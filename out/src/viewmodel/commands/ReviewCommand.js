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
const ReviewerVM_1 = require("../roles/ReviewerVM");
const ClaudeAPIService_1 = require("../../model/services/ClaudeAPIService");
const CommentParser = __importStar(require("../../model/services/CommentParser"));
const WorkScheduleRepo = __importStar(require("../../model/repositories/WorkScheduleRepo"));
const FileRepository = __importStar(require("../../model/repositories/FileRepository"));
const path = __importStar(require("path"));
// @contract: execute() => Promise<void>
// @step: [获取选区] 获取当前编辑器选中的文本范围
// @step: [解析注释] 调用 CommentParser.parseComment
// @step: [提取代码] 提取 @contract 到 // @end 之间的代码
// @step: [读取规范] 读取 _source/COMPILE_SPEC.md（如存在）
// @step: [审查] 调用 ReviewerVM.review
// @step: [写入报告] 调用 FileRepository.appendFile 追加到 REVIEW_REPORT.md
// @step: [高亮标记] 调用 HighlightDecorator 标记不一致的行
// @step: [记录日志] 调用 WorkScheduleRepo.addRecord
// @boundary: 当代码块不完整时，按 BUSINESS_RULES 流程2异常处理
// @boundary: 当审查结论为 MAJOR_VIOLATION 时，调用 ReviewerVM.triggerArbitration
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
    const selectedText = editor.document.getText(selection);
    const comment = CommentParser.parseComment(selectedText, editor.document, selection.start.line);
    if (!comment) {
        vscode.window.showErrorMessage('代码块不完整，无法审查');
        return;
    }
    if (!selectedText.includes('// @end')) {
        vscode.window.showErrorMessage('代码块不完整：缺少 // @end');
        return;
    }
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
    if (!workspaceRoot) {
        vscode.window.showErrorMessage('未打开工作区');
        return;
    }
    const compileSpecPath = path.join(workspaceRoot, '_source', 'COMPILE_SPEC.md');
    let compileSpec = '';
    try {
        compileSpec = await FileRepository.readFile(compileSpecPath);
    }
    catch {
        // COMPILE_SPEC 不存在时使用空字符串
    }
    const apiKey = vscode.workspace.getConfiguration('cdd').get('apiKey') || '';
    if (!apiKey) {
        vscode.window.showErrorMessage('请先配置 API Key');
        return;
    }
    const apiBaseUrl = vscode.workspace.getConfiguration('cdd').get('apiBaseUrl') || undefined;
    const modelId = vscode.workspace.getConfiguration('cdd').get('modelId') || undefined;
    const apiService = new ClaudeAPIService_1.ClaudeAPIService();
    const reviewerVM = new ReviewerVM_1.ReviewerVM(apiService);
    const context = {
        comment,
        code: selectedText,
        compileSpec,
        apiKey,
        apiBaseUrl,
        modelId
    };
    const result = await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: '正在审查代码...',
        cancellable: false
    }, async () => {
        return await reviewerVM.execute(context);
    });
    if (!result.success) {
        vscode.window.showErrorMessage(`审查失败：${result.message}`);
        return;
    }
    const report = result.artifacts;
    const reportPath = path.join(workspaceRoot, 'REVIEW_REPORT.md');
    const reportText = `\n### 审查报告：${report.functionName} - ${report.date}\n结论：${report.conclusion}\n`;
    await FileRepository.appendFile(reportPath, reportText);
    // 当发现严重违规时，触发裁决流程（BR-008）
    if (report.conclusion === 'MAJOR_VIOLATION' && report.inconsistencies.length > 0) {
        const inconsistenciesText = report.inconsistencies
            .map((inc) => `- 第${inc.line}行：${inc.description}`)
            .join('\n');
        const choice = await vscode.window.showWarningMessage(`发现严重违规：\n${inconsistenciesText}\n\n路径A（注释为准）：重新编译\n路径B（代码为准）：代码反向同步注释`, '路径A：重新编译', '路径B：反向同步', '取消');
        if (choice === '路径A：重新编译') {
            vscode.window.showInformationMessage('请修改注释后重新编译');
        }
        else if (choice === '路径B：反向同步') {
            vscode.window.showInformationMessage('请使用"CDD: 转译代码为注释"功能更新注释');
        }
    }
    const now = new Date();
    await WorkScheduleRepo.addRecord({
        date: now.toISOString().split('T')[0],
        time: now.toTimeString().split(' ')[0],
        role: '审查员',
        description: `审查 ${comment.contract.functionName}`,
        duration: 0,
        dependencies: []
    }, workspaceRoot);
    vscode.window.showInformationMessage(`审查完成：${report.conclusion}`);
}
// @end
//# sourceMappingURL=ReviewCommand.js.map