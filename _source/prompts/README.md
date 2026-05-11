# 提示词定义目录

本目录存储 CDD Framework 各个角色的 AI 提示词定义。

## 文件说明

- `compiler.md` - 编译器提示词（注释→代码）
- `reviewer.md` - 审查员提示词（代码一致性审查）
- `translator.md` - 转译员提示词（代码→注释）
- `planner.md` - 规划师提示词（变更影响分析）

## 编写规范

1. 使用 Markdown 格式
2. 可以包含注释和说明
3. 构建时会自动提取内容生成 TypeScript 常量
4. 修改后需运行 `npm run generate-prompts` 重新生成

## 构建流程

```bash
# 修改提示词
vim _source/prompts/compiler.md

# 生成代码
npm run generate-prompts

# 编译
npm run compile

# 测试
F5
```

## 版本控制

- 提示词文件纳入版本控制
- 生成的 `src/generated/prompts.ts` 不纳入版本控制（.gitignore）
- 每次构建自动重新生成

---

**创建日期：** 2026-05-09
