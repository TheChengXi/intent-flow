# 设计文档：project-intent-hardening

## 现状分析

**项目分层**（IntentFlow 三层）：`adapter`（入口）→ `application`（用例编排）→ `data`（数据/服务）。

**本次涉及两条链路**：

```
投射：ProjectIntentTool (adapter) → ProjectIntentUseCase (application)
        → generateIntentBlock() → LanguageConfig / TreeSitterManager (data)
提取：ProjectIntentsToFilesUseCase (application) → IntentExtractor.extractIntentFromLines (data)
```

**依赖验证**（无跨层，无需一并修复项）：
- `ProjectIntentUseCase` → `IFileRepository`/`LanguageConfig`/`TreeSitterManager`（均 data）✅
- `ProjectIntentsToFilesUseCase` → `IntentExtractor`（data）✅
- `IntentExtractor` 为 data 层纯函数，零依赖 ✅

**关键约束**：转义与还原是**对称规则**（`*/` ↔ `*\/`、行首 `@` ↔ `\@`），两处必须同步演进。若各自内联实现，规则会漂移 → 抽公共模块，由测试锁定对称性。

## 模块清单

| 模块 | 层级 | 职责 | 依赖 |
|------|------|------|------|
| `ProjectIntentUseCase`（改） | application | 投射编排；generateIntentBlock 在块注释/行注释分支调用转义 | IFileRepository、LanguageConfig、TreeSitterManager、**intentTextEscaping** |
| `IntentExtractor`（改） | data | @intent 文本提取；返回前调用还原 | **intentTextEscaping** |
| `intentTextEscaping`（**新增**） | data | 转义/还原规则的唯一实现，供投射与提取两侧复用 | 无 |

## 依赖链

```
投射：adapter/ProjectIntentTool → application/ProjectIntentUseCase
        → data/LanguageConfig（注释风格判定）
        → data/intentTextEscaping（转义）        ← 本次新增
        → data/IFileRepository（读写）
提取：application/ProjectIntentsToFilesUseCase → data/IntentExtractor
        → data/intentTextEscaping（还原）        ← 本次新增
```

依赖方向全部为上层→下层，新增依赖不跨层。

## 接口设计

### 新增：`src/data/services/codeContext/intentTextEscaping.ts`

```ts
// 块注释场景（/** */）：*/ → *\/，行首 @ → \@
export function escapeBlockCommentText(text: string): string;

// 行注释场景（//、#）：仅行首 @ → \@（无终止符风险）
export function escapeLineCommentText(text: string): string;

// 提取侧对称还原：*\/ → */，\@ → @
export function unescapeIntentText(text: string): string;
```

**无二次转义保证**（写入注释前验证）：
- `*\/` 转义产物不含 `*/` 连续序列（`*` 后是 `\`），不会被再次转义
- `\@` 行首是 `\` 非 `@`，不会被 `^@` 再次匹配

### 改动：`ProjectIntentUseCase.ts` — `generateIntentBlock`

- 块注释分支：`intent.split('\n')` 前调用 `escapeBlockCommentText(intent)`
- 行注释分支：`intent.split('\n')` 前调用 `escapeLineCommentText(intent)`
- 裸文本分支（.md/.yaml/.json）：不转义（无词法风险，需求文档已定）

### 改动：`IntentExtractor.ts` — `extractIntentFromLines`

- 返回前：`parts.join(' ')` 的结果过 `unescapeIntentText`
- 边界逻辑（遇 `@tag` 停止）不变——转义已从源头规避

## 测试计划

| 测试文件 | 覆盖点 |
|---------|--------|
| `intentTextEscaping.test.ts`（**新增**） | 三条规则：`*/` 全量转义、行首 `@` 转义（多行）、`\@` 不被二次转义；还原闭环 |
| `IntentExtractor.test.ts`（**新增**） | 含转义序列的块提取后与原文一致；`@` 开头行不截断；`//`、`#` 行注释场景还原 |
| `ProjectIntentUseCase.test.ts`（补） | 既有模式：断言 writeFile 参数——投射含 `*/` 的 intent 后内容无裸 `*/`（词法安全） |

既有 481 行测试保持全绿为回归基线。

## 本次设计决策

1. **抽公共模块而非各自内联**：转义/还原是必须同步的对称规则，单一实现 + 单点测试防漂移；放 data 层（`codeContext/` 下与 `extractors/` 平级）使 application 依赖合法、data 内部复用合法
2. **转义序列选 `*\/` / `\@`**：与 JS 生态代码生成器通用约定一致（需求分析阶段已实测验证词法安全）；`* /` 形式因提取侧无法安全还原（自然文本误伤率高）被排除
3. **还原统一作用于拼接后文本**：不做行级精确还原——转义序列在自然文本中出现率极低，统一还原的误伤可接受且实现最简
4. **不引入新依赖、不加配置开关**：两次 replace 级别的规则，引入库或配置项均为过度设计
