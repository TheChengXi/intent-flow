/**
 * @intent
 * /guard-auto 斜杠命令。无参数，每次调用翻转守卫开关状态并 notify 提示当前模式（复用 ClearSubagentCacheCommand 的注册风格）。
 * 提示级别：关闭（进入放行）用 warn 醒目提示；开启（恢复审查）用 info；持久化失败用 error 提示"本次会话已生效"。
 * 边界：handler 内部捕获 toggle() 抛错并 notify error，不向上抛出。
 * 验收条件：
 * - 注册命令名 guard-auto，handler 无参数依赖
 * - 切换成功时 notify 当前模式；持久化失败时 notify error 且不抛异常
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import type { IGuardToggleService } from '../../../application/services/IGuardToggleService';

export class GuardToggleCommand {
  constructor(private guardToggle: IGuardToggleService) {}

  register(pi: ExtensionAPI): void {
    pi.registerCommand('guard-auto', {
      description: '切换工具访问守卫：关闭后 edit/write/bash 不再弹确认框（放行模式）',
      handler: async (_args, ctx) => {
        try {
          const enabled = await this.guardToggle.toggle();
          ctx.ui.notify(
            enabled
              ? '守卫已开启：恢复确认审查'
              : '守卫已关闭：edit/write/bash 不再确认（放行模式）',
            enabled ? 'info' : 'warning',
          );
        } catch {
          ctx.ui.notify('守卫状态写入失败，本次会话已生效', 'error');
        }
      },
    });
  }
}
