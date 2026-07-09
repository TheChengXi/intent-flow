/**
 * @intent
 * Ruby 的 import 解析策略。
 * 处理 require / require_relative / load 三种加载语句。
 * 所有 require 都尝试解析为 .rb 文件。
 * 边界：gem require 会尝试路径解析失败后静默跳过。
 */

import { ImportResolver } from '../ImportResolver';
import { cleanStringLiteral } from '../resolver-utils';
import * as path from 'path';

export class RubyResolver implements ImportResolver {
  readonly language = 'ruby';

  // @contract: AST 节点 → Ruby require/load 路径
  // @step: 匹配 call 表达式节点
  // @step: 验证方法是 require / require_relative / load
  // @step: 提取字符串参数并清洗引号
  extractImportPath(node: any): string | null {
    if (node.type === 'call') {
      const method = node.children.find((c: any) => c.type === 'identifier');
      if (method && (method.text === 'require' || method.text === 'require_relative' || method.text === 'load')) {
        const str = node.children.find((c: any) => c.type === 'string');
        if (str) return cleanStringLiteral(str.text);
      }
    }
    return null;
  }

  // @contract: Ruby require 可能是本地文件，全量尝试
  shouldResolve(_importPath: string): boolean {
    return true;
  }

  // @contract: require 'path/to/file' → path/to/file.rb
  resolve(importPath: string, workspaceRoot: string): string[] {
    return [path.resolve(workspaceRoot, importPath + '.rb')];
  }

  // @contract: Ruby 是文件相对导入，基目录为入口文件所在目录
  getImportBaseDir(entryFile: string, _projectRoot: string): Promise<string> {
    return Promise.resolve(path.dirname(entryFile));
  }

  // @contract: 正则降级方案
  // @step: 只匹配 require_relative 和 load（bare require 是 gem，不映射文件路径）
  // @boundary: gem require 路径不会出现在正则结果中
  extractRegex(code: string, workspaceRoot: string): string[] {
    const files: string[] = [];
    const regex = /^(?:require_relative|load)\s+['"]([^'"]+)['"]/gm;
    let match;
    while ((match = regex.exec(code)) !== null) {
      files.push(path.resolve(workspaceRoot, match[1] + '.rb'));
    }
    return files;
  }
}
