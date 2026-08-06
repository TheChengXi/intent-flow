# 测试报告（轮次 2）：IntentExtractor

> 轮次 1（intentTextEscaping，17 例红灯）见下方"轮次 1 回顾"。

## 文件路径

- 被测文件：`src/data/services/codeContext/extractors/IntentExtractor.ts`
- 测试文件：`src/data/services/codeContext/extractors/IntentExtractor.test.ts`
- 参考风格：`src/application/useCases/ProjectIntentUseCase.test.ts`

## 接口签名列表

```ts
// 从代码注释行数组解析 @intent 块，输出拼接后的意图文本（拼接后统一还原转义序列）
export function extractIntentFromLines(lines: string[]): string | null;
// 输入：代码注释行数组（模拟 generateIntentBlock 投射后的行形态）
// 输出：拼接为单行的意图文本；无 @intent 或标签无内容时返回 null
// 停止：遇空行、下一个 @tag、块注释闭合 */ 停止解析
// 还原：*\/ → */、\@ → @（与投射侧 intentTextEscaping 对称）
```

## 覆盖的测试场景（18 例）

### 三种注释格式提取（5 例，全绿）

| 场景 | 断言要点 |
|------|---------|
| 星号块注释（`/** ... */`） | `/**` / ` * @intent` / ` * 内容` / ` */` 形态提取拼接 |
| `//` 行注释 | `// @intent` + `// 内容` 提取 |
| `#` 井号注释 | `# @intent` + `# 内容` 提取 |
| @intent 标签行内联文本 | ` * @intent 单行描述` → `单行描述` |
| 多行拼接 | 多行块拼接为空格分隔的单行文本 |

### 无 @intent → null（3 例，全绿）

| 场景 | 断言要点 |
|------|---------|
| 无 @intent 标签 | 返回 null |
| 空输入数组 | 不抛异常且返回 null |
| 标签无内容 | `// @intent` 单独出现返回 null |

### 停止条件（4 例，全绿）

| 场景 | 断言要点 |
|------|---------|
| 空行 | 空行后的内容不再提取 |
| 下一个 @tag | ` * @param x` 前的行停止（块注释） |
| 块注释闭合 `*/` | 闭合后的行不提取 |
| 块内空星号行 ` * ` | 跳过不停止，后续行仍提取 |

### 转义序列还原（6 例，红灯——锁定 design 中待接入的还原改动）

| 场景 | 断言要点 |
|------|---------|
| `*\/` 还原 | ` * 支持 /** *\/ 注释` → `支持 /** */ 注释` |
| `\@` 还原 | ` * \@see foo` → `@see foo` |
| 块注释转义行首 @ 不截断 | ` * \@param x 参数` 完整提取（含还原） |
| `//` 格式转义行 | `// \@param x 参数` 完整提取（含还原） |
| `#` 格式转义行 | `# \@param x 参数` 完整提取（含还原） |
| 还原闭环（拼接后统一还原） | 投射形态块提取 == 原文（换行变空格），且产物无残留 `*\/`、`\@` |

## 测试状态

- 12 例绿（格式、拼接、null、停止条件）；6 例红（全部集中在"转义还原"组）
- 红灯原因：`extractIntentFromLines` 当前返回 `parts.join(' ')` 未过 `unescapeIntentText`——design.md「改动：IntentExtractor.ts」项尚未落地，属预期 TDD 红灯，行为断言依据 @intent 规格（"提取后对称还原转义序列"）编写
- 注意：`\@param` 不截断行为在当前实现已成立（`\@` 不匹配 `@\w` 停止正则），6 例红灯仅为还原缺失
- 测试输入全部手动构造"投射后"注释行（`/**`、` * @intent`、` */`、`# @intent`、`// @intent` 形态），与 ProjectIntentUseCase 既有断言确认的 generateIntentBlock 输出一致；不 mock、不依赖实现细节

## 轮次 1 回顾

- `src/data/services/codeContext/intentTextEscaping.test.ts`：17 例（escapeBlockCommentText 7 / escapeLineCommentText 4 / unescapeIntentText 6），全部红灯（实现文件尚无导出），覆盖终止序列全量转义、行首 @ 多行转义、无二次转义、还原闭环、行/块转义范围差异

---

# 测试报告（轮次 3）：ProjectIntentUseCase 转义行为补充

## 文件路径

- 被测文件：`src/application/useCases/ProjectIntentUseCase.ts`（execute() 公开接口）
- 测试文件：`src/application/useCases/ProjectIntentUseCase.test.ts`（保留 @intent 头与全部既有用例，追加 1 个 describe、5 个用例；新增 import `extractIntentFromLines`）

## 接口签名（沿用既有）

```ts
export class ProjectIntentUseCase implements IUseCase<ProjectIntentInput, ProjectIntentResult> {
  execute(input: { path: string; intent: string; force: boolean }): Promise<ProjectIntentResult>;
}
```

## 追加的测试场景（5 例）

| 场景 | 断言要点 | 状态 |
|------|---------|------|
| .ts 新文件投射含终止序列的 intent | writeFile 参数含转义形式（星号反斜杠斜杠）；块内容区（@intent 行与闭合行之间）无裸终止序列（词法安全） | 🔴 红灯 |
| .ts 投射含行首 @ 的 intent | writeFile 参数含转义 @（反斜杠+@） | 🔴 红灯 |
| .py（行注释语言） | 行首 @ 转义（`# \@param x 参数`）；终止序列不转义（`# 支持 */ 注释`） | 🔴 红灯 |
| .md（裸文本通道） | 终止序列与行首 @ 均原样保留（不转义分支） | ✅ 绿（当前实现天然满足） |
| 闭环：.ts writeFile 参数 → extractIntentFromLines | 提取结果 == 投射原文（换行拼接为空格），还原闭环 | 🔴 红灯 |

## 测试状态

- 运行 `npx vitest run src/application/useCases/ProjectIntentUseCase.test.ts`：21 例中 17 例通过（全部既有用例无回归）、4 例红灯
- 红灯原因：`generateIntentBlock` 尚未接入 `escapeBlockCommentText` / `escapeLineCommentText`（design.md「改动：ProjectIntentUseCase.ts」未落地），属预期 TDD 红灯；`.md` 不转义分支当前实现已满足，无需改动
- 测试方法：沿用既有模式（mock IFileRepository + 断言 writeFile 参数），不 mock 内部函数；闭环用例直接引入 `extractIntentFromLines` 对 writeFile 参数做端到端验证
- 安全约定：测试源码注释内不写裸终止序列（星号斜杠），统一用转义形式或中文表述，避免提前闭合块注释
