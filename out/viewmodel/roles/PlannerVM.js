"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlannerVM = void 0;
const BaseRole_1 = require("./BaseRole");
const ChangelogRepo = __importStar(require("../../model/repositories/ChangelogRepo"));
const DependencyTracker = __importStar(require("../../model/services/DependencyTracker"));
class PlannerVM extends BaseRole_1.BaseRole {
    constructor(apiService) {
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
    async execute(context) {
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
                const report = {
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
            const report = {
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
        }
        catch (error) {
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
    buildRecommendation(affectedCount, needsCouncil) {
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
}
exports.PlannerVM = PlannerVM;
//# sourceMappingURL=PlannerVM.js.map