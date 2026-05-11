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
exports.execute = execute;
const vscode = __importStar(require("vscode"));
const PlannerVM_1 = require("../roles/PlannerVM");
const ClaudeAPIService_1 = require("../../model/services/ClaudeAPIService");
const WorkScheduleRepo = __importStar(require("../../model/repositories/WorkScheduleRepo"));
// @contract: execute() => Promise<void>
// @step: [分析] 调用 PlannerVM.analyzeImpact
// @step: [显示报告] 在 OutputPanel 显示影响分析报告
// @step: [记录日志] 调用 WorkScheduleRepo.addRecord
// @boundary: 当 CHANGELOG.md 不存在时，按 BUSINESS_RULES 流程4异常处理
async function execute() {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
    if (!workspaceRoot) {
        vscode.window.showErrorMessage('未打开工作区');
        return;
    }
    const apiService = new ClaudeAPIService_1.ClaudeAPIService();
    const plannerVM = new PlannerVM_1.PlannerVM(apiService);
    const context = {
        workspaceRoot
    };
    const result = await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: '正在分析变更影响...',
        cancellable: false
    }, async () => {
        return await plannerVM.execute(context);
    });
    if (!result.success) {
        vscode.window.showErrorMessage(`分析失败：${result.message}`);
        return;
    }
    const report = result.artifacts;
    let reportText = '# 变更影响分析报告\n\n';
    reportText += `## 最新变更\n${report.latestChange ? report.latestChange.content : '无变更'}\n\n`;
    reportText += `## 受影响的函数\n`;
    if (report.affectedFunctions.length > 0) {
        reportText += report.affectedFunctions.map((f) => `- ${f}`).join('\n');
    }
    else {
        reportText += '无';
    }
    reportText += `\n\n## 建议\n${report.recommendation}\n`;
    const doc = await vscode.workspace.openTextDocument({
        content: reportText,
        language: 'markdown'
    });
    await vscode.window.showTextDocument(doc);
    const now = new Date();
    await WorkScheduleRepo.addRecord({
        date: now.toISOString().split('T')[0],
        time: now.toTimeString().split(' ')[0],
        role: '迭代规划师',
        description: '分析变更影响',
        duration: 0,
        dependencies: []
    }, workspaceRoot);
    vscode.window.showInformationMessage(`影响分析完成：${report.affectedFunctions.length} 个函数受影响`);
}
// @end
//# sourceMappingURL=AnalyzeCommand.js.map