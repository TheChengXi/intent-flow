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
exports.ReviewerContextManager = void 0;
const HistoryService_1 = require("../../model/services/HistoryService");
const CommentParser = __importStar(require("../../model/services/CommentParser"));
const FileRepository = __importStar(require("../../model/repositories/FileRepository"));
const path = __importStar(require("path"));
// @contract: ReviewerContextManager.prepare(document: vscode.TextDocument, selection: vscode.Selection, workspaceRoot: string, apiKey: string, apiBaseUrl?: string, modelId?: string) => Promise<ReviewContext | null>
// @step: [解析注释] 调用 CommentParser.parseComment 解析选中的注释和代码
// @step: [读取规范] 读取 COMPILE_SPEC.md
// @step: [读取编译记录] 调用 HistoryService.getLastCompilerRecord 获取编译器决策过程
// @step: [读取审查记录] 调用 HistoryService.getLastReviewerRecord 获取上次审查结果
// @step: [构建上下文] 构建 ReviewContext 对象
// @step: [返回] 返回上下文
// @boundary: 当注释解析失败时，应返回 null
// @contract: ReviewerContextManager.save(workspaceRoot: string, filePath: string, functionName: string, contract: string, comment: CDDComment, code: string, success: boolean, issues: string[], compileSpec: string) => Promise<void>
// @step: [构建记录] 构建 WorkLineHistoryRecord
// @step: [保存] 调用 HistoryService.addRecord 保存记录
// @boundary: 当保存失败时，应抛出错误
class ReviewerContextManager {
    static async prepare(document, selection, workspaceRoot, apiKey, apiBaseUrl, modelId) {
        // 解析注释和代码
        const selectedText = document.getText(selection);
        const comment = CommentParser.parseComment(selectedText, document, selection.start.line);
        if (!comment) {
            return null;
        }
        // 读取 COMPILE_SPEC
        const compileSpecPath = path.join(workspaceRoot, '_source', 'COMPILE_SPEC.md');
        let compileSpec = '';
        try {
            compileSpec = await FileRepository.readFile(compileSpecPath);
        }
        catch {
            // COMPILE_SPEC 不存在时使用空字符串
        }
        // 读取编译记录
        const compilerRecord = await HistoryService_1.HistoryService.getLastCompilerRecord(workspaceRoot, document.fileName, comment.contract.functionName);
        // 读取上次审查记录
        const lastReview = await HistoryService_1.HistoryService.getLastReviewerRecord(workspaceRoot, document.fileName, comment.contract.functionName);
        // 构建上下文
        const context = {
            comment: comment,
            code: selectedText,
            compileSpec,
            apiKey,
            apiBaseUrl,
            modelId
        };
        // 加载编译器决策过程
        if (compilerRecord) {
            context.compilerRecord = `编译器输入：\n${compilerRecord.input.comment}\n\n编译器输出：\n${compilerRecord.output.content}`;
        }
        // 加载上次审查结果
        if (lastReview) {
            context.lastReviewResult = `上次审查结果：${lastReview.output.success ? '通过' : '不通过'}\n问题：${lastReview.output.issues?.join(', ') || '无'}`;
        }
        return context;
    }
    static async save(workspaceRoot, filePath, functionName, contract, comment, code, success, issues, compileSpec) {
        // 根据文件类型检测注释符号
        const commentPrefix = this.getCommentPrefix(filePath);
        // 格式化注释为字符串
        let commentText = `${commentPrefix} @contract: ${comment.contract.functionName}(`;
        commentText += comment.contract.parameters.map(p => `${p.name}: ${p.type}`).join(', ');
        commentText += `) => ${comment.contract.returnType}\n`;
        for (const step of comment.steps) {
            commentText += `${commentPrefix} @step: ${step.description}\n`;
        }
        for (const boundary of comment.boundaries) {
            commentText += `${commentPrefix} @boundary: ${boundary.description}\n`;
        }
        const record = {
            timestamp: new Date().toISOString(),
            role: 'reviewer',
            input: {
                comment: commentText,
                code,
                compileSpec
            },
            output: {
                success,
                content: success ? '审查通过' : '审查不通过',
                issues
            }
        };
        await HistoryService_1.HistoryService.addRecord(workspaceRoot, filePath, functionName, contract, record);
    }
    // @contract: getCommentPrefix(filePath: string) => string
    // @step: [提取扩展名] 从文件路径提取扩展名
    // @step: [映射] 根据扩展名返回对应的注释前缀
    // @step: [返回] 返回注释前缀
    static getCommentPrefix(filePath) {
        const ext = filePath.split('.').pop()?.toLowerCase();
        const prefixMap = {
            'py': '#',
            'rb': '#',
            'sh': '#',
            'ts': '//',
            'js': '//',
            'tsx': '//',
            'jsx': '//',
            'java': '//',
            'cpp': '//',
            'c': '//',
            'go': '//',
            'rs': '//',
            'kt': '//',
            'swift': '//',
            'cs': '//',
            'php': '//',
            'ets': '//'
        };
        return prefixMap[ext || ''] || '//';
    }
}
exports.ReviewerContextManager = ReviewerContextManager;
//# sourceMappingURL=ReviewerContextManager.js.map