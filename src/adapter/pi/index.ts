/**
 * @intent
 * pi 适配器统一导出出口。导出 DIContainer、extension 入口函数、SubProcessRunner（运行时）与 tools 目录下的工具模块。
 * AgentRepositoryImpl 自 pi-adapter-layer-reorg 起下沉 data 层，不再经 adapter 导出（外部消费者应从 data 层引用）。
 */


export { DIContainer } from './DIContainer';
export { SubProcessRunner } from './runtime/SubProcessRunner';
export { SpawnAgentTool } from './tools/SpawnAgentTool';
export { default as extension } from './extension';
