# Zod — 协议结构校验

- 递归 Schema 定义（`z.lazy()`）对应协议的递归组件树
- `.refine()` 实现跨字段约束检查（如"子节点 type 匹配父节点 accepts"）
- 运行时校验 + TypeScript 类型推导二合一
- AI 生成的 YAML 在落地为代码前，先过 Zod 校验拦截非法结构
