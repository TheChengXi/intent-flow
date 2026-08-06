# ScopePolicy.ts

`src/adapter/pi/services/ScopePolicy.ts`

**intent:** IAccessPolicyService 的 adapter 层实现。委托 data/services/scope/policy.shouldSkip() 执行实际环境变量判断。 接口 IAccessPolicyService 在 application 层定义，由本 adapter 实现完成依赖组装。 边界：纯委托，不含任何逻辑；shouldSkip 返回 boolean，不抛异常。 验收条件： - 实现 IAccessPolicyService 接口 - 委托调用 data/services/scope/policy.shouldSkip() 结果一致
