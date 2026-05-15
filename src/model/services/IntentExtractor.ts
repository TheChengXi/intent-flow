import * as fs from 'fs';
import * as path from 'path';
import { TreeSitterParser } from './TreeSitterParser';

// @intent: 提取文件中的 @intent 注释，用于快速了解模块意图

// @entity: IntentResult
// 意图提取结果
export interface IntentResult {
  fileName: string;
  intent: string;
  found: boolean; // 是否找到了 @intent 注释
}

// @contract: extractIntentFromFile(filePath: string, maxLines?: number) => Promise<IntentResult>
// @step: [读取文件] 读取文件前 maxLines 行（默认 50 行）
// @step: [正则匹配] 使用正则匹配 @intent: 或 # @intent:
// @step: [返回结果] 如果找到，返回文件名+意图；否则用文件名作为意图
// @boundary: 当文件不存在时，抛出错误
// @boundary: 当文件为空时，返回文件名作为意图
export async function extractIntentFromFile(
  filePath: string,
  maxLines: number = 50
): Promise<IntentResult> {
  // 读取文件
  const content = await fs.promises.readFile(filePath, 'utf-8');
  const lines = content.split('\n').slice(0, maxLines);

  // 提取文件名（不含扩展名）
  const fileName = path.basename(filePath, path.extname(filePath));

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
      return {
        fileName,
        intent: match[1].trim(),
        found: true
      };
    }
  }

  // 没有找到 @intent，使用文件名作为意图
  return {
    fileName,
    intent: fileName,
    found: false
  };
}
// @end
