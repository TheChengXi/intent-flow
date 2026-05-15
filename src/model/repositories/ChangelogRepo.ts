import { ChangelogEntry } from '../entities/ChangelogEntry';
import * as FileRepository from './FileRepository';
import * as path from 'path';

const HEADER = '# CHANGELOG.md\n\n## 变更日志\n\n格式：`日期 | 文件 | 变更内容 | 变更原因 | 类型`\n\n类型说明：\n- `[ITERATION]` - 正常迭代\n- `[HOTFIX]` - 紧急修复\n- `[BACKTRACK]` - 回溯修正\n- `[PARADIGM SHIFT]` - 范式升级\n\n---\n\n';

// @contract: addEntry(entry: ChangelogEntry, workspaceRoot: string) => Promise<void>
// @step: [格式化] 按 BR-005 格式化：日期 | 文件 | 变更内容 | 原因 | 类型
// @step: [追加] 调用 FileRepository.appendFile 追加到 _source/CHANGELOG.md
// @boundary: 当 CHANGELOG.md 不存在时，自动创建并添加表头
export async function addEntry(entry: ChangelogEntry, workspaceRoot: string): Promise<void> {
  const filePath = path.join(workspaceRoot, '_source', 'CHANGELOG.md');

  const line = `${entry.date} | ${entry.file} | ${entry.content} | ${entry.reason} | ${entry.type}\n`;

  const exists = await FileRepository.fileExists(filePath);
  if (!exists) {
    await FileRepository.writeFile(filePath, HEADER + line);
  } else {
    await FileRepository.appendFile(filePath, line);
  }
}
// @end

// @contract: getLatestEntry(workspaceRoot: string) => Promise<ChangelogEntry | null>
// @step: [读取] 读取 _source/CHANGELOG.md 全部内容
// @step: [分割] 按行分割，过滤空行和表头
// @step: [解析] 解析最后一行按 BR-005 格式
// @boundary: 当文件为空或不存在时，返回 null
// @boundary: 当最后一行格式错误时，返回 null
export async function getLatestEntry(workspaceRoot: string): Promise<ChangelogEntry | null> {
  const filePath = path.join(workspaceRoot, '_source', 'CHANGELOG.md');

  const exists = await FileRepository.fileExists(filePath);
  if (!exists) {
    return null;
  }

  const content = await FileRepository.readFile(filePath);
  const lines = content.split('\n').filter(line => {
    const trimmed = line.trim();
    return trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('格式') && !trimmed.startsWith('类型') && !trimmed.startsWith('-') && trimmed !== '---';
  });

  if (lines.length === 0) {
    return null;
  }

  const lastLine = lines[lines.length - 1];
  const parts = lastLine.split('|').map(p => p.trim());

  if (parts.length < 5) {
    return null;
  }

  return {
    date: parts[0],
    file: parts[1],
    content: parts[2],
    reason: parts[3],
    type: parts[4] as any
  };
}
// @end


// @contract: getAllEntries(workspaceRoot: string) => Promise<ChangelogEntry[]>
// @step: [定位] 构建 CHANGELOG.md 文件路径
// @step: [检查] 验证文件是否存在
// @step: [读取] 从文件系统读取内容
// @step: [解析] 按行分割内容
// @step: [过滤] 跳过空行、注释行、分隔符
// @step: [提取] 按管道符分割每行为字段
// @step: [转换] 将符合条件的行转换为 ChangelogEntry 对象
// @step: [返回] 返回解析后的条目数组
// @boundary: 当文件不存在时，应返回空数组
// @boundary: 当行字段数少于 5 时，应跳过该行
// @boundary: 当 type 字段类型不匹配时，应使用 as any 强制转换
export async function getAllEntries(workspaceRoot: string): Promise<ChangelogEntry[]> {
  const filePath = path.join(workspaceRoot, '_source', 'CHANGELOG.md');

  const exists = await FileRepository.fileExists(filePath);
  if (!exists) {
    return [];
  }

  const content = await FileRepository.readFile(filePath);
  const lines = content.split('\n');

  const entries: ChangelogEntry[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('格式') || trimmed.startsWith('类型') || trimmed.startsWith('-') || trimmed === '---') {
      continue;
    }

    const parts = line.split('|').map(p => p.trim());
    if (parts.length >= 5) {
      entries.push({
        date: parts[0],
        file: parts[1],
        content: parts[2],
        reason: parts[3],
        type: parts[4] as any
      });
    }
  }

  return entries;
}
// @end
