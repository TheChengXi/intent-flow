import { FunctionDefinition } from '../entities/FunctionDefinition';

/**
 * @intent
 * 代码静态分析的抽象边界，统一封装 tree-sitter 解析能力。新增 countNonCommentLines 方法用于排除注释后的行数统计。
 */

export interface ICodeParserRepository {
  /**
   * 解析代码生成 AST
   * @param content 代码内容
   * @param language 编程语言
   * @returns AST 对象
   */
  parse(content: string, language: string): Promise<any>;

  /**
   * 在文件中搜索函数定义
   * @param functionName 函数名
   * @param filePath 文件路径
   * @param language 编程语言
   * @returns 函数定义（如果找到）
   */
  searchFunctionDefinition(
    functionName: string,
    filePath: string,
    language: string
  ): Promise<FunctionDefinition | null>;

  /**
   * 在文件中搜索类型定义
   * @param typeName 类型名
   * @param filePath 文件路径
   * @param language 编程语言
   * @returns 类型定义代码（如果找到）
   */
  searchTypeDefinition(
    typeName: string,
    filePath: string,
    language: string
  ): Promise<string | null>;

  /**
   * 从代码中提取函数调用
   * @param code 代码内容
   * @param language 编程语言
   * @returns 函数名列表
   */
  extractFunctionCalls(code: string, language: string): Promise<string[]>;

  /**
   * 从代码中提取类型引用
   * @param code 代码内容
   * @param language 编程语言
   * @returns 类型名列表
   */
  extractTypeReferences(code: string, language: string): Promise<string[]>;

  /**
   * 从代码中提取 import 语句
   * @param content 文件内容
   * @param currentDir 当前目录
   * @param language 编程语言
   * @returns 导入的文件路径列表
   */
  extractImports(
    content: string,
    currentDir: string,
    language: string
  ): Promise<string[]>;

  /**
   * 统计排除注释后的纯代码行数
   * @param content 文件内容
   * @param filePath 文件路径（用于推断编程语言）
   * @returns 排除注释后的代码行数（空行保留）
   */
  countNonCommentLines(content: string, filePath: string): Promise<number>;

  /**
   * 提取函数的 @contract 注释
   * @param functionName 函数名
   * @param workspaceRoot 工作区根目录
   * @returns 契约文本（如果找到）
   */
  searchContract(
    functionName: string,
    workspaceRoot: string
  ): Promise<string | null>;

}
