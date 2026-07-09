---
name: resolveImportPath-dead-code
type: reference
---

# `AnalyzeCallGraphUseCase.resolveImportPath` — 死代码

**发现时间：** 2026-06-14

**用意：** 把相对导入路径（`./foo`、`../bar`）解析成绝对路径，顺便去掉文件后缀名。

**为什么死了：** 下游 `ImportExtractor.extractImports()` 已经返回了完整的绝对路径，这个方法根本不需要被调用。

**关联问题：** [[why-these-tools-were-retired]] 里说的"AI 写完后不验证，方法写了等于没写"。这里是同一类问题——AI（或人）在 use case 里预先写了一个"可能有用"的工具函数，但生产路径从来没触发它。

**处理：** 删除。`AnalyzeCallGraphUseCase` 最终的流程是：
1. `fileRepo.scanDirectory()`（原先是私有 `scanDirectory` + `fs.readdirSync`）
2. `fileRepo.readFile()`（原先是 `fs.readFileSync`）
3. `parserRepo.extractImports()` → 已经是绝对路径
