/**
 * @intent
 * pi 扩展入口。仅做注册编排，不包含实现逻辑。注册：AgentCommTools（单工具 agent_chat——发消息并等待下一轮，自动分派 response/prompt 通道）、ListAgentsTool、ToolAccessGuard、ClearSubagentCacheCommand、GuardToggleCommand、/sub-agent 命令；session_start 订阅 tracker 自动弹出 SubAgentView；session_shutdown 清理进程池。spawn_agent 及多工具形态已收敛移除。
 * 边界：不直接实例化业务组件（经 DIContainer）；进程池按需初始化；IFLOW_CHILD=1 时只注册 ask_parent 后立即返回（子进程模式）。
 * 验收条件：
 * - 扩展加载后 agent_chat 可被主 agent 调用（无 request/await/reply/close/send 残留）
 * - 无 spawnAgentTool 注册残留
 */


import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { DIContainer } from './DIContainer';
import { ClearSubagentCacheCommand } from './commands/ClearSubagentCacheCommand';
import { GuardToggleCommand } from './commands/GuardToggleCommand';
import { openSubAgentView } from './tui/SubAgentView';
import { registerChildTools } from './child/ChildExtension';

export default function (pi: ExtensionAPI) {
  // ── 子进程模式（RpcProcessPool spawn 时注入 --extension + IFLOW_CHILD=1）──
  // 只注册 ask_parent 通道，不加载任何主进程逻辑。
  if (process.env.IFLOW_CHILD === '1') {
    registerChildTools(pi);
    return;
  }

  const container = DIContainer.getInstance();
  const tracker = container.agentTracker;
  let agentViewOpen = false;

  // ── session 生命周期 ──
  pi.on('session_start', async (_event, ctx) => {
    let userDismissed = false;  // 用户主动关闭后不再自动弹

    tracker.subscribe(() => {
      // 自动弹出：tracker 新增运行中记录 → 弹 SubAgentView
      // 用户主动关闭后不再自动弹（可手动 /sub-agent 打开）
      if (!agentViewOpen && tracker.getRunningRuns().length > 0 && ctx.mode === 'tui' && !userDismissed) {
        agentViewOpen = true;
        openSubAgentView(ctx, tracker, {
          onUserDismiss: () => { userDismissed = true; },
        }).finally(() => {
          agentViewOpen = false;
        });
      }
    });
  });

  pi.on('session_shutdown', async (_event) => {
    await container.rpcPool.shutdown();
  });

  // ── 工具注册 ──
  container.agentCommTools.register(pi);
  container.listAgentsTool.register(pi);
  container.toolAccessGuard.register(pi);

  // ── 斜杠命令注册 ──
  new ClearSubagentCacheCommand().register(pi);
  new GuardToggleCommand(container.guardToggleService).register(pi);

  // ── /sub-agent 命令 ──
  pi.registerCommand('sub-agent', {
    description: '打开子 agent 监控视图，查看运行状态、实时日志和详情',
    handler: async (_args, ctx) => {
      if (ctx.mode !== 'tui') {
        ctx.ui.notify('/sub-agent 仅在 TUI 模式可用', 'error');
        return;
      }
      await openSubAgentView(ctx, tracker);
    },
  });
}
