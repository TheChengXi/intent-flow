/**
 * @intent
 * picomatch（glob 匹配库，纯 JS 无内置类型）的最小类型声明，消除 ts-node 全量类型检查的 TS7016。
 * 边界：声明为 any（不细化 API 类型）；仅满足 strict 模式下的模块解析。
 * 验收条件：
 * - ts-node 编译不再报 TS7016（mcp:dev 可用）
 * - tsc --noEmit 保持 0 错误
 */

declare module 'picomatch';
