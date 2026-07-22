import { IUseCase } from './IUseCase';
import { IFileRepository } from '../../data/repositories/IFileRepository';
import { LanguageConfig } from '../../data/services/tree-sitter/LanguageConfig';
import * as path from 'path';

// @intent: 投射意图用例，创建/更新文件中的 @intent 注释。用于 execute phase 1 的文件骨架生成。
// 边界：文件已存在且 force=false 时跳过；force=true 时在已有文件中替换/插入 @intent，不覆盖其他内容。

// @entity: ProjectIntentInput
// 投射意图输入
export interface ProjectIntentInput {
  /** 目标文件路径（绝对或相对 cwd） */
  path: string;
  /** @intent 正文内容（纯文本，工具自动加 @intent 前缀和注释符号） */
  intent: string;
  /** 文件已存在时是否覆盖 @intent。默认 false */
  force?: boolean;
}

// @entity: ProjectIntentResult
// 投射意图结果
export interface ProjectIntentResult {
  path: string;
  created: boolean;
  updated: boolean;
}

/** 生成 @intent 注释块（不依赖上下文，纯生成） */
function generateIntentBlock(pathname: string, intent: string): string {
  const ext = path.extname(pathname).toLowerCase();
  const language = LanguageConfig.getLanguageFromExtension(ext);

  if (language) {
    // 块注释语言（C 风格 /** */）：TypeScript、Java、Go、CSS 等
    const blockDelim = LanguageConfig.getCommentBlockDelimiters(language);
    if (blockDelim) {
      const lines = intent.split('\n');
      const body = lines.map(l => `${blockDelim.linePrefix} ${l}`).join('\n');
      return `${blockDelim.start}\n${blockDelim.linePrefix} @intent\n${body}\n${blockDelim.end}\n`;
    }

    // 行注释语言：Python（#）、Ruby（#）等
    const prefixes = LanguageConfig.getCommentPrefixes(language);
    if (prefixes.length > 0) {
      const prefix = prefixes[0];
      const lines = intent.split('\n');
      const body = lines.map(l => `${prefix} ${l}`).join('\n');
      return `${prefix} @intent\n${body}\n`;
    }
  }

  // 没有已知注释语法的文件类型（.md .yaml .json 等）
  return `@intent\n${intent}\n`;
}

/**
 * 在已有内容中替换或插入 @intent 注释块。
 * - 找到已有 @intent → 替换
 * - 未找到 → prepend 到文件顶部（shebang 之后）
 */
function replaceIntentInContent(
  content: string,
  newBlock: string,
  pathname: string
): string {
  const ext = path.extname(pathname).toLowerCase();
  const language = LanguageConfig.getLanguageFromExtension(ext);

  let pattern: RegExp;

  if (language) {
    const blockDelim = LanguageConfig.getCommentBlockDelimiters(language);
    if (blockDelim) {
      // 块注释：匹配 /**...@intent...*/
      pattern = /\/\*\*[\s\S]*?@intent[\s\S]*?\*\/\n?/;
    } else {
      // 行注释：从 @intent 行开始，接续后续注释行
      const prefixes = LanguageConfig.getCommentPrefixes(language);
      if (prefixes.length > 0) {
        const p = prefixes[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        pattern = new RegExp(
          `[ \\t]*${p}[ \\t]*@intent(?:\\n[ \\t]*${p}[^\\n]*)*\\n?`
        );
      } else {
        pattern = /^@intent[\s\S]*?(?=\n\S|\n$|$)/m;
      }
    }
  } else {
    // 未知格式：匹配 @intent 行及后续内容直到非空行
    pattern = /^@intent[\s\S]*?(?=\n\S|\n$|$)/m;
  }

  if (pattern.test(content)) {
    return content.replace(pattern, newBlock.trimEnd() + '\n');
  }

  // 无已有 @intent：插入到 shebang 之后，或文件顶部
  const shebangMatch = content.match(/^#!.*\n/);
  if (shebangMatch) {
    const pos = shebangMatch[0].length;
    return content.slice(0, pos) + newBlock.trimEnd() + '\n\n' + content.slice(pos);
  }

  return newBlock.trimEnd() + '\n\n' + content;
}

export class ProjectIntentUseCase implements IUseCase<ProjectIntentInput, ProjectIntentResult> {
  constructor(private fileRepo: IFileRepository) {}

  async execute(input: ProjectIntentInput): Promise<ProjectIntentResult> {
    const { path: filePath, intent, force } = input;

    const exists = await this.fileRepo.exists(filePath);

    if (exists && !force) {
      return {
        path: filePath,
        created: false,
        updated: false,
      };
    }

    const intentBlock = generateIntentBlock(filePath, intent);

    if (!exists) {
      // 新文件：写入 @intent 块
      await this.fileRepo.writeFile(filePath, intentBlock);
      return { path: filePath, created: true, updated: false };
    }

    // 文件已存在 + force=true：替换/插入 @intent，保留其他内容
    const existingContent = await this.fileRepo.readFile(filePath);
    const updatedContent = replaceIntentInContent(existingContent, intentBlock, filePath);
    await this.fileRepo.writeFile(filePath, updatedContent);
    return { path: filePath, created: false, updated: true };
  }
}
