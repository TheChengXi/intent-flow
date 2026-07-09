// @intent: 契约搜索结果实体，表示函数契约的搜索结果

// @entity: ContractSearchResult
// 契约搜索结果
export interface ContractSearchResult {
  contract: string;       // 契约文本
  filePath: string;       // 文件路径
  relativePath: string;   // 相对路径
  importPath: string;     // 导入路径
}
