/**
 * @intent
 * Go 的 import 解析策略。
 * import "path" / import ( "path1" "path2" ) 两种形式。
 * 边界：只解析相对路径（./ ../），标准库和模块路径跳过。
 */

import { ImportResolver } from '../ImportResolver';
import { cleanStringLiteral } from '../resolver-utils';
import * as path from 'path';

export class GoResolver implements ImportResolver {
  readonly language = 'go';

  // @contract: AST 节点 → Go import 路径
  // @step: 匹配 import_spec 节点
  // @step: 提取 interpreted_string_literal 或 raw_string_literal
  // @boundary: 多行 import 块中每个 import_spec 独立匹配
  extractImportPath(node: any): string | null {
    if (node.type === 'import_spec') {
      const p = node.children.find((c: any) =>
        c.type === 'interpreted_string_literal' || c.type === 'raw_string_literal'
      );
      if (p) return cleanStringLiteral(p.text);
    }
    return null;
  }

  // @contract: Go 只解析相对路径（./ ../），外部模块/标准库跳过
  shouldResolve(importPath: string): boolean {
    return importPath.startsWith('./') || importPath.startsWith('../');
  }

  // @contract: "./path/to/mod" → path/to/mod.go
  resolve(importPath: string, workspaceRoot: string): string[] {
    return [path.resolve(workspaceRoot, importPath + '.go')];
  }

  // @contract: Go 是文件相对导入，基目录为入口文件所在目录
  getImportBaseDir(entryFile: string, _projectRoot: string): Promise<string> {
    return Promise.resolve(path.dirname(entryFile));
  }

  // @contract: 正则降级方案（处理分组和单行两类 import）
  // @step: 匹配 import "..." 单行导入
  // @step: 匹配 import ( ... ) 分组导入，提取内部所有字符串
  // @step: 只保留相对路径（./ ../），标准库和三方模块跳过
  extractRegex(code: string, workspaceRoot: string): string[] {
    const files: string[] = [];
    const addIfRelative = (importPath: string) => {
      if (importPath.startsWith('./') || importPath.startsWith('../')) {
        files.push(path.resolve(workspaceRoot, importPath + '.go'));
      }
    };

    // 单行 import "path"
    const simpleRegex = /^import\s+["']([^"']+)["']\s*$/gm;
    let match;
    while ((match = simpleRegex.exec(code)) !== null) {
      addIfRelative(match[1]);
    }

    // 分组 import ( "path1" "path2" … ) 或跨行写法
    const groupRegex = /import\s*\(([\s\S]*?)\)/g;
    while ((match = groupRegex.exec(code)) !== null) {
      const inner = match[1];
      const strRegex = /["']([^"']+)["']/g;
      let sm;
      while ((sm = strRegex.exec(inner)) !== null) {
        addIfRelative(sm[1]);
      }
    }

    return files;
  }
}
