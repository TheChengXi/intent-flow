/**
 * @intent
 * TypeScript/JavaScript/TSX 的 import 解析策略。
 * 三种语言的 import 语义一致（import ... from / require()），共用一个 resolver。
 * 边界：只解析相对路径（./ ../），外部包由 resolve 包处理。
 */

import { ImportResolver } from '../ImportResolver';
import { cleanStringLiteral } from '../resolver-utils';
import * as path from 'path';

export class TypeScriptResolver implements ImportResolver {
  readonly language = 'typescript';

  // @contract: AST 节点 → TS/JS import 路径
  // @step: import_statement → 提取 string 子节点
  // @step: call_expression (require) → 提取 arguments 中的 string
  // @boundary: 动态 import() 与 import_statement 同为 AST 节点，自动覆盖
  extractImportPath(node: any): string | null {
    if (node.type === 'import_statement') {
      const source = node.children.find((c: any) => c.type === 'string');
      if (source) return cleanStringLiteral(source.text);
    }
    if (node.type === 'call_expression') {
      const func = node.children.find((c: any) => c.type === 'identifier' && c.text === 'require');
      if (func) {
        const args = node.children.find((c: any) => c.type === 'arguments');
        if (args) {
          const str = args.children.find((c: any) => c.type === 'string');
          if (str) return cleanStringLiteral(str.text);
        }
      }
    }
    return null;
  }

  // @contract: TS/JS 只解析相对路径（./ ../），外部包/三方库跳过
  shouldResolve(importPath: string): boolean {
    return importPath.startsWith('./') || importPath.startsWith('../');
  }

  // @contract: 使用 resolve 包处理 Node.js 模块解析规则
  // @step: 调用 resolve.sync() 按 Node.js 模块解析算法处理
  // @step: 支持 .ts/.tsx/.js/.jsx 扩展名
  // @step: 支持 TypeScript types/typings main 字段
  // @boundary: 解析失败时返回空数组（非 npm 私有模块或不存在路径）
  resolve(importPath: string, workspaceRoot: string): string[] {
    try {
      const resolve = require('resolve');
      const resolved = resolve.sync(importPath, {
        basedir: workspaceRoot,
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
        packageFilter: (pkg: any) => {
          if (pkg.types || pkg.typings) {
            pkg.main = pkg.types || pkg.typings;
          }
          return pkg;
        }
      });
      return [resolved];
    } catch (e) {
      console.warn(`[TypeScriptResolver] 无法解析路径: ${importPath} (basedir: ${workspaceRoot})`,
        e instanceof Error ? e.message : String(e));
      return [];
    }
  }

  // @contract: TypeScript/JavaScript 是文件相对导入，基目录为入口文件所在目录
  getImportBaseDir(entryFile: string, _projectRoot: string): Promise<string> {
    return Promise.resolve(path.dirname(entryFile));
  }

  // @contract: 正则降级方案
  // @step: 匹配 import ... from '...' 语句
  // @step: 匹配 require('...') 语句
  // @step: 只处理相对路径
  // @boundary: 与 AST 路径的 shouldResolve 一致
  extractRegex(code: string, workspaceRoot: string): string[] {
    const files: string[] = [];

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

    return files;
  }
}
