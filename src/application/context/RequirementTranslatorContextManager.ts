import * as vscode from 'vscode';
import { CallGraphService } from '../../data/services/CallGraphService';
import { extractIntentFromFile } from '../../data/services/IntentExtractor';
import { DependencyInfo } from '../roles/RequirementTranslatorVM';
import * as path from 'path';
import * as fs from 'fs/promises';

// @intent: 为需求转译器准备上下文，提取项目依赖信息

// @entity: RequirementTranslatorContext
// 需求转译器上下文
export interface RequirementTranslatorContext {
  intent: string;
  dependencies: DependencyInfo;
  apiKey: string;
  apiBaseUrl?: string;
  modelId?: string;
  filePath?: string;
}

// @contract: RequirementTranslatorContextManager.prepare(intent: string, workspaceRoot: string, apiKey: string, apiBaseUrl?: string, modelId?: string) => Promise<RequirementTranslatorContext>
// @step: [提取依赖] 调用 extractDependencies 提取项目依赖信息
// @step: [构建上下文] 构建 RequirementTranslatorContext 对象
// @step: [返回] 返回上下文
// @boundary: 当提取依赖失败时，返回空的依赖信息

export class RequirementTranslatorContextManager {
  static async prepare(
    intent: string,
    workspaceRoot: string,
    apiKey: string,
    apiBaseUrl?: string,
    modelId?: string
  ): Promise<RequirementTranslatorContext> {
    // 提取依赖信息
    const dependencies = await this.extractDependencies(workspaceRoot);

    // 构建上下文
    const context: RequirementTranslatorContext = {
      intent,
      dependencies,
      apiKey,
      apiBaseUrl,
      modelId
    };

    return context;
  }
  // @end

  // @contract: extractDependencies(workspaceRoot: string) => Promise<DependencyInfo>
  // @step: [扫描文件] 递归扫描 src 目录下的所有 .ts 文件
  // @step: [提取 @intent] 对每个文件调用 extractIntentFromFile
  // @step: [构建依赖信息] 构建 DependencyInfo 对象
  // @step: [返回] 返回依赖信息
  // @boundary: 当扫描失败时，返回空的依赖信息
  // @boundary: 当文件读取失败时，跳过该文件
  private static async extractDependencies(workspaceRoot: string): Promise<DependencyInfo> {
    const fileNames: string[] = [];
    const intents = new Map<string, string>();

    try {
      // 扫描 src 目录
      const srcDir = path.join(workspaceRoot, 'src');
      const files = await this.scanDirectory(srcDir, ['.ts', '.tsx']);

      // 提取每个文件的 @intent
      for (const filePath of files) {
        try {
          const intentResult = await extractIntentFromFile(filePath);
          const fileName = path.basename(filePath, path.extname(filePath));

          fileNames.push(fileName);

          if (intentResult.found) {
            intents.set(fileName, intentResult.intent);
          }
        } catch (error) {
          // 跳过无法读取的文件
          console.warn(`[RequirementTranslatorContextManager] 无法提取文件 ${filePath} 的 @intent:`, error);
        }
      }
    } catch (error) {
      console.error('[RequirementTranslatorContextManager] 提取依赖失败:', error);
    }

    return {
      fileNames,
      intents,
      typeDefinitions: new Map(), // 暂时为空，后续集成 LSP 后填充
      functionSignatures: new Map() // 暂时为空，后续集成 LSP 后填充
    };
  }
  // @end

  // @contract: scanDirectory(dir: string, extensions: string[]) => Promise<string[]>
  // @step: [读取目录] 读取目录下的所有文件和子目录
  // @step: [过滤文件] 过滤出指定扩展名的文件
  // @step: [递归扫描] 递归扫描子目录
  // @step: [返回] 返回所有文件路径
  // @boundary: 当目录不存在时，返回空数组
  // @boundary: 当读取失败时，返回空数组
  private static async scanDirectory(dir: string, extensions: string[]): Promise<string[]> {
    const files: string[] = [];

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          // 跳过 node_modules 和 .git 等目录
          if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') {
            continue;
          }

          // 递归扫描子目录
          const subFiles = await this.scanDirectory(fullPath, extensions);
          files.push(...subFiles);
        } else if (entry.isFile()) {
          // 检查文件扩展名
          const ext = path.extname(entry.name).toLowerCase();
          if (extensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      console.error(`[RequirementTranslatorContextManager] 扫描目录 ${dir} 失败:`, error);
    }

    return files;
  }
  // @end
}
