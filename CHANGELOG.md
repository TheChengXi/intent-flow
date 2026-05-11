# Changelog

All notable changes to the CDD Framework extension will be documented in this file.

## [Unreleased]

### Added
- **跨文件引用功能**：编译器现在可以自动提取被调用函数的契约
  - 优先从 import/include 语句中查找引用的文件
  - 支持全局搜索作为兜底方案
  - 提供便捷的导入建议功能
  - 支持 TypeScript/JavaScript/Python/C/C++/Go 等多种语言的导入语法

- **OpenAI API 兼容性**：支持 OpenAI 格式的 API
  - 自动检测 API 提供商（Anthropic 或 OpenAI）
  - 支持 DeepSeek、ModelScope 等第三方 API
  - 详细的错误日志和诊断信息

- **多语言注释支持**：完善的多语言注释处理
  - 支持 `//`（C-style）和 `#`（Python-style）注释
  - 自动检测文件语言并生成对应的 `@end` 标记
  - 支持 14+ 种编程语言

### Fixed
- **注释解析边界问题**：
  - 修复装饰器行（如 `# ====`）导致解析失败的问题
  - 修复空行导致注释块截断的问题
  - 支持多种返回类型语法（`=>`, `->`, `:`）

- **代码插入格式问题**：
  - 修复代码插入后缺少空行的问题
  - 自动检测插入位置下方是否有内容并添加适当的分隔符

- **@end 标记检测**：
  - 从硬编码的 `// @end` 改为通用的 `@end` 检测
  - 支持所有语言的 @end 标记

- **裁决逻辑对齐**：
  - 修正裁决机制的哲学对齐：注释是契约，代码必须符合
  - 路径 A（注释为准）：重新编译生成符合契约的代码
  - 路径 B（代码为准）：反向转译代码为注释

### Changed
- **API 超时时间**：从 30 秒增加到 60 秒
- **ReviewContext 接口**：从 `comment: string` 改为 `comment: CDDComment`
- **错误处理**：增强 API 调用的错误日志和诊断信息

### Technical
- 重构 ReviewCommand 使用 ReviewerContextManager
- 实现 B+C 架构的上下文管理器模式
- 添加 WorkLineService.extractReferencedContracts() 方法
- 添加 WorkLineService.extractImportedFiles() 方法
- 添加 WorkLineService.extractFunctionCalls() 方法
- 添加 WorkLineService.searchContractInWorkspaceWithPath() 方法

## [0.0.1] - Initial Release

### Added
- 基础的 CDD v2.4.1 范式支持
- 编译器（Compiler）角色
- 审查员（Reviewer）角色
- 转译员（Translator）角色
- 历史记录管理
- 工作日志记录
