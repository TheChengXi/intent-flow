/**
 * @intent pi 扩展入口。仅做注册编排，不包含实现逻辑。
 * 委托给 tools/（工具）、commands/（斜杠命令）和 tui/（TUI 组件）。
 * 进程池采用按需初始化，session_shutdown 时清理。
 * Phase 2 新增：AgentRunTracker + SubAgentView（子 agent 监控视图）。
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { DIContainer } from './DIContainer';
import { StopTimeCommand } from './commands/StopTimeCommand';
import { ClearSubagentCacheCommand } from './commands/ClearSubagentCacheCommand';
import { openSubAgentView } from './tui/SubAgentView';

export default function (pi: ExtensionAPI) {
  const container = DIContainer.getInstance();
  const tracker = container.agentTracker;
  let agentViewOpen = false;

  // ── session 生命周期 ──
  pi.on('session_start', async (_event, ctx) => {
    tracker.subscribe(() => {
      // 自动弹出：tracker 新增运行中记录 → 弹 SubAgentView
      if (!agentViewOpen && tracker.getRunningRuns().length > 0 && ctx.mode === 'tui') {
        agentViewOpen = true;
        openSubAgentView(ctx, tracker).finally(() => {
          agentViewOpen = false;
        });
      }
    });
  });

  pi.on('session_shutdown', async (_event) => {
    await container.rpcPool.shutdown();
  });

  // ── 工具注册 ──
  container.spawnAgentTool.register(pi);
  container.listAgentsTool.register(pi);
  container.toolAccessGuard.register(pi);

  // ── 斜杠命令注册 ──
  new StopTimeCommand().register(pi, container);
  new ClearSubagentCacheCommand().register(pi);

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
