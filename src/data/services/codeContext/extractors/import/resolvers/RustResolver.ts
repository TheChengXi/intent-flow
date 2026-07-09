/**
 * @intent
 * Rust 的 import 解析策略。
 * 处理 use 声明（crate::module::Item）和 mod 声明（mod module;）。
 * 路径解析用多候选策略：原样路径 / + /mod.rs / -最后一段 / -最后一段+mod.rs。
 * 边界：只解析 crate::/self::/super:: 开头的路径，外部 crate 跳过。
 */

import { ImportResolver } from '../ImportResolver';
import * as path from 'path';
import { promises as fs } from 'fs';

export class RustResolver implements ImportResolver {
  readonly language = 'rust';

  // @contract: AST 节点 → Rust import 路径
  // @step: use_declaration → 提取 scoped_identifier 或 use_as_clause 文本
  // @step: mod_item → 提取 identifier + prepend "crate::"（通过 shouldResolve 的 crate:: 过滤）
  // @boundary: mod_item 无 crate:: 前缀，手工补上以便 shouldResolve 通过
  extractImportPath(node: any): string | null {
    if (node.type === 'use_declaration') {
      const name = node.children.find((c: any) =>
        c.type === 'scoped_identifier' || c.type === 'use_as_clause'
      );
      if (name) return name.text;
    }
    if (node.type === 'mod_item') {
      const name = node.children.find((c: any) => c.type === 'identifier');
      if (name) return `crate::${name.text}`;
    }
    return null;
  }

  // @contract: Rust 只解析 crate::/self::/super:: 开头的路径
  shouldResolve(importPath: string): boolean {
    return importPath.startsWith('crate::')
      || importPath.startsWith('self::')
      || importPath.startsWith('super::');
  }

  // @contract: 多候选路径解析策略
  // @step: crate::module::Item → 去掉前缀 + :: 转 /
  // @step: 原样候选：{relPath}.rs / {relPath}/mod.rs
  // @step: 去尾候选：去掉最后一段（Item 名）再试 {parent}.rs / {parent}/mod.rs
  // @boundary: 返回 2~4 个候选，由调用方 fileRepo.exists 过滤
  resolve(importPath: string, workspaceRoot: string): string[] {
    const files: string[] = [];
    const relPath = importPath.replace(/^crate::/, '').replace(/::/g, '/');

    // 原样尝试：crate::a::b::C → a/b/C.rs 和 a/b/C/mod.rs
    files.push(path.resolve(workspaceRoot, relPath + '.rs'));
    files.push(path.resolve(workspaceRoot, relPath + '/mod.rs'));

    // 去尾尝试：crate::a::b::C → a/b.rs 和 a/b/mod.rs
    const lastSlash = relPath.lastIndexOf('/');
    if (lastSlash !== -1) {
      const parentPath = relPath.slice(0, lastSlash);
      files.push(path.resolve(workspaceRoot, parentPath + '.rs'));
      files.push(path.resolve(workspaceRoot, parentPath + '/mod.rs'));
    }

    return files;
  }

  // @contract: Rust 以 crate root（Cargo.toml 所在目录的 src/）为 import 基目录
  // @step: 路线一：从 entryFile 向上找 Cargo.toml + src/
  // @step: 路线二：找不到 Cargo.toml 时向上找含 main.rs/lib.rs 的目录
  // @boundary: 都找不到时回退到 entryFile 所在目录
  async getImportBaseDir(entryFile: string, _projectRoot: string): Promise<string> {
    const entryDir = path.dirname(entryFile);
    let searchDir = entryDir;

    // 路线一：找 Cargo.toml → crate 根 = Cargo.toml_dir + /src/
    while (true) {
      try {
        await fs.access(path.join(searchDir, 'Cargo.toml'));
        const candidate = path.join(searchDir, 'src');
        try {
          await fs.access(candidate);
          return candidate;
        } catch {
          return searchDir;
        }
      } catch {
        // 没找到 Cargo.toml，继续向上
      }
      const parent = path.dirname(searchDir);
      if (parent === searchDir) break;
      searchDir = parent;
    }

    // 路线二：向上找含 main.rs/lib.rs 的目录
    searchDir = entryDir;
    while (true) {
      try {
        await fs.access(path.join(searchDir, 'main.rs'));
        return searchDir;
      } catch {}
      try {
        await fs.access(path.join(searchDir, 'lib.rs'));
        return searchDir;
      } catch {}
      const parent = path.dirname(searchDir);
      if (parent === searchDir) break;
      searchDir = parent;
    }

    return entryDir;
  }

  // @contract: 正则降级方案
  // @step: 匹配 use crate::/self::/super:: 路径，多候选策略
  // @step: 匹配 mod xxx; 声明，双候选（.rs / mod.rs）
  // @boundary: 降级候选集与 AST 路径一致
  extractRegex(code: string, workspaceRoot: string): string[] {
    const files: string[] = [];

    // use crate::xxx / self::xxx / super::xxx
    const useRegex = /^use\s+([\w:]+)(?:\s+as\s+\w+)?\s*;/gm;
    let match;
    while ((match = useRegex.exec(code)) !== null) {
      const importPath = match[1];
      if (importPath.startsWith('crate::') || importPath.startsWith('self::') || importPath.startsWith('super::')) {
        const relPath = importPath.replace(/^(?:crate|self|super)::/, '').replace(/::/g, '/');
        files.push(path.resolve(workspaceRoot, relPath + '.rs'));
        files.push(path.resolve(workspaceRoot, relPath + '/mod.rs'));
        const lastSlash = relPath.lastIndexOf('/');
        if (lastSlash !== -1) {
          const parentPath = relPath.slice(0, lastSlash);
          files.push(path.resolve(workspaceRoot, parentPath + '.rs'));
          files.push(path.resolve(workspaceRoot, parentPath + '/mod.rs'));
        }
      }
    }

    // mod xxx
    const modRegex = /^mod\s+(\w+)\s*;/gm;
    while ((match = modRegex.exec(code)) !== null) {
      const modName = match[1];
      files.push(path.resolve(workspaceRoot, modName + '.rs'));
      files.push(path.resolve(workspaceRoot, modName + '/mod.rs'));
    }

    return files;
  }
}
