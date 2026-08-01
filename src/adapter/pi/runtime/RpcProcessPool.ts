/**
 * @intent 常驻子进程池管理。通过 pi --mode rpc 启动 agent 子进程，
 * 保持 stdin/stdout 双向 JSON-L 通信。提供 warmUp()/runTask()/runChain()/shutdown() 四个核心方法。
 * 不限定 agent 类型——通过 agent 名称（SUB-SKILL.md name）动态辨识，按需初始化。
 * 支持进程 crash 自动重建。
 * @location adapter/pi/runtime/
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir, platform } from 'node:os';
import type { IAgentRepository } from '../../../application/services/agentRepository';
import type { AgentRunResult, AgentUsage } from '../../../application/services/ISubProcessRunner';
import { SCOPE_SKIP_ENV } from '../../../application/services/IAccessPolicyService';

// ==================== 类型定义 ====================

/** 子进程内部状态 */
interface ManagedProcess {
  process: ChildProcess;
  agentName: string;
  state: 'idle' | 'busy';
  tmpDir: string;       // 临时目录（含 system prompt 文件）
  buffer: string;       // stdout 累积缓冲区
  skipExts?: string[];  // spawn 时注入的 PI_EXT_SKIP 白名单
}

/** 等待中的任务（Promise 的 resolve/reject 持有者） */
interface PendingTask {
  resolve: (result: AgentRunResult) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  lines: string[];      // 累积的事件行
  onEvent?: (event: Record<string, unknown>) => void;  // 中间事件回调
}

// ==================== 进程池 ====================

export class RpcProcessPool {
  private processes: Map<string, ManagedProcess> = new Map();
  private pending: Map<string, PendingTask> = new Map();
  private agentRepo: IAgentRepository;
  private baseModel?: string;

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
   * 向指定 agent 下发任务，返回结构化结果。
   * 复用已有进程，不创建新进程。
   */
  async runTask(params: {
    agent: string;
    task: string;
    context?: string;
    timeoutMs?: number;
    skipExts?: string[];
    onEvent?: (event: Record<string, unknown>) => void;
  }): Promise<AgentRunResult> {
    const managed = await this.ensureProcess(params.agent, params.skipExts);
    const timeout = params.timeoutMs ?? 10 * 60 * 1000;

    // 构造任务文本
    let taskText = params.task;
    if (params.context) {
      taskText = `${taskText}\n\n## 上下文\n\n${params.context}`;
    }

    managed.state = 'busy';

    return new Promise<AgentRunResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(params.agent);
        managed.state = 'idle';
        // 超时：SIGTERM → 5s → SIGKILL
        managed.process.kill('SIGTERM');
        setTimeout(() => {
          if (!managed.process.killed) managed.process.kill('SIGKILL');
        }, 5000).unref();
        reject(new Error(`RPC 任务超时 (${timeout}ms): ${params.agent}`));
      }, timeout);

      this.pending.set(params.agent, {
        resolve,
        reject,
        timer,
        lines: [],
        onEvent: params.onEvent,
      });

      // 发送 prompt 命令
      const cmd = JSON.stringify({ type: 'prompt', message: taskText }) + '\n';
      managed.process.stdin!.write(cmd);
    }).finally(() => {
      managed.state = 'idle';
    });
  }

  /**
   * Chain 模式：依次执行多个步骤，自动传递 context。
   * 内部调用 runTask，复用进程池。
   */
  async runChain(steps: Array<{
    agent: string;
    task: string;
  }>): Promise<{
    results: AgentRunResult[];
    failedIndex: number | null;
  }> {
    let prevOutput = '';
    const results: AgentRunResult[] = [];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      // 替换 {previous} 占位符
      const task = step.task.replace(/\{previous\}/g, prevOutput);

      const result = await this.runTask({
        agent: step.agent,
        task: task,
      });

      results.push(result);

      if (result.exitCode !== 0) {
        return { results, failedIndex: i };
      }

      prevOutput = result.output;
    }

    return { results, failedIndex: null };
  }

  /**
   * 销毁所有进程。/reload / 项目切换时调用。
   */
  async shutdown(): Promise<void> {
    // 先清理所有 pending 任务
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(new Error('RPC 进程池已关闭'));
    }
    this.pending.clear();

    // 销毁所有进程
    const cleanupPromises: Promise<void>[] = [];
    for (const [, managed] of this.processes) {
      cleanupPromises.push(this.killProcess(managed));
    }
    await Promise.all(cleanupPromises);
    this.processes.clear();
  }

  /**
   * 获取当前进程池状态摘要，用于 UI 展示/调试。
   * 返回每个子进程的 agent 名和状态（idle/busy）。
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

  /** 确保进程存在且可用，否则自动重建（按需初始化） */
  private async ensureProcess(agentName: string, skipExts?: string[]): Promise<ManagedProcess> {
    const managed = this.processes.get(agentName);
    if (managed && !managed.process.killed && managed.process.exitCode === null) {
      // skipExts 变了 → 重启进程
      if (skipExts && managed.skipExts?.join(',') !== skipExts.join(',')) {
        await this.killProcess(managed);
        this.processes.delete(agentName);
        return this.spawnProcess(agentName, skipExts);
      }
      return managed;
    }

    // 进程不存在或已死，自动重建
    return this.spawnProcess(agentName, skipExts);
  }

  /** 启动一个 agent 子进程 */
  private async spawnProcess(agentName: string, skipExts?: string[]): Promise<ManagedProcess> {
    // 查找 agent 定义
    const agentDef = await this.agentRepo.findByName(agentName, 'sub_skill');
    if (!agentDef) {
      throw new Error(`未找到 agent 定义: "${agentName}"`);
    }

    // 写 system prompt 到临时文件
    const tmpDir = await mkdtemp(join(tmpdir(), 'cdd-rpc-'));
    const sysPromptFile = join(tmpDir, 'system.md');
    await writeFile(sysPromptFile, agentDef.systemPrompt, 'utf-8');

    // 构造启动参数
    const args: string[] = [
      '--mode', 'rpc',
      '--name', agentName,
      '--append-system-prompt', sysPromptFile,
    ];
    if (this.baseModel) {
      args.push('--model', this.baseModel);
    }
    if (agentDef.model) {
      args.push('--model', agentDef.model);
    }
    if (agentDef.tools && agentDef.tools.length > 0) {
      args.push('--tools', agentDef.tools.join(','));
    }

    // Windows 上 pi 是 .cmd，必须 shell: true
    const isWindows = platform() === 'win32';
    const pi = this.piInvocation(args);

    // scope：子 agent 跳过指定扩展的拦截
    const childEnv: NodeJS.ProcessEnv = { ...process.env };
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

      // 如果有 pending 任务，resolve 为失败
      const pending = this.pending.get(agentName);
      if (pending) {
        clearTimeout(pending.timer);
        this.pending.delete(agentName);
        pending.resolve({
          agent: agentName,
          exitCode: code ?? -1,
          output: pending.lines.join('\n').slice(0, 50 * 1024),
          error: signal
            ? `进程被信号终止: ${signal}`
            : `进程异常退出 (code=${code})`,
          usage: { input: 0, output: 0, cost: 0, turns: 0 },
          durationMs: 0,
        });
      }

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

  /** 处理一行 JSON-L 事件 */
  private handleEvent(agentName: string, line: string): void {
    let event: any;
    try {
      event = JSON.parse(line);
    } catch {
      return; // 非 JSON 行忽略
    }

    const pending = this.pending.get(agentName);
    if (!pending) return; // 没有等待的任务

    // 累积事件行（用于调试 / 展开视图）
    pending.lines.push(line);

    // 中间事件回调（用于可视化流式输出）
    pending.onEvent?.(event);

    // agent_end：任务完成，提取结果
    if (event.type === 'agent_end') {
      clearTimeout(pending.timer);
      this.pending.delete(agentName);

      const result = this.parseAgentEnd(event, agentName);
      pending.resolve(result);
    }
  }

  /** 从 agent_end 事件中提取结构化结果 */
  private parseAgentEnd(event: any, agentName: string): AgentRunResult {
    const messages: unknown[] = event.messages ?? [];
    const usage: AgentUsage = { input: 0, output: 0, cost: 0, turns: 0 };
    let output = '';
    let resolvedModel: string | undefined;
    let stopReason: string | undefined;
    let errorMessage: string | undefined;

    for (const msg of messages as any[]) {
      if (msg.role !== 'assistant') continue;

      usage.turns++;

      // 累加 usage
      if (msg.usage) {
        usage.input += msg.usage.input ?? 0;
        usage.output += msg.usage.output ?? 0;
        usage.cost += msg.usage.cost?.total ?? 0;
      }

      if (msg.model) resolvedModel = msg.model;
      if (msg.stopReason) stopReason = msg.stopReason;
      if (msg.errorMessage) errorMessage = msg.errorMessage;

      // 提取文本内容
      if (msg.content && Array.isArray(msg.content)) {
        for (const part of msg.content) {
          if (part.type === 'text') {
            output += part.text + '\n';
          }
        }
      }
    }

    return {
      agent: agentName,
      exitCode: errorMessage ? 1 : 0,
      output: output.trim().slice(0, 50 * 1024),
      error: errorMessage,
      usage,
      model: resolvedModel,
      durationMs: 0, // 由调用方填充
      messages,
      stopReason,
    };
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
