import * as fs from 'fs';
import * as path from 'path';
import { extractIntentFromFile, IntentResult } from './extractors/IntentExtractor';
import { ImportExtractor } from './extractors/import/ImportExtractor';
import { FileMetricsService, FileSizeCheckResult } from '../FileMetricsService';
import { CacheRepositoryImpl } from '../cache/CacheRepositoryImpl';

// @intent: 全文上下文提取，递归读取文件及其所有依赖的完整内容（文件级别）

// @entity: DependencyBranch
// 依赖枝条：文件的意图及其依赖的意图树
export interface DependencyBranch {
  filePath: string;
  fileName: string;
  intent: string;
  dependencies: DependencyBranch[];
}

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
    const cache = CacheRepositoryImpl.getInstance();

    // 使用缓存读取文件内容
    const content = await cache.getFileContent(filePath);

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

    // 并行递归提取每个依赖的意图
    const dependencyPromises = importedFiles.map(async (importedFile) => {
      try {
        // 检查文件是否存在
        await fs.promises.access(importedFile);

        // 递归提取依赖
        return await extractIntentWithDependencies(
          importedFile,
          workspaceRoot,
          depth - 1,
          visited
        );
      } catch (error) {
        // 文件不存在，返回 null
        return null;
      }
    });

    // 等待所有依赖提取完成
    const dependencyResults = await Promise.all(dependencyPromises);

    // 过滤掉 null 结果并添加到 dependencies
    branch.dependencies = dependencyResults.filter((dep): dep is DependencyBranch => dep !== null);
  } catch (error) {
    // 读取文件失败，返回当前枝条
    console.warn(`[FullContextExtractor] 无法读取文件 ${filePath}:`, error);
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
    console.warn(`[FullContextExtractor] 无法检查文件 ${branch.filePath}:`, error);
  }

  // 递归检查所有依赖
  for (const dep of branch.dependencies) {
    const depResults = await checkDependencyBranchSize(dep, threshold);
    results.push(...depResults);
  }

  return results;
}
// @end
