import { CodeSnippet } from './CodeSnippet';
import { DependencyInfo } from './DependencyInfo';
import { TypeDefinition } from './TypeDefinition';

// @intent: 部分上下文提取结果实体，包含目标代码及其依赖

// @entity: PartialContextResult
// 部分上下文提取结果
export interface PartialContextResult {
  targetCode: CodeSnippet;              // 目标代码片段
  directDependencies: DependencyInfo[]; // 直接依赖
  typeDefinitions: TypeDefinition[];    // 类型定义
}
