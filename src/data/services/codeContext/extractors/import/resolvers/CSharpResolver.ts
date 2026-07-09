/**
 * @intent
 * C# 的 import 解析策略。
 * using System; / using System.Collections.Generic; → 命名空间到文件路径的映射。
 * C# using 语句是命名空间引用，本地项目代码通常遵循目录=命名空间的约定。
 * 边界：标准库命名空间（System.*）会尝试解析但由 fileRepo.exists 过滤。
 */

import { ImportResolver } from '../ImportResolver';
import * as path from 'path';

export class CSharpResolver implements ImportResolver {
  readonly language = 'csharp';

  // @contract: AST 节点 → C# using 路径
  // @step: 匹配 using_directive 节点
  // @step: 提取 qualified_name 或 identifier 子节点的文本
  extractImportPath(node: any): string | null {
    if (node.type === 'using_directive') {
      const name = node.children.find((c: any) =>
        c.type === 'qualified_name' || c.type === 'identifier'
      );
      if (name) return name.text;
    }
    return null;
  }

  // @contract: 所有 using 尝试解析（标准库命名空间会被 fileRepo.exists 过滤）
  shouldResolve(_importPath: string): boolean {
    return true;
  }

  // @contract: System.Collections.Generic → System/Collections/Generic.cs
  resolve(importPath: string, workspaceRoot: string): string[] {
    const filePath = importPath.replace(/\./g, '/') + '.cs';
    return [path.resolve(workspaceRoot, filePath)];
  }

  // @contract: C# 是命名空间导入（System.Collections → System/Collections.cs），基目录为 projectRoot
  getImportBaseDir(_entryFile: string, projectRoot: string): Promise<string> {
    return Promise.resolve(projectRoot);
  }

  // @contract: 正则降级方案
  // @step: 匹配 using 语句（含 using static / using alias）
  // @step: 跳过别名（using X = Y;）和 using static
  extractRegex(code: string, workspaceRoot: string): string[] {
    const files: string[] = [];
    const regex = /^using\s+(?:static\s+)?([\w.]+)\s*;/gm;
    let match;
    while ((match = regex.exec(code)) !== null) {
      const importPath = match[1];
      files.push(path.resolve(workspaceRoot, importPath.replace(/\./g, '/') + '.cs'));
    }
    return files;
  }
}
