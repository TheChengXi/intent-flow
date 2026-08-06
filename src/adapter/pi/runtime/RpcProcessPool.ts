/**
 * @intent
 * 常驻子进程池管理（pi --mode rpc）。职责收敛为两层：
 * 1) 进程生命周期：按需 spawn（注入 --extension 子进程轻量通道 + IFLOW_CHILD 环境变量）、
 *    crash 自动重建、model/skipExts 进程级参数变化时重启、shutdown 销毁。
 * 2) 消息级通道（委托 MessageRouter 调度）：sendMessage（prompt，busy 时入队串行化）、
 *    awaitMessage（等待者注册，排队提问优先消费）、replyMessage（extension_ui_response 写回）、
 *    resetSession（new_session，执行中拒绝）。
 * 事件流（stdout JSON-L）→ 当前任务 onEvent（可视化）→ router.handleLine 路由 → 投递等待者；
 * agent_end 后自动启动队列中下一个任务。runTask/runChain 已移除。
 *
 * 边界：同一 agent 并发消息按 FIFO 串行（单会话模型，修复 pending 覆盖丢消息 bug）；
 * 等待超时只解除等待者（任务继续，结果可被后续 await 获取）；进程 exit 时该 agent
 * 全部等待者 resolve error 并 resetChannel；无等待者的结果投递被丢弃（会话历史保留）。
 *
 * 验收条件：
 * - 并发 send 同一 agent：消息不丢失，按序执行，各自 await 拿到对应结果
 * - 提问（ask_parent）→ 投递 question → reply 写回 → 继续 → result 全链路正确
 * - 进程 crash 后自动重建，排队任务被 error 终止，状态不悬挂
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir, platform } from 'node:os';
import type { IAgentRepository } from '../../../application/services/agentRepository';
import type { AgentAwaitResult, AgentRunResult, AgentUsage } from '../../../application/services/IAgentMessagingService';
import { SCOPE_SKIP_ENV } from '../../../application/services/IAccessPolicyService';
import { MessageRouterImpl } from './MessageRouter';

// ==================== 类型定义 ====================

/** 子进程内部状态 */
interface ManagedProcess {
  process: ChildProcess;
  agentName: string;
  state: 'idle' | 'busy';
  tmpDir: string;       // 临时目录（含 system prompt 文件）
  buffer: string;       // stdout 累积缓冲区
  skipExts?: string[];  // spawn 时注入的 PI_EXT_SKIP 白名单
  model?: string;       // spawn 时的模型覆盖（变化时重启进程）
}

/** 等待者（awaitMessage 注册的 Promise 持有者） */
interface Waiter {
  resolve: (result: AgentAwaitResult) => void;
  timer: ReturnType<typeof setTimeout>;
  released: boolean;
}

// ==================== 进程池 ====================

export class RpcProcessPool {
  private processes: Map<string, ManagedProcess> = new Map();
  private router = new MessageRouterImpl();
  /** agent → 当前执行任务 id */
  private currentTaskIds = new Map<string, string>();
  /** taskId → 等待者（Promise resolve + 超时 timer） */
  private waiters = new Map<string, Waiter>();
  /** taskId → 事件流回调（可视化） */
  private taskEvents = new Map<string, (event: Record<string, unknown>) => void>();
  private agentRepo: IAgentRepository;
  private baseModel?: string;
  private taskCounter = 0;

  constructor(agentRepo: IAgentRepository, baseModel?: string) {
    this.agentRepo = agentRepo;
    this.baseModel = baseModel;
  }

  // ==================== 公开 API ====================

  /**
   * 预热指定 agent 的常驻进程。不传 agentNames 时自动扫描全部 sub-skill。
   * 已有进程的 agent 跳过（幂等）。
   */
  async warmUp(agentNames?: string[]): Promise<void> {
    if (!agentNames) {
      const { agents } = await this.agentRepo.discoverAll('sub_skill');
      agentNames = agents.map((a) => a.name);
    }

    const errors: string[] = [];

    for (const name of agentNames) {
      if (this.processes.has(name)) continue; // 已有进程，跳过（幂等）
      try {
        await this.spawnProcess(name);
      } catch (err: any) {
        errors.push(`${name}: ${err.message}`);
      }
    }

    if (errors.length > 0) {
      throw new Error(`预热失败 (${errors.length}/${agentNames.length}):\n${errors.join('\n')}`);
    }
  }

  /**
   * 发送消息到指定 agent 会话（非阻塞），自动分派通道：
   * - 该 agent 正在等待回复（awaitingReply）→ 消息作为回答走 extension_ui_response 通道
   * - 否则 → 新消息走 prompt 通道（进程忙碌时入队，FIFO 串行，不丢失）
   */
  async sendMessage(
    agent: string,
    message: string,
    options?: { skipExts?: string[]; model?: string; onEvent?: (event: Record<string, unknown>) => void },
  ): Promise<void> {
    // ── 通道分派：等待回复中 → response 通道 ──
    const awaitingRequestId = this.router.getAwaitingReply(agent);
    if (awaitingRequestId) {
      const managed = this.processes.get(agent);
      if (!managed || managed.process.killed || managed.process.exitCode !== null) {
        throw new Error(`agent 进程不存在: ${agent}`);
      }
      const cmd = JSON.stringify({ type: 'extension_ui_response', id: awaitingRequestId, value: message }) + '\n';
      managed.process.stdin!.write(cmd);
      this.router.clearAwaitingReply(agent);
      return;
    }

    // ── 新消息 → prompt 通道（入队串行） ──
    const managed = await this.ensureProcess(agent, options?.skipExts, options?.model);
    const taskId = `${agent}-${Date.now()}-${this.taskCounter++}`;
    if (options?.onEvent) this.taskEvents.set(taskId, options.onEvent);

    const start = this.router.enqueue(agent, { id: taskId, message, waiterBound: false });
    if (!start) return; // 已排队，当前任务完成后自动启动

    managed.state = 'busy';
    this.currentTaskIds.set(agent, taskId);
    const cmd = JSON.stringify({ type: 'prompt', message }) + '\n';
    managed.process.stdin!.write(cmd);
  }

  /**
   * 阻塞等待下一条消息（question/result/timeout/error）。
   * 排队提问优先消费；等待者绑定当前任务（提问续接）或队首任务（并发 await 排队）。
   * 超时只解除等待者，任务继续执行（结果可被后续 await 获取）。
   */
  async awaitMessage(agent: string, timeoutMs: number = 10 * 60 * 1000): Promise<AgentAwaitResult> {
    // 排队中的提问优先（无人 await 期间到达的提问）
    const queued = this.router.dequeuePending(agent);
    if (queued) {
      this.router.setAwaitingReply(agent, queued.requestId);
      return queued;
    }

    const bound = this.router.bindWaiter(agent);
    if (!bound) {
      throw new Error(`没有进行中的任务可等待: ${agent}（请先 agent_request）`);
    }

    return new Promise<AgentAwaitResult>((resolve) => {
      const timer = setTimeout(() => {
        const w = this.waiters.get(bound.taskId);
        if (w && !w.released) {
          w.released = true;
          this.waiters.delete(bound.taskId);
          this.router.releaseWaiter(agent, bound.taskId);
          resolve({ kind: 'timeout' });
        }
      }, timeoutMs);
      timer.unref();
      this.waiters.set(bound.taskId, { resolve, timer, released: false });
    });
  }

  /**
   * 回答子 agent 的提问（写回 extension_ui_response）。
   * requestId 取该 agent 队列中最早的未回复提问（串行模型下同时只有一个待回复提问）。
   */
  async replyMessage(agent: string, answer: string): Promise<void> {
    const managed = this.processes.get(agent);
    if (!managed || managed.process.killed || managed.process.exitCode !== null) {
      throw new Error(`agent 进程不存在: ${agent}（请先 agent_request）`);
    }
    const requestId = this.router.getPendingRequestId(agent);
    if (!requestId) {
      throw new Error(`没有待回复的提问: ${agent}（请先 agent_await 收到提问）`);
    }
    const cmd = JSON.stringify({ type: 'extension_ui_response', id: requestId, value: answer }) + '\n';
    managed.process.stdin!.write(cmd);
    this.router.removeQuestion(agent, requestId);
  }

  /**
   * 销毁所有进程。/reload / 项目切换时调用。
   */
  async shutdown(): Promise<void> {
    // 所有等待者 resolve error（exit 事件兜底，这里主动清理）
    for (const [, w] of this.waiters) {
      if (!w.released) {
        w.released = true;
        clearTimeout(w.timer);
        w.resolve({ kind: 'error', message: 'RPC 进程池已关闭' });
      }
    }
    this.waiters.clear();
    this.currentTaskIds.clear();
    this.taskEvents.clear();

    const cleanupPromises: Promise<void>[] = [];
    for (const [, managed] of this.processes) {
      cleanupPromises.push(this.killProcess(managed));
    }
    await Promise.all(cleanupPromises);
    this.processes.clear();
  }

  /**
   * 获取当前进程池状态摘要，用于 UI 展示/调试。
   */
  getProcessSummary(): Array<{ agentName: string; state: 'idle' | 'busy' }> {
    const summary: Array<{ agentName: string; state: 'idle' | 'busy' }> = [];
    for (const [, managed] of this.processes) {
      summary.push({
        agentName: managed.agentName,
        state: managed.state,
      });
    }
    return summary;
  }

  /** 获取当前 busy 状态的子进程数量 */
  getBusyCount(): number {
    let count = 0;
    for (const [, managed] of this.processes) {
      if (managed.state === 'busy') count++;
    }
    return count;
  }

  // ==================== 进程管理 ====================

  /** 确保进程存在且可用，否则自动重建；skipExts/model 变化时重启 */
  private async ensureProcess(agentName: string, skipExts?: string[], model?: string): Promise<ManagedProcess> {
    const managed = this.processes.get(agentName);
    if (managed && !managed.process.killed && managed.process.exitCode === null) {
      // 进程级参数变化 → 重启进程
      if (skipExts && managed.skipExts?.join(',') !== skipExts.join(',')) {
        await this.killProcess(managed);
        this.processes.delete(agentName);
        return this.spawnProcess(agentName, skipExts, model);
      }
      if (model && managed.model !== model) {
        await this.killProcess(managed);
        this.processes.delete(agentName);
        return this.spawnProcess(agentName, skipExts, model);
      }
      return managed;
    }

    // 进程不存在或已死，自动重建
    return this.spawnProcess(agentName, skipExts, model);
  }

  /** 启动一个 agent 子进程 */
  private async spawnProcess(agentName: string, skipExts?: string[], model?: string): Promise<ManagedProcess> {
    // 查找 agent 定义
    const agentDef = await this.agentRepo.findByName(agentName, 'sub_skill');
    if (!agentDef) {
      throw new Error(`未找到 agent 定义: "${agentName}"`);
    }

    // 写 system prompt 到临时文件
    const tmpDir = await mkdtemp(join(tmpdir(), 'iflow-rpc-'));
    const sysPromptFile = join(tmpDir, 'system.md');
    await writeFile(sysPromptFile, agentDef.systemPrompt, 'utf-8');

    // 构造启动参数
    const args: string[] = [
      '--mode', 'rpc',
      '--name', agentName,
      '--append-system-prompt', sysPromptFile,
    ];
    const resolvedModel = model || agentDef.model || this.baseModel;
    if (resolvedModel) {
      args.push('--model', resolvedModel);
    }
    if (agentDef.tools && agentDef.tools.length > 0) {
      args.push('--tools', agentDef.tools.join(','));
    }
    // 子进程轻量通道：加载同一扩展 bundle，IFLOW_CHILD 分支只注册 ask_parent
    if (typeof __filename === 'string' && existsSync(__filename)) {
      args.push('--extension', __filename);
    }

    // Windows 上 pi 是 .cmd，必须 shell: true
    const isWindows = platform() === 'win32';
    const pi = this.piInvocation(args);

    // scope：子 agent 跳过指定扩展的拦截；IFLOW_CHILD 标记子进程模式
    const childEnv: NodeJS.ProcessEnv = { ...process.env, IFLOW_CHILD: '1' };
    if (skipExts && skipExts.length > 0) {
      childEnv[SCOPE_SKIP_ENV] = skipExts.join(',');
    }

    const child = spawn(pi.command, pi.args, {
      cwd: process.cwd(),
      shell: isWindows,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: childEnv,
    });

    const managed: ManagedProcess = {
      process: child,
      agentName,
      state: 'idle',
      tmpDir,
      buffer: '',
      skipExts,
      model: resolvedModel,
    };

    // stdout 处理：按 \n 分割，逐行解析 JSON-L
    child.stdout!.on('data', (data: Buffer) => {
      managed.buffer += data.toString();
      const lines = managed.buffer.split('\n');
      // 保留最后一段不完整的行
      managed.buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        this.handleEvent(agentName, trimmed);
      }
    });

    // stderr 转发（仅调试）
    child.stderr!.on('data', (data: Buffer) => {
      process.stderr.write(`[rpc:${agentName}] ${data}`);
    });

    // 进程退出处理
    child.on('exit', (code, signal) => {
      // 清理临时目录
      rm(managed.tmpDir, { recursive: true, force: true }).catch(() => {});

      // 该 agent 全部等待者 resolve error，任务队列作废（下个 send 重建进程开新上下文）
      const failedPrefix = `${agentName}-`;
      for (const [taskId, w] of this.waiters) {
        if (taskId.startsWith(failedPrefix) && !w.released) {
          w.released = true;
          clearTimeout(w.timer);
          w.resolve({
            kind: 'error',
            message: signal ? `进程被信号终止: ${signal}` : `进程异常退出 (code=${code})`,
          });
        }
      }
      for (const [taskId] of this.waiters) {
        if (taskId.startsWith(failedPrefix)) this.waiters.delete(taskId);
      }
      this.router.resetChannel(agentName);
      this.currentTaskIds.delete(agentName);

      // 标记进程已死，下次使用时会自动重建
      managed.state = 'idle';
    });

    this.processes.set(agentName, managed);
    return managed;
  }

  /** 销毁单个进程 */
  private async killProcess(managed: ManagedProcess): Promise<void> {
    if (!managed.process.killed) {
      managed.process.kill('SIGTERM');
      // 给 3 秒优雅退出
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          if (!managed.process.killed) managed.process.kill('SIGKILL');
          resolve();
        }, 3000);
        managed.process.on('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }
    // 清理临时文件
    await rm(managed.tmpDir, { recursive: true, force: true }).catch(() => {});
  }

  // ==================== 事件处理 ====================

  /** 处理一行 JSON-L 事件：可视化流 → 路由 → 投递 → 队列推进 */
  private handleEvent(agentName: string, line: string): void {
    let event: any;
    try {
      event = JSON.parse(line);
    } catch {
      return; // 非 JSON 行忽略
    }

    const taskId = this.currentTaskIds.get(agentName);

    // 中间事件流（可视化 / tracker 推送）
    if (taskId) {
      this.taskEvents.get(taskId)?.(event);
    }

    const msg = this.router.handleLine(agentName, line);
    if (!msg) return;

    // 投递给当前任务的等待者
    if (taskId) {
      const w = this.waiters.get(taskId);
      if (w && !w.released) {
        w.released = true;
        clearTimeout(w.timer);
        this.waiters.delete(taskId);
        w.resolve(msg);
        // 提问投递后：记录等待回复标记（通道分派依据）并释放槽位（可续接 await 重新绑定）
        if (msg.kind === 'question') {
          this.router.setAwaitingReply(agentName, msg.requestId);
          this.router.releaseWaiter(agentName, taskId);
          this.router.removeQuestion(agentName, msg.requestId);
        }
      }
      // 无等待者：提问留在 pendingQuestions 待 dequeuePending 消费；结果丢弃（会话历史保留）
    }

    // agent_end：任务结束，启动队列中下一个任务
    if (msg.kind === 'result') {
      if (taskId) this.taskEvents.delete(taskId);
      this.currentTaskIds.delete(agentName);

      const next = this.router.taskFinished(agentName);
      if (next) {
        const managed = this.processes.get(agentName);
        if (managed && !managed.process.killed && managed.process.exitCode === null) {
          managed.state = 'busy';
          this.currentTaskIds.set(agentName, next.id);
          const cmd = JSON.stringify({ type: 'prompt', message: next.message }) + '\n';
          managed.process.stdin!.write(cmd);
        }
      } else {
        const managed = this.processes.get(agentName);
        if (managed) managed.state = 'idle';
      }
    }
  }

  // ==================== 工具函数 ====================

  /** 构造 pi 调用命令（兼容 Windows） */
  private piInvocation(args: string[]): { command: string; args: string[] } {
    const currentScript = process.argv[1];
    if (currentScript && existsSync(currentScript)) {
      return { command: process.execPath, args: [currentScript, ...args] };
    }
    return { command: 'pi', args };
  }
}

// 类型 re-export（兼容外部引用方）
export type { AgentRunResult, AgentUsage };
