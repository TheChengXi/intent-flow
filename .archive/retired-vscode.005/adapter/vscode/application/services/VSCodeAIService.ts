import { IAIService, AIRequest, AIResponse, AIUsage } from './IAIService';
import { APIService, APICallConfig } from '../../../../data/services/aiAPIservice/APIService';
import { build as buildSystemPrompt } from '../../../../data/services/aiAPIservice/buildSystemPrompt';
import { VSCodeConfigAdapter } from '../config/VSCodeConfigAdapter';
import { APIError, ConfigurationError } from '../../../../data/entities/Errors';

// @intent: VSCode 适配器的 AI 服务实现。通过 VSCodeConfigAdapter 获取 API Key/Base URL/Model 配置，调用 ClaudeAPIService 并将响应适配为 IAIService 的 AIResponse 格式

export class VSCodeAIService implements IAIService {
  private apiService: APIService;
  private configAdapter: VSCodeConfigAdapter;

  constructor(configAdapter: VSCodeConfigAdapter) {
    this.configAdapter = configAdapter;
    this.apiService = new APIService();
  }

  // @contract: generate(request: AIRequest) => Promise<AIResponse>
  // @step: [读取配置] 从 VSCodeConfigAdapter 读取 API Key、Base URL、Model ID
  // @step: [验证配置] 检查 API Key 是否存在
  // @step: [构建请求] 将 AIRequest 转换为 ClaudeAPIRequest
  // @step: [调用 API] 调用 ClaudeAPIService.callAPI
  // @step: [转换响应] 将 ClaudeAPIResponse 转换为 AIResponse
  // @step: [返回结果] 返回标准化的 AIResponse
  // @boundary: 当 API Key 不存在时，抛出 ConfigurationError
  // @boundary: 当 API 调用失败时，抛出 APIError
  async generate(request: AIRequest): Promise<AIResponse> {
    // 1. 读取配置
    const apiKey = this.configAdapter.get<string>('apiKey');
    const apiBaseUrl = this.configAdapter.get<string>('apiBaseUrl');
    const modelId = this.configAdapter.get<string>('modelId');

    // 2. 验证配置
    if (!apiKey || apiKey.trim() === '') {
      throw new ConfigurationError('API Key 未配置。请在 VSCode 设置中配置 cdd.apiKey');
    }

    // 3. 构建 system prompt + 调用 API
    const role = this.inferRole(request);
    const systemPrompt = buildSystemPrompt(role);
    const userMessage = request.userMessage;

    const config: APICallConfig = {
      apiKey,
      baseURL: apiBaseUrl,
      model: modelId,
    };

    // 4. 调用 APIService
    try {
      const result = await this.apiService.call(systemPrompt, userMessage, config);

      // 5. 转换响应
      const response: AIResponse = {
        content: result.content,
        usage: {
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          totalTokens: result.usage.inputTokens + result.usage.outputTokens
        },
        metadata: {
          modelId: modelId || 'claude-sonnet-4-20250514',
          apiBaseUrl: apiBaseUrl || 'default'
        }
      };

      return response;
    } catch (error: any) {
      // 包装错误，提供更友好的错误信息
      if (error instanceof ConfigurationError || error instanceof APIError) {
        throw error;
      }
      throw new APIError(`AI 服务调用失败: ${error.message}`, error);
    }
  }

  // @contract: inferRole(request: AIRequest) => string
  // @step: [分析提示词] 根据 systemPrompt 推断角色
  // @step: [返回角色] 返回角色字符串
  // @boundary: 默认返回 'development-assistant'
  private inferRole(request: AIRequest): 'compiler' | 'reviewer' | 'translator' | 'development-assistant' {
    const systemPrompt = request.systemPrompt.toLowerCase();

    if (systemPrompt.includes('编译') || systemPrompt.includes('compile')) {
      return 'compiler';
    }
    if (systemPrompt.includes('审查') || systemPrompt.includes('review')) {
      return 'reviewer';
    }
    if (systemPrompt.includes('转译') || systemPrompt.includes('translate')) {
      return 'translator';
    }

    return 'development-assistant';
  }

  // @contract: buildUserMessage(request: AIRequest) => string
  // @step: [组合消息] 将 systemPrompt 和 userMessage 组合
  // @step: [返回消息] 返回完整的用户消息
  // @note: ClaudeAPIService 期望 systemPrompt 和 userMessage 分开传递
  // @note: 但 IAIService 接口将它们合并，这里需要适配
  private buildUserMessage(request: AIRequest): string {
    // 注意：这里简化处理，实际上 ClaudeAPIService 会分别处理 systemPrompt 和 userMessage
    // 但由于 ClaudeAPIRequest 的设计，我们只需要传递 userMessage
    return request.userMessage;
  }
}
