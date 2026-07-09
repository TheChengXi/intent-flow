import { IUseCase } from './IUseCase';
import { DependencyBranch } from '../../data/entities/DependencyBranch';
import { IFileRepository } from '../../data/repositories/IFileRepository';
import { ICodeParserRepository } from '../../data/repositories/ICodeParserRepository';
import { ICacheRepository } from '../../data/repositories/ICacheRepository';
import { LanguageConfig } from '../../data/services/core/LanguageConfig';
import * as path from 'path';

/**
 * @intent
 * 从入口文件递归提取所有依赖的文件内容，构建完整的依赖树。
 * 产出 DependencyBranch 树结构，供全量上下文分析。
 * 边界：depth 为 0 停止递归；已访问文件跳过防循环；单条依赖读取失败跳过不影响整体
 */

// @entity: ExtractFullContextInput
// 全文上下文提取输入
export interface ExtractFullContextInput {
  filePath: string;       // 文件路径
  workspaceRoot: string;  // 工作区根目录
  depth?: number;         // 依赖深度，默认 2
}

export class ExtractFullContextUseCase implements IUseCase<ExtractFullContextInput, DependencyBranch> {
  constructor(
    private fileRepo: IFileRepository,
    private parserRepo: ICodeParserRepository,
    private cacheRepo: ICacheRepository
  ) {}

  // @contract: execute(input: ExtractFullContextInput) => Promise<DependencyBranch>
  // @step: [验证输入] 验证文件路径
  // @step: [提取意图] 提取当前文件的 @intent 注释
  // @step: [读取文件] 读取文件内容
  // @step: [提取 import] 提取依赖文件路径
  // @step: [递归提取] 对每个依赖文件递归调用
  // @step: [构建枝条] 构建依赖枝条结构
  // @step: [返回结果] 返回 DependencyBranch
  // @boundary: 文件不存在时抛出错误
  // @boundary: depth 为 0 时停止递归
  // @boundary: 文件已访问过时跳过（避免循环依赖）
  async execute(input: ExtractFullContextInput): Promise<DependencyBranch> {
    const { filePath, workspaceRoot, depth = 2 } = input;
    const visited = new Set<string>();

    return this.extractRecursive(filePath, workspaceRoot, depth, visited);
  }

  // @contract: extractRecursive(filePath: string, workspaceRoot: string, depth: number, visited: Set<string>) => Promise<DependencyBranch>
  // @step: [提取意图] 提取当前文件的意图
  // @step: [初始化枝条] 初始化依赖枝条
  // @step: [检查深度] 如果 depth 为 0 或文件已访问，停止递归
  // @step: [标记访问] 标记当前文件已访问
  // @step: [读取文件] 读取文件内容
  // @step: [提取 import] 提取依赖文件路径
  // @step: [递归提取] 对每个依赖文件递归调用
  // @step: [返回枝条] 返回依赖枝条
  private async extractRecursive(
    filePath: string,
    workspaceRoot: string,
    depth: number,
    visited: Set<string>
  ): Promise<DependencyBranch> {
    // 验证文件存在
    const exists = await this.fileRepo.exists(filePath);
    if (!exists) {
      throw new Error(`File not found: ${filePath}`);
    }

    // 提取意图
    const intent = await this.extractIntent(filePath);
    const fileName = path.basename(filePath);

    // 初始化依赖枝条
    const branch: DependencyBranch = {
      filePath,
      fileName,
      intent,
      dependencies: []
    };

    // 如果 depth 为 0，或者文件已访问过，停止递归
    if (depth === 0 || visited.has(filePath)) {
      return branch;
    }

    // 标记当前文件已访问
    visited.add(filePath);

    // 读取文件内容
    const content = await this.fileRepo.readFile(filePath);

    // 检测语言
    const language = this.detectLanguage(filePath);

    // 提取 import
    const importedFiles = await this.parserRepo.extractImports(
      content,
      path.dirname(filePath),
      language
    );

    // 递归提取依赖
    for (const importedFile of importedFiles) {
      try {
        const importExists = await this.fileRepo.exists(importedFile);
        if (importExists && !visited.has(importedFile)) {
          const depBranch = await this.extractRecursive(
            importedFile,
            workspaceRoot,
            depth - 1,
            visited
          );
          branch.dependencies.push(depBranch);
        }
      } catch (error) {
        // 跳过无法访问的依赖
        console.warn(`[ExtractFullContextUseCase] 跳过依赖: ${importedFile}`, error);
      }
    }

    return branch;
  }

  // @contract: extractIntent(filePath: string) => Promise<string>
  // @step: [读取文件] 读取文件前 50 行
  // @step: [查找 @intent] 查找 @intent 注释
  // @step: [返回意图] 返回意图文本，未找到则返回文件名
  private async extractIntent(filePath: string): Promise<string> {
    try {
      const content = await this.fileRepo.readFile(filePath);
      const lines = content.split('\n').slice(0, 50);

      for (const line of lines) {
        const match = line.match(/@intent[:\s]+(.+)/);
        if (match) {
          return match[1].trim();
        }
      }

      // 未找到 @intent，返回文件名
      return path.basename(filePath);
    } catch (error) {
      return path.basename(filePath);
    }
  }

  private detectLanguage(filePath: string): string {
    return LanguageConfig.getLanguageFromExtension(path.extname(filePath)) || 'typescript';
  }
}
