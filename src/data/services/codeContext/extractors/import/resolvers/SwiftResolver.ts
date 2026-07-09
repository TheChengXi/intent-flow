/**
 * @intent
 * Swift 的 import 解析策略。
 * import Foundation / import AppModule → 模块名到文件路径的猜测解析。
 * Swift 模块名不直接映射到文件路径，但本地项目模块通常对应同名 .swift 文件。
 * 边界：标准库模块（Foundation/UIKit 等）会尝试解析但由 fileRepo.exists 过滤。
 */

import { ImportResolver } from '../ImportResolver';
import * as path from 'path';

export class SwiftResolver implements ImportResolver {
  readonly language = 'swift';

  // @contract: AST 节点 → Swift import 路径
  // @step: 匹配 import_declaration 节点
  // @step: 提取模块名（identifier 或 scoped_identifier）
  extractImportPath(node: any): string | null {
    if (node.type === 'import_declaration') {
      const name = node.children.find((c: any) =>
        c.type === 'scoped_identifier' || c.type === 'identifier'
      );
      if (name) return name.text;
    }
    return null;
  }

  // @contract: 所有 import 尝试解析（标准库模块会被 fileRepo.exists 过滤）
  shouldResolve(_importPath: string): boolean {
    return true;
  }

  // @contract: import ModuleName → ModuleName.swift
  // @step: scoped_identifier（import Foo.Bar）也展平为路径
  resolve(importPath: string, workspaceRoot: string): string[] {
    const filePath = importPath.replace(/\./g, '/') + '.swift';
    return [path.resolve(workspaceRoot, filePath)];
  }

  // @contract: Swift 是模块名导入（import AppModule → AppModule.swift），基目录为 projectRoot
  getImportBaseDir(_entryFile: string, projectRoot: string): Promise<string> {
    return Promise.resolve(projectRoot);
  }

  // @contract: 正则降级方案
  // @step: 匹配 import 语句（含 import struct/class/func 修饰）
  extractRegex(code: string, workspaceRoot: string): string[] {
    const files: string[] = [];
    const regex = /^import\s+(?:\w+\s+)?([\w.]+)\s*$/gm;
    let match;
    while ((match = regex.exec(code)) !== null) {
      const importPath = match[1];
      files.push(path.resolve(workspaceRoot, importPath.replace(/\./g, '/') + '.swift'));
    }
    return files;
  }
}
