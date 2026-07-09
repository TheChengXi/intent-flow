import { TreeSitterManager } from '../../core/TreeSitterManager';
import { LanguageConfig } from '../../core/LanguageConfig';

// @contract: FunctionCallExtractor.extractFromText(text: string, language?: string) => Promise<string[]>
// @step: [检测语言] 如果提供了 language，使用 Tree-sitter 方案
// @step: [调用方法] 调用 extractWithTreeSitter 或 extractWithRegex
// @step: [返回] 返回函数名数组

export class FunctionCallExtractor {
  // @contract: extractFromText(text: string, language?: string) => Promise<string[]>
  // @step: [检测语言] 如果提供了 language，使用 Tree-sitter 方案
  // @step: [调用方法] 调用 extractWithTreeSitter 或 extractWithRegex
  // @step: [返回] 返回函数名数组
  static async extractFromText(text: string, language?: string): Promise<string[]> {
    if (language) {
      return await this.extractWithTreeSitter(text, language);
    }
    return this.extractWithRegex(text);
  }

  // @contract: extractWithRegex(code: string) => string[]
  // @step: [正则匹配] 使用正则提取所有函数调用（函数名后跟括号）
  // @step: [去重] 使用 Set 去除重复的函数名
  // @step: [过滤] 过滤掉常见的内置函数和方法
  // @step: [返回] 返回函数名数组
  private static extractWithRegex(code: string): string[] {
    const functionCallRegex = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;
    const calls = new Set<string>();

    let match;
    while ((match = functionCallRegex.exec(code)) !== null) {
      const funcName = match[1];

      const builtins = ['if', 'for', 'while', 'switch', 'catch', 'function', 'return',
                        'console', 'log', 'error', 'warn', 'info', 'debug',
                        'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
                        'parseInt', 'parseFloat', 'isNaN', 'isFinite',
                        'Array', 'Object', 'String', 'Number', 'Boolean', 'Date', 'Math',
                        'JSON', 'Promise', 'Map', 'Set', 'WeakMap', 'WeakSet'];

      if (!builtins.includes(funcName)) {
        calls.add(funcName);
      }
    }

    return Array.from(calls);
  }
  // @end

  // @contract: extractWithTreeSitter(code: string, language: string) => Promise<string[]>
  // @step: [初始化] 初始化 Tree-sitter parser
  // @step: [解析代码] 使用 Tree-sitter 解析代码生成 AST
  // @step: [遍历 AST] 递归遍历 AST 查找函数调用节点
  // @step: [提取函数名] 从调用节点中提取函数名
  // @step: [过滤内置] 过滤掉标准库函数
  // @step: [去重] 使用 Set 去除重复
  // @step: [返回] 返回函数名数组
  // @boundary: 当 Tree-sitter 初始化失败时，回退到正则方案
  // @boundary: 当语言不支持时，回退到正则方案
  private static async extractWithTreeSitter(code: string, language: string): Promise<string[]> {
    try {
      await TreeSitterManager.init();

      const parser = await TreeSitterManager.getParser();
      const lang = await TreeSitterManager.getLanguage(language);

      if (!lang) {
        console.warn('[FunctionCallExtractor] Tree-sitter 不支持该语言，回退到正则方案');
        return this.extractWithRegex(code);
      }

      parser.setLanguage(lang);
      const tree = parser.parse(code);

      if (!tree) {
        console.warn('[FunctionCallExtractor] Tree-sitter 解析失败，回退到正则方案');
        return this.extractWithRegex(code);
      }

      const calls = new Set<string>();
      const builtins = this.getBuiltinFunctions(language);

      const traverse = (node: any) => {
        const callNodeTypes = [
          'call_expression',
          'call',
          'call_expr',
          'method_invocation'
        ];

        if (callNodeTypes.includes(node.type)) {
          const funcName = this.extractFunctionNameFromCallNode(node, language);
          if (funcName && !builtins.has(funcName)) {
            calls.add(funcName);
          }
        }

        for (const child of node.children) {
          traverse(child);
        }
      };

      traverse(tree.rootNode);
      return Array.from(calls);

    } catch (error) {
      console.warn('[FunctionCallExtractor] Tree-sitter 提取失败，回退到正则方案:', error);
      return this.extractWithRegex(code);
    }
  }
  // @end

  private static extractFunctionNameFromCallNode(node: any, language: string): string | null {
    const lang = language.toLowerCase();

    if (lang === 'typescript' || lang === 'javascript' || lang === 'tsx') {
      for (const child of node.children) {
        if (child.type === 'identifier') {
          return child.text;
        }
        if (child.type === 'member_expression') {
          const property = child.children.find((c: any) => c.type === 'property_identifier');
          if (property) {
            return property.text;
          }
        }
      }
    } else if (lang === 'python') {
      for (const child of node.children) {
        if (child.type === 'identifier') {
          return child.text;
        }
        if (child.type === 'attribute') {
          const attr = child.children.find((c: any) => c.type === 'identifier');
          if (attr) {
            return attr.text;
          }
        }
      }
    } else if (lang === 'go') {
      for (const child of node.children) {
        if (child.type === 'identifier') {
          return child.text;
        }
        if (child.type === 'selector_expression') {
          const field = child.children.find((c: any) => c.type === 'field_identifier');
          if (field) {
            return field.text;
          }
        }
      }
    } else if (lang === 'cpp' || lang === 'c') {
      for (const child of node.children) {
        if (child.type === 'identifier') {
          return child.text;
        }
        if (child.type === 'field_expression') {
          const field = child.children.find((c: any) => c.type === 'field_identifier');
          if (field) {
            return field.text;
          }
        }
      }
    }

    return null;
  }

  private static getBuiltinFunctions(language: string): Set<string> {
    return LanguageConfig.getBuiltinFunctions(language);
  }
}
