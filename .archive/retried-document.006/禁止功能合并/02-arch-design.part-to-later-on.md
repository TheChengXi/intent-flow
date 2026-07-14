# 备忘录 — 后续想法记录

## 想法列表
| 编号 | 想法描述 | 来源（谁/何时提出） | 可能的改动范围 | 备注 |
|------|----------|---------------------|----------------|------|
| L01 | 后续拦截规则增多后，可能需将每条规则抽取为独立策略类（如 `IConfirmEditRule`、`IConfirmBashRule`），注入规则列表到 `ToolAccessGuard` | 用户/设计阶段 — 用户明确说后续会多出更多拦截规则 | `ToolAccessGuard` 内部重构，可能新增 `IAccessRule` 接口 | 当前规则少，硬编码私有方法更简洁；届时提炼接口即可 |
| L02 | 规则粒度的独立开关（例如只关 edit 不关 bash），可能需引入规则级 skip 配置 | 设计阶段自然衍生 | `IAccessPolicy` 可能需扩展为 `shouldSkipRule(ruleName: string): boolean` | 当前无此需求，所有规则共享同一个全局 skip |
| L03 | `PI_EXT_SKIP` 中的扩展名列表目前是静态环境变量，后续可考虑动态配置源（如配置文件 or 运行时 API） | 设计阶段自然衍生 | `ScopePolicy` 实现层可能替换策略源 | 当前环境变量已满足需求，不做设计预留 |

## 与当前设计的关系（轻量提示）
- L01 不会影响 `IAccessPolicy` 接口，重构范围局限在 `ToolAccessGuard` 内部
- L02 若实现，需扩展 `IAccessPolicy` 接口新增方法，但当前接口无需提前预留方法签名
- L03 仅影响 `ScopePolicy` 的实现细节，`IAccessPolicy` 接口不变
