/**
 * @intent
 * C 语言的 import 解析策略。只处理 #include 预处理器指令。
 * 注意：C 没有 C++ 的 import 模块声明，C++ 的 import 模块在 CppResolver 中处理。
 * 边界：系统库 <...> 和本地 "..." 均尝试解析。
 */

import { ImportResolver } from '../ImportResolver';
import { cleanStringLiteral } from '../resolver-utils';
import * as path from 'path';

export class CResolver implements ImportResolver {
  readonly language = 'c';

  // @contract: AST 节点 → C #include 路径
  // @step: 匹配 preproc_include 节点
  // @step: 提取 string_literal 或 system_lib_string 并清洗
  extractImportPath(node: any): string | null {
    if (node.type === 'preproc_include') {
      const p = node.children.find((c: any) =>
        c.type === 'string_literal' || c.type === 'system_lib_string'
      );
      if (p) return cleanStringLiteral(p.text);
    }
    return null;
  }

  // @contract: C 语言 #include 全部尝试解析
  // @step: 相对路径（./ ../）和裸文件名都尝试
  shouldResolve(importPath: string): boolean {
    return importPath.startsWith('./') || importPath.startsWith('../')
      || !importPath.includes('/');
  }

  // @contract: #include "path" → path（原样）
  resolve(importPath: string, workspaceRoot: string): string[] {
    return [path.resolve(workspaceRoot, importPath)];
  }

  // @contract: C 是文件相对导入，基目录为入口文件所在目录
  getImportBaseDir(entryFile: string, _projectRoot: string): Promise<string> {
    return Promise.resolve(path.dirname(entryFile));
  }

  // @contract: 正则降级方案
  // @step: 匹配 #include "..." 和 #include <...>
  extractRegex(code: string, workspaceRoot: string): string[] {
    const files: string[] = [];
    const regex = /#include\s+["<]([^">]+)[">]/g;
    let match;
    while ((match = regex.exec(code)) !== null) {
      files.push(path.resolve(workspaceRoot, match[1]));
    }
    return files;
  }
}
