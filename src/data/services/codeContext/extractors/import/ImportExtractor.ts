/**
 * @intent
 * 多语言 import 解析的统一调度入口。
 * 有 language 参数时查 ResolverRegistry 获取对应的策略实现，
 * Tree-sitter 失败时降级到该策略的正则方案。
 * 无 language 参数时走旧全局正则（向后兼容）。
 * 不再持有语言分支逻辑——加语言 = 加 resolver + 注册，不改此文。
 */

import { TreeSitterManager } from '../../../tree-sitter/TreeSitterManager';
import { ImportResolver } from './ImportResolver';
import { ResolverRegistry } from './ResolverRegistry';
import { TypeScriptResolver } from './resolvers/TypeScriptResolver';
import { PythonResolver } from './resolvers/PythonResolver';
import { GoResolver } from './resolvers/GoResolver';
import { CResolver } from './resolvers/CResolver';
import { CppResolver } from './resolvers/CppResolver';
import { JavaResolver } from './resolvers/JavaResolver';
import { RustResolver } from './resolvers/RustResolver';
import { RubyResolver } from './resolvers/RubyResolver';
import { KotlinResolver } from './resolvers/KotlinResolver';
import { SwiftResolver } from './resolvers/SwiftResolver';
import { CSharpResolver } from './resolvers/CSharpResolver';
import { PhpResolver } from './resolvers/PhpResolver';
import { CssResolver } from './resolvers/CssResolver';

export class ImportExtractor {
  private static initialized = false;

  /** 确保注册表已初始化，返回初始状态 */
  private static ensureInitialized(): boolean {
    if (this.initialized) return true;
    this.initialized = true;

    ResolverRegistry.register(new TypeScriptResolver(), 'javascript', 'tsx');
    ResolverRegistry.register(new PythonResolver());
    ResolverRegistry.register(new GoResolver());
    ResolverRegistry.register(new CResolver());
    ResolverRegistry.register(new CppResolver(), 'cxx');
    ResolverRegistry.register(new JavaResolver());
    ResolverRegistry.register(new RustResolver());
    ResolverRegistry.register(new RubyResolver());
    ResolverRegistry.register(new KotlinResolver());
    ResolverRegistry.register(new SwiftResolver());
    ResolverRegistry.register(new CSharpResolver());
    ResolverRegistry.register(new PhpResolver());
    ResolverRegistry.register(new CssResolver());
    return true;
  }

  /** 获取指定语言的 ImportResolver。未注册的语言返回 null。 */
  static getResolver(language: string): ImportResolver | null {
    this.ensureInitialized();
    return ResolverRegistry.get(language);
  }

  // @contract: extractImportedFiles(code, workspaceRoot, language?) => Promise<string[]>
  // @step: [懒初始化] 首次调用时注册所有 resolver
  // @step: [查注册表] 有 language 时查 ResolverRegistry 获取策略
  // @step: [Tree-sitter 解析] 优先用 AST 解析，失败降级到该策略的正则
  // @step: [全局正则] 无 language 或未注册时走旧全局正则
  // @step: [去重] 使用 Set 去重
  // @boundary: resolver 未注册时走全局正则（向后兼容）
  // @boundary: Tree-sitter 解析失败时按语言降级正则
  // @boundary: 所有异常被 catch 不中断整体流程
  static async extractImportedFiles(code: string, workspaceRoot: string, language?: string): Promise<string[]> {
    this.ensureInitialized();

    if (!language) {
      return this.extractWithRegex(code, workspaceRoot);
    }

    const resolver = ResolverRegistry.get(language);
    if (!resolver) {
      console.warn(`[ImportExtractor] 无 resolver 注册: ${language}，走全局正则`);
      return this.extractWithRegex(code, workspaceRoot);
    }

    try {
      return await this.extractWithTreeSitter(code, workspaceRoot, language, resolver);
    } catch (error) {
      console.warn(`[ImportExtractor] Tree-sitter 解析失败 (${language})，降级到该语言的正则:`, error);
      return resolver.extractRegex(code, workspaceRoot);
    }
  }

  // @contract: extractWithTreeSitter(code, workspaceRoot, language, resolver) => Promise<string[]>
  // @step: [初始化] 获取 Tree-sitter parser 和 Language
  // @step: [解析] parser.parse(code) 生成 AST
  // @step: [遍历] 递归遍历 AST，调用 resolver.extractImportPath
  // @step: [过滤] 调用 resolver.shouldResolve 过滤外部包
  // @step: [解析路径] 调用 resolver.resolve 生成候选文件路径
  // @step: [去重] 使用 Set 去重
  // @boundary: WASM 加载失败或解析失败时抛出，由调用方降级
  private static async extractWithTreeSitter(
    code: string,
    workspaceRoot: string,
    language: string,
    resolver: ImportResolver
  ): Promise<string[]> {
    const parser = await TreeSitterManager.getParser();
    const lang = await TreeSitterManager.getLanguage(language);
    if (!lang) {
      throw new Error(`Tree-sitter 不支持 ${language}`);
    }

    parser.setLanguage(lang);
    const tree = parser.parse(code);
    if (!tree) {
      throw new Error(`Tree-sitter 解析 ${language} 失败`);
    }

    const files = new Set<string>();
    const traverse = (node: any) => {
      const importPath = resolver.extractImportPath(node);
      if (importPath && resolver.shouldResolve(importPath)) {
        const resolvedPaths = resolver.resolve(importPath, workspaceRoot);
        resolvedPaths.forEach(p => files.add(p));
      }
      for (const child of node.children) {
        traverse(child);
      }
    };
    traverse(tree.rootNode);
    return Array.from(files);
  }

  // ==================== 全局正则降级（无 language 参数时使用） ====================

  private static extractWithRegex(code: string, workspaceRoot: string): string[] {
    const path = require('path');
    const files: string[] = [];

    // TypeScript/JavaScript
    const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(code)) !== null) {
      const importPath = match[1];
      if (importPath.startsWith('./') || importPath.startsWith('../')) {
        try {
          const resolve = require('resolve');
          const resolved = resolve.sync(importPath, {
            basedir: workspaceRoot,
            extensions: ['.ts', '.tsx', '.js', '.jsx']
          });
          files.push(resolved);
        } catch (e) { /* 跳过 */ }
      }
    }
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = requireRegex.exec(code)) !== null) {
      const requirePath = match[1];
      if (requirePath.startsWith('./') || requirePath.startsWith('../')) {
        try {
          const resolve = require('resolve');
          const resolved = resolve.sync(requirePath, {
            basedir: workspaceRoot,
            extensions: ['.ts', '.tsx', '.js', '.jsx']
          });
          files.push(resolved);
        } catch (e) { /* 跳过 */ }
      }
    }

    // Python
    const pythonImportRegex = /(?:from\s+([.\w]+)\s+import|import\s+([.\w]+))/g;
    while ((match = pythonImportRegex.exec(code)) !== null) {
      const moduleName = match[1] || match[2];
      if (moduleName.startsWith('.')) {
        files.push(path.resolve(workspaceRoot, moduleName.replace(/\./g, '/') + '.py'));
      }
    }

    // C/C++
    const includeRegex = /#include\s+["<]([^">]+)[">]/g;
    while ((match = includeRegex.exec(code)) !== null) {
      files.push(path.resolve(workspaceRoot, match[1]));
    }

    // Go
    const goImportRegex = /import\s+(?:\(\s*)?["']([^"']+)["']/g;
    while ((match = goImportRegex.exec(code)) !== null) {
      const importPath = match[1];
      if (importPath.startsWith('./') || importPath.startsWith('../')) {
        files.push(path.resolve(workspaceRoot, importPath + '.go'));
      }
    }

    // Java
    const javaImportRegex = /^import\s+(?:static\s+)?([\w.*]+)\s*;/gm;
    while ((match = javaImportRegex.exec(code)) !== null) {
      const importPath = match[1];
      if (!importPath.endsWith('.*') && !importPath.startsWith('java.lang')) {
        files.push(path.resolve(workspaceRoot, importPath.replace(/\./g, '/') + '.java'));
      }
    }

    // Rust
    const rustUseRegex = /^use\s+([\w:]+)(?:\s+as\s+\w+)?\s*;/gm;
    while ((match = rustUseRegex.exec(code)) !== null) {
      const importPath = match[1];
      if (importPath.startsWith('crate::') || importPath.startsWith('self::') || importPath.startsWith('super::')) {
        let relPath = importPath.replace(/^(?:crate|self|super)::/, '').replace(/::/g, '/');
        files.push(path.resolve(workspaceRoot, relPath + '.rs'));
        files.push(path.resolve(workspaceRoot, relPath + '/mod.rs'));
        const lastSlash = relPath.lastIndexOf('/');
        if (lastSlash !== -1) {
          const parentPath = relPath.slice(0, lastSlash);
          files.push(path.resolve(workspaceRoot, parentPath + '.rs'));
          files.push(path.resolve(workspaceRoot, parentPath + '/mod.rs'));
        }
      }
    }
    const rustModRegex = /^mod\s+(\w+)\s*;/gm;
    while ((match = rustModRegex.exec(code)) !== null) {
      const modName = match[1];
      files.push(path.resolve(workspaceRoot, modName + '.rs'));
      files.push(path.resolve(workspaceRoot, modName + '/mod.rs'));
    }

    // Ruby
    const rubyRequireRegex = /^(?:require|require_relative|load)\s+['"]([^'"]+)['"]/gm;
    while ((match = rubyRequireRegex.exec(code)) !== null) {
      files.push(path.resolve(workspaceRoot, match[1] + '.rb'));
    }

    return files;
  }
}
