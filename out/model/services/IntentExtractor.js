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
exports.extractIntentFromFile = extractIntentFromFile;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// @contract: extractIntentFromFile(filePath: string, maxLines?: number) => Promise<IntentResult>
// @step: [读取文件] 读取文件前 maxLines 行（默认 50 行）
// @step: [正则匹配] 使用正则匹配 @intent: 或 # @intent:
// @step: [返回结果] 如果找到，返回文件名+意图；否则用文件名作为意图
// @boundary: 当文件不存在时，抛出错误
// @boundary: 当文件为空时，返回文件名作为意图
async function extractIntentFromFile(filePath, maxLines = 50) {
    // 读取文件
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const lines = content.split('\n').slice(0, maxLines);
    // 提取文件名（不含扩展名）
    const fileName = path.basename(filePath, path.extname(filePath));
    // 正则匹配 @intent
    // 支持格式：
    // // @intent: 这是意图
    // # @intent: 这是意图
    // @intent: 这是意图
    const intentRegex = /^[\/\/#\s]*@intent[:\s]+(.+)$/;
    for (const line of lines) {
        const trimmed = line.trim();
        const match = trimmed.match(intentRegex);
        if (match) {
            return {
                fileName,
                intent: match[1].trim(),
                found: true
            };
        }
    }
    // 没有找到 @intent，使用文件名作为意图
    return {
        fileName,
        intent: fileName,
        found: false
    };
}
// @end
//# sourceMappingURL=IntentExtractor.js.map