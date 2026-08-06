# ToolAccessGuard.ts

`src/adapter/pi/tools/ToolAccessGuard.ts`

**intent:** 工具访问守卫。监听 pi 的 tool_call 事件，拦截 edit/write/bash 操作并弹确认框。 依赖 IAccessPolicy 做作用域跳过判断（子 agent 环境放行）。 规则以私有方法组织，当前含 confirm-edit 和 confirm-bash 两条规则，后续可扩展。 边界： - shouldSkip("confirm-edit") 返回 true 时直接放行所有操作 - 用户拒绝修改时返回 { block: true, reason } 阻止工具调用 - isDangerousBash 匹配规则与原始 confirm-edit.ts 保持完全一致 验收条件： - edit/write 操作弹确认框，取消则 block - bash 危险命令弹确认框，取消则 block - 应跳过时不弹任何框，直接放行
