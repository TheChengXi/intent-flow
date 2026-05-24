import * as vscode from 'vscode';
import { HistoryService } from '../../data/services/HistoryService';
import { WorkLineHistoryRecord } from '../../data/entities/WorkLineHistory';
import * as FileRepository from '../../data/repositories/FileRepository';
import * as path from 'path';

// @entity: TranslateContext
// 转译上下文
export interface TranslateContext {
  code: string;
  compileSpec: string;
  apiKey: string;
  apiBaseUrl?: string;
  modelId?: string;
  lastTranslateResult?: string;
  filePath?: string;
  languageId?: string;
}

// @contract: TranslatorContextManager.prepare(document: vscode.TextDocument, selection: vscode.Selection, workspaceRoot: string, apiKey: string, apiBaseUrl?: string, modelId?: string) => Promise<TranslateContext>
// @step: [获取代码] 获取选中的代码文本
// @step: [读取规范] 读取 COMPILE_SPEC.md
// @step: [读取转译记录] 调用 HistoryService.getLastTranslatorRecord 获取上次转译结果（如果有函数名）
// @step: [构建上下文] 构建 TranslateContext 对象
// @step: [返回] 返回上下文
// @boundary: 当 COMPILE_SPEC 不存在时，使用空字符串

// @contract: TranslatorContextManager.save(workspaceRoot: string, filePath: string, functionName: string, contract: string, code: string, commentText: string, success: boolean, compileSpec: string) => Promise<void>
// @step: [构建记录] 构建 WorkLineHistoryRecord
// @step: [保存] 调用 HistoryService.addRecord 保存记录
// @boundary: 当保存失败时，应抛出错误

export class TranslatorContextManager {
  static async prepare(
    document: vscode.TextDocument,
    selection: vscode.Selection,
    workspaceRoot: string,
    apiKey: string,
    apiBaseUrl?: string,
    modelId?: string
  ): Promise<TranslateContext> {
    const selectedText = document.getText(selection);

    // 读取 COMPILE_SPEC
    const compileSpecPath = path.join(workspaceRoot, '_source', 'COMPILE_SPEC.md');
    let compileSpec = '';
    try {
      compileSpec = await FileRepository.readFile(compileSpecPath);
    } catch {
      // COMPILE_SPEC 不存在时使用空字符串
    }

    // 构建上下文
    const context: TranslateContext = {
      code: selectedText,
      compileSpec,
      apiKey,
      apiBaseUrl,
      modelId,
      filePath: document.fileName,
      languageId: document.languageId
    };

    return context;
  }

  static async save(
    workspaceRoot: string,
    filePath: string,
    functionName: string,
    contract: string,
    code: string,
    commentText: string,
    success: boolean,
    compileSpec: string
  ): Promise<void> {
    const record: WorkLineHistoryRecord = {
      timestamp: new Date().toISOString(),
      role: 'translator',
      input: {
        code,
        compileSpec
      },
      output: {
        success,
        content: commentText
      }
    };

    await HistoryService.addRecord(workspaceRoot, filePath, functionName, contract, record);
  }
}
