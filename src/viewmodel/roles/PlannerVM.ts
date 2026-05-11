import { BaseRole, RoleResult } from './BaseRole';
import * as ChangelogRepo from '../../model/repositories/ChangelogRepo';
import * as DependencyTracker from '../../model/services/DependencyTracker';
import { ChangelogEntry } from '../../model/entities/ChangelogEntry';
import { ClaudeAPIService } from '../../model/services/ClaudeAPIService';

// @entity: ImpactReport
// 影响分析报告
export interface ImpactReport {
  latestChange: ChangelogEntry | null;
  affectedFunctions: string[];
  needsCouncil: boolean;
  recommendation: string;
}

// @entity: PlannerContext
// 迭代规划师上下文
export interface PlannerContext {
  workspaceRoot: string;
}

export class PlannerVM extends BaseRole {
  constructor(apiService: ClaudeAPIService) {
    super(apiService);
  }

  // @contract: execute(context: PlannerContext) => Promise<RoleResult>
  // @step: [验证输入] 检查 workspaceRoot 是否存在
  // @step: [读取变更] 调用 ChangelogRepo.getLatestEntry
  // @step: [扫描依赖] 调用 DependencyTracker.checkOutdated
  // @step: [检测类型] 检查是否包含 [PARADIGM SHIFT]
  // @step: [生成报告] 构建 ImpactReport 对象
  // @step: [返回结果] 返回 success: true，artifacts 包含 ImpactReport
  // @boundary: 当 workspaceRoot 为空时，返回 success: false
  // @boundary: 当 CHANGELOG.md 为空时，返回"无变更"报告
  // @boundary: 当检测到 [PARADIGM SHIFT] 时，needsCouncil 设为 true
  async execute(context: PlannerContext): Promise<RoleResult> {
    try {
      if (!context.workspaceRoot) {
        return {
          success: false,
          message: '工作区路径为空',
          artifacts: null
        };
      }

      const latestChange = await ChangelogRepo.getLatestEntry(context.workspaceRoot);

      if (!latestChange) {
        const report: ImpactReport = {
          latestChange: null,
          affectedFunctions: [],
          needsCouncil: false,
          recommendation: '无变更'
        };
        return {
          success: true,
          message: '无变更',
          artifacts: report
        };
      }

      const needsCouncil = latestChange.type === '[PARADIGM SHIFT]';
      const changedContracts = [latestChange.file];
      const affectedFunctions = await DependencyTracker.checkOutdated(changedContracts, context.workspaceRoot);

      const recommendation = this.buildRecommendation(affectedFunctions.length, needsCouncil);

      const report: ImpactReport = {
        latestChange,
        affectedFunctions,
        needsCouncil,
        recommendation
      };

      return {
        success: true,
        message: `影响分析完成：${affectedFunctions.length} 个函数受影响`,
        artifacts: report
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
        artifacts: error
      };
    }
  }
  // @end

  // @contract: buildRecommendation(affectedCount: number, needsCouncil: boolean) => string
  // @step: [判断] 若 needsCouncil 为 true，建议召集 Council
  // @step: [判断] 若 affectedCount > 10，建议全流程重新编译
  // @step: [判断] 若 affectedCount 1-10，建议快速通道
  // @step: [判断] 若 affectedCount 为 0，建议无需操作
  // @boundary: 当 affectedCount 为 0 且 needsCouncil 为 false 时，返回"无影响"
  private buildRecommendation(affectedCount: number, needsCouncil: boolean): string {
    if (needsCouncil) {
      return '检测到 [PARADIGM SHIFT]，建议召集 Council 评估影响';
    }

    if (affectedCount > 10) {
      return `${affectedCount} 个函数受影响，建议全流程重新编译`;
    }

    if (affectedCount >= 1 && affectedCount <= 10) {
      return `${affectedCount} 个函数受影响，建议快速通道重新编译`;
    }

    return '无影响';
  }
  // @end
}
