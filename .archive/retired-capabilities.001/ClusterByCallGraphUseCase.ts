/**
 * @intent [已归档] 基于调用图进行聚类，生成能力。
 * 使用拓扑排序和DFS算法识别入口文件，生成能力树结构。
 *
 * 归档原因：复杂聚类逻辑，generate_capability_list 回归简单设计后不再需要。
 * 归档时间：2026-06-12
 */

import { Intent } from '../../src/data/entities/Intent';
import { CallDependency } from '../../src/data/entities/CallDependency';
import { Capability } from '../../src/data/entities/Capability';
import { IUseCase } from '../../src/application/useCases/IUseCase';

export interface ClusterByCallGraphInput {
  intents: Intent[];
  callDependencies: Map<string, CallDependency>;
  maxDepth?: number;
  entryFiles?: string[];
}

export interface ClusterByCallGraphOutput {
  capabilities: Capability[];
  isolated: Capability[];
  clusteringDuration: number;
  totalCapabilities: number;
  isolatedCapabilities: number;
}

export interface IClusterByCallGraphUseCase extends IUseCase<ClusterByCallGraphInput, ClusterByCallGraphOutput> {
  execute(input: ClusterByCallGraphInput): Promise<ClusterByCallGraphOutput>;
}

export class ClusterByCallGraphUseCase implements IClusterByCallGraphUseCase {
  private intentMap: Map<string, Intent> = new Map();

  async execute(input: ClusterByCallGraphInput): Promise<ClusterByCallGraphOutput> {
    const startTime = Date.now();

    try {
      this.intentMap.clear();
      input.intents.forEach((intent) => {
        this.intentMap.set(intent.filePath, intent);
      });

      const capabilities: Capability[] = [];
      const isolated: Capability[] = [];

      if (!input.entryFiles || input.entryFiles.length === 0) {
        throw new Error('必须提供 entryFiles 参数');
      }

      const entryIntents: Intent[] = [];
      for (const entryPath of input.entryFiles) {
        const normalizedPath = entryPath.replace(/\\/g, '/');
        const intent = this.intentMap.get(normalizedPath);
        if (!intent) {
          console.warn(`[ClusterByCallGraph] 警告：入口文件 ${entryPath} (标准化后: ${normalizedPath}) 没有 @intent 注解，将跳过`);
          continue;
        }
        entryIntents.push(intent);
      }

      if (entryIntents.length === 0) {
        throw new Error('所有指定的入口文件都没有 @intent 注解');
      }

      const clusteredFiles = new Set<string>();
      const maxDepth = input.maxDepth || 5;

      entryIntents.forEach((entry) => {
        const cap = this.buildCapabilityTree(
          entry,
          input.callDependencies,
          clusteredFiles,
          1,
          maxDepth
        );
        if (cap) {
          capabilities.push(cap);
        }
      });

      return {
        capabilities,
        isolated: [],
        clusteringDuration: Date.now() - startTime,
        totalCapabilities: capabilities.length,
        isolatedCapabilities: 0
      };
    } catch (error) {
      throw new Error(`聚类失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private buildCapabilityTree(
    entryIntent: Intent,
    dependencies: Map<string, CallDependency>,
    clusteredFiles: Set<string>,
    currentDepth: number,
    maxDepth: number
  ): Capability {
    clusteredFiles.add(entryIntent.filePath);

    const normalizedPath = entryIntent.filePath.replace(/\//g, '\\');
    const callDep = dependencies.get(normalizedPath);
    const branchFiles = callDep?.to || [];
    const branchIntents = branchFiles
      .map((file) => {
        const intentPath = file.replace(/\\/g, '/');
        return this.intentMap.get(intentPath);
      })
      .filter((intent): intent is Intent => intent !== undefined);

    const inDegree = this.calculateInDegree(entryIntent.filePath, dependencies);
    const hasCallers = inDegree > 0;

    const subdivisions: Capability[] = [];
    if (currentDepth < maxDepth && branchFiles.length > 0) {
      branchIntents.forEach((branchIntent) => {
        if (!clusteredFiles.has(branchIntent.filePath)) {
          const subCap = this.buildCapabilityTree(
            branchIntent,
            dependencies,
            clusteredFiles,
            currentDepth + 1,
            maxDepth
          );
          subdivisions.push(subCap);
        }
      });
    } else {
      branchFiles.forEach((file) => clusteredFiles.add(file));
    }

    const hasOutgoingDependencies = branchFiles.length > 0;

    const capability: Capability = {
      name: entryIntent.fileName,
      intent: entryIntent.intent || '',
      entryIntent,
      branchIntents,
      callGraph: callDep || { from: entryIntent.filePath, to: [] },
      branchCount: branchFiles.length,
      depth: currentDepth + 1,
      status: hasOutgoingDependencies ? 'integrated' : 'isolated',
      subdivisions: subdivisions.length > 0 ? subdivisions : undefined
    };

    return capability;
  }

  private calculateInDegree(filePath: string, dependencies: Map<string, CallDependency>): number {
    let degree = 0;
    dependencies.forEach((dep) => {
      if (dep.to?.includes(filePath)) {
        degree++;
      }
    });
    return degree;
  }
}
