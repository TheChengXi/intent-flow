/**
 * @intent /clear-subagent-cache 命令。清理子 agent 运行时遗留的临时目录。
 * 目录以 cdd-agent- 或 cdd-rpc- 开头，位于系统临时目录下。
 * 正常情况下进程退出时会自动清理，此命令用于手动清理残留。
 */

import { readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

export class ClearSubagentCacheCommand {
  register(pi: any): void {
    pi.registerCommand('clear-subagent-cache', {
      description: '清理子 agent 残留的临时目录（cdd-agent-* / cdd-rpc-*）',
      handler: async (_args: string, ctx: any) => {
        const tmpBase = tmpdir();
        let entries: string[];

        try {
          entries = await readdir(tmpBase);
        } catch {
          ctx.ui.notify('无法读取临时目录', 'error');
          return;
        }

        const targets = entries.filter(
          (name) => name.startsWith('cdd-agent-') || name.startsWith('cdd-rpc-'),
        );

        if (targets.length === 0) {
          ctx.ui.notify('没有需要清理的子 agent 缓存', 'info');
          return;
        }

        let deleted = 0;
        let failed = 0;

        for (const name of targets) {
          try {
            await rm(join(tmpBase, name), { recursive: true, force: true });
            deleted++;
          } catch {
            failed++;
          }
        }

        const msg = `清理了 ${deleted} 个子 agent 临时目录` +
          (failed > 0 ? `，${failed} 个无法删除（可能正在使用）` : '');
        ctx.ui.notify(msg, deleted > 0 ? 'info' : 'warn');
      },
    });
  }
}
