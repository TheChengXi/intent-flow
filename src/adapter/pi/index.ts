/**
 * @intent
 * pi 适配器统一导出出口。导出 DIContainer、extension 入口函数、AgentCommTools（通信工具）、
 * AgentMessagingService / MessageRouter（通信运行时）与 registerChildTools（子进程轻量通道）。
 * SpawnAgentTool/SubProcessRunner 导出已移除。
 * 验收条件：
 * - 导出清单与设计文档一致，无已删模块残留导出
 */


export { DIContainer } from './DIContainer';
export { AgentCommTools } from './tools/AgentCommTools';
export { AgentMessagingService } from './runtime/AgentMessagingService';
export { MessageRouterImpl } from './runtime/MessageRouter';
export { RpcProcessPool } from './runtime/RpcProcessPool';
export { registerChildTools } from './child/ChildExtension';
export { default as extension } from './extension';
