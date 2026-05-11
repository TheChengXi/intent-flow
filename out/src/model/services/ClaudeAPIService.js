"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClaudeAPIService = void 0;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const Errors_1 = require("../entities/Errors");
class ClaudeAPIService {
    // @contract: callAPI(request: ClaudeAPIRequest, apiKey: string, baseURL?: string, modelId?: string) => Promise<ClaudeAPIResponse>
    // @step: [验证输入] 检查 apiKey 是否为空
    // @step: [构建系统提示] 根据 role 构建不同的 system prompt
    // @step: [构建用户消息] 将 context 和 prompt 组合为用户消息
    // @step: [配置客户端] 使用 apiKey 和可选的 baseURL 创建 Anthropic 客户端
    // @step: [调用 API] 使用指定的 modelId（默认 claude-sonnet-4-20250514），设置 30s 超时
    // @step: [重试逻辑] 失败后等待 2 秒重试 1 次（BR-006）
    // @step: [解析响应] 提取 content 和 usage 信息
    // @boundary: 当 apiKey 为空时，抛出 ConfigurationError
    // @boundary: 当重试后仍失败时，抛出 APIError 包含原始错误信息
    // @boundary: 当响应超时（30s）时，抛出 TimeoutError
    async callAPI(request, apiKey, baseURL, modelId) {
        if (!apiKey || apiKey.trim() === '') {
            throw new Errors_1.ConfigurationError('API Key 未配置');
        }
        const systemPrompt = this.buildSystemPrompt(request.role);
        let userMessage = '';
        if (request.context.comment) {
            userMessage += `## 注释\n${request.context.comment}\n\n`;
        }
        if (request.context.code) {
            userMessage += `## 代码\n${request.context.code}\n\n`;
        }
        if (request.context.compileSpec) {
            userMessage += `## 编译规范\n${request.context.compileSpec}\n\n`;
        }
        if (request.context.businessRules) {
            userMessage += `## 业务规则\n${request.context.businessRules}\n\n`;
        }
        userMessage += `## 任务\n${request.prompt}`;
        const clientConfig = { apiKey };
        if (baseURL) {
            clientConfig.baseURL = baseURL;
        }
        const client = new sdk_1.default(clientConfig);
        const model = modelId || 'claude-sonnet-4-20250514';
        let lastError;
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                const response = await Promise.race([
                    client.messages.create({
                        model: model,
                        max_tokens: 8192,
                        system: systemPrompt,
                        messages: [{ role: 'user', content: userMessage }]
                    }),
                    new Promise((_, reject) => setTimeout(() => reject(new Errors_1.TimeoutError('API 调用超时（30s）')), 30000))
                ]);
                const content = response.content[0].type === 'text' ? response.content[0].text : '';
                return {
                    content,
                    usage: {
                        inputTokens: response.usage.input_tokens,
                        outputTokens: response.usage.output_tokens
                    }
                };
            }
            catch (error) {
                lastError = error;
                if (attempt === 0) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
        }
        throw new Errors_1.APIError(`API 调用失败: ${lastError.message}`, lastError);
    }
    // @end
    // @contract: buildSystemPrompt(role: string) => string
    // @step: [选择模板] 根据 role 返回对应的系统提示词
    // @step: [编译器] 返回"你是编译器，根据注释生成代码，严格遵循 COMPILE_SPEC"
    // @step: [审查员] 返回"你是审查员，以注释为标尺审查代码，输出审查报告"
    // @step: [转译员] 返回"你是转译员，将代码逆向生成 CDD 注释，必须严格遵循格式"
    // @boundary: 当 role 未知时，返回通用提示词
    buildSystemPrompt(role) {
        switch (role) {
            case 'compiler':
                return '你是编译器。根据 CDD 注释生成代码。\n\n重要：只输出纯代码，不要包含任何注释（包括原始的 @contract、@step、@boundary 注释），不要添加代码块标记（```），不要解释。直接输出可执行的代码。\n\n如果提供了 COMPILE_SPEC，严格遵循其中的规范。如果没有提供，使用该语言的标准最佳实践。\n\n如果注释中引用了未定义的类型（如 User、Order 等），不要自己猜测定义，而应该在代码中添加注释说明需要用户提供类型定义。';
            case 'reviewer':
                return '你是代码审查员。以注释为标尺审查代码，检查一致性。输出审查报告，包含通过项、偏离项、违规项。';
            case 'translator':
                return '你是代码转译员。将代码逆向生成 CDD 格式注释。\n\n重要规则：\n1. 必须严格按照 CDD v2.4.1 格式输出\n2. @contract 格式：functionName(param1: Type1, param2: Type2) => ReturnType\n3. @step 格式：[意图] 描述\n4. @boundary 格式：当<条件>时，应<动作>\n5. 每个注释独占一行，以 // 或 # 开头\n6. 不要输出文档注释格式（/** */）\n7. 不要解释代码，只提取意图\n\n示例输出：\n// @contract: add(a: number, b: number) => number\n// @step: [验证] 检查参数类型\n// @step: [计算] 返回 a + b\n// @boundary: 当参数不是数字时，抛出 TypeError';
            case 'code-translator':
                return '你是代码转译员。将代码的变更同步为注释更新，检测契约冲突。';
            case 'planner':
                return '你是迭代规划师。分析变更影响，输出受影响的模块和建议。';
            default:
                return '你是 CDD 助手。协助用户完成 Comment-Driven Development 相关任务。';
        }
    }
}
exports.ClaudeAPIService = ClaudeAPIService;
//# sourceMappingURL=ClaudeAPIService.js.map