/**
 * @intent
 * CSS 的 import 解析策略。
 * 处理 @import url("...") 和 @import "..." 两种导入语法。
 * 边界：只解析相对路径（./ ../），外部 CDN 链接跳过。
 */

import { ImportResolver } from '../ImportResolver';
import { cleanStringLiteral } from '../resolver-utils';
import * as path from 'path';

export class CssResolver implements ImportResolver {
  readonly language = 'css';

  // @contract: AST 节点 → CSS @import 路径
  // @step: 匹配 import_statement 或 preproc_include 节点
  // @step: 提取字符串子节点并清洗引号
  // @boundary: CSS 的 @import 必须出现在样式表顶部，但 AST 节点不受位置限制
  extractImportPath(node: any): string | null {
    // @import "..." 或 @import url("...")
    if (node.type === 'import_statement' || node.type === 'import_rule') {
      const str = node.children.find((c: any) =>
        c.type === 'string' || c.type === 'string_value' || c.type === 'uri_value'
      );
      if (str) return cleanStringLiteral(str.text);

      // @import url(...) without quotes
      const url = node.children.find((c: any) => c.type === 'call_expression' || c.type === 'function_call');
      if (url) {
        const inner = url.children.find((c: any) =>
          c.type === 'string' || c.type === 'string_value' || c.type === 'identifier'
        );
        if (inner) return cleanStringLiteral(inner.text);
      }
    }
    return null;
  }

  // @contract: CSS 只解析相对路径（./ ../），CDN 和绝对 URL 跳过
  shouldResolve(importPath: string): boolean {
    return importPath.startsWith('./') || importPath.startsWith('../')
      || importPath.startsWith('/');  // 项目内绝对路径
  }

  // @contract: "./path/to/file.css" → path/to/file.css（原样解析）
  resolve(importPath: string, workspaceRoot: string): string[] {
    return [path.resolve(workspaceRoot, importPath)];
  }

  // @contract: CSS 文件相对导入，基目录为入口文件所在目录
  getImportBaseDir(entryFile: string, _projectRoot: string): Promise<string> {
    return Promise.resolve(path.dirname(entryFile));
  }

  // @contract: 正则降级方案
  // @step: 匹配 @import url("...") 和 @import "..." 两种形式
  extractRegex(code: string, workspaceRoot: string): string[] {
    const files: string[] = [];
    const addIfRelative = (importPath: string) => {
      if (importPath.startsWith('./') || importPath.startsWith('../') || importPath.startsWith('/')) {
        files.push(path.resolve(workspaceRoot, importPath));
      }
    };

    // @import "path"
    const simpleRegex = /@import\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = simpleRegex.exec(code)) !== null) {
      addIfRelative(match[1]);
    }

    // @import url("path") or @import url(path)
    const urlRegex = /@import\s+url\s*\(\s*['"]?([^'")\s]+)['"]?\s*\)/g;
    while ((match = urlRegex.exec(code)) !== null) {
      addIfRelative(match[1]);
    }

    return files;
  }
}
