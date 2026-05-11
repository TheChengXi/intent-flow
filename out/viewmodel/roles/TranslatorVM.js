"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TranslatorVM = void 0;
const BaseRole_1 = require("./BaseRole");
const Errors_1 = require("../../model/entities/Errors");
class TranslatorVM extends BaseRole_1.BaseRole {
    constructor(apiService) {
        super(apiService);
    }
    // @contract: execute(context: TranslateContext) => Promise<RoleResult>
    // @step: [验证输入] 检查代码是否为空
    // @step: [检测语言] 从 languageId 或 filePath 检测目标语言
    // @step: [构建 Prompt] 要求 API 逆向生成 @contract、@step、@boundary，指定目标语言的注释格式
    // @step: [调用 API] 通过 apiService.callAPI 生成注释
    // @step: [检查响应] 检查 API 是否返回"代码逻辑混乱"
    // @step: [返回结果] 返回 success: true，artifacts 包含生成的注释文本
    // @boundary: 当代码为空时，返回 success: false 和 ValidationError
    // @boundary: 当 API 返回"代码逻辑混乱"时，返回 success: false 和 LogicUnclearError
    // @boundary: 当 API 调用失败时，返回 success: false 和 APIError
    async execute(context) {
        try {
            if (!context.code || context.code.trim() === '') {
                return {
                    success: false,
                    message: '代码为空，无法转译',
                    artifacts: null
                };
            }
            const language = this.detectLanguage(context.filePath, context.languageId);
            const commentPrefix = this.getCommentPrefix(language);
            const request = {
                role: 'translator',
                context: {
                    code: context.code,
                    compileSpec: context.compileSpec
                },
                prompt: `将以下 ${language} 代码逆向生成 CDD 格式注释（@contract、@step、@boundary）。

重要规则：
1. 使用 ${language} 的注释语法：${commentPrefix}
2. 注释格式示例：
   ${commentPrefix} @contract: functionName(param: type) => returnType
   ${commentPrefix} @step: [意图] 描述
   ${commentPrefix} @boundary: 当条件时，应动作
3. 只输出注释，不要包含代码
4. 如果代码逻辑混乱无法理解，请明确说明"代码逻辑混乱"
5. 注释末尾添加 ${commentPrefix} @end`
            };
            const response = await this.apiService.callAPI(request, context.apiKey, context.apiBaseUrl, context.modelId);
            let comments = response.content.trim();
            console.log('[TranslatorVM] API 返回的原始内容:');
            console.log('='.repeat(80));
            console.log(comments);
            console.log('='.repeat(80));
            // 检查是否返回"代码逻辑混乱"
            if (comments.includes('代码逻辑混乱')) {
                throw new Errors_1.LogicUnclearError('代码逻辑混乱，无法转译');
            }
            // 精确接收：只提取有效的 CDD 注释块
            comments = this.extractValidComments(comments, commentPrefix);
            if (!comments) {
                throw new Error('未找到有效的 CDD 注释块');
            }
            return {
                success: true,
                message: '转译完成，请人工审查后再编译',
                artifacts: comments
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
    // @contract: detectLanguage(filePath?: string, languageId?: string) => string
    // @step: [优先 languageId] 如果 languageId 存在，映射到语言名称
    // @step: [检测扩展名] 从 filePath 提取扩展名，映射到语言名称
    // @step: [兜底] 无法识别时返回 'TypeScript'
    detectLanguage(filePath, languageId) {
        if (languageId) {
            const languageMap = {
                'typescript': 'TypeScript',
                'javascript': 'JavaScript',
                'python': 'Python',
                'go': 'Go',
                'rust': 'Rust',
                'java': 'Java',
                'cpp': 'C++',
                'c': 'C',
                'csharp': 'C#',
                'swift': 'Swift',
                'kotlin': 'Kotlin',
                'ruby': 'Ruby',
                'php': 'PHP'
            };
            return languageMap[languageId] || 'TypeScript';
        }
        if (filePath) {
            const ext = filePath.split('.').pop()?.toLowerCase();
            const extMap = {
                'ts': 'TypeScript',
                'js': 'JavaScript',
                'py': 'Python',
                'go': 'Go',
                'rs': 'Rust',
                'java': 'Java',
                'cpp': 'C++',
                'c': 'C',
                'cs': 'C#',
                'swift': 'Swift',
                'kt': 'Kotlin',
                'rb': 'Ruby',
                'php': 'PHP'
            };
            return extMap[ext || ''] || 'TypeScript';
        }
        return 'TypeScript';
    }
    // @end
    // @contract: getCommentPrefix(language: string) => string
    // @step: [映射] 根据语言返回对应的注释前缀
    // @step: [返回] 返回注释前缀
    getCommentPrefix(language) {
        const prefixMap = {
            'TypeScript': '//',
            'JavaScript': '//',
            'Python': '#',
            'Go': '//',
            'Rust': '//',
            'Java': '//',
            'C++': '//',
            'C': '//',
            'C#': '//',
            'Swift': '//',
            'Kotlin': '//',
            'Ruby': '#',
            'PHP': '//'
        };
        return prefixMap[language] || '//';
    }
    // @contract: extractValidComments(output: string, commentPrefix: string) => string
    // @step: [查找起点] 找到第一个包含 @contract: 的注释行
    // @step: [提取块] 从起点开始提取连续的注释行，直到 @end
    // @step: [验证格式] 确保每行都是注释格式
    // @step: [返回] 返回提取的注释块
    // @boundary: 当未找到 @contract 时，返回空字符串
    extractValidComments(output, commentPrefix) {
        const lines = output.split('\n');
        // 1. 找到第一个 @contract: 行
        let startIndex = -1;
        for (let i = 0; i < lines.length; i++) {
            const trimmed = lines[i].trim();
            if (trimmed.startsWith(commentPrefix) && trimmed.includes('@contract:')) {
                startIndex = i;
                break;
            }
        }
        if (startIndex === -1) {
            return ''; // 没有找到有效的 @contract
        }
        // 2. 从 @contract 开始提取，直到 @end
        const validLines = [];
        for (let i = startIndex; i < lines.length; i++) {
            const trimmed = lines[i].trim();
            // 跳过空行
            if (trimmed === '') {
                continue;
            }
            // 必须是注释格式
            if (!trimmed.startsWith(commentPrefix)) {
                break; // 遇到非注释行，停止
            }
            validLines.push(lines[i]);
            // 遇到 @end，停止
            if (trimmed.includes('@end')) {
                break;
            }
        }
        return validLines.join('\n');
    }
}
exports.TranslatorVM = TranslatorVM;
//# sourceMappingURL=TranslatorVM.js.map