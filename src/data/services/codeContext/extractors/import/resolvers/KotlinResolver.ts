/**
 * @intent
 * Kotlin 的 import 解析策略。
 * import com.example.Module → com/example/Module.kt 的包绝对路径解析。
 * 与 Java 的机制相同：点号转路径分隔符 + .kt 后缀。
 * 边界：通配符导入（.*）和 kotlin.* 标准库跳过。
 */

import { ImportResolver } from '../ImportResolver';
import * as path from 'path';

export class KotlinResolver implements ImportResolver {
  readonly language = 'kotlin';

  // @contract: AST 节点 → Kotlin import 路径
  // @step: 匹配 import_declaration 节点
  // @step: 提取 scoped_identifier 或 identifier 子节点的文本
  extractImportPath(node: any): string | null {
    if (node.type === 'import_declaration') {
      const name = node.children.find((c: any) =>
        c.type === 'scoped_identifier' || c.type === 'identifier'
      );
      if (name) return name.text;
    }
    return null;
  }

  // @contract: Kotlin 跳过 kotlin.* 标准库，其他全量解析
  shouldResolve(importPath: string): boolean {
    return !importPath.startsWith('kotlin.');
  }

  // @contract: com.example.Module → com/example/Module.kt
  resolve(importPath: string, workspaceRoot: string): string[] {
    const filePath = importPath.replace(/\./g, '/') + '.kt';
    return [path.resolve(workspaceRoot, filePath)];
  }

  // @contract: Kotlin 是包路径导入基目录为 projectRoot
  getImportBaseDir(_entryFile: string, projectRoot: string): Promise<string> {
    return Promise.resolve(projectRoot);
  }

  // @contract: 正则降级方案
  // @step: 匹配 import 语句
  // @step: 过滤通配符 .* 和 kotlin.* 标准库
  extractRegex(code: string, workspaceRoot: string): string[] {
    const files: string[] = [];
    const regex = /^import\s+([\w.*]+)\s*$/gm;
    let match;
    while ((match = regex.exec(code)) !== null) {
      const importPath = match[1];
      if (!importPath.endsWith('.*') && !importPath.startsWith('kotlin.')) {
        files.push(path.resolve(workspaceRoot, importPath.replace(/\./g, '/') + '.kt'));
      }
    }
    return files;
  }
}
