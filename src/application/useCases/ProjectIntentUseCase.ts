import { IUseCase } from './IUseCase';
import { IFileRepository } from '../../data/repositories/IFileRepository';
import { LanguageConfig } from '../../data/services/core/LanguageConfig';
import * as path from 'path';

// @intent: 投射意图用例，创建文件并写入 @intent 注释。用于 execute phase 1 的文件骨架生成。
// 边界：文件已存在且 force=false 时跳过不覆盖。

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

/** 通过 LanguageConfig 获取语言的注释风格，写入 @intent 注释 */
function formatIntent(pathname: string, intent: string): string {
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

    const content = formatIntent(filePath, intent);
    await this.fileRepo.writeFile(filePath, content);

    return {
      path: filePath,
      created: !exists,
      updated: exists && !!force,
    };
  }
}
