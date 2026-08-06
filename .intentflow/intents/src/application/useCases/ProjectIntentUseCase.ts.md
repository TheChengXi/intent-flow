# ProjectIntentUseCase.ts

`src/application/useCases/ProjectIntentUseCase.ts`

**intent:** 投射意图用例，创建/更新文件中的 @intent 注释。 替换策略：优先通过 tree-sitter 解析 AST 定位 @intent 注释节点并替换； 不支持 tree-sitter 时静默回退到正则匹配。 保护机制：仅替换注释节点内的 @intent，不触及字符串/数据中的 @intent 文本。 边界： - 文件已存在且 force=false 时跳过 - force=true 时在已有文件中查找并替换 @intent 注释，不覆盖其他内容 - 查找以 @intent 内容标识为锚点，不限注释风格 (line-comment, block-comment, hash-comment) - tree-sitter 失败时静默回退到正则 - 多行注释整体替换，不残留旧行 验收条件： - 行注释 // @intent: 风格能被找到并替换为块注释 @intent 风格 - 字符串/数据中的 @intent 文本不被误匹配 - tree-sitter 不可用时自动回退到正则且结果正确
