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
exports.CompilerVM = exports.NEEDS_SPLIT = void 0;
const BaseRole_1 = require("./BaseRole");
const DependencyTracker = __importStar(require("../../model/services/DependencyTracker"));
const Errors_1 = require("../../model/entities/Errors");
// @entity: CompileResult
// 编译结果（特殊标记）
exports.NEEDS_SPLIT = Symbol('NEEDS_SPLIT');
class CompilerVM extends BaseRole_1.BaseRole {
    constructor(apiService) {
        super(apiService);
    }
    // @contract: execute(context: CompileContext) => Promise<RoleResult>
    // @step: [验证] 检查 comment.contract 格式是否符合 BR-007
    // @step: [检测语言] 从文件扩展名推断目标语言，如无法识别则使用配置项
    // @step: [估算] 根据 steps 数量估算代码行数（每个 step 约 10-20 行）
    // @step: [暂停检查] 预计超过 200 行时，返回 artifacts: NEEDS_SPLIT
    // @step: [构建请求] 将 comment + compileSpec + 目标语言构建为 ClaudeAPIRequest
    // @step: [调用 API] 通过 apiService.callAPI 生成代码
    // @step: [清理代码] 去除代码块标记和原始注释
    // @step: [添加标记] 在代码末尾添加 // @end
    // @step: [提取依赖] 使用正则提取代码中调用的函数名
    // @step: [记录依赖] 调用 dependencyTracker.recordDependency
    // @step: [返回结果] 返回 success: true，artifacts 包含生成的代码
    // @boundary: 当注释格式不符合 BR-007 时，返回 success: false 和 ValidationError
    // @boundary: 当 API 调用失败时，返回 success: false 和 APIError
    async execute(context) {
        try {
            if (!context.comment.contract.functionName) {
                throw new Errors_1.ValidationError('@contract 格式不符合 BR-007：缺少函数名');
            }
            const estimatedLines = this.estimateLines(context.comment.steps.length);
            if (estimatedLines > 200) {
                return {
                    success: false,
                    message: `预计生成 ${estimatedLines} 行代码，建议拆分函数`,
                    artifacts: exports.NEEDS_SPLIT
                };
            }
            const language = this.detectLanguage(context.filePath, context.targetLanguage);
            const commentText = this.formatComment(context.comment);
            const request = {
                role: 'compiler',
                context: {
                    comment: commentText,
                    compileSpec: context.compileSpec
                },
                prompt: `你是 ${language} 编译器。根据 @contract 中的类型签名生成严格类型化的代码。

重要规则：
1. 函数参数必须包含完整的类型标注（如 a: number）
2. 返回值必须包含类型标注
3. 严格遵循 COMPILE_SPEC 中的 ${language} 编码规范
4. 只输出纯代码，不要包含任何注释（包括原始的 @contract、@step、@boundary 注释）
5. 不要添加代码块标记（\`\`\`）
6. 不要解释，直接输出可执行的代码`
            };
            const response = await this.apiService.callAPI(request, context.apiKey, context.apiBaseUrl, context.modelId);
            let code = response.content.trim();
            // 清理代码块标记
            code = code.replace(/^```[\w]*\n/gm, '').replace(/\n```$/gm, '');
            // 清理原始注释（@contract、@step、@boundary）
            const lines = code.split('\n');
            const cleanedLines = lines.filter(line => {
                const trimmed = line.trim();
                return !trimmed.startsWith('// @contract:') &&
                    !trimmed.startsWith('// @step:') &&
                    !trimmed.startsWith('// @boundary:');
            });
            code = cleanedLines.join('\n').trim();
            if (!code.endsWith('// @end')) {
                code += '\n// @end';
            }
            const dependencies = this.extractDependencies(code);
            DependencyTracker.recordDependency(context.comment.contract.functionName, dependencies);
            return {
                success: true,
                message: `编译完成：${context.comment.contract.functionName}`,
                artifacts: code
            };
        }
        catch (error) {
            return {
                success: false,
                message: error.message,
                artifacts: error
            };
        }
    }
    // @end
    // @contract: getNextRole() => string | null
    // @step: [返回] 返回 'reviewer'（编译完成后自动触发审查）
    getNextRole() {
        return 'reviewer';
    }
    // @contract: estimateLines(steps: number) => number
    // @step: [计算] 每个 step 按 15 行估算（10-20 行的中位数）
    // @step: [基础] 加上函数签名、返回语句等基础 20 行
    // @boundary: 当 steps 为 0 时，返回 20
    estimateLines(steps) {
        return steps * 15 + 20;
    }
    // @contract: formatComment(comment: CDDComment) => string
    // @step: [构建契约] 拼接 @contract 行，包含函数名、参数、返回类型、异常
    // @step: [构建步骤] 遍历 steps，拼接每个 @step 行
    // @step: [构建边界] 遍历 boundaries，拼接每个 @boundary 行
    // @step: [返回] 返回完整的注释文本
    formatComment(comment) {
        let text = `// @contract: ${comment.contract.functionName}(`;
        text += comment.contract.parameters.map(p => `${p.name}: ${p.type}`).join(', ');
        text += `) => ${comment.contract.returnType}`;
        if (comment.contract.throwsTypes.length > 0) {
            text += ` | throws ${comment.contract.throwsTypes.join(', ')}`;
        }
        text += '\n';
        for (const step of comment.steps) {
            text += `// @step: [${step.intent}] ${step.description}\n`;
        }
        for (const boundary of comment.boundaries) {
            text += `// @boundary: 当${boundary.condition}时，应${boundary.action}\n`;
        }
        return text;
    }
    // @end
    // @contract: extractDependencies(code: string) => ContractDependency[]
    // @step: [正则匹配] 使用正则提取所有函数调用（函数名后跟括号）
    // @step: [去重] 使用 Set 去除重复的函数名
    // @step: [构建依赖] 为每个函数名构建 ContractDependency 对象，版本默认 v1.0
    // @step: [返回] 返回依赖数组
    extractDependencies(code) {
        const functionCallRegex = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;
        const dependencies = [];
        const seen = new Set();
        let match;
        while ((match = functionCallRegex.exec(code)) !== null) {
            const funcName = match[1];
            if (!seen.has(funcName)) {
                seen.add(funcName);
                dependencies.push({
                    contractName: funcName,
                    version: 'v1.0'
                });
            }
        }
        return dependencies;
    }
    // @end
    // @contract: detectLanguage(filePath?: string, targetLanguage?: string) => string
    // @step: [优先配置] 如果 targetLanguage 已配置，直接返回
    // @step: [检测扩展名] 从 filePath 提取扩展名，映射到语言名称
    // @step: [兜底] 无法识别时返回 'TypeScript'
    // @boundary: 当 filePath 为空且 targetLanguage 为空时，返回 'TypeScript'
    detectLanguage(filePath, targetLanguage) {
        if (targetLanguage) {
            return targetLanguage;
        }
        if (!filePath) {
            return 'TypeScript';
        }
        const ext = filePath.split('.').pop()?.toLowerCase();
        const languageMap = {
            'ts': 'TypeScript',
            'js': 'JavaScript',
            'py': 'Python',
            'cpp': 'C++',
            'c': 'C',
            'java': 'Java',
            'go': 'Go',
            'rs': 'Rust',
            'ets': 'ArkTS',
            'kt': 'Kotlin',
            'swift': 'Swift',
            'cs': 'C#',
            'rb': 'Ruby',
            'php': 'PHP'
        };
        return languageMap[ext || ''] || 'TypeScript';
    }
}
exports.CompilerVM = CompilerVM;
//# sourceMappingURL=CompilerVM.js.map