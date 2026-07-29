import { IUseCase } from './IUseCase';
import { IFileRepository } from '../../data/repositories/IFileRepository';
import { LanguageConfig } from '../../data/services/tree-sitter/LanguageConfig';
import { TreeSitterManager } from '../../data/services/tree-sitter/TreeSitterManager';
import * as path from 'path';

/**
 * @intent
 * 投射意图用例，创建/更新文件中的 @intent 注释。
 * 替换策略：优先通过 tree-sitter 解析 AST 定位 @intent 注释节点并替换；
 * 不支持 tree-sitter 时静默回退到正则匹配。
 * 保护机制：仅替换注释节点内的 @intent，不触及字符串/数据中的 @intent 文本。
 *
 * 边界：
 * - 文件已存在且 force=false 时跳过
 * - force=true 时在已有文件中查找并替换 @intent 注释，不覆盖其他内容
 * - 查找以 @intent 内容标识为锚点，不限注释风格 (line-comment, block-comment, hash-comment)
 * - tree-sitter 失败时静默回退到正则
 * - 多行注释整体替换，不残留旧行
 *
 * 验收条件：
 * - 行注释 // @intent: 风格能被找到并替换为块注释 @intent 风格
 * - 字符串/数据中的 @intent 文本不被误匹配
 * - tree-sitter 不可用时自动回退到正则且结果正确
 */

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
 * 优先通过 tree-sitter AST 定位 @intent 注释节点并替换；
 * 失败时静默回退到正则匹配。
 * - 找到已有 @intent → 替换
 * - 未找到 → prepend 到文件顶部（shebang 之后）
 */
async function replaceIntentInContent(
  content: string,
  newBlock: string,
  pathname: string
): Promise<string> {
  // 1. 优先尝试 tree-sitter 通道
  const tsResult = await replaceWithTreeSitter(content, newBlock, pathname);
  if (tsResult !== null) {
    return tsResult;
  }

  // 2. 静默回退到正则通道
  return replaceWithRegex(content, newBlock);
}

/**
 * tree-sitter 通道：解析 AST 定位 @intent 注释节点并替换。
 * 失败时返回 null（语言不支持 / 解析失败 / 未找到节点）。
 */
async function replaceWithTreeSitter(
  content: string,
  newBlock: string,
  pathname: string
): Promise<string | null> {
  try {
    const ext = path.extname(pathname).toLowerCase();
    const language = LanguageConfig.getLanguageFromExtension(ext);
    if (!language) return null;

    const parser = await TreeSitterManager.getParser();
    const lang = await TreeSitterManager.getLanguage(language);
    if (!lang) return null;

    parser.setLanguage(lang);
    const tree = parser.parse(content);
    if (!tree || !tree.rootNode) return null;

    // 递归遍历 AST 查找包含 @intent 的注释节点
    const node = findIntentCommentNode(tree.rootNode);
    if (!node) return null;

    // 检查连续兄弟注释节点，合并为完整替换范围
    let startNode = node;
    let endNode = node;

    let prev = node.previousSibling;
    while (prev && isCommentNode(prev)) {
      startNode = prev;
      prev = prev.previousSibling;
    }

    let next = node.nextSibling;
    while (next && isCommentNode(next)) {
      endNode = next;
      next = next.nextSibling;
    }

    const startIdx = startNode.startIndex;
    const endIdx = endNode.endIndex;

    // 替换指定范围
    return content.slice(0, startIdx) + newBlock.trimEnd() + '\n' + content.slice(endIdx);
  } catch {
    return null;
  }
}

/** 判断 AST 节点是否为注释类型 */
function isCommentNode(node: any): boolean {
  const type = node.type;
  return (
    type === 'comment' ||
    type === 'line_comment' ||
    type === 'block_comment' ||
    type === 'documentation_comment'
  );
}

/**
 * 递归遍历 AST 节点，查找包含 @intent 的注释节点。
 * 返回第一个匹配的节点，未找到时返回 null。
 */
function findIntentCommentNode(node: any): any | null {
  if (isCommentNode(node) && node.text && typeof node.text === 'string' && node.text.includes('@intent')) {
    return node;
  }

  // 遍历子节点
  if (node.children && Array.isArray(node.children) && node.children.length > 0) {
    for (const child of node.children) {
      const result = findIntentCommentNode(child);
      if (result) return result;
    }
  }

  // 遍历命名子节点（某些语法可能区分 named/unnamed children）
  if (node.namedChildren && Array.isArray(node.namedChildren) && node.namedChildren.length > 0) {
    for (const child of node.namedChildren) {
      const result = findIntentCommentNode(child);
      if (result) return result;
    }
  }

  return null;
}

/**
 * 正则回退：宽容匹配多种注释风格中的 @intent。
 * 尝试顺序：行注释 // @intent → 井号注释 # @intent → 划线注释 -- @intent → 块注释 /★ (star-slash)
 * 多行处理：找到 @intent 行后连续消费后续注释行，直到非注释行或空行。
 * 未找到时 prepend 到文件顶部（shebang 之后）。
 *
 * @boundary
 * 输入：content - 文件内容；newBlock - 新 @intent 注释块
 * 输出：替换或插入后的完整内容
 * 副作用：无
 */
function replaceWithRegex(content: string, newBlock: string): string {
  const patterns: RegExp[] = [
    // // @intent 及后续 // 行
    /\/\/[ \t]*@intent[^\n]*(?:\n[ \t]*\/\/[^\n]*)*\n?/,
    // # @intent 及后续 # 行（Python、Ruby、R 等）
    /#[ \t]*@intent[^\n]*(?:\n[ \t]*#[^\n]*)*\n?/,
    // -- @intent 及后续 -- 行（SQL、Lua 等）
    /--[ \t]*@intent[^\n]*(?:\n[ \t]*--[^\n]*)*\n?/,
    // /** @intent */ 块注释（JSDoc、C 风格）
    /\/\*\*[\s\S]*?@intent[\s\S]*?\*\/\n?/,
  ];

  for (const pattern of patterns) {
    if (pattern.test(content)) {
      return content.replace(pattern, newBlock.trimEnd() + '\n');
    }
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
    const updatedContent = await replaceIntentInContent(existingContent, intentBlock, filePath);
    await this.fileRepo.writeFile(filePath, updatedContent);
    return { path: filePath, created: false, updated: true };
  }
}
