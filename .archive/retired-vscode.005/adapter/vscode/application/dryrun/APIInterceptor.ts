import { APIService, APICallConfig, APICallResult } from '../../../../data/services/aiAPIservice/APIService';
import { build as buildSystemPrompt } from '../../../../data/services/aiAPIservice/buildSystemPrompt';
import { DryRunManager } from './DryRunManager';

// 本地类型定义（向后兼容旧 ClaudeAPIRequest 接口）
interface ClaudeAPIRequest {
  role: string;
  userMessage: string;
  compileSpec?: string;
}

interface ClaudeAPIResponse {
  content: string;
  usage: { inputTokens: number; outputTokens: number };
}

type APIProvider = 'anthropic' | 'openai';

/**
 * @intent
 * APIService 的装饰器，在 Dry Run 启用时拦截 AI API 请求并委托给 DryRunManager 保存，不调用真实 API。
 * 边界：拦截模式下不调用真实 AI 服务
 */
export class APIInterceptor {
  private apiService: APIService;
  private dryRunManager: DryRunManager;

  constructor(apiService: APIService, dryRunManager: DryRunManager) {
    this.apiService = apiService;
    this.dryRunManager = dryRunManager;
  }

  // @contract: callAPI(request: ClaudeAPIRequest, apiKey: string, baseURL?: string, modelId?: string, provider?: APIProvider) => Promise<ClaudeAPIResponse>
  // @step: [检查 Dry Run 状态] 调用 dryRunManager.isEnabled()
  // @step: [拦截模式] 如果启用，构建系统提示词并调用 dryRunManager.intercept()，返回模拟响应
  // @step: [正常模式] 如果未启用，直接调用 apiService.call()
  // @boundary: 拦截模式下不调用真实 API
  async callAPI(
    request: ClaudeAPIRequest,
    apiKey: string,
    baseURL?: string,
    modelId?: string,
    provider?: APIProvider
  ): Promise<ClaudeAPIResponse> {
    const systemPrompt = buildSystemPrompt(request.role, request.compileSpec);
    const userMessage = request.userMessage;

    if (this.dryRunManager.isEnabled()) {
      // Dry Run 模式：拦截请求
      await this.dryRunManager.intercept(request.role, systemPrompt, userMessage);

      return {
        content: '[Dry Run] Request intercepted and saved',
        usage: { inputTokens: 0, outputTokens: 0 }
      };
    }

    // 正常模式：调用真实 API
    const config: APICallConfig = { apiKey, provider, baseURL, model: modelId };
    const result = await this.apiService.call(systemPrompt, userMessage, config);
    return {
      content: result.content,
      usage: result.usage,
    };
  }
}
