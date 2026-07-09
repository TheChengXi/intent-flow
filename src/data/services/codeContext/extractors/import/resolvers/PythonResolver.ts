/**
 * @intent
 * Python 的 import 解析策略。
 * from ... import ... / import ... 两种形式，. 开头为相对导入。
 * 边界：只解析相对导入（.module），绝对导入视为外部包。
 */

import { ImportResolver } from '../ImportResolver';
import * as path from 'path';

export class PythonResolver implements ImportResolver {
  readonly language = 'python';

  // @contract: AST 节点 → Python import 路径
  // @step: import_from_statement 提取 dotted_name 或 relative_import
  // @step: import_statement 提取 dotted_name
  extractImportPath(node: any): string | null {
    if (node.type === 'import_statement' || node.type === 'import_from_statement') {
      if (node.type === 'import_from_statement') {
        const moduleName = node.children.find((c: any) =>
          c.type === 'dotted_name' || c.type === 'relative_import'
        );
        if (moduleName) return moduleName.text;
      }
      if (node.type === 'import_statement') {
        const moduleName = node.children.find((c: any) => c.type === 'dotted_name');
        if (moduleName) return moduleName.text;
      }
    }
    return null;
  }

  // @contract: Python 只解析 . 开头的相对导入
  shouldResolve(importPath: string): boolean {
    return importPath.startsWith('.');
  }

  // @contract: .module.sub → module/sub.py（相对当前文件目录）
  // @step: 前导点计算目录层级（. → ./，.. → ../，... → ../../）
  // @step: 剩余部分点号转路径分隔符 + .py 后缀
  // @boundary: 前导点和剩余部分分步处理，避免全部替换导致绝对路径
  resolve(importPath: string, workspaceRoot: string): string[] {
    let dotCount = 0;
    while (dotCount < importPath.length && importPath[dotCount] === '.') {
      dotCount++;
    }

    const rest = importPath.slice(dotCount);
    if (!rest) {
      // from . import ... → 包自身 __init__.py
      let prefix = '';
      for (let i = 1; i < dotCount; i++) {
        prefix += '../';
      }
      return [path.resolve(workspaceRoot, prefix + '__init__.py')];
    }

    const parts = rest.split('.');
    const fileName = parts.join('/') + '.py';

    let prefix = '';
    for (let i = 1; i < dotCount; i++) {
      prefix += '../';
    }

    return [path.resolve(workspaceRoot, prefix + fileName)];
  }

  // @contract: Python 是文件相对导入，基目录为入口文件所在目录
  getImportBaseDir(entryFile: string, _projectRoot: string): Promise<string> {
    return Promise.resolve(path.dirname(entryFile));
  }

  // @contract: 正则降级方案
  // @step: 匹配 from ... import ... 和 import ... 两种形式
  // @step: 只保留 . 开头的相对导入，复用 resolve 路径逻辑
  extractRegex(code: string, workspaceRoot: string): string[] {
    const files: string[] = [];
    const regex = /(?:from\s+([.\w]+)\s+import|import\s+([.\w]+))/g;
    let match;
    while ((match = regex.exec(code)) !== null) {
      const moduleName = match[1] || match[2];
      if (moduleName && moduleName.startsWith('.')) {
        files.push(...this.resolve(moduleName, workspaceRoot));
      }
    }
    return files;
  }
}
