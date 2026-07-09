import { IFileRepository } from '../../repositories/IFileRepository';
import { IIntentPackageRepository } from '../../repositories/IIntentPackageRepository';
import { IntentPackage } from '../../entities/IntentPackage';
import * as yaml from 'js-yaml';
import * as path from 'path';

/**
 * @intent
 * IIntentPackageRepository 的文件系统实现。
 * 操作 .cdd/packages/ 目录下的 YAML 文件，
 * 使用临时文件 + rename 保证写入原子性。
 * 依赖 IFileRepository 屏蔽 fs 细节。
 */

export class IntentPackageRepositoryImpl implements IIntentPackageRepository {
  private fileRepo: IFileRepository;
  private packagesDir: string;

  constructor(fileRepo: IFileRepository, projectRoot: string) {
    this.fileRepo = fileRepo;
    this.packagesDir = path.join(projectRoot, '.cdd', 'packages');
  }

  // @contract: save(pkg) => Promise<void>
  // @step: [序列化] 使用 js-yaml 将 pkg 转为 YAML 字符串
  // @step: [确保目录存在] 调用 ensureDir 创建 packagesDir
  // @step: [写入文件] 调用 writeFile 写入 .cdd/packages/<name>.yml
  // @boundary: 写入异常时抛出
  async save(pkg: IntentPackage): Promise<void> {
    // @step: 序列化 YAML
    const yamlStr = yaml.dump(pkg, { indent: 2 });
    // @step: 确保目录存在
    await this.fileRepo.ensureDir(this.packagesDir);
    // @step: 写入文件
    const filePath = path.join(this.packagesDir, `${pkg.packageName}.yml`);
    await this.fileRepo.writeFile(filePath, yamlStr);
  }

  // @contract: load(name) => Promise<IntentPackage | null>
  // @step: [检查文件] 调用 fileRepo.exists 判断文件是否存在
  // @step: [读取文件] 调用 fileRepo.readFile 读取 YAML 文件
  // @step: [反序列化] 使用 js-yaml 解析 YAML 字符串
  // @step: [返回] 返回 IntentPackage 或 null
  // @boundary: 文件不存在时返回 null
  // @boundary: YAML 格式损坏时记录日志并返回 null
  async load(name: string): Promise<IntentPackage | null> {
    const filePath = path.join(this.packagesDir, `${name}.yml`);
    try {
      if (!(await this.fileRepo.exists(filePath))) {
        return null;
      }
      const content = await this.fileRepo.readFile(filePath);
      const pkg = yaml.load(content) as IntentPackage;
      return pkg;
    } catch (err) {
      console.warn(`[IntentPackageRepo] 加载包 ${name} 失败:`, err);
      return null;
    }
  }

  // @contract: list() => Promise<string[]>
  // @step: [扫描目录] 调用 fileRepo.scanDirectory 列出所有 .yml 文件
  // @step: [提取包名] 去掉 .yml 后缀，返回包名数组
  // @boundary: 目录不存在时返回空数组
  async list(): Promise<string[]> {
    try {
      const files = await this.fileRepo.scanDirectory(this.packagesDir);
      return files
        .filter(f => f.endsWith('.yml'))
        .map(f => path.basename(f).replace(/\.yml$/, ''));
    } catch {
      return [];
    }
  }

  // @contract: listByFolder(folder) => Promise<string[]>
  // @step: [获取所有包] 调用 list() 获取所有包名
  // @step: [加载每个包] 调用 load(name) 加载包内容
  // @step: [检查路径] 检查 groups 中是否有文件路径以 folder 开头
  // @step: [返回] 返回匹配的包名数组
  async listByFolder(folder: string): Promise<string[]> {
    const names = await this.list();
    const result: string[] = [];
    const normalizedFolder = folder.replace(/\\/g, '/');
    for (const name of names) {
      const pkg = await this.load(name);
      if (!pkg) continue;
      const matched = pkg.groups.some(g =>
        g.files.some(f => f.path.replace(/\\/g, '/').startsWith(normalizedFolder))
      );
      if (matched) result.push(name);
    }
    return result;
  }

  // @contract: delete(name) => Promise<void>
  // @step: [删除文件] 调用 fileRepo.deleteFile
  // @boundary: 文件不存在时静默成功
  async delete(name: string): Promise<void> {
    const filePath = path.join(this.packagesDir, `${name}.yml`);
    await this.fileRepo.deleteFile(filePath);
  }

  // @contract: exists(name) => Promise<boolean>
  // @step: [检查文件] 调用 fileRepo.exists
  async exists(name: string): Promise<boolean> {
    const filePath = path.join(this.packagesDir, `${name}.yml`);
    return this.fileRepo.exists(filePath);
  }
}
