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
const TranslatorVM_1 = require("../roles/TranslatorVM");
const ClaudeAPIService_1 = require("../../model/services/ClaudeAPIService");
const WorkScheduleRepo = __importStar(require("../../model/repositories/WorkScheduleRepo"));
// @contract: execute() => Promise<void>
// @step: [获取选区] 获取当前编辑器选中的代码
// @step: [转译] 调用 TranslatorVM.translateToComment
// @step: [插入注释] 在代码上方插入生成的注释
// @step: [记录日志] 调用 WorkScheduleRepo.addRecord
// @step: [提示] 显示"注释已生成，请人工审查后再编译"
// @boundary: 当未选中文本时，提示"请选中要转译的代码块"
// @boundary: 当 API 返回 LogicUnclearError 时，按 BUSINESS_RULES 流程3异常处理
async function execute() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('未打开编辑器');
        return;
    }
    const selection = editor.selection;
    if (selection.isEmpty) {
        vscode.window.showErrorMessage('请选中要转译的代码块');
        return;
    }
    const selectedText = editor.document.getText(selection);
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
    const apiService = new ClaudeAPIService_1.ClaudeAPIService();
    const translatorVM = new TranslatorVM_1.TranslatorVM(apiService);
    const context = {
        code: selectedText,
        apiKey,
        apiBaseUrl,
        modelId
    };
    const result = await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: '正在转译为注释...',
        cancellable: false
    }, async () => {
        return await translatorVM.execute(context);
    });
    if (!result.success) {
        vscode.window.showErrorMessage(`转译失败：${result.message}`);
        return;
    }
    const commentText = result.artifacts;
    const insertPosition = selection.start;
    await editor.edit(editBuilder => {
        editBuilder.insert(insertPosition, commentText + '\n');
    });
    const now = new Date();
    await WorkScheduleRepo.addRecord({
        date: now.toISOString().split('T')[0],
        time: now.toTimeString().split(' ')[0],
        role: '转译员',
        description: '转译代码为注释',
        duration: 0,
        dependencies: []
    }, workspaceRoot);
    vscode.window.showInformationMessage('注释已生成，请人工审查后再编译');
}
// @end
//# sourceMappingURL=TranslateCommand.js.map