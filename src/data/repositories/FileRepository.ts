import * as fs from 'fs/promises';
import * as path from 'path';
import { FileNotFoundError, PermissionError } from '../entities/Errors';

// @contract: readFile(filePath: string) => Promise<string>
// @step: [读取] 使用 fs.promises.readFile 读取文件内容
// @step: [解码] 以 UTF-8 解码
// @boundary: 当文件不存在时，抛出 FileNotFoundError
// @boundary: 当无读取权限时，抛出 PermissionError
export async function readFile(filePath: string): Promise<string> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return content;
  } catch (error: unknown) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      throw new FileNotFoundError(`文件不存在: ${filePath}`);
    }
    if (code === 'EACCES' || code === 'EPERM') {
      throw new PermissionError(`无读取权限: ${filePath}`);
    }
    throw error;
  }
}
// @end

// @contract: writeFile(filePath: string, content: string) => Promise<void>
// @step: [创建目录] 如果父目录不存在，递归创建
// @step: [写入] 使用 fs.promises.writeFile 写入内容
// @boundary: 当无写入权限时，抛出 PermissionError
export async function writeFile(filePath: string, content: string): Promise<void> {
  try {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');
  } catch (error: unknown) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'EACCES' || code === 'EPERM') {
      throw new PermissionError(`无写入权限: ${filePath}`);
    }
    throw error;
  }
}
// @end

// @contract: appendFile(filePath: string, content: string) => Promise<void>
// @step: [创建目录] 如果父目录不存在，递归创建
// @step: [追加] 使用 fs.promises.appendFile 追加内容
// @boundary: 当文件不存在时，自动创建
// @boundary: 当无写入权限时，抛出 PermissionError
export async function appendFile(filePath: string, content: string): Promise<void> {
  try {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.appendFile(filePath, content, 'utf-8');
  } catch (error: unknown) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'EACCES' || code === 'EPERM') {
      throw new PermissionError(`无写入权限: ${filePath}`);
    }
    throw error;
  }
}
// @end

// @contract: fileExists(filePath: string) => Promise<boolean>
// @step: [检查] 使用 fs.promises.access 检查文件是否存在
// @step: [返回] 存在返回 true，不存在返回 false
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
// @end
