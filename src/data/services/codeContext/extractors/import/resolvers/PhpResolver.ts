/**
 * @intent
 * PHP 的 import 解析策略。
 * use App\Models\User; → App/Models/User.php 的 PSR-4 命名空间到路径映射。
 * 边界：只处理 use 语句（不含 use function / use const），过滤第三方库路径。
 */

import { ImportResolver } from '../ImportResolver';
import * as path from 'path';

export class PhpResolver implements ImportResolver {
  readonly language = 'php';

  /**
   * PSR-4 命名空间前缀到目录的映射。
   * 如 'App\\' → 'src/' 表示 use App\Service\UserService → src/Service/UserService.php
   * 可扩展：检测到 composer.json 自动读取更精确。
   */
  private static readonly NAMESPACE_PREFIX_MAP: Record<string, string> = {
    'App\\': 'src/',
    'App/': 'src/',
  };

  /** 将 PSR-4 导入路径转为候选文件路径列表（含原始路径和映射路径） */
  private toCandidatePaths(importPath: string): string[] {
    const candidates: string[] = [];
    // 原始路径：App\Service\UserService → App/Service/UserService.php
    const raw = importPath.replace(/[\\\/]/g, '/') + '.php';
    candidates.push(raw);

    // PSR-4 映射路径：App\Service\UserService → src/Service/UserService.php
    for (const [prefix, dir] of Object.entries(PhpResolver.NAMESPACE_PREFIX_MAP)) {
      if (importPath.startsWith(prefix)) {
        const mapped = importPath.slice(prefix.length).replace(/[\\\/]/g, '/') + '.php';
        candidates.push(dir + mapped);
        break; // 只匹配第一个前缀
      }
    }
    return candidates;
  }

  // @contract: AST 节点 → PHP use 路径
  // @step: 匹配 namespace_use_statement 节点
  // @step: 提取 name 子节点的文本（命名空间全名）
  extractImportPath(node: any): string | null {
    if (node.type === 'namespace_use_statement') {
      const name = node.children.find((c: any) =>
        c.type === 'name' || c.type === 'namespace_name'
      );
      if (name) return name.text;
    }
    return null;
  }

  // @contract: PHP use 语句全部尝试解析（外部包会被 fileRepo.exists 过滤）
  shouldResolve(_importPath: string): boolean {
    return true;
  }

  // @contract: App\Models\User → App/Models/User.php 及 PSR-4 映射候选项
  // @step: 反斜杠命名空间分隔符转路径分隔符 + .php
  // @step: 额外生成 PSR-4 前缀映射路径（如 App\ → src/）
  resolve(importPath: string, workspaceRoot: string): string[] {
    return this.toCandidatePaths(importPath).map(p => path.resolve(workspaceRoot, p));
  }

  // @contract: PHP 是 PSR-4 命名空间映射，基目录为 projectRoot
  getImportBaseDir(_entryFile: string, projectRoot: string): Promise<string> {
    return Promise.resolve(projectRoot);
  }

  // @contract: 正则降级方案
  // @step: 匹配 use 语句，排除 use function / use const
  // @boundary: 先用行级否定前瞻跳过 function/const 开头
  extractRegex(code: string, workspaceRoot: string): string[] {
    const files: string[] = [];
    const regex = /^use\s+(?!function\s|const\s)([\w\\]+)\s*;/gm;
    let match;
    while ((match = regex.exec(code)) !== null) {
      const importPath = match[1];
      for (const candidate of this.toCandidatePaths(importPath)) {
        files.push(path.resolve(workspaceRoot, candidate));
      }
    }
    return files;
  }
}
