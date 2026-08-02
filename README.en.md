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

MIT