/**
 * @intent
 * 扫描目录下所有文件，提取 import 依赖关系，构建文件间调用图。
 * 产出 CallDependency[] 供后续能力聚类分析使用。
 * 边界：不支持的文件扩展名跳过；读取失败的单条文件不中断整体扫描
 */

import { IFileRepository } from '../../data/repositories/IFileRepository';
import { ICodeParserRepository } from '../../data/repositories/ICodeParserRepository';
import { LanguageConfig } from '../../data/services/tree-sitter/LanguageConfig';
import { CallDependency } from '../../data/entities/CallDependency';
import { IUseCase } from './IUseCase';
import * as path from 'path';

export interface AnalyzeCallGraphInput {
  directoryPath: string;
  recursive?: boolean;
  extensions?: string[];
}

export interface AnalyzeCallGraphOutput {
  dependencies: Map<string, CallDependency>;
  analyzeDuration: number;
  filesAnalyzed: number;
  dependenciesFound: number;
}

export interface IAnalyzeCallGraphUseCase extends IUseCase<AnalyzeCallGraphInput, AnalyzeCallGraphOutput> {
  execute(input: AnalyzeCallGraphInput): Promise<AnalyzeCallGraphOutput>;
}

export class AnalyzeCallGraphUseCase implements IAnalyzeCallGraphUseCase {
  constructor(
    private fileRepo: IFileRepository,
    private parserRepo: ICodeParserRepository
  ) {}

  // @contract: execute(input: AnalyzeCallGraphInput) => Promise<AnalyzeCallGraphOutput>
  // @step: [扫描目录] 递归扫描目录获取所有代码文件（通过 IFileRepository）
  // @step: [提取导入] 对每个文件调用 parserRepo 提取 import/require 语句
  // @step: [解析路径] 将相对导入路径解析为绝对路径
  // @step: [构建依赖图] 将解析结果存入 Map<filePath, CallDependency>
  // @step: [统计元数据] 记录扫描文件数、依赖关系数、耗时
  // @boundary: 所有路径必须规范化为绝对路径；单个文件分析失败不中断流程
  async execute(input: AnalyzeCallGraphInput): Promise<AnalyzeCallGraphOutput> {
    const startTime = Date.now();

    try {
      const dependencies = new Map<string, CallDependency>();
      const extensions = input.extensions || ['.ts', '.tsx', '.js', '.jsx'];
      const recursive = input.recursive !== false;

      // 扫描目录获取所有文件
      const files = await this.fileRepo.scanDirectory(input.directoryPath, {
        extensions,
        recursive
      });

      // 分析每个文件的导入关系
      for (const filePath of files) {
        try {
          const content = await this.fileRepo.readFile(filePath);
          const imports = await this.parserRepo.extractImports(
            content,
            path.dirname(filePath),
            this.getLanguage(filePath)
          );

          // ImportExtractor 已经返回了完整的绝对路径，直接过滤即可
          const resolvedImports = imports
            .filter((imp: string) => this.isCodeFile(imp, extensions));

          if (resolvedImports.length > 0) {
            dependencies.set(filePath, {
              from: filePath,
              to: resolvedImports
            });
          }
        } catch (fileError) {
          console.warn(`Failed to analyze file ${filePath}:`, fileError);
        }
      }

      return {
        dependencies,
        analyzeDuration: Date.now() - startTime,
        filesAnalyzed: files.length,
        dependenciesFound: dependencies.size
      };
    } catch (error) {
      throw new Error(`分析调用图失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private resolveImportPath(importPath: string, currentDir: string): string {
    let cleaned = importPath.replace(/\.(js|ts|jsx|tsx)$/, '');

    if (cleaned.startsWith('.')) {
      const resolved = path.resolve(currentDir, cleaned);
      return resolved;
    }

    return importPath;
  }

  private isCodeFile(filePath: string, extensions: string[]): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return extensions.includes(ext) || extensions.includes(ext + 'x');
  }

  private getLanguage(filePath: string): string {
    return LanguageConfig.getLanguageFromExtension(path.extname(filePath)) || 'typescript';
  }
}
