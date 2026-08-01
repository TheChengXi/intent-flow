/**
 * @intent
 * 工具访问守卫。监听 pi 的 tool_call 事件，拦截 edit/write/bash 操作并弹确认框。 依赖 IAccessPolicyService（application 层接口）做作用域跳过判断（子 agent 环境放行）。 规则以私有方法组织，当前含 confirm-edit 和 confirm-bash 两条规则，后续可扩展。 边界： - shouldSkip("confirm-edit") 返回 true 时直接放行所有操作 - 用户拒绝修改时返回 { block: true, reason } 阻止工具调用 - isDangerousBash 匹配规则与原始 confirm-edit.ts 保持完全一致 验收条件： - edit/write 操作弹确认框，取消则 block - bash 危险命令弹确认框，取消则 block - 应跳过时不弹任何框，直接放行
 */


import type { IAccessPolicyService } from '../../../application/services/IAccessPolicyService';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

export class ToolAccessGuard {
  constructor(private accessPolicy: IAccessPolicyService) {}

  /**
   * @contract
   * 注册 tool_call 事件监听器，在工具调用前进行安全拦截。
   * 输入：pi - ExtensionAPI 实例
   * 副作用：注册 pi.on("tool_call", handler) 监听
   */
  register(pi: ExtensionAPI): void {
    /**
     * @step
     * 1. 调用 pi.on("tool_call", handler) 注册监听
     * 2. handler 内部根据 toolName 分派到对应拦截逻辑
     */
    pi.on('tool_call', async (event, ctx) => {
      // 应跳过时不弹任何框，直接放行
      if (this.accessPolicy.shouldSkip('confirm-edit')) {
        return;
      }

      if (event.toolName === 'edit' || event.toolName === 'write') {
        const path = (event.input as Record<string, unknown>).path ?? '未知文件';
        const ok = await ctx.ui.confirm(
          '⚠️ 确认修改',
          `要修改文件: ${String(path)}\n\n确定允许修改吗？`,
        );
        if (!ok) {
          const reason = await ctx.ui.input(
            '驳回原因',
            '为什么取消这次修改？（可选）',
          );
          const reasonMsg = reason ? `: ${reason}` : '';
          return { block: true, reason: `用户拒绝了修改${reasonMsg}` };
        }
      }

      if (event.toolName === 'bash') {
        const cmd = ((event.input as Record<string, unknown>).command as string) ?? '';
        if (this.isDangerousBash(cmd)) {
          const ok = await ctx.ui.confirm(
            '⚠️ 危险 bash 命令',
            `命令: ${cmd.substring(0, 120)}\n\n确定允许执行吗？`,
          );
          if (!ok) {
            const reason = await ctx.ui.input(
              '驳回原因',
              '为什么取消这次操作？（可选）',
            );
            const reasonMsg = reason ? `: ${reason}` : '';
            return { block: true, reason: `用户拒绝了 bash 命令${reasonMsg}` };
          }
        }
      }
    });
  }

  /**
   * @contract
   * 检测 bash 命令是否涉及文件写入/删除等危险操作。
   * 输入：cmd - bash 命令字符串
   * 输出：boolean - true表示危险命令
   * 规则与原始 confirm-edit.ts 完全一致
   */
  private isDangerousBash(cmd: string): boolean {
    const stripped = cmd.replace(/['"][^'"]*['"]/g, '');
    const patterns = [
      /\brm\s+-r[f]?\b/,           // rm -rf
      /\brm\s+-\w*r\w*/,            // rm -r 递归删除
      /\brmdir\b/,                   // 删除目录
      /\bdel\s+/i,                   // del 删除文件
      /\bremove\s+/i,               // remove
      /\bmv\s+/i,                    // mv 移动/重命名
      /\bcp\s+/i,                    // cp 复制
      /[>]/,                         // > 重定向写入
      /[|]\s*tee\b/,                // | tee 写入
      /\bdd\s+if=/,                 // dd 磁盘操作
      /\bchmod\s+/i,                // 改权限
      /\bchown\s+/i,                // 改所有者
      /\bmkfs\b/i,                   // 格式化
      /\bformat\b/i,                // 格式化
      /\bfdisk\b/i,                  // 分区
      /\bsudo\s+rm\b/i,            // sudo rm
      /:\s*rm\b/i,                   // :; rm 形式
    ];
    return patterns.some(p => p.test(stripped));
  }
}
