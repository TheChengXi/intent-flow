# 测试策略

## 换算层（converter）— 属性测试

```
convertTree(compiled, cw, ch)

不变量：
  ① 所有输出的 w/h 值为正数或零
  ② 宽高比不超出输入容器的范围
  ③ 百分比总和 ≤ 容器尺寸（不保证刚好填满）
  ④ 相同输入 → 相同输出（纯函数保证）
```

- 用 fast-check 做属性测试，随机生成百分比组合
- 不需要 mock，纯函数入参出参

## 行为层（behavior）— XState 测试

- `@xstate/test` 从状态机定义自动生成测试用例
- 覆盖所有合法迁移路径
- 非法事件不走到未定义状态（XState 内置保证）

## 协议定义（protocol.ts）— 类型检查

- TypeScript `tsc --noEmit` 确保协议定义类型正确
- Zod schema 覆盖所有协议字段

## 渲染层（render）— 快照对比

- 构建已知场景图 → 序列化为 JSON 快照
- 改协议后对比快照差异
- 不需要像素级截图对比，只验证场景图结构

## 不做的

- 不写端到端测试（E2E），Leafer Canvas 渲染结果依赖 GPU 驱动
- 不测 UI 视觉效果（人类审美验收制）
