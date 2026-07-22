import { TreeSitterManager } from '../../tree-sitter/TreeSitterManager';
import { CacheRepositoryImpl } from '../../cache/CacheRepositoryImpl';

// @intent: 在文件中搜索函数定义，返回完整的函数代码（包含注释）

// @entity: FunctionDefinitionResult
// 函数定义搜索结果
export interface FunctionDefinitionResult {
  functionName: string;
  code: string;           // 完整的函数代码（包含注释）
  startLine: number;
  endLine: number;
  contract?: string;      // 如果有 @contract 注释
}

// @contract: FunctionDefinitionSearcher.searchInFile(functionName: string, filePath: string, language?: string) => Promise<FunctionDefinitionResult | null>
// @step: [读取文件] 读取指定文件内容
// @step: [检测语言] 如果提供了 language，使用 Tree-sitter 方案
// @step: [调用方法] 调用 searchWithTreeSitter 或 searchWithRegex
// @step: [返回] 返回函数定义结果或 null
// @boundary: 当文件不存在时，返回 null
// @boundary: 当函数未找到时，返回 null
export class FunctionDefinitionSearcher {
  // @contract: searchInFile(functionName: string, filePath: string, language?: string) => Promise<FunctionDefinitionResult | null>
  // @step: [读取文件] 读取指定文件内容
  // @step: [检测语言] 如果提供了 language，使用 Tree-sitter 方案
  // @step: [调用方法] 调用 searchWithTreeSitter 或 searchWithRegex
  // @step: [返回] 返回函数定义结果或 null
  // @boundary: 当文件不存在时，返回 null
  // @boundary: 当函数未找到时，返回 null
  static async searchInFile(
    functionName: string,
    filePath: string,
    language?: string
  ): Promise<FunctionDefinitionResult | null> {
    const cache = CacheRepositoryImpl.getInstance();

    try {
      // 检查缓存
      const cached = cache.getFunction(functionName, filePath);
      if (cached) {
        return cached;
      }

      console.log(`[FunctionDefinitionSearcher] 搜索函数定义: ${functionName} 在文件: ${filePath}`);

      // 使用缓存读取文件
      const content = await cache.getFileContent(filePath);

      let result: FunctionDefinitionResult | null = null;

      if (language) {
        result = await this.searchWithTreeSitter(functionName, content, language);
      } else {
        result = this.searchWithRegex(functionName, content);
      }

      // 缓存结果
      if (result) {
        cache.setFunction(functionName, filePath, result);
      }

      return result;
    } catch (error) {
      console.warn(`[FunctionDefinitionSearcher] 搜索失败:`, error);
      return null;
    }
  }
  // @end

  // @contract: searchWithTreeSitter(functionName: string, content: string, language: string) => Promise<FunctionDefinitionResult | null>
  // @step: [初始化] 初始化 Tree-sitter parser
  // @step: [解析代码] 使用 Tree-sitter 解析代码生成 AST
  // @step: [遍历 AST] 递归遍历 AST 查找函数定义节点
  // @step: [匹配名称] 检查函数名称是否匹配
  // @step: [提取代码] 提取完整的函数定义代码（包含前面的注释）
  // @step: [返回] 返回函数定义结果或 null
  // @boundary: 当 Tree-sitter 初始化失败时，回退到正则方案
  // @boundary: 当语言不支持时，回退到正则方案
  private static async searchWithTreeSitter(
    functionName: string,
    content: string,
    language: string
  ): Promise<FunctionDefinitionResult | null> {
    try {
      await TreeSitterManager.init();

      const lang = await TreeSitterManager.getLanguage(language);
      if (!lang) {
        console.warn('[FunctionDefinitionSearcher] Tree-sitter 不支持该语言，回退到正则方案');
        return this.searchWithRegex(functionName, content);
      }

      const parser = await TreeSitterManager.getParser();
      parser.setLanguage(lang);
      const tree = parser.parse(content);

      if (!tree) {
        console.warn('[FunctionDefinitionSearcher] Tree-sitter 解析失败，回退到正则方案');
        return this.searchWithRegex(functionName, content);
      }

      const result = this.findFunctionNode(tree.rootNode, functionName, language, content);
      if (result) {
        console.log(`[FunctionDefinitionSearcher] 找到函数定义: ${functionName}`);
        return result;
      }

      console.log(`[FunctionDefinitionSearcher] 未找到函数定义: ${functionName}`);
      return null;

    } catch (error) {
      console.warn('[FunctionDefinitionSearcher] Tree-sitter 提取失败，回退到正则方案:', error);
      return this.searchWithRegex(functionName, content);
    }
  }
  // @end

  // @contract: findFunctionNode(node: any, functionName: string, language: string, content: string) => FunctionDefinitionResult | null
  // @step: [检查节点类型] 检查当前节点是否是函数定义节点
  // @step: [提取名称] 从节点中提取函数名称
  // @step: [匹配名称] 比较名称是否匹配
  // @step: [提取代码] 提取完整的函数代码（包含前面的注释）
  // @step: [递归查找] 如果不匹配，递归查找子节点
  // @step: [返回] 返回匹配的结果或 null
  private static findFunctionNode(
    node: any,
    functionName: string,
    language: string,
    content: string
  ): FunctionDefinitionResult | null {
    const lang = language.toLowerCase();

    if (lang === 'typescript' || lang === 'javascript' || lang === 'tsx') {
      // TypeScript/JavaScript: function_declaration, method_definition, arrow_function
      const functionNodeTypes = [
        'function_declaration',
        'method_definition',
        'lexical_declaration',
        'variable_declarator'
      ];

      if (functionNodeTypes.includes(node.type)) {
        const nameNode = node.children.find((c: any) =>
          c.type === 'identifier' || c.type === 'property_identifier'
        );

        if (nameNode && nameNode.text === functionName) {
          return this.extractFunctionCode(node, content);
        }
      }
    } else if (lang === 'python') {
      if (node.type === 'function_definition') {
        const nameNode = node.children.find((c: any) => c.type === 'identifier');
        if (nameNode && nameNode.text === functionName) {
          return this.extractFunctionCode(node, content);
        }
      }
    } else if (lang === 'go') {
      if (node.type === 'function_declaration' || node.type === 'method_declaration') {
        const nameNode = node.children.find((c: any) => c.type === 'identifier');
        if (nameNode && nameNode.text === functionName) {
          return this.extractFunctionCode(node, content);
        }
      }
    }

    for (const child of node.children) {
      const result = this.findFunctionNode(child, functionName, language, content);
      if (result) {
        return result;
      }
    }

    return null;
  }
  // @end

  private static extractFunctionCode(node: any, content: string): FunctionDefinitionResult {
    const lines = content.split('\n');
    const startLine = node.startPosition.row;
    const endLine = node.endPosition.row;

    let commentStartLine = startLine;
    for (let i = startLine - 1; i >= 0; i--) {
      const line = lines[i].trim();

      if (line.startsWith('//') || line.startsWith('#') || line.startsWith('/*') || line.startsWith('*')) {
        commentStartLine = i;
      } else if (line === '') {
        continue;
      } else {
        break;
      }
    }

    const codeLines = lines.slice(commentStartLine, endLine + 1);
    const code = codeLines.join('\n');

    let contract: string | undefined;
    for (const line of codeLines) {
      if (line.includes('@contract:')) {
        contract = line.trim();
        break;
      }
    }

    return {
      functionName: node.text.split('(')[0].trim().split(' ').pop() || '',
      code,
      startLine: commentStartLine,
      endLine,
      contract
    };
  }

  private static searchWithRegex(functionName: string, content: string): FunctionDefinitionResult | null {
    const patterns = [
      new RegExp(`^\\s*(export\\s+)?(async\\s+)?function\\s+${functionName}\\s*\\(`, 'm'),
      new RegExp(`^\\s*(export\\s+)?const\\s+${functionName}\\s*=\\s*(async\\s*)?\\(`, 'm'),
      new RegExp(`^\\s*(async\\s+)?${functionName}\\s*\\(`, 'm'),
      new RegExp(`^\\s*def\\s+${functionName}\\s*\\(`, 'm'),
      new RegExp(`^\\s*func\\s+${functionName}\\s*\\(`, 'm')
    ];

    for (const pattern of patterns) {
      const match = pattern.exec(content);
      if (match) {
        return this.extractFunctionCodeWithRegex(match.index, content, functionName);
      }
    }

    return null;
  }

  private static extractFunctionCodeWithRegex(
    startIndex: number,
    content: string,
    functionName: string
  ): FunctionDefinitionResult {
    const lines = content.split('\n');
    let currentIndex = 0;
    let startLine = 0;

    for (let i = 0; i < lines.length; i++) {
      if (currentIndex + lines[i].length >= startIndex) {
        startLine = i;
        break;
      }
      currentIndex += lines[i].length + 1;
    }

    let commentStartLine = startLine;
    for (let i = startLine - 1; i >= 0; i--) {
      const line = lines[i].trim();

      if (line.startsWith('//') || line.startsWith('#') || line.startsWith('/*') || line.startsWith('*')) {
        commentStartLine = i;
      } else if (line === '') {
        continue;
      } else {
        break;
      }
    }

    let braceCount = 0;
    let inFunction = false;
    let endLine = startLine;

    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i];

      for (const char of line) {
        if (char === '{') {
          braceCount++;
          inFunction = true;
        } else if (char === '}') {
          braceCount--;
        }
      }

      if (inFunction && braceCount === 0) {
        endLine = i;
        break;
      }
    }

    const codeLines = lines.slice(commentStartLine, endLine + 1);
    const code = codeLines.join('\n');

    let contract: string | undefined;
    for (const line of codeLines) {
      if (line.includes('@contract:')) {
        contract = line.trim();
        break;
      }
    }

    return {
      functionName,
      code,
      startLine: commentStartLine,
      endLine,
      contract
    };
  }
}
