/**
 * @intent
 * 从 @contract 契约行提取类型引用名的工具，供类型依赖分析使用；多语言 tree-sitter 路径解析失败时回退正则，过滤内置类型与基础类型。
 * 边界：契约行格式不正确时返回空数组，不抛错；内置类型名单集中维护在 LanguageConfig。
 * 验收条件：
 * - 无 language 参数时返回正则提取的类型名数组
 * - 内置类型（string/number 等）被过滤不出现在结果中
 */

import { TreeSitterManager } from '../../tree-sitter/TreeSitterManager';
import { LanguageConfig } from '../../tree-sitter/LanguageConfig';

// @contract: TypeReferenceExtractor.extractFromContractLine(contractLine: string, language?: string) => Promise<string[]>
// @step: [检测语言] 如果提供了 language，使用 Tree-sitter 方案
// @step: [调用方法] 调用 extractWithTreeSitter 或 extractWithRegex
// @step: [返回] 返回类型名数组

export class TypeReferenceExtractor {
  // @contract: extractFromContractLine(contractLine: string, language?: string) => Promise<string[]>
  // @step: [检测语言] 如果提供了 language，使用 Tree-sitter 方案
  // @step: [调用方法] 调用 extractWithTreeSitter 或 extractWithRegex
  // @step: [返回] 返回类型名数组
  static async extractFromContractLine(contractLine: string, language?: string): Promise<string[]> {
    if (language) {
      return await this.extractWithTreeSitter(contractLine, language);
    }
    return this.extractWithRegex(contractLine);
  }

  // @contract: extractWithRegex(contractLine: string) => string[]
  // @step: [提取参数类型] 从参数列表中提取类型（param: Type）
  // @step: [提取返回类型] 从返回值中提取类型（=> Type）
  // @step: [展开泛型] 从泛型中提取内部类型（Promise<User> => User）
  // @step: [过滤内置类型] 过滤掉基础类型和标准库类型
  // @step: [去重] 使用 Set 去除重复的类型名
  // @step: [返回] 返回类型名数组
  // @boundary: 当 contractLine 格式不正确时，返回空数组
  private static extractWithRegex(contractLine: string): string[] {
    const types = new Set<string>();

    const builtinTypes = new Set([
      'string', 'number', 'boolean', 'null', 'undefined', 'void', 'any', 'unknown', 'never', 'symbol', 'bigint',
      'Promise', 'Array', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Date', 'Error', 'RegExp',
      'Partial', 'Required', 'Readonly', 'Record', 'Pick', 'Omit', 'Exclude', 'Extract',
      'JSX', 'React', 'ReactNode', 'ReactElement', 'FC', 'Component'
    ]);

    const typeRegex = /:\s*([A-Z][a-zA-Z0-9_<>,\s\[\]|&]*)|=>\s*([A-Z][a-zA-Z0-9_<>,\s\[\]|&]*)/g;

    let match;
    while ((match = typeRegex.exec(contractLine)) !== null) {
      const typeStr = match[1] || match[2];
      if (typeStr) {
        const typeNames = this.extractTypeNamesFromTypeString(typeStr.trim());
        typeNames.forEach(typeName => {
          if (!builtinTypes.has(typeName)) {
            types.add(typeName);
          }
        });
      }
    }

    return Array.from(types);
  }
  // @end

  // @contract: extractWithTreeSitter(contractLine: string, language: string) => Promise<string[]>
  // @step: [解析契约] 使用 Tree-sitter 解析契约行
  // @step: [遍历 AST] 递归遍历 AST 查找类型注解节点
  // @step: [提取类型] 从类型注解中提取类型名
  // @step: [过滤内置] 过滤掉基础类型和标准库类型
  // @step: [去重] 使用 Set 去除重复
  // @step: [返回] 返回类型名数组
  // @boundary: 当 Tree-sitter 初始化失败时，回退到正则方案
  // @boundary: 当语言不支持时，回退到正则方案
  private static async extractWithTreeSitter(contractLine: string, language: string): Promise<string[]> {
    try {
      await TreeSitterManager.init();

      const lang = await TreeSitterManager.getLanguage(language);
      if (!lang) {
        console.warn('[TypeReferenceExtractor] Tree-sitter 不支持该语言，回退到正则方案');
        return this.extractWithRegex(contractLine);
      }

      const parser = await TreeSitterManager.getParser();
      parser.setLanguage(lang);

      // 将契约行包装成可解析的代码
      const wrappedCode = this.wrapContractLine(contractLine, language);
      const tree = parser.parse(wrappedCode);

      if (!tree) {
        console.warn('[TypeReferenceExtractor] Tree-sitter 解析失败，回退到正则方案');
        return this.extractWithRegex(contractLine);
      }

      const types = new Set<string>();
      const builtinTypes = this.getBuiltinTypes();

      const traverse = (node: any) => {
        const typeNames = this.extractTypeFromNode(node, language);
        typeNames.forEach(typeName => {
          if (!builtinTypes.has(typeName)) {
            types.add(typeName);
          }
        });

        for (const child of node.children) {
          traverse(child);
        }
      };

      traverse(tree.rootNode);
      return Array.from(types);

    } catch (error) {
      console.warn('[TypeReferenceExtractor] Tree-sitter 提取失败，回退到正则方案:', error);
      return this.extractWithRegex(contractLine);
    }
  }
  // @end

  // @contract: wrapContractLine(contractLine: string, language: string) => string
  // @step: [提取函数签名] 从契约行中提取函数签名部分
  // @step: [包装代码] 根据语言包装成可解析的函数声明
  // @step: [返回] 返回包装后的代码
  private static wrapContractLine(contractLine: string, language: string): string {
    const lang = language.toLowerCase();

    // 提取 @contract: 后面的函数签名
    const match = contractLine.match(/@contract:\s*(.+)/);
    if (!match) {
      return contractLine;
    }

    const signature = match[1].trim();

    if (lang === 'typescript' || lang === 'tsx') {
      // TypeScript: function functionName(params): ReturnType
      return `function ${signature} {}`;
    } else if (lang === 'javascript') {
      // JavaScript: 去掉类型注解
      return `function ${signature.replace(/:\s*[^,)]+/g, '')} {}`;
    } else if (lang === 'python') {
      // Python: def functionName(params) -> ReturnType:
      return `def ${signature}:\n    pass`;
    } else if (lang === 'go') {
      // Go: func functionName(params) ReturnType {}
      return `func ${signature} {}`;
    }

    return signature;
  }
  // @end

  // @contract: extractTypeFromNode(node: any, language: string) => string[]
  // @step: [检查节点类型] 检查当前节点是否是类型注解节点
  // @step: [提取类型名] 从节点中提取类型名
  // @step: [返回] 返回类型名数组
  private static extractTypeFromNode(node: any, language: string): string[] {
    const lang = language.toLowerCase();
    const types: string[] = [];

    if (lang === 'typescript' || lang === 'tsx') {
      // TypeScript 类型注解节点
      const typeNodeTypes = [
        'type_annotation',
        'type_identifier',
        'generic_type',
        'predefined_type'
      ];

      if (typeNodeTypes.includes(node.type)) {
        if (node.type === 'type_identifier') {
          types.push(node.text);
        } else if (node.text) {
          // 从文本中提取类型名
          const extracted = this.extractTypeNamesFromTypeString(node.text);
          types.push(...extracted);
        }
      }
    } else if (lang === 'python') {
      // Python 类型注解
      if (node.type === 'type') {
        const typeNames = this.extractTypeNamesFromTypeString(node.text);
        types.push(...typeNames);
      }
    } else if (lang === 'go') {
      // Go 类型
      if (node.type === 'type_identifier') {
        types.push(node.text);
      }
    }

    return types;
  }
  // @end

  // @contract: extractTypeNamesFromTypeString(typeStr: string) => string[]
  // @step: [移除空格] 移除所有空格
  // @step: [提取类型名] 使用正则提取所有大写开头的类型名
  // @step: [返回] 返回类型名数组
  private static extractTypeNamesFromTypeString(typeStr: string): string[] {
    const types: string[] = [];
    const cleaned = typeStr.replace(/\s+/g, '');
    const typeNameRegex = /[A-Z][a-zA-Z0-9_]*/g;
    let match;
    while ((match = typeNameRegex.exec(cleaned)) !== null) {
      types.push(match[0]);
    }
    return types;
  }
  // @end

  // @contract: getBuiltinTypes() => Set<string>
  // @step: [委托] 委托给 LanguageConfig.getBuiltinTypes
  // @step: [返回] 返回内置类型集合
  private static getBuiltinTypes(): Set<string> {
    return LanguageConfig.getBuiltinTypes('typescript');
  }
  // @end
}

