import * as fs from 'fs';
import * as path from 'path';
import { TreeSitterParser } from './TreeSitterParser';
import { ImportExtractor } from './codeAnalysis/ImportExtractor';
import { FileMetricsService, FileSizeCheckResult } from './FileMetricsService';

// @intent: 提取文件中的 @intent 注释，用于快速了解模块意图

// @entity: IntentResult
// 意图提取结果
export interface IntentResult {
  fileName: string;
  intent: string;
  found: boolean; // 是否找到了 @intent 注释
}

// @entity: DependencyBranch
// 依赖枝条：文件的意图及其依赖的意图树
export interface DependencyBranch {
  filePath: string;
  fileName: string;
  intent: string;
  dependencies: DependencyBranch[];
}

// @contract: extractIntentFromFile(filePath: string, maxLines?: number) => Promise<IntentResult>
// @step: [检测语言] 从文件扩展名检测语言
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
  const languageMap: { [key: string]: string } = {
    '.ts': 'typescript',
    '.tsx': 'tsx',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.py': 'python',
    '.go': 'go',
    '.cpp': 'cpp',
    '.c': 'c',
    '.rs': 'rust',
    '.java': 'java',
    '.kt': 'kotlin',
    '.swift': 'swift',
    '.cs': 'csharp',
    '.rb': 'ruby',
    '.php': 'php'
  };
  const language = languageMap[ext];

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
// @step: [初始化] 初始化 Tree-sitter parser
// @step: [获取 parser] 从 TreeSitterParser 获取已初始化的 parser
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
    // 获取已初始化的 parser
    const parser = await TreeSitterParser.getParser();

    // 加载语言
    const lang = await TreeSitterParser['getLanguage'](language);
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
    const intentMatch = commentText.match(/@intent[:\s]+(.+?)(?:\n|$|\*\/)/);
    if (intentMatch) {
      return intentMatch[1].trim();
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

// @contract: extractIntentWithRegex(content: string, maxLines: number) => string | null
// @step: [读取前 N 行] 读取文件前 maxLines 行
// @step: [正则匹配] 使用正则匹配 @intent: 或 # @intent:
// @step: [返回] 返回 @intent 内容或 null
function extractIntentWithRegex(content: string, maxLines: number): string | null {
  const lines = content.split('\n').slice(0, maxLines);

  // 正则匹配 @intent
  // 支持格式：
  // // @intent: 这是意图
  // # @intent: 这是意图
  // @intent: 这是意图
  const intentRegex = /^[\/\/#\s]*@intent[:\s]+(.+)$/;

  for (const line of lines) {
    const trimmed = line.trim();
    const match = trimmed.match(intentRegex);

    if (match) {
      return match[1].trim();
    }
  }

  return null;
}
// @end

// @contract: extractIntentWithDependencies(filePath: string, workspaceRoot: string, depth?: number, visited?: Set<string>) => Promise<DependencyBranch>
// @step: [提取意图] 调用 extractIntentFromFile 提取当前文件的意图
// @step: [读取文件] 读取文件内容
// @step: [提取 import] 调用 ImportExtractor 提取依赖文件路径
// @step: [递归提取] 对每个依赖文件递归调用 extractIntentWithDependencies
// @step: [构建枝条] 构建依赖枝条结构
// @step: [返回] 返回 DependencyBranch
// @boundary: 当 depth 为 0 时，停止递归
// @boundary: 当文件不存在时，跳过该依赖
// @boundary: 当文件已访问过时，跳过（避免循环依赖）
export async function extractIntentWithDependencies(
  filePath: string,
  workspaceRoot: string,
  depth: number = 2,
  visited: Set<string> = new Set()
): Promise<DependencyBranch> {
  // 提取当前文件的意图
  const intentResult = await extractIntentFromFile(filePath);

  // 初始化依赖枝条
  const branch: DependencyBranch = {
    filePath,
    fileName: intentResult.fileName,
    intent: intentResult.intent,
    dependencies: []
  };

  // 如果 depth 为 0，或者文件已访问过，停止递归
  if (depth === 0 || visited.has(filePath)) {
    return branch;
  }

  // 标记当前文件已访问
  visited.add(filePath);

  try {
    // 读取文件内容
    const content = await fs.promises.readFile(filePath, 'utf-8');

    // 检测语言
    const ext = path.extname(filePath).toLowerCase();
    const languageMap: { [key: string]: string } = {
      '.ts': 'typescript',
      '.tsx': 'tsx',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.py': 'python',
      '.go': 'go',
      '.cpp': 'cpp',
      '.c': 'c'
    };
    const language = languageMap[ext];

    // 提取 import 的文件路径
    const importedFiles = await ImportExtractor.extractImportedFiles(
      content,
      path.dirname(filePath),
      language
    );

    // 递归提取每个依赖的意图
    for (const importedFile of importedFiles) {
      try {
        // 检查文件是否存在
        await fs.promises.access(importedFile);

        // 递归提取依赖
        const depBranch = await extractIntentWithDependencies(
          importedFile,
          workspaceRoot,
          depth - 1,
          visited
        );

        branch.dependencies.push(depBranch);
      } catch (error) {
        // 文件不存在，跳过
        continue;
      }
    }
  } catch (error) {
    // 读取文件失败，返回当前枝条
    console.warn(`[IntentExtractor] 无法读取文件 ${filePath}:`, error);
  }

  return branch;
}
// @end

// @contract: checkDependencyBranchSize(branch: DependencyBranch, threshold?: number) => Promise<FileSizeCheckResult[]>
// @step: [检查当前文件] 调用 FileMetricsService.getLineCount 检查当前文件行数
// @step: [记录结果] 如果超过阈值，记录到结果列表
// @step: [递归检查] 递归检查所有依赖文件
// @step: [返回结果] 返回所有需要重构的文件列表
// @boundary: 当文件不存在时，跳过该文件
export async function checkDependencyBranchSize(
  branch: DependencyBranch,
  threshold: number = FileMetricsService.WARNING_THRESHOLD
): Promise<FileSizeCheckResult[]> {
  const results: FileSizeCheckResult[] = [];

  try {
    // 检查当前文件
    const lineCount = await FileMetricsService.getLineCount(branch.filePath);

    if (lineCount > threshold) {
      results.push({
        filePath: branch.filePath,
        lineCount,
        threshold,
        needsRefactoring: true,
        exceedsBy: lineCount - threshold
      });
    }
  } catch (error) {
    // 文件不存在或无法读取，跳过
    console.warn(`[IntentExtractor] 无法检查文件 ${branch.filePath}:`, error);
  }

  // 递归检查所有依赖
  for (const dep of branch.dependencies) {
    const depResults = await checkDependencyBranchSize(dep, threshold);
    results.push(...depResults);
  }

  return results;
}
// @end
