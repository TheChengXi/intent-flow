import * as vscode from 'vscode';
import { CDDComment, ContractAnnotation, StepAnnotation, BoundaryAnnotation } from '../../../data/entities/CDDComment';
import { ValidationError } from '../../../data/entities/Errors';
import { LanguageConfig } from '../../../data/services/tree-sitter/LanguageConfig';

// @contract: parseComment(text: string, document: vscode.TextDocument, startLine: number) => CDDComment | null
// @step: [跳过装饰行] 跳过不包含 @contract 的注释行
// @step: [提取契约] 使用正则 /@contract:\s*(.+)/ 提取 @contract 行
// @step: [解析契约] 解析函数名、参数、返回类型、异常类型
// @step: [提取步骤] 使用正则 /@step:\s*\[(.+?)\]\s*(.+)/ 提取所有 @step
// @step: [检测简化] 检查是否包含 @simple 标记
// @step: [提取边界] 使用正则 /@boundary:\s*当(.+?)时，应(.+)/ 提取所有 @boundary
// @step: [计算范围] 从 startLine 到找到的最后一个注释行
// @step: [构建对象] 构建 CDDComment 对象
// @boundary: 当未找到 @contract 时，返回 null
// @boundary: 当 @contract 格式不符合 BR-007 时，抛出 ValidationError
// @boundary: 当 @boundary 格式不符合"当...时，应..."时，抛出 ValidationError
export function parseComment(text: string, document: vscode.TextDocument, startLine: number): CDDComment | null {
  try {
    // 跳过装饰行，找到第一个包含 @contract 的行
    const lines = text.split('\n');
    let contractLineIndex = -1;
    let actualText = text;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('@contract:')) {
        contractLineIndex = i;
        // 从 @contract 行开始截取
        actualText = lines.slice(i).join('\n');
        break;
      }
    }

    if (contractLineIndex === -1) {
      return null;
    }

    // 清理注释符号（支持 // 和 # 开头的注释）
    const cleanedLines = actualText.split('\n').map(line => {
      return line.replace(/^\s*(\/\/|#)\s*/, '');
    });
    actualText = cleanedLines.join('\n');

    const contractMatch = actualText.match(/@contract:\s*(.+)/);
    if (!contractMatch) {
      return null;
    }

    const contract = parseContractLine(contractMatch[1]);

    const steps: StepAnnotation[] = [];
    // 宽松提取：只提取 @step: 后的全部内容
    const stepRegex = /@step:\s*(.+)/g;
    let stepMatch;
    while ((stepMatch = stepRegex.exec(actualText)) !== null) {
      steps.push({
        description: stepMatch[1].trim(),
        isSimple: false
      });
    }

    const isSimple = actualText.includes('@simple');
    if (isSimple && steps.length > 0) {
      steps[0].isSimple = true;
    }

    const boundaries: BoundaryAnnotation[] = [];
    const boundaryRegex = /@boundary:\s*(.+)/g;
    let boundaryMatch;
    console.log('[CommentParser] 开始解析 boundaries，文本长度:', actualText.length);
    while ((boundaryMatch = boundaryRegex.exec(actualText)) !== null) {
      console.log('[CommentParser] 找到 boundary:', boundaryMatch[0]);
      boundaries.push({
        description: boundaryMatch[1].trim()
      });
    }
    console.log('[CommentParser] 解析到的 boundaries 数量:', boundaries.length);

    const adjustedStartLine = startLine + contractLineIndex;
    const endLine = adjustedStartLine + actualText.split('\n').length - 1;
    const range = new vscode.Range(adjustedStartLine, 0, endLine, actualText.split('\n')[actualText.split('\n').length - 1].length);

    return {
      contract,
      steps,
      boundaries,
      range
    };
  } catch (error) {
    console.error('CommentParser.parseComment error:', error);
    return null;
  }
}
// @end

// @contract: parseContractLine(line: string) => ContractAnnotation
// @step: [正则匹配] 使用正则提取函数名、参数列表、返回类型、throws 子句
// @step: [解析参数] 分割参数列表，解析每个参数的名称和类型
// @step: [解析异常] 提取 throws 后的异常类型列表
// @step: [生成版本] 生成版本号格式为 functionName:v1.0
// @boundary: 当格式不匹配时，抛出 ValidationError
// @boundary: 当参数格式不包含类型时，抛出 ValidationError
export function parseContractLine(line: string): ContractAnnotation {
  try {
    const contractRegex = /(\w+)\s*\(([^)]*)\)\s*(?:=>|->|:)\s*([^|]+)(?:\s*\|\s*throws\s+(.+))?/;
    const match = line.match(contractRegex);

    if (!match) {
      throw new ValidationError(`@contract 格式不符合 BR-007: ${line}`);
    }

    const functionName = match[1];
    const paramsStr = match[2].trim();
    const returnType = match[3].trim();
    const throwsStr = match[4]?.trim();

    // 智能分割参数：考虑尖括号、方括号、圆括号内的逗号
    const parameters = paramsStr ? splitParameters(paramsStr).map(param => {
      const trimmedParam = param.trim();
      const colonIndex = trimmedParam.indexOf(':');
      if (colonIndex === -1) {
        throw new ValidationError(`参数格式错误，必须包含类型标注: ${param}`);
      }
      const name = trimmedParam.substring(0, colonIndex).trim();
      const type = trimmedParam.substring(colonIndex + 1).trim();
      if (!name || !type) {
        throw new ValidationError(`参数格式错误，必须包含类型标注: ${param}`);
      }
      return { name, type };
    }) : [];

    const throwsTypes = throwsStr ? throwsStr.split(',').map(t => t.trim()) : [];

    const version = `${functionName}:v1.0`;

    return {
      functionName,
      parameters,
      returnType,
      throwsTypes,
      version
    };
  } catch (error) {
    console.error('CommentParser.parseContractLine error:', error);
    throw error;
  }
}

// @contract: splitParameters(paramsStr: string) => string[]
// @step: [初始化] 创建结果数组和当前参数字符串
// @step: [遍历] 遍历每个字符，跟踪括号深度
// @step: [分割] 只在括号深度为 0 时遇到逗号才分割
// @step: [返回] 返回分割后的参数数组
// @boundary: 当括号不匹配时，仍然尝试分割
function splitParameters(paramsStr: string): string[] {
  const result: string[] = [];
  let current = '';
  let depth = 0; // 跟踪 <>, [], () 的嵌套深度

  for (let i = 0; i < paramsStr.length; i++) {
    const char = paramsStr[i];

    if (char === '<' || char === '[' || char === '(') {
      depth++;
      current += char;
    } else if (char === '>' || char === ']' || char === ')') {
      depth--;
      current += char;
    } else if (char === ',' && depth === 0) {
      // 只在深度为 0 时，逗号才是参数分隔符
      if (current.trim()) {
        result.push(current.trim());
      }
      current = '';
    } else {
      current += char;
    }
  }

  // 添加最后一个参数
  if (current.trim()) {
    result.push(current.trim());
  }

  return result;
}
// @end

// @contract: findCommentBlock(document: vscode.TextDocument, position: vscode.Position) => { start: number; end: number } | null
// @step: [向上查找] 从当前位置向上查找，直到找到 @contract 或非注释行
// @step: [向下查找] 从 @contract 向下查找，直到找到 @end 或非注释行
// @step: [返回范围] 返回起始行号和结束行号
// @boundary: 当未找到 @contract 时，返回 null
export function findCommentBlock(document: vscode.TextDocument, position: vscode.Position): { start: number; end: number } | null {
  try {
    let startLine = position.line;
    let foundContract = false;

    // 检测注释符号（支持多语言）
    const languageId = document.languageId;
    const commentPrefixes = getCommentPrefixes(languageId);

    // 向上查找 @contract
    for (let i = position.line; i >= 0; i--) {
      const line = document.lineAt(i).text.trim();
      if (line.includes('@contract:')) {
        startLine = i;
        foundContract = true;
        break;
      }
      // 遇到非注释且非空行，停止查找
      if (!isCommentLine(line, commentPrefixes) && line !== '') {
        break;
      }
    }

    if (!foundContract) {
      return null;
    }

    // 向下查找 @end，允许跳过空行和代码行
    let endLine = startLine;
    let foundEnd = false;
    for (let i = startLine; i < document.lineCount; i++) {
      const line = document.lineAt(i).text.trim();

      // 找到 @end 标记
      if (line.includes('@end')) {
        endLine = i;
        foundEnd = true;
        break;
      }

      // 如果是注释行或空行，继续
      if (isCommentLine(line, commentPrefixes) || line === '') {
        endLine = i;
        continue;
      }

      // 如果是代码行，也继续（因为代码块可能包含代码）
      endLine = i;
    }

    return { start: startLine, end: endLine };
  } catch (error) {
    console.error('CommentParser.findCommentBlock error:', error);
    return null;
  }
}
// @end

// @contract: getCommentPrefixes(languageId: string) => string[]
// @step: [委托] 委托给 LanguageConfig.getCommentPrefixes
// @step: [返回] 返回注释前缀数组
function getCommentPrefixes(languageId: string): string[] {
  const language = LanguageConfig.getLanguageName(languageId);
  return LanguageConfig.getCommentPrefixes(language);
}
// @end

// @contract: isCommentLine(line: string, prefixes: string[]) => boolean
// @step: [检查前缀] 检查行是否以任一注释前缀开头
// @step: [返回] 返回是否为注释行
function isCommentLine(line: string, prefixes: string[]): boolean {
  return prefixes.some(prefix => line.startsWith(prefix));
}
// @end
