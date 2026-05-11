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
const CompilerVM_1 = require("../roles/CompilerVM");
const ClaudeAPIService_1 = require("../../model/services/ClaudeAPIService");
const CommentParser = __importStar(require("../../model/services/CommentParser"));
const WorkScheduleRepo = __importStar(require("../../model/repositories/WorkScheduleRepo"));
const FileRepository = __importStar(require("../../model/repositories/FileRepository"));
const ReviewCommand = __importStar(require("./ReviewCommand"));
const path = __importStar(require("path"));
// @contract: execute() => Promise<void>
// @step: [获取选区] 获取当前编辑器选中的文本范围
// @step: [解析注释] 调用 CommentParser.parseComment
// @step: [读取规范] 读取 _source/COMPILE_SPEC.md（如存在）
// @step: [读取配置] 读取 apiKey、apiBaseUrl、modelId、targetLanguage 配置
// @step: [获取文件路径] 获取当前文件路径用于语言检测
// @step: [编译] 调用 CompilerVM.compile
// @step: [插入代码] 在注释下方插入生成的代码
// @step: [记录日志] 调用 WorkScheduleRepo.addRecord
// @step: [触发审查] 自动调用 ReviewCommand.execute
// @boundary: 当未选中文本时，提示"请选中包含 @contract 的函数"
// @boundary: 当未找到 @contract 时，按 BUSINESS_RULES 流程1异常处理
// @boundary: 当编译器返回 NEEDS_SPLIT 时，弹出确认对话框
async function execute() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('未打开编辑器');
        return;
    }
    const selection = editor.selection;
    if (selection.isEmpty) {
        vscode.window.showErrorMessage('请选中包含 @contract 的函数');
        return;
    }
    const selectedText = editor.document.getText(selection);
    const comment = CommentParser.parseComment(selectedText, editor.document, selection.start.line);
    if (!comment) {
        vscode.window.showErrorMessage('未找到 @contract，无法编译');
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
    const targetLanguage = vscode.workspace.getConfiguration('cdd').get('targetLanguage') || undefined;
    const apiService = new ClaudeAPIService_1.ClaudeAPIService();
    const compilerVM = new CompilerVM_1.CompilerVM(apiService);
    const context = {
        comment,
        compileSpec,
        apiKey,
        apiBaseUrl,
        modelId,
        filePath: editor.document.fileName,
        targetLanguage
    };
    const result = await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: '正在编译注释...',
        cancellable: false
    }, async () => {
        return await compilerVM.execute(context);
    });
    if (!result.success) {
        // 检查是否是 NEEDS_SPLIT
        if (result.artifacts === CompilerVM_1.NEEDS_SPLIT) {
            const choice = await vscode.window.showWarningMessage(result.message, '继续', '取消');
            if (choice !== '继续') {
                return;
            }
            // 用户选择继续，重新编译（忽略行数限制）
            // 这里简化处理，直接返回
            vscode.window.showInformationMessage('请手动拆分函数后再编译');
            return;
        }
        vscode.window.showErrorMessage(`编译失败：${result.message}`);
        return;
    }
    const code = result.artifacts;
    const insertPosition = selection.end;
    await editor.edit(editBuilder => {
        editBuilder.insert(insertPosition, '\n' + code);
    });
    const now = new Date();
    await WorkScheduleRepo.addRecord({
        date: now.toISOString().split('T')[0],
        time: now.toTimeString().split(' ')[0],
        role: '编译器',
        description: `编译 ${comment.contract.functionName}`,
        duration: 0,
        dependencies: []
    }, workspaceRoot);
    vscode.window.showInformationMessage(`编译完成：${comment.contract.functionName}`);
    // 自动触发审查
    await ReviewCommand.execute();
}
// @end
//# sourceMappingURL=CompileCommand.js.map