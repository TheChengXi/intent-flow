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
exports.TranslatorContextManager = void 0;
const HistoryService_1 = require("../../model/services/HistoryService");
const FileRepository = __importStar(require("../../model/repositories/FileRepository"));
const path = __importStar(require("path"));
// @contract: TranslatorContextManager.prepare(document: vscode.TextDocument, selection: vscode.Selection, workspaceRoot: string, apiKey: string, apiBaseUrl?: string, modelId?: string) => Promise<TranslateContext>
// @step: [获取代码] 获取选中的代码文本
// @step: [读取规范] 读取 COMPILE_SPEC.md
// @step: [读取转译记录] 调用 HistoryService.getLastTranslatorRecord 获取上次转译结果（如果有函数名）
// @step: [构建上下文] 构建 TranslateContext 对象
// @step: [返回] 返回上下文
// @boundary: 当 COMPILE_SPEC 不存在时，使用空字符串
// @contract: TranslatorContextManager.save(workspaceRoot: string, filePath: string, functionName: string, contract: string, code: string, commentText: string, success: boolean, compileSpec: string) => Promise<void>
// @step: [构建记录] 构建 WorkLineHistoryRecord
// @step: [保存] 调用 HistoryService.addRecord 保存记录
// @boundary: 当保存失败时，应抛出错误
class TranslatorContextManager {
    static async prepare(document, selection, workspaceRoot, apiKey, apiBaseUrl, modelId) {
        const selectedText = document.getText(selection);
        // 读取 COMPILE_SPEC
        const compileSpecPath = path.join(workspaceRoot, '_source', 'COMPILE_SPEC.md');
        let compileSpec = '';
        try {
            compileSpec = await FileRepository.readFile(compileSpecPath);
        }
        catch {
            // COMPILE_SPEC 不存在时使用空字符串
        }
        // 构建上下文
        const context = {
            code: selectedText,
            compileSpec,
            apiKey,
            apiBaseUrl,
            modelId,
            filePath: document.fileName,
            languageId: document.languageId
        };
        return context;
    }
    static async save(workspaceRoot, filePath, functionName, contract, code, commentText, success, compileSpec) {
        const record = {
            timestamp: new Date().toISOString(),
            role: 'translator',
            input: {
                code,
                compileSpec
            },
            output: {
                success,
                content: commentText
            }
        };
        await HistoryService_1.HistoryService.addRecord(workspaceRoot, filePath, functionName, contract, record);
    }
}
exports.TranslatorContextManager = TranslatorContextManager;
//# sourceMappingURL=TranslatorContextManager.js.map