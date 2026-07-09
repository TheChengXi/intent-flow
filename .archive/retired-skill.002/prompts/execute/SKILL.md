---
name: execute
description: 三分阶段生成代码：先投射文件骨架和 @intent，再 TDD 逐文件 RED→GREEN 循环，最后集成验证。Use when 分层设计完成，需要生成代码。
---

# Execute

三分阶段执行，顺序不可逆。如果是修改已有功能而非新建，跳过 Phase 1，直接从 Phase 2 开始：

1. **阶段一** [PHASE1-SCAFFOLD.md](PHASE1-SCAFFOLD.md) — 读两份设计文档（part-to-finish + part-to-later-on），
   创建 part-to-finish 的文件骨架 + 写 @intent，
   同时在已创建的文件接口中预留 part-to-later-on 的方法签名
2. **阶段二** [PHASE2-TDD.md](PHASE2-TDD.md) — 逐文件 TDD 循环：先写测试（RED）→ 再填充实现（GREEN），
   只覆盖 Phase 1 创建的文件（part-to-finish 范围）
3. **阶段三** [PHASE3-INTEGRATE.md](PHASE3-INTEGRATE.md) — 跨模块集成测试 + 端到端通路验证 + 重构收尾
