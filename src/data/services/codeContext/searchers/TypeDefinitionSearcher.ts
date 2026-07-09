import { TreeSitterManager } from '../../core/TreeSitterManager';
import { CacheRepositoryImpl } from '../../cache/CacheRepositoryImpl';

// @contract: TypeDefinitionSearcher.searchInFile(typeName: string, filePath: string, language?: string) => Promise<string | null>
// @step: [读取文件] 读取指定文件内容
// @step: [检测语言] 如果提供了 language，使用 Tree-sitter 方案
// @step: [调用方法] 调用 searchWithTreeSitter 或 searchWithRegex
// @step: [返回] 返回类型定义文本或 null
// @boundary: 当文件不存在时，返回 null
// @boundary: 当类型未找到时，返回 null

export class TypeDefinitionSearcher {
  // @contract: searchInFile(typeName: string, filePath: string, language?: string) => Promise<string | null>
  // @step: [读取文件] 读取指定文件内容
  // @step: [检测语言] 如果提供了 language，使用 Tree-sitter 方案
  // @step: [调用方法] 调用 searchWithTreeSitter 或 searchWithRegex
  // @step: [返回] 返回类型定义文本或 null
  // @boundary: 当文件不存在时，返回 null
  // @boundary: 当类型未找到时，返回 null
  static async searchInFile(typeName: string, filePath: string, language?: string): Promise<string | null> {
    const cache = CacheRepositoryImpl.getInstance();

    try {
      // 检查缓存
      const cached = cache.getType(typeName, filePath);
      if (cached) {
        return cached;
      }

      console.log(`[TypeDefinitionSearcher] 搜索类型定义: ${typeName} 在文件: ${filePath}`);

      // 使用缓存读取文件
      const content = await cache.getFileContent(filePath);
      console.log(`[TypeDefinitionSearcher] 文件内容长度: ${content.length}`);

      let result: string | null = null;

      if (language) {
        result = await this.searchWithTreeSitter(typeName, content, language);
      } else {
        result = this.searchWithRegex(typeName, content);
      }

      // 缓存结果
      if (result) {
        cache.setType(typeName, filePath, result);
      }

      return result;
    } catch (error) {
      return null;
    }
  }
  // @end

  // @contract: searchWithTreeSitter(typeName: string, content: string, language: string) => Promise<string | null>
  // @step: [初始化] 初始化 Tree-sitter parser
  // @step: [解析代码] 使用 Tree-sitter 解析代码生成 AST
  // @step: [遍历 AST] 递归遍历 AST 查找类型定义节点
  // @step: [匹配名称] 检查类型名称是否匹配
  // @step: [提取文本] 提取完整的类型定义文本
  // @step: [返回] 返回类型定义文本或 null
  // @boundary: 当 Tree-sitter 初始化失败时，回退到正则方案
  // @boundary: 当语言不支持时，回退到正则方案
  private static async searchWithTreeSitter(typeName: string, content: string, language: string): Promise<string | null> {
    try {
      await TreeSitterManager.init();

      const lang = await TreeSitterManager.getLanguage(language);
      if (!lang) {
        console.warn('[TypeDefinitionSearcher] Tree-sitter 不支持该语言，回退到正则方案');
        return this.searchWithRegex(typeName, content);
      }

      const parser = await TreeSitterManager.getParser();
      parser.setLanguage(lang);
      const tree = parser.parse(content);

      if (!tree) {
        console.warn('[TypeDefinitionSearcher] Tree-sitter 解析失败，回退到正则方案');
        return this.searchWithRegex(typeName, content);
      }

      const result = this.findTypeDefinitionNode(tree.rootNode, typeName, language);
      if (result) {
        console.log(`[TypeDefinitionSearcher] 找到类型定义: ${typeName}`);
        return result.text;
      }

      console.log(`[TypeDefinitionSearcher] 未找到类型定义: ${typeName}`);
      return null;

    } catch (error) {
      console.warn('[TypeDefinitionSearcher] Tree-sitter 提取失败，回退到正则方案:', error);
      return this.searchWithRegex(typeName, content);
    }
  }
  // @end

  // @contract: findTypeDefinitionNode(node: any, typeName: string, language: string) => any | null
  // @step: [检查节点类型] 检查当前节点是否是类型定义节点
  // @step: [提取名称] 从节点中提取类型名称
  // @step: [匹配名称] 比较名称是否匹配
  // @step: [递归查找] 如果不匹配，递归查找子节点
  // @step: [返回] 返回匹配的节点或 null
  private static findTypeDefinitionNode(node: any, typeName: string, language: string): any | null {
    const lang = language.toLowerCase();

    if (lang === 'typescript' || lang === 'javascript' || lang === 'tsx') {
      // TypeScript/JavaScript: interface, type_alias, class, enum
      const typeNodeTypes = [
        'interface_declaration',
        'type_alias_declaration',
        'class_declaration',
        'enum_declaration'
      ];

      if (typeNodeTypes.includes(node.type)) {
        const nameNode = node.children.find((c: any) => c.type === 'type_identifier' || c.type === 'identifier');
        if (nameNode && nameNode.text === typeName) {
          return node;
        }
      }
    } else if (lang === 'python') {
      // Python: class
      if (node.type === 'class_definition') {
        const nameNode = node.children.find((c: any) => c.type === 'identifier');
        if (nameNode && nameNode.text === typeName) {
          return node;
        }
      }
    } else if (lang === 'go') {
      // Go: type declaration
      if (node.type === 'type_declaration' || node.type === 'type_spec') {
        const nameNode = node.children.find((c: any) => c.type === 'type_identifier');
        if (nameNode && nameNode.text === typeName) {
          return node;
        }
      }
    } else if (lang === 'cpp' || lang === 'c') {
      // C/C++: struct, class, enum
      const typeNodeTypes = ['struct_specifier', 'class_specifier', 'enum_specifier'];
      if (typeNodeTypes.includes(node.type)) {
        const nameNode = node.children.find((c: any) => c.type === 'type_identifier');
        if (nameNode && nameNode.text === typeName) {
          return node;
        }
      }
    }

    // 递归查找子节点
    for (const child of node.children) {
      const result = this.findTypeDefinitionNode(child, typeName, language);
      if (result) {
        return result;
      }
    }

    return null;
  }
  // @end

  // @contract: searchWithRegex(typeName: string, content: string) => string | null
  // @step: [搜索类型定义] 使用正则搜索 interface/type/class/enum TypeName
  // @step: [提取定义块] 提取完整的类型定义代码
  // @step: [返回] 返回类型定义文本或 null
  private static searchWithRegex(typeName: string, content: string): string | null {
    // 搜索类型定义（interface, type, class, enum）
    const typeDefRegex = new RegExp(`^\\s*(export\\s+)?(interface|type|class|enum)\\s+${typeName}\\b`, 'm');
    const match = typeDefRegex.exec(content);

    if (!match) {
      console.log(`[TypeDefinitionSearcher] 未找到类型定义: ${typeName}`);
      return null;
    }

    console.log(`[TypeDefinitionSearcher] 找到类型定义: ${typeName} at index ${match.index}`);

    // 找到定义的起始位置
    const startIndex = match.index;
    const lines = content.split('\n');
    let currentIndex = 0;
    let startLine = 0;

    // 找到起始行
    for (let i = 0; i < lines.length; i++) {
      if (currentIndex + lines[i].length >= startIndex) {
        startLine = i;
        break;
      }
      currentIndex += lines[i].length + 1; // +1 for newline
    }

    // 提取完整的类型定义
    let definition = '';
    let braceCount = 0;
    let inDefinition = false;

    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i];
      definition += line + '\n';

      // 计算大括号数量
      for (const char of line) {
        if (char === '{') {
          braceCount++;
          inDefinition = true;
        } else if (char === '}') {
          braceCount--;
        }
      }

      // 如果是 type 别名（没有大括号），遇到分号或换行结束
      if (!inDefinition && line.includes('=') && (line.trim().endsWith(';') || line.trim().endsWith(','))) {
        break;
      }

      // 如果大括号匹配完成，结束
      if (inDefinition && braceCount === 0) {
        break;
      }
    }

    return definition.trim();
  }
  // @end
}

