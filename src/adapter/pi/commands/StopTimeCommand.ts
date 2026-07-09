/**
 * @intent /stop-time 命令。提供会话级硬停功能：
 * 设置停止标志 → tool_call 拦截后续工具调用 → agent_end 重置标志。
 * 同时感知 RPC 子进程池状态，通知用户当前忙碌子进程。
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import type { DIContainer } from '../DIContainer';

export class StopTimeCommand {
  private stopRequested = false;

  register(pi: ExtensionAPI, container: DIContainer): void {
    // ── /stop-time 命令 handler ──
    pi.registerCommand('stop-time', {
      description: '强制中断当前正在执行的操作，等待工具执行完毕后停止',
      handler: async (_args, ctx) => {
        this.stopRequested = true;

        // 查询子进程状态
        const processes = container.rpcPool.getProcessSummary();
        const busyList = processes.filter((p) => p.state === 'busy');

        let msg = '⏹ 中断信号已发送，等待当前工具执行完毕后停止';
        if (busyList.length > 0) {
          const names = busyList.map((p) => p.agentName).join(', ');
          msg += `\n当前有 ${busyList.length} 个子进程忙碌中: ${names}`;
        }
        ctx.ui.notify(msg, 'info');
      },
    });

    // ── tool_call 拦截：stopRequested 时阻止后续工具调用 ──
    pi.on('tool_call', async (_event, ctx) => {
      if (this.stopRequested) {
        this.stopRequested = false;
        return { block: true, reason: '用户通过 /stop-time 强制中断' };
      }
    });

    // ── agent_end 重置：一轮执行结束后清空标志 ──
    pi.on('agent_end', async () => {
      this.stopRequested = false;
    });
  }
}
