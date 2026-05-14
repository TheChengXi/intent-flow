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
const ClaudeAPIService_1 = require("../../model/services/ClaudeAPIService");
const vscode = __importStar(require("vscode"));
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
    // @end
    // @contract: generatePlan(changeDescription: string, projectState: ProjectState) => Promise<Plan>
    // @step: [读取配置] 读取 API 配置
    // @step: [读取提示词] 读取 planner.md 提示词模板
    // @step: [构建提示] 将变更描述和项目状态填入提示词
    // @step: [调用 API] 调用 Claude API 生成计划
    // @step: [返回计划] 返回生成的计划
    // @boundary: 当 API 调用失败时，抛出错误
    // @boundary: 当提示词文件不存在时，使用默认提示词
    static async generatePlan(changeDescription, projectState) {
        // 读取配置
        const config = vscode.workspace.getConfiguration('cdd');
        const apiKey = config.get('apiKey') || '';
        const apiBaseUrl = config.get('apiBaseUrl') || 'https://api.anthropic.com';
        const modelId = config.get('modelId') || 'claude-sonnet-4-20250514';
        if (!apiKey) {
            throw new Error('API Key not configured. Please set cdd.apiKey in settings.');
        }
        // 读取提示词模板
        const promptTemplate = await this.loadPromptTemplate();
        // 构建提示
        const prompt = this.buildPrompt(promptTemplate, changeDescription, projectState);
        // 调用 API
        const apiService = new ClaudeAPIService_1.ClaudeAPIService();
        const response = await apiService.callAPI({
            role: 'planner',
            userMessage: prompt
        }, apiKey, apiBaseUrl, modelId);
        // 返回计划（提示词控制输出格式）
        return {
            impact: {
                affectedModules: [],
                affectedFiles: []
            },
            tasks: [],
            risks: []
        };
    }
    // @contract: loadPromptTemplate() => Promise<string>
    // @step: [读取文件] 读取 _source/prompts/planner.md
    // @step: [返回内容] 返回文件内容
    // @boundary: 当文件不存在时，返回默认提示词
    static async loadPromptTemplate() {
        const fs = require('fs').promises;
        const path = require('path');
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return this.getDefaultPrompt();
        }
        const promptPath = path.join(workspaceFolders[0].uri.fsPath, '_source', 'prompts', 'planner.md');
        try {
            const content = await fs.readFile(promptPath, 'utf-8');
            return content;
        }
        catch (error) {
            console.warn('[PlannerVM] Failed to load prompt template, using default');
            return this.getDefaultPrompt();
        }
    }
    // @contract: buildPrompt(template: string, changeDescription: string, projectState: ProjectState) => string
    // @step: [格式化项目结构] 调用 formatProjectState 格式化项目状态
    // @step: [替换变量] 将模板中的变量替换为实际值
    // @step: [返回] 返回构建好的提示
    static buildPrompt(template, changeDescription, projectState) {
        const projectStructure = this.formatProjectState(projectState);
        let prompt = template;
        prompt = prompt.replace('{{changeDescription}}', changeDescription);
        prompt = prompt.replace('{{projectStructure}}', projectStructure);
        return prompt;
    }
    // @contract: formatProjectState(projectState: ProjectState) => string
    // @step: [格式化] 将 ProjectState 格式化为可读的字符串
    // @step: [返回] 返回格式化后的字符串
    static formatProjectState(projectState) {
        let result = `Project Intent: ${projectState.intent}\n\n`;
        result += 'Modules:\n';
        for (const module of projectState.modules) {
            result += `- ${module.name}/: ${module.intent}\n`;
            if (module.files.length > 0) {
                result += `  Files: ${module.files.join(', ')}\n`;
            }
            if (module.dependencies.length > 0) {
                result += `  Dependencies: ${module.dependencies.join(', ')}\n`;
            }
        }
        return result;
    }
    // @contract: getDefaultPrompt() => string
    // @step: [返回] 返回默认的提示词模板
    static getDefaultPrompt() {
        return `You are a project planner. Analyze the change request and generate an implementation plan.

Change Request: {{changeDescription}}

Project Structure:
{{projectStructure}}

Please provide:
1. Impact Analysis (which modules and files are affected)
2. Task List (what needs to be done)
3. Risk Assessment (potential risks)

Format your response as a structured plan.`;
    }
}
exports.PlannerVM = PlannerVM;
//# sourceMappingURL=PlannerVM.js.map