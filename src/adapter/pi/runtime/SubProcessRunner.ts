/**
 * @intent ISubProcessRunner 的 pi 特有实现。支持两种运行模式：
 * 1) RPC 进程池模式（优先）——委托 RpcProcessPool，进程按 agent 名称动态按需初始化。
 * 2) Spawn 一次性模式（fallback）——spawn('pi --mode json') 用完即弃。
 * 不限定 agent 类型——通过 agent 名称（SUB-SKILL.md name）动态匹配池进程。
 * @location adapter/pi/runtime/
 */

import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir, platform } from 'node:os';
import { SCOPE_SKIP_ENV } from '../../../data/services/scope/policy';
import type { ISubProcessRunner, SubProcessRunParams, SubProcessChainStep, SubProcessChainResult } from '../../../data/repositories/ISubProcessRunner';
import type { AgentRunResult } from '../../../data/entities/AgentRunResult';
import type { AgentUsage } from '../../../data/entities/AgentUsage';
import { RpcProcessPool } from './RpcProcessPool';

// ==================== 工具函数 ====================

function extractText(msg: any): string {
  if (!msg?.content) return '';
  if (typeof msg.content === 'string') return msg.content;
  if (Array.isArray(msg.content)) {
    return msg.content
      .filter((c: any) => c.type === 'text')
      .map((c: any) => c.text)
      .join('\n');
  }
  return '';
}

function piInvocation(args: string[]): { command: string; args: string[] } {
  const currentScript = process.argv[1];
  if (currentScript && existsSync(currentScript)) {
    return { command: process.execPath, args: [currentScript, ...args] };
  }
  return { command: 'pi', args };
}

// ==================== Runner 实现 ====================

export class SubProcessRunner implements ISubProcessRunner {
  private pool: RpcProcessPool | null;

  /**
   * @param pool 可选。有池时优先用池，无池时 fallback 到 spawn 一次性模式。
   */
  constructor(pool?: RpcProcessPool) {
    this.pool = pool ?? null;
  }

  /**
   * 运行单个 agent 任务。
   * 优先使用 RPC 进程池，不可用时 fallback 到 spawn 一次性模式。
   */
  async run(params: SubProcessRunParams): Promise<AgentRunResult> {
    // 优先用 RPC 进程池（按 agent 名称直接匹配，无硬编码映射）
    if (this.pool) {
      try {
        const result = await this.pool.runTask({
          agent: params.agentName,
          task: params.task,
          context: params.context,
          timeoutMs: params.timeoutMs,
          skipExts: params.skipExts,
          onEvent: params.onEvent,
        });
        return { ...result, durationMs: result.durationMs };
      } catch (err: any) {
        // RPC 执行失败，fallback 到 spawn
        console.warn(`[SubProcessRunner] RPC 执行失败，fallback 到 spawn: ${err.message}`);
      }
    }

    // Fallback：spawn 一次性模式（原来的逻辑）
    return this.spawnOnce(params);
  }

  /**
   * 链式执行多步任务。
   * 需要 RPC 进程池，无池时抛错。
   */
  async runChain(steps: SubProcessChainStep[]): Promise<SubProcessChainResult> {
    if (!this.pool) {
      throw new Error('runChain 需要 RPC 进程池，但未提供');
    }

    return this.pool.runChain(
      steps.map((step) => ({ agent: step.agent, task: step.task })),
    );
  }

  // ==================== Spawn 一次性模式（Fallback） ====================

  private async spawnOnce(params: SubProcessRunParams): Promise<AgentRunResult> {
    const started = Date.now();

    const promptParts = [params.systemPrompt];
    if (params.context) {
      promptParts.push(`\n\n## 上下文\n${params.context}`);
    }

    const tmpDir = await mkdtemp(join(homedir(), 'agent-'));
    const systemFile = join(tmpDir, 'system.md');
    const taskFile = join(tmpDir, 'task.md');

    try {
      await writeFile(systemFile, promptParts.join(''), 'utf-8');
      await writeFile(taskFile, `Task: ${params.task}\n`, 'utf-8');

      const args: string[] = [
        '--mode', 'json',
        '-p',
        '--no-session',
      ];
      if (params.model) args.push('--model', params.model);
      if (params.tools && params.tools.length > 0) {
        args.push('--tools', params.tools.join(','));
      }
      args.push('--append-system-prompt', systemFile);
      args.push(`@${taskFile}`);

      const isWindows = platform() === 'win32';
      const pi = piInvocation(args);
      let timedOut = false;

      // scope：子 agent 跳过指定扩展的拦截
      const childEnv: NodeJS.ProcessEnv = { ...process.env };
      if (params.skipExts && params.skipExts.length > 0) {
        childEnv[SCOPE_SKIP_ENV] = params.skipExts.join(',');
      }

      return await new Promise<AgentRunResult>((resolve) => {
        const child = spawn(pi.command, pi.args, {
          cwd: params.cwd,
          shell: isWindows,
          stdio: ['ignore', 'pipe', 'pipe'],
          env: childEnv,
        });

        let stdout = '';
        let stderr = '';
        const outputParts: string[] = [];
        const messages: unknown[] = [];
        const usage: AgentUsage = { input: 0, output: 0, cost: 0, turns: 0 };
        let resolvedModel: string | undefined;
        let stopReason: string | undefined;
        let errorMessage: string | undefined;

        const timer = setTimeout(() => {
          timedOut = true;
          child.kill('SIGTERM');
          setTimeout(() => {
            if (!child.killed) child.kill('SIGKILL');
          }, 5000).unref();
        }, params.timeoutMs);
        timer.unref();

        let buf = '';
        child.stdout.on('data', (data: Buffer) => {
          buf += data.toString();
          const lines = buf.split('\n');
          buf = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const ev = JSON.parse(line) as any;
              if (ev.type === 'message_end' && ev.message) {
                messages.push(ev.message);
                if (ev.message.role === 'assistant') {
                  const m = ev.message;
                  usage.turns++;
                  if (m.usage) {
                    usage.input += m.usage.input ?? 0;
                    usage.output += m.usage.output ?? 0;
                    usage.cost += m.usage.cost?.total ?? 0;
                  }
                  if (m.model) resolvedModel = m.model;
                  if (m.stopReason) stopReason = m.stopReason;
                  if (m.errorMessage) errorMessage = m.errorMessage;
                  const text = extractText(m);
                  if (text) outputParts.push(text);
                }
              }
              if (ev.type === 'tool_result_end' && ev.message) {
                messages.push(ev.message);
              }
            } catch {
              // 非 JSON 行忽略
            }
          }
        });

        child.stderr.on('data', (data: Buffer) => {
          stderr += data.toString();
        });

        child.on('close', (code) => {
          clearTimeout(timer);
          const exitCode = timedOut ? -1 : (code ?? -1);
          resolve({
            agent: params.agentName,
            exitCode,
            output: outputParts.join('\n').slice(0, 50 * 1024),
            error: timedOut
              ? `超时(${params.timeoutMs}ms)`
              : stderr.slice(0, 4 * 1024) || undefined,
            usage,
            model: resolvedModel,
            durationMs: Date.now() - started,
            messages: messages.length > 0 ? messages : undefined,
            stopReason,
            errorMessage,
          });
        });

        child.on('error', (err) => {
          clearTimeout(timer);
          resolve({
            agent: params.agentName,
            exitCode: -1,
            output: '',
            error: `spawn 失败: ${err.message}`,
            usage: { input: 0, output: 0, cost: 0, turns: 0 },
            durationMs: Date.now() - started,
          });
        });
      });
    } finally {
      await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
