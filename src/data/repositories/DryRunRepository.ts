/**
 * @intent
 * 拦截记录持久化仓库：将 DryRunRecord 序列化为 Markdown 落盘到工作区输出目录，覆盖目录创建、时间戳文件名生成、内容格式化的完整链路。
 * 边界：无工作区根目录时抛错；目录/文件写入失败时抛错；文件名按时间戳唯一。
 * 验收条件：
 * - save() 返回落盘文件的完整绝对路径
 * - 输出目录不存在时自动递归创建
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';
import { DryRunRecord } from '../entities/DryRunRecord';

// @repository: DryRunRepository
// 负责将拦截记录保存到本地文件
export class DryRunRepository {
  // @contract: save(record: DryRunRecord, outputDir: string) => Promise<string>
  // @step: [确保目录存在] 调用 ensureOutputDir 创建输出目录
  // @step: [生成文件名] 根据时间戳生成文件名
  // @step: [格式化内容] 将 record 格式化为 Markdown
  // @step: [异步写入] 使用 fs.promises.writeFile 异步写入文件
  // @step: [返回路径] 返回保存的文件完整路径
  // @boundary: 当目录创建失败时，抛出错误
  // @boundary: 当文件写入失败时，抛出错误
  async save(record: DryRunRecord, outputDir: string): Promise<string> {
    // 获取工作区根路径
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      throw new Error('未找到工作区根目录');
    }

    // 构建完整的输出目录路径
    const fullOutputDir = path.join(workspaceRoot, outputDir);

    // 确保输出目录存在
    await this.ensureOutputDir(fullOutputDir);

    // 生成文件名
    const fileName = this.generateFileName(record.timestamp);
    const filePath = path.join(fullOutputDir, fileName);

    // 格式化为 Markdown
    const content = this.formatAsMarkdown(record);

    // 异步写入文件
    await fs.writeFile(filePath, content, 'utf-8');

    return filePath;
  }

  // @contract: ensureOutputDir(outputDir: string) => Promise<void>
  // @step: [检查目录] 使用 fs.access 检查目录是否存在
  // @step: [创建目录] 如果不存在，使用 fs.mkdir 创建目录（recursive: true）
  // @boundary: 当权限不足时，抛出错误
  private async ensureOutputDir(outputDir: string): Promise<void> {
    try {
      await fs.access(outputDir);
    } catch {
      // 目录不存在，创建目录
      await fs.mkdir(outputDir, { recursive: true });
    }
  }

  // @contract: generateFileName(timestamp: Date) => string
  // @step: [格式化时间] 将时间格式化为 YYYY-MM-DD-HHmmss
  // @step: [拼接文件名] 返回 prompt-{timestamp}.md
  // @boundary: 文件名格式固定为 prompt-{timestamp}.md
  private generateFileName(timestamp: Date): string {
    const year = timestamp.getFullYear();
    const month = String(timestamp.getMonth() + 1).padStart(2, '0');
    const day = String(timestamp.getDate()).padStart(2, '0');
    const hours = String(timestamp.getHours()).padStart(2, '0');
    const minutes = String(timestamp.getMinutes()).padStart(2, '0');
    const seconds = String(timestamp.getSeconds()).padStart(2, '0');

    return `prompt-${year}-${month}-${day}-${hours}${minutes}${seconds}.md`;
  }

  // @contract: formatAsMarkdown(record: DryRunRecord) => string
  // @step: [构建标题] 添加标题和时间戳
  // @step: [添加统计信息] 添加 Statistics 部分
  // @step: [添加完整内容] 添加 Full Content 部分
  // @boundary: 使用 Markdown 格式
  private formatAsMarkdown(record: DryRunRecord): string {
    const timestamp = record.timestamp.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    const lines: string[] = [];
    lines.push(`# Prompt Test - ${timestamp}`);
    lines.push('');
    lines.push(`## Role`);
    lines.push(`- ${record.role}`);
    lines.push('');
    lines.push(`## Statistics`);
    lines.push(`- Total Characters: ${record.statistics.totalCharacters.toLocaleString()}`);
    lines.push(`- Estimated Tokens: ${record.statistics.estimatedTokens.toLocaleString()}`);
    lines.push(`- Code Blocks: ${record.statistics.codeBlocks}`);
    lines.push(`- File References: ${record.statistics.fileReferences}`);
    lines.push('');
    lines.push(`## System Prompt`);
    lines.push('');
    lines.push('```');
    lines.push(record.systemPrompt);
    lines.push('```');
    lines.push('');
    lines.push(`## User Message`);
    lines.push('');
    lines.push('```');
    lines.push(record.userMessage);
    lines.push('```');

    return lines.join('\n');
  }
}
