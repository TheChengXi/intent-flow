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
exports.CompilerContextManager = void 0;
const HistoryService_1 = require("../../model/services/HistoryService");
const CommentParser = __importStar(require("../../model/services/CommentParser"));
const FileRepository = __importStar(require("../../model/repositories/FileRepository"));
const WorkLineService_1 = require("../../model/services/WorkLineService");
const StepDiffDetector = __importStar(require("../../model/services/StepDiffDetector"));
const path = __importStar(require("path"));
// @contract: CompilerContextManager.prepare(document: vscode.TextDocument, selection: vscode.Selection, workspaceRoot: string, apiKey: string, apiBaseUrl?: string, modelId?: string, targetLanguage?: string) => Promise<CompileContext | null>
// @step: [解析注释] 调用 CommentParser.parseComment 解析选中的注释
// @step: [读取规范] 读取 COMPILE_SPEC.md
// @step: [读取历史] 调用 HistoryService.getLastCompilerRecord 获取上次编译记录
// @step: [检测差异] 如果存在历史记录，调用 StepDiffDetector.detectDiff 检测步骤差异
// @step: [判断增量] 调用 StepDiffDetector.shouldUseIncrementalMode 判断是否使用增量模式
// @step: [读取审查记录] 调用 HistoryService.getLastReviewerRecord 获取上次审查结果
// @step: [检查是否不通过] 如果审查不通过，读取审查反馈和上次编译代码
// @step: [构建上下文] 构建 CompileContext 对象，包含增量编译信息
// @step: [返回] 返回上下文
// @boundary: 当注释解析失败时，应返回 null
// @contract: CompilerContextManager.save(workspaceRoot: string, filePath: string, functionName: string, contract: string, commentText: string, code: string, success: boolean, compileSpec: string) => Promise<void>
// @step: [解析注释] 调用 CommentParser.parseComment 解析注释文本
// @step: [构建记录] 构建 WorkLineHistoryRecord，包含 parsedComment
// @step: [保存] 调用 HistoryService.addRecord 保存记录
// @boundary: 当保存失败时，应抛出错误
class CompilerContextManager {
    static async prepare(document, selection, workspaceRoot, apiKey, apiBaseUrl, modelId, targetLanguage) {
        console.log('[CompilerContextManager] 开始准备编译上下文');
        // 解析注释
        console.log('[CompilerContextManager] 解析注释...');
        const selectedText = document.getText(selection);
        console.log('[CompilerContextManager] 选中的文本长度:', selectedText.length);
        console.log('[CompilerContextManager] 选中的文本内容:', selectedText);
        const comment = CommentParser.parseComment(selectedText, document, selection.start.line);
        if (!comment) {
            console.log('[CompilerContextManager] 注释解析失败');
            return null;
        }
        console.log('[CompilerContextManager] 注释解析成功:', comment.contract.functionName);
        console.log('[CompilerContextManager] 解析到的 boundaries 数量:', comment.boundaries.length);
        console.log('[CompilerContextManager] boundaries 详情:', JSON.stringify(comment.boundaries, null, 2));
        // 读取 COMPILE_SPEC
        console.log('[CompilerContextManager] 读取 COMPILE_SPEC...');
        const compileSpecPath = path.join(workspaceRoot, '_source', 'COMPILE_SPEC.md');
        let compileSpec = '';
        try {
            compileSpec = await FileRepository.readFile(compileSpecPath);
            console.log('[CompilerContextManager] COMPILE_SPEC 读取成功，长度:', compileSpec.length);
        }
        catch {
            console.log('[CompilerContextManager] COMPILE_SPEC 不存在，使用空字符串');
        }
        // 读取上次编译记录
        console.log('[CompilerContextManager] 读取上次编译记录...');
        const lastCompile = await HistoryService_1.HistoryService.getLastCompilerRecord(workspaceRoot, document.fileName, comment.contract.functionName);
        console.log('[CompilerContextManager] 上次编译记录:', lastCompile ? '存在' : '不存在');
        // 检测步骤差异和增量编译
        console.log('[CompilerContextManager] 检测步骤差异...');
        let stepDiff;
        let isIncremental = false;
        let previousCode;
        if (lastCompile && lastCompile.input.parsedComment && lastCompile.output.success) {
            console.log('[CompilerContextManager] 验证上次生成的代码...');
            // 验证上次生成的代码是有效的（不是错误消息）
            const lastCode = lastCompile.output.content;
            const isValidCode = lastCode &&
                !lastCode.includes('I cannot proceed') &&
                !lastCode.includes('Missing Prerequisites') &&
                !lastCode.includes('CRITICAL:') &&
                lastCode.length >= 50;
            console.log('[CompilerContextManager] 上次代码有效性:', isValidCode);
            if (isValidCode) {
                console.log('[CompilerContextManager] 调用 StepDiffDetector.detectDiff...');
                stepDiff = StepDiffDetector.detectDiff(lastCompile.input.parsedComment, comment);
                console.log('[CompilerContextManager] 步骤差异检测完成');
                isIncremental = StepDiffDetector.shouldUseIncrementalMode(stepDiff);
                console.log('[CompilerContextManager] 是否使用增量模式:', isIncremental);
                if (isIncremental) {
                    previousCode = lastCode;
                }
            }
        }
        else {
            console.log('[CompilerContextManager] 跳过步骤差异检测（无有效历史记录）');
        }
        // 读取上次审查记录
        console.log('[CompilerContextManager] 读取上次审查记录...');
        const lastReview = await HistoryService_1.HistoryService.getLastReviewerRecord(workspaceRoot, document.fileName, comment.contract.functionName);
        console.log('[CompilerContextManager] 上次审查记录:', lastReview ? '存在' : '不存在');
        // 提取引用的契约（跨文件引用）
        // 注意：只在第一次编译时提取，重新编译时跳过（避免重复弹出对话框）
        console.log('[CompilerContextManager] 提取引用的契约...');
        let referencedContracts = [];
        // 如果存在上次编译记录且代码有效，说明这是重新编译，跳过契约搜索
        const hasValidPreviousCode = lastCompile &&
            lastCompile.output.success &&
            lastCompile.output.content &&
            !lastCompile.output.content.includes('I cannot proceed') &&
            !lastCompile.output.content.includes('Missing Prerequisites') &&
            lastCompile.output.content.length >= 50;
        console.log('[CompilerContextManager] 是否存在有效的上次编译:', hasValidPreviousCode);
        if (!hasValidPreviousCode) {
            try {
                // 从注释文本中提取可能调用的函数
                // 使用注释文本而不是 workLine，因为此时还没有生成代码
                const commentText = selectedText;
                console.log('[CompilerContextManager] 调用 extractFunctionCallsFromText...');
                const functionCalls = WorkLineService_1.WorkLineService.extractFunctionCallsFromText(commentText);
                console.log('[CompilerContextManager] 提取到的函数调用数量:', functionCalls.length);
                if (functionCalls.length > 0) {
                    // 从文档中提取 import 语句
                    console.log('[CompilerContextManager] 提取 import 语句...');
                    const fullText = document.getText();
                    const importedFiles = WorkLineService_1.WorkLineService.extractImportedFilesFromText(fullText, workspaceRoot);
                    console.log('[CompilerContextManager] 提取到的导入文件数量:', importedFiles.length);
                    console.log('[CompilerContextManager] 调用 searchContractsForFunctions...');
                    referencedContracts = await WorkLineService_1.WorkLineService.searchContractsForFunctions(functionCalls, importedFiles, workspaceRoot);
                    console.log('[CompilerContextManager] 搜索到的契约数量:', referencedContracts.length);
                }
            }
            catch (error) {
                console.warn('[CompilerContextManager] 提取引用契约失败:', error);
            }
        }
        else {
            console.log('[CompilerContextManager] 跳过契约搜索（重新编译模式）');
        }
        // 构建基础上下文
        console.log('[CompilerContextManager] 构建基础上下文...');
        const context = {
            comment,
            compileSpec,
            apiKey,
            apiBaseUrl,
            modelId,
            filePath: document.fileName,
            targetLanguage,
            referencedContracts: referencedContracts.length > 0 ? referencedContracts : undefined,
            stepDiff,
            isIncremental,
            previousCode
        };
        // 如果上次审查不通过，加载反馈（优先级高于增量编译）
        // 但需要验证审查是否针对当前注释（避免使用过时的反馈）
        console.log('[CompilerContextManager] 检查审查反馈...');
        if (lastReview && !lastReview.output.success) {
            console.log('[CompilerContextManager] 上次审查不通过，验证是否针对当前注释...');
            // 比较当前注释和审查记录中的注释
            const currentCommentText = selectedText.trim();
            const reviewCommentText = lastReview.input.comment?.trim() || '';
            if (currentCommentText === reviewCommentText) {
                console.log('[CompilerContextManager] 审查反馈有效，加载反馈');
                context.reviewFeedback = lastReview.output.issues?.join('\n') || '';
                context.previousCode = lastReview.input.code || '';
                context.isIncremental = false; // 审查不通过时禁用增量模式
            }
            else {
                console.log('[CompilerContextManager] 注释已改变，忽略旧的审查反馈');
            }
        }
        console.log('[CompilerContextManager] 上下文准备完成');
        return context;
    }
    static async save(workspaceRoot, filePath, functionName, contract, commentText, code, success, compileSpec) {
        // 解析注释以保存到历史记录
        const parsedComment = CommentParser.parseComment(commentText, null, 0);
        const record = {
            timestamp: new Date().toISOString(),
            role: 'compiler',
            input: {
                comment: commentText,
                compileSpec,
                parsedComment: parsedComment || undefined
            },
            output: {
                success,
                content: code
            }
        };
        await HistoryService_1.HistoryService.addRecord(workspaceRoot, filePath, functionName, contract, record);
    }
}
exports.CompilerContextManager = CompilerContextManager;
//# sourceMappingURL=CompilerContextManager.js.map