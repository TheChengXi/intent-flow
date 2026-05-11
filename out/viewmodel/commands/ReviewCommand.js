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
const CDDWorkflow_1 = require("../workflow/CDDWorkflow");
const WorkScheduleRepo = __importStar(require("../../model/repositories/WorkScheduleRepo"));
// @contract: execute() => Promise<void>
// @step: [获取选区] 获取当前编辑器选中的文本范围
// @step: [读取配置] 读取 apiKey、apiBaseUrl、modelId 配置
// @step: [构建上下文] 构建 WorkflowContext
// @step: [执行工作流] 调用 executeCDDWorkflow
// @step: [记录日志] 调用 WorkScheduleRepo.addRecord
// @step: [显示结果] 根据工作流结果显示消息
// @boundary: 当未选中文本时，提示"请选中要审查的代码块"
// @boundary: 当未配置 API Key 时，提示错误
async function execute() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('未打开编辑器');
        return;
    }
    const selection = editor.selection;
    if (selection.isEmpty) {
        vscode.window.showErrorMessage('请选中要审查的代码块');
        return;
    }
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
    if (!workspaceRoot) {
        vscode.window.showErrorMessage('未打开工作区');
        return;
    }
    const apiKey = vscode.workspace.getConfiguration('cdd').get('apiKey') || '';
    if (!apiKey) {
        vscode.window.showErrorMessage('请先配置 API Key');
        return;
    }
    const apiBaseUrl = vscode.workspace.getConfiguration('cdd').get('apiBaseUrl') || undefined;
    const modelId = vscode.workspace.getConfiguration('cdd').get('modelId') || undefined;
    // 构建工作流上下文
    const context = {
        document: editor.document,
        selection,
        workspaceRoot,
        apiKey,
        apiBaseUrl,
        modelId
    };
    // 执行工作流
    const result = await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: '正在审查代码...',
        cancellable: false
    }, async () => {
        return await (0, CDDWorkflow_1.executeCDDWorkflow)(context);
    });
    // 记录日志
    const now = new Date();
    await WorkScheduleRepo.addRecord({
        date: now.toISOString().split('T')[0],
        time: now.toTimeString().split(' ')[0],
        role: '审查员',
        description: `工作流执行: ${result.executionPath.join(' → ')}`,
        duration: 0,
        dependencies: []
    }, workspaceRoot);
    // 显示结果
    if (result.success) {
        if (result.reviewPassed) {
            vscode.window.showInformationMessage(`✅ ${result.message}`);
        }
        else {
            vscode.window.showInformationMessage(result.message);
        }
    }
    else {
        vscode.window.showErrorMessage(`❌ ${result.message}`);
    }
}
// @end
//# sourceMappingURL=ReviewCommand.js.map