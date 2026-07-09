/**
 * @intent
 * C++ 的 import 解析策略。
 * 处理 #include（传统）和 C++20/26 的 import 模块声明（import std;）。
 * 与 CResolver 分开独立，因为 C++ 有模块系统而 C 没有。
 * 边界：系统库和模块名不产生具体文件路径，本地 #include 尝试解析。
 */

import { ImportResolver } from '../ImportResolver';
import { cleanStringLiteral } from '../resolver-utils';
import * as path from 'path';

export class CppResolver implements ImportResolver {
  readonly language = 'cpp';

  // @contract: AST 节点 → C++ import 路径
  // @step: preproc_include 提取 string_literal / system_lib_string
  // @step: 注意 C++26 的 import 模块声明未来扩展
  // @boundary: C++26 import 模块名不映射到文件路径，在 shouldResolve 中过滤
  extractImportPath(node: any): string | null {
    if (node.type === 'preproc_include') {
      const p = node.children.find((c: any) =>
        c.type === 'string_literal' || c.type === 'system_lib_string'
      );
      if (p) return cleanStringLiteral(p.text);
    }
    // C++26: import module_name; 和 import <header>;
    if (node.type === 'import_declaration' || node.type === 'cpp_modules_import') {
      const name = node.children.find((c: any) =>
        c.type === 'identifier' || c.type === 'scoped_identifier' || c.type === 'string_literal'
      );
      if (name) return name.text;
    }
    return null;
  }

  // @contract: C++ 相对路径和裸文件名尝试解析
  // @step: import 模块名（如 import std;）是非文件路径，在 shouldResolve 中过滤
  // @boundary: 不包含 '/' 的裸文件名不一定是文件（可能是系统库），但全部尝试让调用方 fileRepo.exists 过滤
  shouldResolve(importPath: string): boolean {
    return importPath.startsWith('./') || importPath.startsWith('../')
      || !importPath.includes('/');
  }

  // @contract: #include "path" → path（原样）
  resolve(importPath: string, workspaceRoot: string): string[] {
    return [path.resolve(workspaceRoot, importPath)];
  }

  // @contract: C++ 是文件相对导入，基目录为入口文件所在目录
  getImportBaseDir(entryFile: string, _projectRoot: string): Promise<string> {
    return Promise.resolve(path.dirname(entryFile));
  }

  // @contract: 正则降级方案
  // @step: 匹配 #include "..." 和 #include <...>
  // @step: 同时匹配 C++26 import 语句（模块名暂不映射文件路径）
  extractRegex(code: string, workspaceRoot: string): string[] {
    const files: string[] = [];
    // #include
    const includeRegex = /#include\s+["<]([^">]+)[">]/g;
    let match;
    while ((match = includeRegex.exec(code)) !== null) {
      files.push(path.resolve(workspaceRoot, match[1]));
    }
    return files;
  }
}
