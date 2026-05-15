"use strict";
// @intent: 提供文件大小检查相关的 VSCode 命令
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
exports.checkCurrentFileWithDependencies = checkCurrentFileWithDependencies;
const vscode = __importStar(require("vscode"));
const FileMetricsService_1 = require("../../model/services/FileMetricsService");
const IntentExtractor_1 = require("../../model/services/IntentExtractor");
const path = __importStar(require("path"));
// @contract: execute() => Promise<void>
// @step: [获取工作区] 获取当前工作区根目录
// @step: [扫描项目] 调用 FileMetricsService.checkProjectFiles 扫描所有文件
// @step: [显示结果] 在输出面板显示结果
// @boundary: 当没有工作区时，显示错误提示
async function execute() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showErrorMessage('请先打开一个工作区');
        return;
    }
    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    // 显示进度提示
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: '正在扫描项目文件...',
        cancellable: false
    }, async (progress) => {
        try {
            // 扫描项目
            const results = await FileMetricsService_1.FileMetricsService.checkProjectFiles(workspaceRoot, 400);
            // 格式化报告
            const report = FileMetricsService_1.FileMetricsService.formatReport(results);
            // 显示结果
            const outputChannel = vscode.window.createOutputChannel('CDD - File Metrics');
            outputChannel.clear();
            outputChannel.appendLine('=== 文件大小检查报告 ===\n');
            outputChannel.appendLine(report);
            outputChannel.show();
            // 显示通知
            if (results.length > 0) {
                const critical = results.filter((r) => r.lineCount > FileMetricsService_1.FileMetricsService.CRITICAL_THRESHOLD);
                if (critical.length > 0) {
                    vscode.window.showWarningMessage(`发现 ${critical.length} 个严重超标文件，建议立即重构`, '查看报告').then(action => {
                        if (action === '查看报告') {
                            outputChannel.show();
                        }
                    });
                }
                else {
                    vscode.window.showInformationMessage(`发现 ${results.length} 个文件建议重构`);
                }
            }
            else {
                vscode.window.showInformationMessage('✓ 所有文件都在推荐大小范围内');
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`扫描失败: ${error.message}`);
        }
    });
}
// @contract: checkCurrentFileWithDependencies() => Promise<void>
// @step: [获取当前文件] 获取当前编辑器打开的文件
// @step: [提取依赖树] 调用 extractIntentWithDependencies
// @step: [检查大小] 调用 checkDependencyBranchSize
// @step: [显示结果] 在输出面板显示结果
// @boundary: 当没有打开文件时，显示错误提示
async function checkCurrentFileWithDependencies() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('请先打开一个文件');
        return;
    }
    const filePath = editor.document.uri.fsPath;
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showErrorMessage('请先打开一个工作区');
        return;
    }
    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: '正在检查文件及其依赖...',
        cancellable: false
    }, async (progress) => {
        try {
            // 提取依赖树
            const branch = await (0, IntentExtractor_1.extractIntentWithDependencies)(filePath, workspaceRoot, 2);
            // 检查大小
            const results = await (0, IntentExtractor_1.checkDependencyBranchSize)(branch, 400);
            // 格式化报告
            const fileName = path.basename(filePath);
            const report = FileMetricsService_1.FileMetricsService.formatReport(results);
            // 显示结果
            const outputChannel = vscode.window.createOutputChannel('CDD - File Metrics');
            outputChannel.clear();
            outputChannel.appendLine(`=== 文件依赖树大小检查: ${fileName} ===\n`);
            outputChannel.appendLine(report);
            outputChannel.show();
            // 显示通知
            if (results.length > 0) {
                vscode.window.showWarningMessage(`在依赖树中发现 ${results.length} 个文件需要重构`, '查看报告').then(action => {
                    if (action === '查看报告') {
                        outputChannel.show();
                    }
                });
            }
            else {
                vscode.window.showInformationMessage('✓ 依赖树中所有文件都在推荐大小范围内');
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`检查失败: ${error.message}`);
        }
    });
}
//# sourceMappingURL=CheckFileSizeCommand.js.map