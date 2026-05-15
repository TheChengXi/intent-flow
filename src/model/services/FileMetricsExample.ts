import { extractIntentWithDependencies, checkDependencyBranchSize } from './IntentExtractor';
import { FileMetricsService } from './FileMetricsService';
import * as path from 'path';

// 使用示例

// 示例 1: 检查单个文件的依赖树
async function checkFileWithDependencies(filePath: string, workspaceRoot: string) {
  console.log(`\n=== 检查文件及其依赖: ${path.basename(filePath)} ===\n`);

  // 1. 提取依赖树
  const branch = await extractIntentWithDependencies(filePath, workspaceRoot, 2);

  // 2. 检查依赖树中所有文件的大小
  const results = await checkDependencyBranchSize(branch, 400);

  // 3. 输出结果
  if (results.length === 0) {
    console.log('✓ 所有文件都在推荐大小范围内');
  } else {
    console.log(`发现 ${results.length} 个文件需要重构:\n`);
    console.log(FileMetricsService.formatReport(results));
  }

  return results;
}

// 示例 2: 扫描整个项目
async function scanProject(projectPath: string) {
  console.log(`\n=== 扫描项目: ${projectPath} ===\n`);

  const results = await FileMetricsService.checkProjectFiles(projectPath, 400);

  console.log(FileMetricsService.formatReport(results));

  return results;
}

// 示例 3: 检查单个文件行数
async function checkSingleFile(filePath: string) {
  const lineCount = await FileMetricsService.getLineCount(filePath);
  console.log(`${path.basename(filePath)}: ${lineCount} 行`);

  if (lineCount > FileMetricsService.CRITICAL_THRESHOLD) {
    console.log('🚨 严重: 需要立即重构');
  } else if (lineCount > FileMetricsService.WARNING_THRESHOLD) {
    console.log('⚠️  警告: 建议重构');
  } else {
    console.log('✓ 大小合理');
  }

  return lineCount;
}

// 导出示例函数
export { checkFileWithDependencies, scanProject, checkSingleFile };
