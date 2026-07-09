import * as fs from 'fs';
import * as path from 'path';
import { TreeSitterManager } from '../../core/TreeSitterManager';
import { LanguageConfig } from '../../core/LanguageConfig';

// @intent: 从文件中提取 @intent 注释，配合 ImportExtractor 形成「意图依赖树」

// @entity: IntentResult
// 意图提取结果
export interface IntentResult {
  fileName: string;
  intent: string;
  found: boolean; // 是否找到了 @intent 注释
}

// @contract: extractIntentFromFile(filePath: string, maxLines?: number) => Promise<IntentResult>
// @step: [检测语言] 使用 LanguageConfig 从文件扩展名检测语言
// @step: [尝试 Tree-sitter] 如果支持该语言，使用 Tree-sitter 提取注释中的 @intent
// @step: [回退正则] 如果 Tree-sitter 失败，使用正则表达式匹配
// @step: [返回结果] 如果找到，返回文件名+意图；否则用文件名作为意图
// @boundary: 当文件不存在时，抛出错误
// @boundary: 当文件为空时，返回文件名作为意图
export async function extractIntentFromFile(
  filePath: string,
  maxLines: number = 50
): Promise<IntentResult> {
  // 提取文件名（不含扩展名）
  const fileName = path.basename(filePath, path.extname(filePath));

  // 检测语言
  const ext = path.extname(filePath).toLowerCase();
  const language = LanguageConfig.getLanguageFromExtension(ext);

  // 读取文件
  const content = await fs.promises.readFile(filePath, 'utf-8');

  // 如果支持该语言，尝试使用 Tree-sitter
  if (language) {
    try {
      const intent = await extractIntentWithTreeSitter(content, language, maxLines);
      if (intent) {
        return {
          fileName,
          intent,
          found: true
        };
      }
    } catch (error) {
      // Tree-sitter 失败，回退到正则
      console.warn(`[IntentExtractor] Tree-sitter 提取失败，回退到正则:`, error);
    }
  }

  // 回退到正则表达式
  const intent = extractIntentWithRegex(content, maxLines);
  if (intent) {
    return {
      fileName,
      intent,
      found: true
    };
  }

  // 没有找到 @intent，使用文件名作为意图
  return {
    fileName,
    intent: fileName,
    found: false
  };
}
// @end

// @contract: extractIntentWithTreeSitter(content: string, language: string, maxLines: number) => Promise<string | null>
// @step: [初始化] 初始化 Tree-sitter
// @step: [获取 parser] 从 TreeSitterManager 获取已初始化的 parser
// @step: [加载语言] 加载对应语言的 Language
// @step: [解析代码] 使用 Tree-sitter 解析代码生成 AST
// @step: [遍历 AST] 递归遍历 AST 查找注释节点
// @step: [提取 @intent] 从注释节点中提取 @intent
// @step: [返回] 返回 @intent 内容或 null
// @boundary: 当 Tree-sitter 初始化失败时，返回 null
// @boundary: 当语言不支持时，返回 null
async function extractIntentWithTreeSitter(
  content: string,
  language: string,
  maxLines: number
): Promise<string | null> {
  try {
    // 初始化 Tree-sitter
    await TreeSitterManager.init();

    // 获取 parser 和语言
    const parser = await TreeSitterManager.getParser();
    const lang = await TreeSitterManager.getLanguage(language);
    if (!lang) {
      return null;
    }

    // 设置语言并解析
    parser.setLanguage(lang);
    const tree = parser.parse(content);

    if (!tree) {
      return null;
    }

    // 只检查前 maxLines 行
    const lines = content.split('\n').slice(0, maxLines);
    const maxOffset = lines.join('\n').length;

    // 遍历 AST 查找注释节点
    const intent = findIntentInComments(tree.rootNode, maxOffset);
    return intent;

  } catch (error) {
    return null;
  }
}

// @contract: findIntentInComments(node: any, maxOffset: number) => string | null
// @step: [检查节点] 检查当前节点是否是注释节点
// @step: [提取 @intent] 如果是注释，尝试提取 @intent
// @step: [递归] 递归检查子节点
// @step: [返回] 返回找到的 @intent 或 null
function findIntentInComments(node: any, maxOffset: number): string | null {
  // 如果节点超出范围，停止
  if (node.startPosition.row * 1000 > maxOffset) {
    return null;
  }

  // 检查是否是注释节点
  const commentTypes = [
    'comment',
    'line_comment',
    'block_comment',
    'documentation_comment'
  ];

  if (commentTypes.includes(node.type)) {
    const commentText = node.text;
    const intent = extractIntentFromCommentBlock(commentText);
    if (intent) {
      return intent;
    }
  }

  // 递归检查子节点
  for (const child of node.children) {
    const intent = findIntentInComments(child, maxOffset);
    if (intent) {
      return intent;
    }
  }

  return null;
}

/**
 * 从注释文本块中提取 @intent 内容（支持单行和多行 JSDoc 格式）。
 *
 * 支持的格式：
 *   // @intent: xxx
 *   // @intent xxx
 *   @intent xxx（无前缀）
 *   /** @intent xxx *\/
 *   /**
 *    * @intent
 *    * xxx
 *    * xxx
 *    *\/
 */
function extractIntentFromCommentBlock(commentText: string): string | null {
  const lines = commentText.split('\n');
  let inIntent = false;
  let parts: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (!inIntent) {
      // 检测 @intent 标签行
      // 支持: * @intent, // @intent, # @intent, @intent, /** @intent
      const tagMatch = trimmed.match(/^(\*|\/\/|#|\/\*)?\s*@intent\b/);
      if (tagMatch) {
        inIntent = true;
        // 检查 @intent 同一行是否有内容（@intent xxx 或 @intent: xxx）
        const inline = trimmed.replace(/^(\*|\/\/|#|\/\*)?\s*@intent[:\s]*/, '').trim();
        if (inline) parts.push(inline);
        continue;
      }
      continue;
    }

    // ---- 在 @intent 块中 ----

    // 结束条件
    if (trimmed === '*/' || trimmed === '') break;
    // 遇到其他 @ 标签（@contract, @param 等）停止
    if (/^\*?\s*@\w/.test(trimmed) && !/^\*?\s*@intent\b/.test(trimmed)) break;
    if (/^\/\/\s*@\w/.test(trimmed)) break;
    if (/^#\s*@\w/.test(trimmed)) break;

    // 提取文本，去除注释标记：*, //, #
    const text = trimmed
      .replace(/^\*\s?/, '')
      .replace(/^\/\/\s?/, '')
      .replace(/^#\s?/, '')
      .trim();

    if (text) parts.push(text);
  }

  return parts.length > 0 ? parts.join(' ') : null;
}

// @contract: extractIntentWithRegex(content: string, maxLines: number) => string | null
// @step: [读取前 N 行] 读取文件前 maxLines 行
// @step: [正则匹配] 使用正则匹配 @intent: 或 # @intent:
// @step: [返回] 返回 @intent 内容或 null
function extractIntentWithRegex(content: string, maxLines: number): string | null {
  const lines = content.split('\n').slice(0, maxLines);
  return extractIntentFromLines(lines);
}

/**
 * 从行数组中提取 @intent（复用逻辑，避免重复实现）。
 */
function extractIntentFromLines(lines: string[]): string | null {
  let inIntent = false;
  let parts: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (!inIntent) {
      // 检测 @intent 标签行
      const tagMatch = trimmed.match(/^(\*|\/\/|#|\/\*)?\s*@intent\b/);
      if (tagMatch) {
        inIntent = true;
        const inline = trimmed.replace(/^(\*|\/\/|#|\/\*)?\s*@intent[:\s]*/, '').trim();
        if (inline) parts.push(inline);
        continue;
      }
      continue;
    }

    // ---- 在 @intent 块中 ----

    // 结束条件
    if (trimmed === '*/' || trimmed === '') break;
    if (/^\*?\s*@\w/.test(trimmed) && !/^\*?\s*@intent\b/.test(trimmed)) break;
    if (/^\/\/\s*@\w/.test(trimmed)) break;
    if (/^#\s*@\w/.test(trimmed)) break;

    // 提取文本，去除注释标记
    const text = trimmed
      .replace(/^\*\s?/, '')
      .replace(/^\/\/\s?/, '')
      .replace(/^#\s?/, '')
      .trim();

    if (text) parts.push(text);
  }

  return parts.length > 0 ? parts.join(' ') : null;
}
// @end
