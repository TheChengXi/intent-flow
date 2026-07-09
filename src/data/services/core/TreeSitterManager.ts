import { Parser, Language } from '@vscode/tree-sitter-wasm';
import * as path from 'path';

/**
 * @intent
 * 对 Tree-sitter Parser 的统一管理（初始化 + 语言加载 + 多语言缓存）。
 * 基于 @vscode/tree-sitter-wasm 运行时，支持新版 tree-sitter WASM 格式（dylink 而非 dylink.0）。
 * 定义：init() → 初始化 Parser 实例；getParser() → 返回单例 parser；
 * getLanguage(lang) → 加载对应 WASM 并缓存 Language 对象；clearCache() → 重置全部状态。
 * 被哪些消费者使用：
 * - CodeParserService / IntentExtractor：通过它获取 Parser 和 Language 进行 AST 解析
 * 屏蔽了什么实现细节：WASM 文件路径解析、Language.load 异步初始化、多语言缓存复用。
 */

// @contract: TreeSitterManager.init() => Promise<void>
// @step: [检查初始化] 如果已初始化则直接返回
// @step: [初始化 Parser] 调用 Parser.init()，提供 locateFile 定位 tree-sitter.wasm
// @step: [创建实例] 创建 Parser 实例
// @step: [标记完成] 设置 initialized 为 true
// @boundary: 当初始化失败时，抛出错误

// @contract: TreeSitterManager.getParser() => Promise<Parser>
// @step: [确保初始化] 如果未初始化，先调用 init()
// @step: [返回 parser] 返回已初始化的 parser
// @boundary: 当 parser 为 null 时，抛出错误

// @contract: TreeSitterManager.getLanguage(language: string) => Promise<Language | null>
// @step: [检查缓存] 如果语言已加载，从缓存返回
// @step: [获取 wasm 文件名] 调用 getWasmFileName 获取文件名
// @step: [加载语言] 使用 Language.load 加载 wasm 文件
// @step: [缓存语言] 将加载的语言存入缓存
// @step: [返回] 返回 Language 对象
// @boundary: 当语言不支持时，返回 null
// @boundary: 当加载失败时，返回 null

// @contract: TreeSitterManager.getWasmFileName(language: string) => string | null
// @step: [映射] 根据语言名返回对应的 wasm 文件名
// @step: [返回] 返回文件名或 null
// @boundary: 当语言未知时，返回 null

// @contract: TreeSitterManager.clearCache() => void
// @step: [清空] 清空语言缓存
// @step: [重置] 重置初始化状态

export class TreeSitterManager {
  private static parser: Parser | null = null;
  private static languages: Map<string, Language> = new Map();
  private static initialized = false;

  /**
   * 获取 WASM 文件所在目录。
   * 在 webpack 构建中，WASM 文件（parser wasm + tree-sitter.wasm）被复制到
   * 输出目录的 parsers/ 子目录下，与 js 文件同级。
   * 通过 __dirname 定位可以同时覆盖 CLI / MCP / VSCode 三种构建。
   */
  private static getWasmDir(): string {
    return path.join(__dirname, 'parsers');
  }

  static async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await Parser.init({
      locateFile: (file: string) => {
        return path.join(this.getWasmDir(), file);
      }
    });
    this.parser = new Parser();
    this.initialized = true;
  }

  static async getParser(): Promise<Parser> {
    if (!this.initialized) {
      await this.init();
    }

    if (!this.parser) {
      throw new Error('TreeSitterManager: parser is null after initialization');
    }

    return this.parser;
  }

  static async getLanguage(language: string): Promise<Language | null> {
    if (this.languages.has(language)) {
      return this.languages.get(language)!;
    }

    const wasmFile = this.getWasmFileName(language);
    if (!wasmFile) {
      return null;
    }

    try {
      const wasmPath = path.join(this.getWasmDir(), wasmFile);
      const lang = await Language.load(wasmPath);
      this.languages.set(language, lang);
      return lang;
    } catch (error) {
      console.error(`TreeSitterManager: Failed to load language ${language}:`, error);
      return null;
    }
  }

  static getWasmFileName(language: string): string | null {
    const map: { [key: string]: string | null } = {
      'typescript': 'tree-sitter-typescript.wasm',
      'tsx': 'tree-sitter-tsx.wasm',
      'javascript': 'tree-sitter-javascript.wasm',
      'python': 'tree-sitter-python.wasm',
      'cpp': 'tree-sitter-cpp.wasm',
      'cxx': 'tree-sitter-cpp.wasm',
      'c': 'tree-sitter-c.wasm',
      'java': 'tree-sitter-java.wasm',
      'go': 'tree-sitter-go.wasm',
      'rust': 'tree-sitter-rust.wasm',
      'kotlin': 'tree-sitter-kotlin.wasm',
      'swift': 'tree-sitter-swift.wasm',
      'csharp': 'tree-sitter-c-sharp.wasm',
      'c_sharp': 'tree-sitter-c-sharp.wasm',
      'ruby': 'tree-sitter-ruby.wasm',
      'php': 'tree-sitter-php.wasm',
      'css': 'tree-sitter-css.wasm',
    };
    const key = language.toLowerCase();
    return map[key] !== undefined ? map[key] : null;
  }

  static clearCache(): void {
    this.languages.clear();
    this.initialized = false;
    this.parser = null;
  }
}
