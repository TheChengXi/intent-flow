// @intent: 项目架构导航工具，扫描意图树和依赖枝条，生成结构化的项目架构视图

import * as path from 'path';
import * as fs from 'fs';
import * as IntentExtractor from '../../data/services/IntentExtractor';
import { DependencyBranch } from '../../data/services/IntentExtractor';

// @entity: ArchitectureView
// 项目架构视图
export interface ArchitectureView {
  scope: string; // 'global' 或具体模块名
  modules: ModuleArchitecture[];
  summary: ArchitectureSummary;
}

// @entity: ModuleArchitecture
// 模块架构信息
export interface ModuleArchitecture {
  moduleName: string;
  files: FileInfo[];
  dependencies: string[]; // 依赖的其他模块
}

// @entity: FileInfo
// 文件信息
export interface FileInfo {
  fileName: string;
  filePath: string;
  intent: string;
  dependencies: string[]; // 依赖的文件名
}

// @entity: ArchitectureSummary
// 架构摘要
export interface ArchitectureSummary {
  totalFiles: number;
  totalModules: number;
  maxDependencyDepth: number;
}

export class PlannerVM {
  // @contract: generateArchitectureView(workspaceRoot: string, scope?: string) => Promise<ArchitectureView>
  // @step: [扫描文件] 扫描工作区所有源代码文件
  // @step: [提取意图] 对每个文件调用 IntentExtractor.extractIntentFromFile
  // @step: [构建依赖] 对每个文件调用 IntentExtractor.extractIntentWithDependencies
  // @step: [分组模块] 按目录结构分组为模块
  // @step: [过滤范围] 如果提供 scope，只保留匹配的模块
  // @step: [生成摘要] 统计文件数、模块数、依赖深度
  // @step: [返回视图] 返回 ArchitectureView
  // @boundary: 当 workspaceRoot 不存在时，抛出错误
  // @boundary: 当 scope 不匹配任何模块时，返回空视图
  static async generateArchitectureView(
    workspaceRoot: string,
    scope?: string
  ): Promise<ArchitectureView> {
    // 检查工作区是否存在
    if (!fs.existsSync(workspaceRoot)) {
      throw new Error(`工作区不存在: ${workspaceRoot}`);
    }

    // 扫描所有源代码文件
    const sourceFiles = await this.scanSourceFiles(workspaceRoot);

    // 构建依赖枝条
    const branches: DependencyBranch[] = [];
    const visited = new Set<string>();

    for (const file of sourceFiles) {
      if (!visited.has(file)) {
        const branch = await IntentExtractor.extractIntentWithDependencies(
          file,
          workspaceRoot,
          2, // 依赖深度
          visited
        );
        branches.push(branch);
      }
    }

    // 按模块分组
    const modules = this.groupByModule(branches, workspaceRoot);

    // 如果提供了 scope，过滤模块
    let filteredModules = modules;
    if (scope) {
      filteredModules = modules.filter(m =>
        m.moduleName.toLowerCase().includes(scope.toLowerCase()) ||
        m.files.some(f => f.fileName.toLowerCase().includes(scope.toLowerCase()))
      );
    }

    // 生成摘要
    const summary = this.generateSummary(filteredModules, branches);

    return {
      scope: scope || 'global',
      modules: filteredModules,
      summary
    };
  }
  // @end

  // @contract: scanSourceFiles(workspaceRoot: string) => Promise<string[]>
  // @step: [定义扩展名] 定义需要扫描的源代码文件扩展名
  // @step: [递归扫描] 递归扫描工作区目录
  // @step: [过滤文件] 过滤出源代码文件
  // @step: [排除目录] 排除 node_modules, dist, out 等目录
  // @step: [返回] 返回文件路径列表
  // @boundary: 当目录为空时，返回空数组
  private static async scanSourceFiles(workspaceRoot: string): Promise<string[]> {
    const sourceExtensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.cpp', '.c', '.java', '.rs'];
    const excludeDirs = ['node_modules', 'dist', 'out', 'build', '.git', '_source'];
    const files: string[] = [];

    const scan = async (dir: string) => {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          // 排除特定目录
          if (!excludeDirs.includes(entry.name)) {
            await scan(fullPath);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (sourceExtensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    };

    await scan(workspaceRoot);
    return files;
  }
  // @end

  // @contract: groupByModule(branches: DependencyBranch[], workspaceRoot: string) => ModuleArchitecture[]
  // @step: [提取模块名] 从文件路径提取模块名（第一级目录）
  // @step: [分组] 按模块名分组文件
  // @step: [提取依赖] 提取每个模块依赖的其他模块
  // @step: [构建结构] 构建 ModuleArchitecture 对象
  // @step: [返回] 返回模块列表
  private static groupByModule(
    branches: DependencyBranch[],
    workspaceRoot: string
  ): ModuleArchitecture[] {
    const moduleMap = new Map<string, FileInfo[]>();

    // 遍历所有枝条，按模块分组
    for (const branch of branches) {
      const relativePath = path.relative(workspaceRoot, branch.filePath);
      const parts = relativePath.split(path.sep);

      // 提取模块名（第一级目录，如 src, model, viewmodel）
      const moduleName = parts.length > 1 ? parts[0] : 'root';

      // 构建 FileInfo
      const fileInfo: FileInfo = {
        fileName: branch.fileName,
        filePath: branch.filePath,
        intent: branch.intent,
        dependencies: branch.dependencies.map(d => d.fileName)
      };

      // 添加到模块
      if (!moduleMap.has(moduleName)) {
        moduleMap.set(moduleName, []);
      }
      moduleMap.get(moduleName)!.push(fileInfo);
    }

    // 构建 ModuleArchitecture
    const modules: ModuleArchitecture[] = [];
    for (const [moduleName, files] of moduleMap.entries()) {
      // 提取模块依赖
      const moduleDeps = new Set<string>();
      for (const file of files) {
        for (const dep of file.dependencies) {
          // 查找依赖文件所属的模块
          for (const [otherModule, otherFiles] of moduleMap.entries()) {
            if (otherModule !== moduleName && otherFiles.some(f => f.fileName === dep)) {
              moduleDeps.add(otherModule);
            }
          }
        }
      }

      modules.push({
        moduleName,
        files,
        dependencies: Array.from(moduleDeps)
      });
    }

    return modules;
  }
  // @end

  // @contract: generateSummary(modules: ModuleArchitecture[], branches: DependencyBranch[]) => ArchitectureSummary
  // @step: [统计文件] 统计总文件数
  // @step: [统计模块] 统计总模块数
  // @step: [计算深度] 计算最大依赖深度
  // @step: [返回] 返回 ArchitectureSummary
  private static generateSummary(
    modules: ModuleArchitecture[],
    branches: DependencyBranch[]
  ): ArchitectureSummary {
    const totalFiles = modules.reduce((sum, m) => sum + m.files.length, 0);
    const totalModules = modules.length;
    const maxDependencyDepth = this.calculateMaxDepth(branches);

    return {
      totalFiles,
      totalModules,
      maxDependencyDepth
    };
  }
  // @end

  // @contract: calculateMaxDepth(branches: DependencyBranch[]) => number
  // @step: [递归计算] 递归计算每个枝条的深度
  // @step: [取最大值] 返回最大深度
  private static calculateMaxDepth(branches: DependencyBranch[]): number {
    if (branches.length === 0) {
      return 0;
    }

    let maxDepth = 0;
    for (const branch of branches) {
      const depth = 1 + this.calculateMaxDepth(branch.dependencies);
      maxDepth = Math.max(maxDepth, depth);
    }

    return maxDepth;
  }
  // @end

  // @contract: formatArchitectureView(view: ArchitectureView) => string
  // @step: [格式化标题] 生成标题（全局或局部）
  // @step: [格式化模块] 遍历每个模块，格式化为可读文本
  // @step: [格式化文件] 遍历每个文件，显示意图和依赖
  // @step: [格式化摘要] 显示统计信息
  // @step: [返回] 返回格式化后的字符串
  // @boundary: 当模块为空时，返回"无匹配模块"
  static formatArchitectureView(view: ArchitectureView): string {
    if (view.modules.length === 0) {
      return `# 项目架构视图 (${view.scope})\n\n无匹配的模块或文件。`;
    }

    let output = `# 项目架构视图 (${view.scope})\n\n`;
    output += `## 摘要\n`;
    output += `- 总文件数: ${view.summary.totalFiles}\n`;
    output += `- 总模块数: ${view.summary.totalModules}\n`;
    output += `- 最大依赖深度: ${view.summary.maxDependencyDepth}\n\n`;

    output += `## 模块详情\n\n`;

    for (const module of view.modules) {
      output += `### ${module.moduleName}/\n`;

      if (module.dependencies.length > 0) {
        output += `**依赖模块**: ${module.dependencies.join(', ')}\n\n`;
      }

      output += `**文件列表**:\n`;
      for (const file of module.files) {
        output += `- **${file.fileName}**: ${file.intent}\n`;
        if (file.dependencies.length > 0) {
          output += `  - 依赖: ${file.dependencies.join(', ')}\n`;
        }
      }
      output += `\n`;
    }

    return output;
  }
  // @end
}
