# IntentFlow

**Comment-Driven Development** — 注释驱动开发框架

> 这只是一套本地的个人设计思路。读一读本 README 也好，参考别人的方案也好，实际本仓库的代码内容没有必要一定要读。内容只是讲解设计思路，不必照抄——毕竟并没有科学验证过这套思路是永久可行的，顺便说一下这个README也是ai写的，我自己也没怎么看，嗯，这句话也是，再顺便说一下其实我叫这个iflow框架的原因也是ai写的。

IntentFlow 是一套以 **@intent 注释**为核心契约的 AI 辅助开发工作流框架，提供 VS Code 扩展、CLI 和 MCP Server 三种适配形态。

---

## 设计思路

### Prompt / Skill 的本质

Prompt 和 Skill 的核心价值不是什么精巧的措辞技巧，它的本质很简单：**把上下文中重复出现的相同文字提取出来，集成成一份可复用的规则说明**。最标准的写法就是一套执行流程、一个阶段的说明。

随着 LLM 越来越强，很多 skill 里的技术性指令可能不再需要了。但有一件事无论模型怎么进化都绕不开——**跟用户对齐**。用户需求是个无穷底的黑箱，模型再精尖，不跟用户对齐那么最终的结果也只是个一团糟。

所以这套 skill 的核心目的不是"教模型做事"，每一份 skill 都是可以被替代的，它们只是在开发流程的关键节点上建立模型与人的对齐锚点。

相关文件：
- `_source/APPEND_SYSTEM.md` — 系统提示词（全局指令与工作流规范）
- `_source/skill-standards-ref.md` — Skill 书写质量标准

### 四个阶段

**Requirement（需求）** — `_source/prompts/requirement/SKILL.md`
要把模糊想法结构化，最重点的事情是反复跟用户对话确定需求细节。侧面辅助手段是联网搜索——从问题角度看看别人怎么解决的，从功能角度看看同类功能解决了什么问题，或者直接随便乱搜找灵感。还有一个关键思路是测试前置：在需求阶段先模拟出一套验证流程，后续代码怎么写都得跟这套测试方法对齐，哪怕用户不会写代码，也能通过测试步骤体会到功能是否达标。

**Design（设计）** — `_source/prompts/design/SKILL.md`
结构设计和需求分析本质上属于同一个阶段，但刻意拆成两个。原因是"结构设计"这件事在前后端、小脚本里有太多不同的做法，需要一个固定的框架来兜住。参考了 DDD 的分层概念，简化成三层：数据结构/接口/仓库放一层，应用逻辑/编排放一层，面向用户或外部接口的放一层叫适配。这套逻辑不分技术栈，前端后端小脚本大致都能套，因为它没讲什么高深的理论，只是一种代码的结构划分。划分的根本原因是——LLM 经常把代码全写在一个文件夹里，文件夹一长写着写着就跑偏了，所以要划分上下文、降低理解难度，人对代码的理解也是一样的道理。

需求+设计两个阶段会生成一份 feature 产出，包含两个文档：需求文档和设计文档，作为本次开发的对齐基准。

这里面附带了一个小机制叫 **later-on 备忘录**——需求或设计阶段冒出了什么奇妙想法，但跟本次沾边不大或者太复杂，直接记进去，防止过度设计。

**Execute（执行）** — `_source/prompts/execute/SKILL.md`
这是一个多 skill 编排的阶段，核心思路是隔离上下文——测试、写代码、审查三段彼此隔离。

多 agent 的上下文是统一的：写在文件里的 @intent 本身就是子 agent 需要读取和执行的内容。测试 agent 读 requirement 和 design 文档，同时主 agent 把每个文件的 @intent 作为该文件的规格派发给子 agent。子 agent 不需要再考虑"要设计哪些内容"——这些在主线程的上下文里已经满足。同理，写代码的 agent 和审查 agent 也是这样，各司其职，通过统一的 @intent 契约对齐。

**Report（报告）** — `_source/prompts/report/SKILL.md`
接管 Git 对文件改动的关注，对需求理解做打包。通过 feature 这一全局工作流阶段，把每次变更的意图沉淀为意图包（intent package）。后续更新改动时，优先查阅 report 发布的 intent package，方便模型搜索代码内容。

为什么这么设计？目前的 RAG 工具在实际反馈中，很多时候大语言模型宁愿用自己原生的那套 grep 也不愿意用 RAG 自带的代码分析工具。既然这样也就只好顺从——每次代码变动后遗存一份项目的备忘录/方向标，帮助模型分析自己的代码，在后续的设计和改动中提高代码质量。至少模型搜的时候有方向。

本质上，report 这一套就是工程规范中用来**全局统一意志的上下文**。

### Loop / 状态机

四个阶段描述了工作流的"静态结构"，但开发是一个持续的过程——你怎么知道什么时候该进入下一个阶段？

Loop 的本质是：**你拥有无穷的 token 和一套本地的代码库，改代码不需要花什么钱，并且你有无穷的需求可以让 loop 定时去触发**。每轮对话结束后自动扫描 `.intentflow/` 目录下的 feature 文件夹，检查文件状态变化（requirement.md 出现没有？design.md 出现没有？），一旦检测到新文件出现，自动推送消息提醒进入下一阶段。

对于普通开发者来说这个机制可能显得"过于贵重"，但它的核心含义是好的：**定时的、按阶段触发的状态机，驱动 skill 执行**。

实现上体现在 `another_extension_pi/init_feature/` 插件中：
- `engine.ts` — 纯函数：扫描 feature 目录、读取文件状态、判定当前阶段
- `register.ts` — pi 扩展注册：监听 `session_start` 初始化快照、`turn_end` 自动检测变化、`/init-feature` 命令手动触发
- `index.ts` — 统一导出入口

这套思路很多 AI 开发工具都有，有些是在提示词里做手脚，有些是在代码里做手脚。IntentFlow 的选择是在代码里——通过 pi 扩展的事件机制实现一个轻量状态机。

### 不兜底哲学

逻辑代码中禁止"以防万一"式兜底。只处理确定会发生的路径，不存在的分支不需要防御。兜底 = 崩了不炸，不是优雅跑。测试未覆盖的兜底就是潜在的 bug。

### 关于 @intent

一个个人观点（未经科学验证，仅作为设计出发点）：代码文件对于大语言模型而言本质上是一份**分析语料**。文本形式的约束对模型来说本身就是好东西——机器看不懂的代码，模型同样可能看不懂。

尤其是一些接近底层的代码：效率越高、能力越强、越贴近硬件的写法，就越脱离模型知识库里的 token 分布。别说人看不懂，大语言模型想看懂代价也不小。这时候加上注释辅助，模型后续重复分析同一段代码时就能省下大量开销。

我的 @intent 思路默认了一个前提：AI 在理解代码时，并不会采用逐块分析的方式，而是先完整通读整个文件，后续需要修改时再分批处理。

#### 为什么 @intent 写在代码文件里，而不是外部 PRD

PRD（产品需求文档）这类外部文档有一个绕不开的问题：**文件腐烂**。一旦代码和文档分开维护，就必须同时维护两份内容——代码本身和 PRD。但现实是，大多数人写完代码之后不会再去看文档，写代码之前也不看。PRD 对非专业人士是一种负担.

更现实的问题是：写着写着突然想到一个更好的优化方案，这时候是不是要同时改代码文件和 PRD？很麻烦。

所以不如把 PRD 分层打散，直接写进代码文件本身。这样大语言模型在读取代码语料的时候，顺手就能把 @intent 也一并改了，不存在"忘了更新文档"这回事。

每个文件头顶写一段自然语言 @intent，说明这个文件为什么存在、承担什么职责、边界在哪。人看了能理解，AI 看了也能理解，工具还能读取、追踪、聚类。这是整个框架的契约基础。

---

## 工具能力一览

### MCP 工具

| 工具 | 功能 |
|------|------|
| `check_file_size` | 检查文件大小，排除注释统计纯代码行数 |
| `trace_dependency_chain` | 沿依赖链追踪，分析 @intent 语义 |
| `project_intent` | 创建/更新 @intent 注释 |
| `list_folder_intents` | 列出文件夹内 @intent 投影 |

### CLI 命令

`iflow check-file-size`、`iflow trace-dependency-chain`、`iflow project-intent`、`iflow list-folder-intents`、`iflow intent-package`

### VS Code 命令

大文件扫描、当前文件及依赖检查、能力地图可视化、框选交互、干运行模式等。

### Pi Agent 集成

子进程 agent 调度（SpawnAgent/ListAgents）、访问策略控制、RPC 进程池、TUI 可视化面板。

---

## 项目结构

```
.intentflow/                     # 工作流产出（需求/设计/报告/意图包）
_source/                  # Skill 定义
src/
  data/                   # 实体 + 接口 + 实现
  application/            # 用例编排
  adapter/                # CLI / MCP / VS Code / Pi
dist/                     # 构建产出
another_extension_pi/     # Pi 扩展插件
  init_feature/           #   状态机：自动检测 feature 阶段流转
```

---

## Skill 质量标准参考

详见 `_source/skill-standards-ref.md`，核心七条：前置默认、去人称化、过程式声明、极简无歧义、不角色扮演、不冗余、不兜底。

这些标准同样遵循上面的思路——随着模型越来越强，它们可能被替代，但"与人对齐"这个目标不变。

---

## License

MIT
# IntentFlow

**Comment-Driven Development** — A comment-driven development framework

> This is just a set of local, personal design ideas. There is no need to actually read the code in this repository — reading this README or looking at other people's approaches is fine. The content merely explains the design rationale; there is no need to copy it exactly. After all, it hasn't been scientifically verified that this approach will work forever. By the way, this README was also written by an AI, and I haven't really read it much myself. Yeah, this sentence too.By the way, the name "Comment-Driven Development" was also suggested by an AI. Of course it was.

IntentFlow is an AI-assisted development workflow framework centered on **@intent comments** as the core contract. It offers three adaptation forms: a VS Code extension, a CLI, and an MCP Server.

---

## Design Rationale

### The Essence of Prompts / Skills

The core value of Prompts and Skills isn't about elaborate wording tricks; its essence is simple: **extract recurring, identical text from the context and consolidate it into a reusable rule specification**. The most standard form is a set of execution procedures, a description for a phase.

As LLMs grow stronger, many of the technical instructions inside skills may no longer be needed. But there is one thing that cannot be circumvented no matter how models evolve — **aligning with the user**. User requirements are a bottomless black box. No matter how sophisticated a model is, without aligning with the user, the final result will just be a mess.

Therefore, the core purpose of this set of skills is not to "teach the model how to do things." Every single skill is replaceable; they only serve to establish alignment anchors between the model and the human at key nodes in the development process.

Related files:
- `_source/APPEND_SYSTEM.md` — System prompt (global instructions and workflow specifications)
- `_source/skill-standards-ref.md` — Skill writing quality standards

### Four Phases

**Requirement** — `_source/prompts/requirement/SKILL.md`
To structure vague ideas, the most important thing is to repeatedly converse with the user to nail down requirement details. A supplementary aid is web searching — looking at how others solved the problem from that angle, examining what problems similar features addressed from the feature perspective, or simply searching randomly for inspiration. Another key idea is test-first: during the requirements phase, simulate a verification process upfront. No matter how the subsequent code is written, it must align with this testing method. Even if the user can't code, they can still get a feel for whether the feature meets the standard through the test steps.

**Design** — `_source/prompts/design/SKILL.md`
Structural design and requirement analysis essentially belong to the same phase, but they are deliberately split into two. The reason is that "structural design" has too many different approaches across frontend, backend, and small scripts — a fixed framework is needed to anchor it. Borrowing from DDD's layered concepts, it's simplified into three layers: data structures/interfaces/repositories in one layer, application logic/orchestration in another, and user-facing or external interfaces in a layer called adapters. This logic is technology-agnostic; frontend, backend, small scripts can roughly all fit in, because it doesn't preach any profound theories — it's just a structural division of code. The fundamental reason for this division is that LLMs often write all the code in a single folder, and as the folder grows long, the code starts to drift. Dividing the context reduces the difficulty of comprehension; the same principle applies to human understanding of code.

The Requirement + Design phases together produce a feature output, containing two documents: a requirements document and a design document, serving as the alignment baseline for this development session.

Embedded within this is a small mechanism called the **later-on memo** — if some brilliant idea pops up during the requirement or design phase but is only loosely related to the current task or is too complex, it gets jotted down there to prevent over-design.

**Execute** — `_source/prompts/execute/SKILL.md`
This is a phase that orchestrates multiple skills. The core idea is context isolation — testing, coding, and review are three segments isolated from each other.

The context across multiple agents is unified: the @intent written in the files is itself the content that sub-agents need to read and execute. The testing agent reads the requirement and design documents, while the main agent dispatches each file's @intent as the specification for that file to the sub-agents. The sub-agents no longer need to consider "what content should be designed" — that is already satisfied in the main thread's context. Similarly, the coding agent and the review agent each perform their own duties, aligned through the unified @intent contract.

**Report** — `_source/prompts/report/SKILL.md`
It takes over Git's focus on file changes and packages the understanding of requirements. Through the global workflow phase of a feature, the intent of each change is consolidated into an intent package. During subsequent updates and modifications, the intent packages published by the report are consulted first, making it easier for the model to search code content.

Why this design? In actual feedback from current RAG tools, many times the large language model would rather use its own native grep than use the code analysis tools that come with RAG. Since that's the case, we comply — after each code change, a project memo/direction indicator is left behind to help the model analyze its own code, improving code quality in subsequent design and modifications. At least when the model searches, it has a direction.

In essence, the report suite is the context used to **globally unify intent** in engineering specifications.

### Loop / State Machine

The four phases describe the "static structure" of the workflow, but development is an ongoing process — how do you know when to move to the next phase?

The essence of the Loop is: **you have infinite tokens and a local codebase; changing code costs practically nothing, and you have endless requirements that can trigger the loop on a timer**. After each round of conversation, it automatically scans the feature folders under the `.intentflow/` directory, checking for file status changes (has `requirement.md` appeared? has `design.md` appeared?). Once a new file is detected, it automatically pushes a notification prompting entry into the next phase.

For ordinary developers, this mechanism might seem "overly extravagant," but its core meaning is sound: **a timed, phase-triggered state machine that drives skill execution**.

In implementation, this is embodied in the `another_extension_pi/init_feature/` plugin:
- `engine.ts` — Pure functions: scan feature directory, read file statuses, determine the current phase
- `register.ts` — Pi extension registration: listens for `session_start` to initialize snapshots, `turn_end` to auto-detect changes, and `/init-feature` command for manual trigger
- `index.ts` — Unified export entry

Many AI development tools have similar ideas, some tampering with prompts, some tampering with code. IntentFlow chooses the code path — implementing a lightweight state machine through the event mechanism of the Pi extension.

### No Fallback Philosophy

Logic code forbids "just in case" fallbacks. Only handle paths that are certain to occur; non-existent branches need no defense. Fallback = it doesn't explode when crashing, not graceful execution. Fallbacks not covered by tests are potential bugs.

### About @intent

A personal opinion (not scientifically verified, merely a design starting point): code files are essentially **analysis corpora** for large language models. Textual constraints are inherently good for models — code that a machine can't understand, a model likely can't understand either.

This is especially true for low-level code: the more efficient, capable, and hardware-close the writing style, the further it deviates from the token distribution in the model's knowledge base. Let alone humans, the cost for a large language model to understand it is not small. At this point, adding comments as aids can save enormous overhead when the model subsequently analyzes the same code repeatedly.

My @intent approach assumes by default that when an AI seeks to understand code, it does not analyze it chunk by chunk — it reads the entire file through first, and only later, when modifications are needed, processes it in batches.

#### Why @intent is written in code files, not an external PRD

External documents like PRDs (Product Requirement Documents) have an unavoidable problem: **file rot**. Once code and documentation are maintained separately, you must maintain two copies of the content — the code itself and the PRD. In reality, most people won't look at the document again after writing the code, nor do they read it before writing code. PRDs are a burden for non-professionals.

A more realistic problem: what if, while writing, you suddenly think of a better optimization? Do you then need to update both the code file and the PRD simultaneously? It's a huge hassle.

So, it's better to break the PRD down by layers and write it directly into the code files themselves. This way, when a large language model reads the code corpus, it can conveniently modify the @intent along the way — there's no such thing as "forgetting to update the documentation."

Write a paragraph of natural language @intent at the top of each file, explaining why this file exists, what responsibility it bears, and where its boundaries lie. Humans can understand it at a glance, AI can understand it, and tools can read, track, and cluster it. This is the contractual foundation of the entire framework.

---

## Tool Capabilities Overview

### MCP Tools

| Tool | Function |
|------|------|
| `check_file_size` | Check file size, excluding comments to count pure lines of code |
| `trace_dependency_chain` | Trace along dependency chains, analyzing @intent semantics |
| `project_intent` | Create/update @intent comments |
| `list_folder_intents` | List @intent projections within a folder |

### CLI Commands

`iflow check-file-size`, `iflow trace-dependency-chain`, `iflow project-intent`, `iflow list-folder-intents`, `iflow intent-package`

### VS Code Commands

Large file scanning, current file and dependency inspection, capability map visualization, box selection interaction, dry-run mode, etc.

### Pi Agent Integration

Sub-process agent scheduling (SpawnAgent/ListAgents), access policy control, RPC process pool, TUI visualization panel.

---

## Project Structure

```
.intentflow/                     # Workflow artifacts (requirements/design/report/intent packages)
_source/                  # Skill definitions
src/
  data/                   # Entities + interfaces + implementations
  application/            # Use case orchestration
  adapter/                # CLI / MCP / VS Code / Pi
dist/                     # Build artifacts
another_extension_pi/     # Pi extension plugins
  init_feature/           #   State machine: auto-detect feature phase transitions
```

---

## Skill Quality Standards Reference

See `_source/skill-standards-ref.md` for details. The seven core rules: presuppose defaults, depersonalize, procedural declaration, minimal and unambiguous, no role-playing, no redundancy, no fallbacks.

These standards follow the same reasoning above — as models become stronger, they may be replaced, but the goal of "aligning with humans" remains unchanged.

---

## License

<<<<<<< HEAD
MIT
=======
MIT
>>>>>>> 3118520158986d312d70d6b1b554d7a43f92ba29
