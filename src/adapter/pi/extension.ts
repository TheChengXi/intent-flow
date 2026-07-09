/**
 * @intent pi 扩展入口。仅做注册编排，不包含实现逻辑。
 * 委托给 tools/（工具）和 commands/（斜杠命令）。
 * 进程池采用按需初始化，session_shutdown 时清理。
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { DIContainer } from './DIContainer';
import { StopTimeCommand } from './commands/StopTimeCommand';
import { SubSkillCommand } from './commands/SubSkillCommand';

export default function (pi: ExtensionAPI) {
  const container = DIContainer.getInstance();

  // ── session 生命周期 ──
  pi.on('session_start', async (_event, ctx) => {
    ctx.ui.setWidget('subagent', ['── 子进程池 ──', '待命中 (暂无活跃子进程)'], { placement: 'aboveEditor' });
  });

  pi.on('session_shutdown', async (_event, ctx) => {
    await container.rpcPool.shutdown();
    ctx.ui.setWidget('subagent', undefined);
  });

  // ── 工具注册 ──
  container.spawnAgentTool.register(pi);
  container.subagentTool.register(pi);

  // ── 斜杠命令注册 ──
  new StopTimeCommand().register(pi, container);
  new SubSkillCommand().register(pi, container);
}
