/**
 * @intent
 * Java 的 import 解析策略。
 * import com.example.Module; → com/example/Module.java 的包绝对路径解析。
 * 所有 Java import 都是包路径（无外部包过滤），一律解析。
 * 边界：通配符导入（.*）和 java.* 标准库跳过。
 */

import { ImportResolver } from '../ImportResolver';
import * as path from 'path';

export class JavaResolver implements ImportResolver {
  readonly language = 'java';

  // @contract: AST 节点 → Java import 路径
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

  // @contract: Java 跳过 java.* 标准库（JVM 自动导入），其他全量解析
  shouldResolve(importPath: string): boolean {
    return !importPath.startsWith('java.');
  }

  // @contract: com.example.Module → com/example/Module.java
  // @step: 点号转路径分隔符 + .java 后缀
  // @boundary: 通配符和 java.* 已在 shouldResolve 过滤
  resolve(importPath: string, workspaceRoot: string): string[] {
    const filePath = importPath.replace(/\./g, '/') + '.java';
    return [path.resolve(workspaceRoot, filePath)];
  }

  // @contract: Java 是包路径导入（com.example.Module → com/example/Module.java），基目录为 projectRoot
  getImportBaseDir(_entryFile: string, projectRoot: string): Promise<string> {
    return Promise.resolve(projectRoot);
  }

  // @contract: 正则降级方案
  // @step: 匹配 import 语句（含 static 导入）
  // @step: 过滤通配符 .* 和 java.* 标准库
  // @boundary: 降级路径与 resolve 的候选集一致（单候选）
  extractRegex(code: string, workspaceRoot: string): string[] {
    const files: string[] = [];
    const regex = /^import\s+(?:static\s+)?([\w.*]+)\s*;/gm;
    let match;
    while ((match = regex.exec(code)) !== null) {
      const importPath = match[1];
      if (!importPath.endsWith('.*') && !importPath.startsWith('java.')) {
        files.push(path.resolve(workspaceRoot, importPath.replace(/\./g, '/') + '.java'));
      }
    }
    return files;
  }
}
