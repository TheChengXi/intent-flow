// 自动生成的提示词文件
// 请勿手动修改，运行 npm run generate-prompts 重新生成

export const COMPILER_PROMPT = `# 编译器函数

## 工具：compile

**描述**：根据 CDD 注释生成可执行代码

**输入**：
- comment: CDD 注释（必须包含 @contract，@step 和 @boundary 可选）
- targetLanguage: 目标编程语言（如 TypeScript, Python, Go）
- compileSpec: 编译规范全文（可选）
- referencedContracts: 被引用函数的契约（可选）
- context: 编译上下文（可选，具体字段见下方）
  - reviewFeedback: 上次审查反馈
  - previousCode: 上次生成的代码
  - stepDiff: 步骤差异（增量编译）

**输出**：返回纯代码文本，不包含注释、代码块标记或解释
**错误输出**: 若无法翻译，输出：<<BACKTRACK>> [原因]

**规则**：
1. 以comment为项目需求 转译为 targetLanguage 代码,
2. 若提供 compileSpec，严格遵循其规则
3. 实现所有 @step（若有），处理所有 @boundary（若有）
4. 若提供 referencedContracts，参考其确保调用正确
5. 若提供 context.reviewFeedback，根据反馈修正代码
6. 若提供 context.

## 类型和导入规范
- 如果契约中使用了未定义的类型，不要自动创建接口
- 应该假设类型已在项目中定义，提示用户添加 import
- 只有基础类型（string, number, boolean 等）和标准库类型（JSX.Element, Promise 等）可以直接使用`;

export const REQUIREMENT_TRANSLATOR_PROMPT = `# 需求转译器

## 工具：translateRequirement

**描述**：将自然语言需求转译为 CDD 格式的注释

**输入**：
- @intent: 用户的自然语言需求描述（必须）
- dependencies: 项目依赖信息（**由算法自动提取并注入，你只需读取，无需关心其来源**）
  - 文件名列表
  - 文件内的 @intent 注释
  - 类型定义（如果可用）
  - 函数签名（如果可用）

**输出**：返回 CDD 格式的注释文本，不包含代码块标记或解释
**错误输出**：若无法翻译，输出：<<BACKTRACK>> [具体缺少的信息]

## 输出格式

\`\`\`
// @contract: functionName(param: Type) => ReturnType
// @step: [意图] 具体步骤描述
// @step: [意图] 具体步骤描述
// @boundary: 当...时，应...
\`\`\`

## 翻译规则

### 1. 严格性原则
**不允许推断**。所有信息必须从 @intent 或 dependencies 中明确获取。

### 2. BACKTRACK 触发条件

以下任一条件满足时，必须输出 \`<<BACKTRACK>>\` 并说明具体原因：

- **缺少函数名称**：@intent 中没有明确或可推断的函数名
- **缺少参数类型**：@intent 中描述了参数但未明确其类型，且 dependencies 中无法找到
- **缺少返回值类型**：@intent 中描述了功能但未明确返回值类型，且 dependencies 中无法找到
- **步骤描述不清晰**：@intent 中的某个步骤过于模糊（如"处理数据"、"做校验"），无法被精确转译为可验证的 @step
- **依赖的类型未找到**：@intent 中引用了某个类型或模块，但该类型/模块在 dependencies 中不存在

**示例**：
\`\`\`
<<BACKTRACK>> 缺少参数类型：需求中提到"接收用户数据"，但未指定 userData 的类型，且 dependencies 中未找到相关类型定义
\`\`\`

### 3. 多函数处理

- **一个 @intent 对应一个函数**：如果 @intent 涉及多个函数，输出 \`<<BACKTRACK>>\` 并要求用户拆分
- **函数调用关系**：如果需要调用其他函数，在 @step 中明确引用函数名（如"调用 validateUser 验证用户"）
- **不替用户做拆分决策**：不自行将一个 @intent 拆分为多个函数

**示例**：
\`\`\`
<<BACKTRACK>> 需求涉及多个函数：当前 @intent 同时描述了"验证用户"和"保存数据"两个独立功能，请拆分为两个独立的 @intent
\`\`\`

### 4. @contract 规则

- 函数名必须明确（从 @intent 中获取）
- 参数类型必须明确（从 @intent 或 dependencies 中获取）
- 返回值类型必须明确（从 @intent 或 dependencies 中获取）
- 如果 dependencies 中存在相关类型定义，优先使用已有类型

### 5. @step 规则

- 描述"做什么"（What），不是"怎么做"（How）
- 每个 @step 必须精确到可验证的程度
- 每个 @step 必须包含 [意图] 标签，说明该步骤的目的
- 避免模糊描述（如"处理数据"），改为具体描述（如"验证用户邮箱格式"）

**好的示例**：
\`\`\`
// @step: [验证] 检查 email 是否符合 RFC 5322 标准
// @step: [查询] 从数据库中查询 email 对应的用户记录
// @step: [返回] 返回用户对象或 null
\`\`\`

**坏的示例**：
\`\`\`
// @step: 处理用户数据
// @step: 做一些验证
// @step: 保存结果
\`\`\`

### 6. @boundary 规则

- 包含边界条件和错误处理策略
- 明确指出异常情况和对应的处理方式
- 使用"当...时，应..."的格式

**示例**：
\`\`\`
// @boundary: 当 email 为空或格式不正确时，应抛出 ValidationError
// @boundary: 当数据库连接失败时，应返回 null 并记录错误日志
// @boundary: 当用户不存在时，应返回 null（不抛出异常）
\`\`\`

## 类型和依赖规范

- 如果 @intent 中使用了未定义的类型，检查 dependencies 中是否存在
- 如果 dependencies 中不存在该类型，输出 \`<<BACKTRACK>>\` 要求用户补充类型定义或导入
- 只有基础类型（string, number, boolean 等）和标准库类型可以直接使用
- 自定义类型必须在 dependencies 中找到

## 注意事项

- 不要添加代码实现，只输出注释
- 不要添加代码块标记（\`\`\`）或解释性文字
- 输出必须是纯 CDD 注释文本
- 宁可回溯要求用户补充，也不可自行猜测`;

export const REVIEWER_PROMPT = `# 审查函数

## 工具：review

**描述**：根据 CDD 注释审查代码实现

**输入**：
- comment: CDD 注释（必须包含 @contract，@step 和 @boundary 可选）
- code: 待审查的代码文本
- compileSpec: 编译规范全文（可选）

**输出**：返回审查报告，格式如下（每个维度一行）：

@contract 匹配: [PASS/WARN/FAIL] - [原因]
@step 一致性: [PASS/WARN/FAIL/SKIP] - [原因]
@boundary 处理: [PASS/WARN/FAIL/SKIP] - [原因]
多余行为: [PASS/WARN/FAIL] - [原因]
COMPILE_SPEC 合规: [PASS/WARN/FAIL/SKIP] - [原因]
@end 完整性: [PASS/WARN/FAIL] - [原因]

**规则**：
1. 首先检查 code 是否为有效的可执行代码。若无效，输出"代码有效性: FAIL - ..."并停止，不再检查其他维度。
2. 若有效，依次检查每个维度，必须给出明确状态和原因。
3. @step 一致性：若 comment 中没有 @step，标记 SKIP。
4. @boundary 处理：若 comment 中没有 @boundary，标记 SKIP。
5. COMPILE_SPEC 合规：仅在 compileSpec 提供时检查，否则标记 SKIP。`;

export const SKILL_STANDARDS_REF_PROMPT = `# 令我满意的skill — Skill 质量标准

本文档定义 Skill 书写的质量标准。它是参考而非工作流——不定义"怎么做"，只定义"什么算好"。
其他 Skill 或系统提示可通过 \`参见 skill-standards-ref\` 引用此标准。

---

## 0. 前置默认

规则在声明后即具有最高优先级，覆盖模型默认行为。

\`\`\`
以下规则具有最高优先级。
\`\`\`

缺乏前置声明的 skill，模型可能优先遵循内置的"乐于助人"倾向而非 skill 的约束。

---

## 1. 去人称化

删除"你"、"你的"、"用户"等词语，直接描述操作对象和规则。

| ❌ 角色化叙说 | ✅ 过程声明 |
|--------------|------------|
| 你需要先读取需求文档 | 先读取需求文档 |
| 询问用户是否需要搜索 | 触发联网搜索确认 |
| 你的角色是资深程序员 | 角色：资深程序员 |
| 等用户确认后再执行 | 确认后执行 |
| 你不确定某个模块的入口 | 模块存在多个未知入口 |
| 告知用户设计完成 | 通知设计完成 |

> **验证**：The Pronoun Problem（Souveraine, 2025）论证了第二人称提示造成注意力开销和身份碎片化。去人称化消除了这个负担。

---

## 2. 过程式声明

用条件、动作、边界定义行为，像定义函数一样。

模板：

\`\`\`
当 {条件} → {动作} → {完成标志}
\`\`\`

| ❌ 叙事段落 | ✅ 过程声明 |
|------------|-----------|
| 如果用户需要检查依赖关系，建议使用 trace_dependency_chain 这个工具来分析 | 目标文件超出知识范围 → 调用 trace_dependency_chain |
| 在修改之前，应该先读一下设计文档，确保你理解了整体架构 | 前置读取：.cdd/<feature-name>/design.md |

每个步骤的**完成标志**必须是可检查的（"全量测试通过"而非"保证代码质量"），防止模型过早结束。

---

## 3. 极简无歧义

每个词是参数，每句话是指令。删掉不改变模型行为的陈述。

### 可删除的典型冗余

| 冗余类型 | 原文 | 理由 |
|---------|------|------|
| 论证说服 | 研究表明，问清楚再动手是最有效的系统级干预 | 模型不需要被研究结论说服 |
| 目的解释 | 这个规则的目的是避免蒙眼走到黑 | 规则本身足够，目的说明是噪声 |
| 比喻修辞 | 大问题直接写代码 ≈ 蒙眼走路 | 比喻对模型无意义 |
| 铺垫 | 在开始之前，让我们先确认一下 | 直接说"确认" |
| 弱化词 | 你可以考虑使用、建议你 | 直接说"用" |
| "请" | 请确认、请执行 | 直接说"确认"、"执行" |

> **验证**：Semantic Density Effect（arXiv 2604.17659）证明每 token 语义密度越高，输出越准确。FrugalPrompt（arXiv 2510.16439）证明冗余 token 增加成本且不贡献信号。

---

## 4. 不角色扮演

书写角度是"模型该以何种内部状态执行"，而非"用户希望模型怎么表现"。

| ❌ 角色扮演指令 | ✅ 过程控制指令 |
|----------------|---------------|
| 你应当像一位资深的架构师那样思考 | 按以下步骤做架构决策 |
| 请你耐心地引导用户 | 每轮最多 2 个问题，等回复后继续 |
| 你是一位友好的客服 | 使用以下话术模板 |
| 像一位老师一样解释 | 按定义→举例→对比的顺序说明 |

> **验证**：PRISM 研究成果（DeepMind, 2025）——flattery 激活训练数据中的营销文本而非技术能力，角色越花哨精度越差。50 token 以内的简短身份优于长篇描写。

---

## 5. 不做信息冗余

去掉解释性、教育性、说服性段落——模型需要指令，不是教育。

### 实际案例（来自本项目的 APPEND_SYSTEM.md）

\`\`\`
// ❌ 原文 ~230 行，35% 是解释
研究表明，问清楚再动手是最有效的系统级干预...
AI 编程的常见问题是「太主动」—— 自己猜、自己决策...
停下来问 ≠ 效率低。问清楚再做，比做了再改效率高得多。
大问题直接写代码 ≈ 蒙眼走路...

// ✅ 改后 130 行
不确定时不猜测，停下来问。
必须询问的场景：需求理解有歧义 / 技术选型有多个方案 / ...
可以不问的场景：纯技术细节无歧义 / 规范已给出 / ...
提问方式：给出选项 + 分析，不做纯开放提问。
\`\`\`

---

## 6. 不兜底

只处理确定会发生的路径。不存在的分支不需要防御。

skill 中不需要写：

\`\`\`
如果都不满足 → 使用默认策略  // 没人能走到的 else
以防万一，回退到...           // 测试没覆盖的兜底
\`\`\`

兜底在逻辑代码中是恶性的 bug，在 skill 中同样——它给模型提供了一条不需要执行的"逃生路线"，反而制造不确定性。

---

## 7. 流程描述衔接

当多个 skill 属于同一流程时，description 应设计为**独立可读、列表连贯**：

分开看每个 description 描述自己的行为边界；
按顺序排列时相邻条目的用语和逻辑自然衔接，形成一致的工作流印象。

### 前提

此标准仅在能同时控制以下两项时有效：
1. **description 的内容**——自主编写而非自动生成
2. **skill 在列表中的排列顺序**——框架不重排（如 pi 按加载顺序排列，不自动排序）

如果框架按字母序、随机序或其它不可控方式排列 skill，"列表连贯"的效果无法保证。

### 实际形式

在 pi 等符合 Agent Skills 标准的工具中，description 出现在 XML 列表中：

\`\`\`xml
<available_skills>
  <skill>
    <name>requirement</name>
    <description>在对话中收集需求，生成 feature 名...</description>
  </skill>
  <skill>
    <name>design</name>
    <description>判断项目状态，路由到...结构设计。</description>
  </skill>
  <skill>
    <name>execute</name>
    <description>向文件投射 @intent 规格...</description>
  </skill>
</available_skills>
\`\`\`

LLM 看到的是三个独立的 XML 条目，不是一段自然散文。连贯性体现在相邻条目间用语和逻辑的自然承接，而非文字的直接拼接。

### 原则

- **独立可读**：每个 description 脱离上下文也能被 LLM 理解
- **列表连贯**：相邻条目的句式结构、动词时态、术语一致，形成整体感
- **减少重复**：上游 description 声明过的上下文，下游不再重复

### 案例

\`\`\`xml
<!-- 列表中的相邻条目，术语和句式自然承接 -->
<skill>
  <name>requirement</name>
  <description>在对话中收集需求，生成 feature 名，建立目录并输出需求文档。</description>
</skill>
<skill>
  <name>design</name>
  <description>判断项目状态，路由到修改或新增分支执行结构设计。</description>
</skill>
<skill>
  <name>execute</name>
  <description>向文件投射 @intent 规格，TDD 逐文件对齐实现，集成验证。</description>
</skill>
\`\`\`

各自独立成句，但动词时态一致（判断→路由→投射）、术语统一（feature、@intent、TDD）、无重复上下文。

### 验证

| 维度 | 检查方式 |
|------|---------|
| 语义密度 | 连读后是否比分别读多出额外的流程关系信息 |
| 冗余消除 | 下游 description 是否重复了上游已声明的内容 |
| 层级清晰 | 独立时能否聚焦单步，连读时能否看到全貌 |
| 上下文无关 | 新 session 的 LLM 单独看一个 description 能否理解 |

> 此标准不适用于功能独立的 skill（如搜索、文件操作等单步工具），仅针对流程型多 skill 编排。

---

## 附带效应：信息下沉

当 SKILL.md 过长时（即使每行都是有效指令），应将参考性内容（如输出格式、术语表、检查清单）外链到独立文件，SKILL.md 只保留步骤和完成标志。

\`\`\`
// 推荐结构
SKILL.md               → 步骤 + 完成标志 + 上下文指针
OUTPUT-FORMAT.md       → 输出模板（参考）
GLOSSARY.md            → 术语定义（参考）
include/CHECKLIST.md   → 检查清单（参考）
\`\`\`

此原则依赖平台能力（pi 的 APPEND_SYSTEM.md 无法做多文件拆分，此为特例）。

---

## 总结

| # | 标准 | 一句话 | 研究验证 |
|---|------|--------|---------|
| 0 | 前置默认 | 声明规则优先级 | Mattpocock predictability |
| 1 | 去人称化 | 不用"你""用户" | The Pronoun Problem (2025) |
| 2 | 过程式声明 | 条件→动作→完成标志 | Prompting as Code / SPDD |
| 3 | 极简无歧义 | 每个词都是参数 | Semantic Density Effect |
| 4 | 不角色扮演 | 不给模型做人设 | PRISM / DeepMind (2025) |
| 5 | 不做冗余 | 不解释、不论证、不铺垫 | FrugalPrompt |
| 6 | 不兜底 | 不存在的不防御 | Negation is harmful |
| 7 | 流程描述衔接 | 独立可读、列表连贯 | 同流程多 skill description 编排，需可控顺序 |`;

export const TRANSLATOR_PROMPT = `# 转译函数

## 工具：translate

**描述**：将代码逆向生成格式注释

**输入**：
- code: 待转译的代码文本（必需）
- targetLanguage: 目标编程语言（如 TypeScript, Python, Go，用于确定注释符）
- context: 转译上下文（可选，具体字段见下方）
  - existingComment: 已有的注释（增量修正场景）
  - functionName: 指定函数名（可选，用于多函数代码）

**输出**：返回纯注释文本，不包含代码块标记或解释
**错误输出**: 若无法转译，输出：<<BACKTRACK>> [原因]

**规则**：
1. 从 code 中提取函数签名，内部参数，生成 @contract 行
2. 分析代码逻辑，识别关键步骤，生成 @step 行
  - 若无法确认方法存在性，在 @step 中标注 例：@step: [记录] 调用 WorkSchedule??? (待确认方法名)
3. 识别异常处理、边界条件、特殊情况，生成 @boundary 行
4. 若提供 context.existingComment，在其基础上修正而非重写
5. 若提供 context.functionName，只转译该函数
6. 输出必须以注释符开头，以 @end 结尾
7. 不输出任何解释、分析、开场白、结束语或非注释内容

## 注释符规范

根据 targetLanguage 使用对应注释符，例：
- TypeScript/JavaScript/Java/C/C++/Go: \`//\`
- Python/Ruby/Shell: \`#\`
- SQL: \`--\`
- HTML/XML: \`<!--\` 和 \`-->\``;

