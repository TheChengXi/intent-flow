# 代码报告：intentTextEscaping

## 文件路径

- 实现文件：`src/data/services/codeContext/intentTextEscaping.ts`
- 测试文件：`src/data/services/codeContext/intentTextEscaping.test.ts`

## GREEN 验证结果

- 命令：`npx vitest run src/data/services/codeContext/intentTextEscaping.test.ts`
- 结果：**17 passed (17)**，全部通过 ✅

三个导出函数均已实现，签名与 test-report.md 一致：

```ts
export function escapeBlockCommentText(text: string): string;
export function escapeLineCommentText(text: string): string;
export function unescapeIntentText(text: string): string;
```

实现要点（对照验收条件）：

1. **escapeBlockCommentText**：两步正则——`/\*\//g` 全量替换终止序列为 `*\/`，再 `/^@/gm` 多行模式替换行首 `@` 为 `\@`。步骤顺序保证无二次转义：第一步后产物不含裸 `*/`（`*` 后必为 `\`），第二步 `^@` 不会匹配已转义的 `\@`（行首是 `\`）。
2. **escapeLineCommentText**：仅 `/^@/gm` 单步替换，`*/` 原样保留（行注释无终止符词法风险）。
3. **unescapeIntentText**：`/\*\\\//g` 还原 `*\/` → `*/`，再 `/\\@/g` 还原 `\@` → `@`。两个规则字符集不相交（`*\/` 与 `\@` 无重叠），执行顺序不影响结果，闭环测试 `unescape(escape(text)) === text` 通过。

## 决策点

1. **转义两步顺序（先终止序列、后行首 @）**：`*/` 替换不产生行首 `@`，`^@` 替换不产生 `*/`，两步互不干扰，顺序选择不影响正确性；先替换终止序列使后续行首匹配无需考虑 `*\/` 干扰。
2. **还原方向与转义方向同序**：`unescapeIntentText` 先 `*\/` 后 `\@`，与转义侧顺序对称；因两规则不相交，实际与顺序无关，但保持对称降低阅读成本。
3. **JSDoc 注释中避免字面 `*/` 序列**：首版实现注释里写了 `/** */`、`*/ 变为 *\/` 等字样，导致块注释被提前闭合、vitest 编译报语法错误（TS1109 同类问题）。修正为「星号斜杠/星号反斜杠斜杠」中文表述（与 @intent 头部风格一致），代码字符串字面量 `'*\\/'` 不受影响。这也印证了需求文档中转义规则的必要性。

## 疑虑或卡点

- 无未解决卡点。已知行为（字面含 `*\/` 的文本被还原为 `*/`）已按需求文档异常场景由测试锁定，未做特殊处理。

---

## 轮次 2：IntentExtractor 接入提取侧还原

### 文件路径

- 改动文件：`src/data/services/codeContext/extractors/IntentExtractor.ts`
- 测试文件：`src/data/services/codeContext/extractors/IntentExtractor.test.ts`

### 改动内容（design.md 已定）

1. 新增同层导入：`import { unescapeIntentText } from '../intentTextEscaping'`（data 层 → data 层，同层依赖合法，不跨层）
2. 返回前统一还原：`return parts.length > 0 ? unescapeIntentText(parts.join(' ')) : null;`
3. 边界逻辑（遇空行/`@tag`/块闭合停止、无 @intent 返回 null）未改动

### GREEN 验证结果

- 命令：`npx vitest run src/data/services/codeContext/extractors/IntentExtractor.test.ts`
- 结果：**18 passed (18)**，全部通过 ✅（12 例既有绿 + 6 例转义还原红灯转绿）

### 决策点

1. **拼接后统一还原而非行级还原**：与 design.md 决策 3 一致——`parts.join(' ')` 结果一次性过 `unescapeIntentText`，实现最简；转义序列在自然文本出现率极低，统一还原的误伤可接受。
2. **`\@` 行不截断无需额外处理**：`\@param` 行首是反斜杠，不匹配现有停止正则 `^\*?\s*@\w`，天然不触发截断（test-report 已确认）；还原在拼接后统一完成。
3. **注释中避免裸终止序列**：沿用轮次 1 教训，改动注释全部使用「星号反斜杠斜杠」中文表述；代码字符串字面量不受影响。

---

## 轮次 3：ProjectIntentUseCase.generateIntentBlock 接入投射侧转义

### 文件路径

- 改动文件：`src/application/useCases/ProjectIntentUseCase.ts`
- 测试文件：`src/application/useCases/ProjectIntentUseCase.test.ts`

### 改动内容（design.md 已定，改动仅限 generateIntentBlock 函数内部 + 导入）

1. 新增导入：`import { escapeBlockCommentText, escapeLineCommentText } from '../../data/services/codeContext/intentTextEscaping'`（application → data，上层依赖下层合法）
2. 块注释分支：`intent.split('\n')` 前调用 `escapeBlockCommentText(intent)`（终止序列 + 行首 @ 全量转义）
3. 行注释分支：`intent.split('\n')` 前调用 `escapeLineCommentText(intent)`（仅行首 @）
4. 裸文本分支（.md/.yaml/.json）：不转义，保持不变
5. @intent 头、替换/回退逻辑（tree-sitter、正则）均未改动

### GREEN 验证结果

- 命令：`npx vitest run src/application/useCases/ProjectIntentUseCase.test.ts`
- 结果：**21 passed (21)**，全部通过 ✅
- 全链路回归：`ProjectIntentUseCase.test.ts` + `intentTextEscaping.test.ts` + `IntentExtractor.test.ts` 三文件 **56 passed (56)** ✅

### 决策点

1. **转义发生在 split 之前、以新 const 承接**：`const escapedIntent = escapeBlockCommentText(intent)` 后按行拆分，逐行加注释前缀；不修改参数、不影响裸文本分支。转义作用于整块文本（含换行），与 intentTextEscaping 的多行模式（`^@` + `m` flag）语义吻合。
2. **两个分支各自独立转义**：块注释分支用块规则（含终止序列），行注释分支用行规则（不含），与需求文档「按注释风格自动转义」一致；裸文本分支无词法风险不转义。
3. **依赖方向合规**：application 层 use case → data 层 intentTextEscaping，单向向下，无跨层/反向依赖。
