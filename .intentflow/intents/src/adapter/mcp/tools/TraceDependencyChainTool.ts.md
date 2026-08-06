# TraceDependencyChainTool.ts

`src/adapter/mcp/tools/TraceDependencyChainTool.ts`

**intent:** 作为 MCP 工具层，处理 TraceDependencyChainInput → TraceDependencyChainOutput。 核心行为：接收 entryFile 参数，调用 TraceDependencyChainUseCase，返回同层/跨层依赖分组。 输入：entryFile（必填）、layerConfig（可选）。 输出：entry 信息 + dependencies（same_layer / cross_layer 两组）。 谁调用：MCP Server 根据 "trace_dependency_chain" 工具名分发至此。 边界：entryFile 不存在时向上抛错；依赖读取失败跳过单条。
