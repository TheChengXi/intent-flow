// @intent: 类型定义实体，表示类型的定义信息

// @entity: TypeDefinition
// 类型定义
export interface TypeDefinition {
  name: string;      // 类型名
  filePath: string;  // 文件路径
  code: string;      // 完整代码
}
