import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { FileSystemRepository } from './FileSystemRepository';

function createTempDir(): string {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fsrepo-test-'));
  return tmp;
}

function createDir(parent: string, name: string): string {
  const p = path.join(parent, name);
  fs.mkdirSync(p, { recursive: true });
  return p;
}

function createFile(dir: string, name: string, content = ''): string {
  const p = path.join(dir, name);
  fs.writeFileSync(p, content, 'utf-8');
  return p;
}

describe('FileSystemRepository', () => {
  let repo: FileSystemRepository;
  let tmpDir: string;

  beforeEach(() => {
    repo = new FileSystemRepository();
    tmpDir = createTempDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('listSubdirectories', () => {
    it('返回目录下的所有直接子目录名', async () => {
      createDir(tmpDir, 'sub1');
      createDir(tmpDir, 'sub2');
      createFile(tmpDir, 'file.txt');

      const dirs = await repo.listSubdirectories(tmpDir);
      expect(dirs.sort()).toEqual(['sub1', 'sub2']);
    });

    it('没有子目录时返回空数组', async () => {
      createFile(tmpDir, 'file.txt');

      const dirs = await repo.listSubdirectories(tmpDir);
      expect(dirs).toEqual([]);
    });

    it('排除隐藏目录（以 . 开头）', async () => {
      createDir(tmpDir, 'visible');
      createDir(tmpDir, '.hidden');

      const dirs = await repo.listSubdirectories(tmpDir);
      expect(dirs).toEqual(['visible']);
    });

    it('排除 node_modules', async () => {
      createDir(tmpDir, 'src');
      createDir(tmpDir, 'node_modules');

      const dirs = await repo.listSubdirectories(tmpDir);
      expect(dirs).toEqual(['src']);
    });

    it('不递归——只返回直接子目录', async () => {
      createDir(tmpDir, 'parent');
      createDir(path.join(tmpDir, 'parent'), 'child');

      const dirs = await repo.listSubdirectories(tmpDir);
      expect(dirs).toEqual(['parent']);
    });

    it('目录不存在时返回空数组', async () => {
      const dirs = await repo.listSubdirectories(path.join(tmpDir, 'ghost'));
      expect(dirs).toEqual([]);
    });

    it('返回的是目录名而非路径', async () => {
      createDir(tmpDir, 'my-dir');

      const dirs = await repo.listSubdirectories(tmpDir);
      expect(dirs[0]).toBe('my-dir');
      expect(dirs[0]).not.toContain(path.sep);
    });
  });
});
