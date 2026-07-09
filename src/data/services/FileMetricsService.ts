import * as fs from 'fs';
import * as path from 'path';

// @intent: 提供文件代码行数统计和大小检查功能

// @contract: FileMetricsService.getLineCount(filePath: string) => Promise<number>
// @step: [读取文件] 使用 fs.promises.readFile 读取文件内容
// @step: [统计行数] 按换行符分割并计算行数
// @step: [返回结果] 返回文件的总行数
// @boundary: 当文件不存在时，抛出错误
// @boundary: 当文件无法读取时，抛出错误

export interface FileSizeCheckResult {
  filePath: string;
  lineCount: number;
  threshold: number;
  needsRefactoring: boolean;
  exceedsBy?: number;
}

export class FileMetricsService {
  // 警告阈值：400 行
  static readonly WARNING_THRESHOLD = 400;
  // 严重阈值：500 行
  static readonly CRITICAL_THRESHOLD = 500;

  static async getLineCount(filePath: string): Promise<number> {
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');

      if (content.length === 0) {
        return 0;
      }

      const lines = content.split('\n');
      return lines.length;
    } catch (error) {
      throw new Error(`Failed to read file ${filePath}: ${error}`);
    }
  }
  // @end

  // @contract: FileMetricsService.checkProjectFiles(projectPath: string, threshold: number, extensions: string[]) => Promise<FileSizeCheckResult[]>
  // @step: [扫描文件] 递归扫描项目目录，找到所有匹配扩展名的文件
  // @step: [检查每个文件] 对每个文件调用 getLineCount
  // @step: [过滤结果] 只返回需要重构的文件
  // @step: [排序] 按超出行数降序排序
  // @boundary: 当目录不存在时，抛出错误
  static async checkProjectFiles(
    projectPath: string,
    threshold: number = FileMetricsService.WARNING_THRESHOLD,
    extensions: string[] = ['.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.cpp', '.c', '.go']
  ): Promise<FileSizeCheckResult[]> {
    const results: FileSizeCheckResult[] = [];

    async function scanDirectory(dirPath: string): Promise<void> {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          if (!['node_modules', '.git', 'dist', 'out', 'build'].includes(entry.name)) {
            await scanDirectory(fullPath);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (extensions.includes(ext)) {
            const lineCount = await FileMetricsService.getLineCount(fullPath);
            if (lineCount > threshold) {
              results.push({
                filePath: fullPath,
                lineCount,
                threshold,
                needsRefactoring: true,
                exceedsBy: lineCount - threshold
              });
            }
          }
        }
      }
    }

    await scanDirectory(projectPath);

    // 按超出行数降序排序
    results.sort((a, b) => (b.exceedsBy || 0) - (a.exceedsBy || 0));

    return results;
  }
  // @end

  // @contract: FileMetricsService.formatReport(results: FileSizeCheckResult[]) => string
  // @step: [分类] 将结果按严重程度分类（critical > 500, warning 400-500）
  // @step: [构建报告] 构建格式化的报告文本
  // @step: [返回] 返回报告字符串
  static formatReport(results: FileSizeCheckResult[]): string {
    if (results.length === 0) {
      return '✓ All files are within the recommended size limits.';
    }

    const critical = results.filter(r => r.lineCount > this.CRITICAL_THRESHOLD);
    const warning = results.filter(r => r.lineCount <= this.CRITICAL_THRESHOLD);

    let report = `Found ${results.length} file(s) that need attention:\n\n`;

    if (critical.length > 0) {
      report += `🚨 Critical (>${this.CRITICAL_THRESHOLD} lines):\n`;
      critical.forEach(r => {
        const fileName = path.basename(r.filePath);
        report += `  - ${fileName}: ${r.lineCount} lines (exceeds by ${r.exceedsBy})\n`;
      });
      report += '\n';
    }

    if (warning.length > 0) {
      report += `⚠️  Warning (${this.WARNING_THRESHOLD}-${this.CRITICAL_THRESHOLD} lines):\n`;
      warning.forEach(r => {
        const fileName = path.basename(r.filePath);
        report += `  - ${fileName}: ${r.lineCount} lines (exceeds by ${r.exceedsBy})\n`;
      });
    }

    report += '\n→ These files should be submitted to the project iteration planner for refactoring.';

    return report;
  }
  // @end
}
