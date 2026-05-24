import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { ConfigurationError, APIError, TimeoutError } from '../entities/Errors';
import { COMPILER_PROMPT, REVIEWER_PROMPT, TRANSLATOR_PROMPT, REQUIREMENT_TRANSLATOR_PROMPT } from '../../generated/prompts';

// @entity: ClaudeAPIRequest
// API 请求参数
export interface ClaudeAPIRequest {
  role: 'compiler' | 'reviewer' | 'translator' | 'code-translator' | 'development-assistant' | 'requirement-translator';
  userMessage: string;  // 完整的用户消息，由各 VM 自行构建
  compileSpec?: string; // 编译规范（仅 compiler 和 reviewer 使用）
  conversationHistory?: any[]; // 对话历史（仅 development-assistant 使用）
}

// @entity: ClaudeAPIResponse
// API 响应结果
export interface ClaudeAPIResponse {
  content: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

// @entity: APIProvider
// API 提供商类型
export type APIProvider = 'anthropic' | 'openai';

export class ClaudeAPIService {
  // @contract: callAPI(request: ClaudeAPIRequest, apiKey: string, baseURL?: string, modelId?: string, provider?: APIProvider) => Promise<ClaudeAPIResponse>
  // @step: [验证输入] 检查 apiKey 是否为空
  // @step: [检测提供商] 根据 baseURL 或 provider 参数判断使用哪个 API 格式
  // @step: [构建系统提示] 根据 role 和 compileSpec 构建不同的 system prompt
  // @step: [获取用户消息] 直接使用 request.userMessage
  // @step: [调用对应 API] 根据提供商调用 Anthropic 或 OpenAI 格式的 API
  // @step: [重试逻辑] 失败后等待 2 秒重试 1 次（BR-006）
  // @step: [解析响应] 提取 content 和 usage 信息
  // @boundary: 当 apiKey 为空时，抛出 ConfigurationError
  // @boundary: 当重试后仍失败时，抛出 APIError 包含原始错误信息
  // @boundary: 当响应超时（30s）时，抛出 TimeoutError
  async callAPI(request: ClaudeAPIRequest, apiKey: string, baseURL?: string, modelId?: string, provider?: APIProvider): Promise<ClaudeAPIResponse> {
    if (!apiKey || apiKey.trim() === '') {
      throw new ConfigurationError('API Key 未配置');
    }

    // 自动检测提供商
    const detectedProvider = provider || this.detectProvider(baseURL);

    const systemPrompt = this.buildSystemPrompt(request.role, request.compileSpec);
    const userMessage = request.userMessage;

    let lastError: any;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        if (detectedProvider === 'openai') {
          return await this.callOpenAI(userMessage, systemPrompt, apiKey, baseURL, modelId);
        } else {
          return await this.callAnthropic(userMessage, systemPrompt, apiKey, baseURL, modelId);
        }
      } catch (error: any) {
        lastError = error;
        if (attempt === 0) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }

    throw new APIError(`API 调用失败: ${lastError.message}`, lastError);
  }
  // @end

  // @contract: detectProvider(baseURL?: string) => APIProvider
  // @step: [检查 URL] 如果 baseURL 包含 'openai' 或 'v1/chat/completions'，返回 'openai'
  // @step: [检查 URL] 如果 baseURL 包含 'modelscope' 或 'deepseek'，返回 'openai'
  // @step: [默认] 返回 'anthropic'
  private detectProvider(baseURL?: string): APIProvider {
    if (!baseURL) {
      return 'anthropic';
    }

    const url = baseURL.toLowerCase();
    if (url.includes('openai') || url.includes('v1/chat') || url.includes('modelscope') || url.includes('deepseek')) {
      return 'openai';
    }

    return 'anthropic';
  }
  // @end

  

  // @contract: callAnthropic(userMessage: string, systemPrompt: string, apiKey: string, baseURL?: string, modelId?: string) => Promise<ClaudeAPIResponse>
  // @step: [配置客户端] 创建 Anthropic 客户端
  // @step: [调用 API] 调用 messages.create
  // @step: [解析响应] 提取 content 和 usage
  // @step: [返回] 返回标准响应格式
  private async callAnthropic(userMessage: string, systemPrompt: string, apiKey: string, baseURL?: string, modelId?: string): Promise<ClaudeAPIResponse> {
    const clientConfig: any = { apiKey };
    if (baseURL) {
      clientConfig.baseURL = baseURL;
    }
    const client = new Anthropic(clientConfig);

    const model = modelId || 'claude-sonnet-4-20250514';

    const response = await Promise.race([
      client.messages.create({
        model: model,
        max_tokens: 8192,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }]
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new TimeoutError('API 调用超时（60s）')), 60000)
      )
    ]) as Anthropic.Message;

    const content = response.content[0].type === 'text' ? response.content[0].text : '';

    return {
      content,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens
      }
    };
  }
  // @end

  // @contract: callOpenAI(userMessage: string, systemPrompt: string, apiKey: string, baseURL?: string, modelId?: string) => Promise<ClaudeAPIResponse>
  // @step: [配置客户端] 创建 OpenAI 客户端
  // @step: [调用 API] 调用 chat.completions.create
  // @step: [解析响应] 提取 content 和 usage
  // @step: [返回] 返回标准响应格式
  // @boundary: 当响应为空时，抛出 APIError
  private async callOpenAI(userMessage: string, systemPrompt: string, apiKey: string, baseURL?: string, modelId?: string): Promise<ClaudeAPIResponse> {
    const clientConfig: any = { apiKey };
    if (baseURL) {
      clientConfig.baseURL = baseURL;
    }
    const client = new OpenAI(clientConfig);

    const model = modelId || 'gpt-4';

    console.log('[CDD] OpenAI API 调用:', {
      baseURL: clientConfig.baseURL,
      model: model,
      hasSystemPrompt: !!systemPrompt,
      userMessageLength: userMessage.length
    });

    try {
      const response = await Promise.race([
        client.chat.completions.create({
          model: model,
          max_tokens: 8192,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ]
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new TimeoutError('API 调用超时（60s）')), 60000)
        )
      ]) as OpenAI.Chat.Completions.ChatCompletion;

      console.log('[CDD] OpenAI API 响应:', {
        hasChoices: !!response.choices,
        choicesLength: response.choices?.length,
        firstChoice: response.choices?.[0],
        usage: response.usage,
        fullResponse: response
      });

      if (!response.choices || response.choices.length === 0) {
        console.error('[CDD] OpenAI API 返回空 choices:', response);

        // 尝试提供更有用的错误信息
        let errorMsg = 'API 返回空响应';
        if (response.id === '' && response.created === 0) {
          errorMsg += '（可能是速率限制或配额用完）';
        }

        throw new APIError(errorMsg + '\n\n建议：\n1. 检查 API 配额是否用完\n2. 尝试切换到 DeepSeek 官方 API (https://api.deepseek.com/v1)\n3. 检查模型 ID 是否正确');
      }

      const content = response.choices[0].message.content || '';

      if (!content || content.trim() === '') {
        console.error('[CDD] OpenAI API 返回空内容:', response.choices[0]);
        throw new APIError('API 返回空内容（可能是内容被过滤或模型拒绝生成）');
      }

      return {
        content,
        usage: {
          inputTokens: response.usage?.prompt_tokens || 0,
          outputTokens: response.usage?.completion_tokens || 0
        }
      };
    } catch (error: any) {
      console.error('[CDD] OpenAI API 错误:', {
        message: error.message,
        status: error.status,
        code: error.code,
        type: error.type
      });
      throw error;
    }
  }
  // @end

  // @contract: buildSystemPrompt(role: string, compileSpec?: string) => string
  // @step: [选择模板] 根据 role 返回对应的系统提示词
  // @step: [编译器] 返回范式定义的编译器提示词 + 工程补充规则
  // @step: [审查员] 返回范式定义的审查员提示词
  // @step: [转译员] 返回范式定义的转译员提示词 + 工程补充规则
  // @step: [需求转译器] 返回需求转译器提示词
  // @step: [追加规范] 如果 role 是 compiler 或 reviewer 且 compileSpec 存在，追加到系统提示词
  // @boundary: 当 role 未知时，返回通用提示词
  private buildSystemPrompt(role: string, compileSpec?: string): string {
    let prompt = '';

    switch (role) {
      case 'compiler':
        prompt = COMPILER_PROMPT + '\n\n重要：只输出纯代码，不要包含任何注释（包括原始的 @contract、@step、@boundary 注释），不要添加代码块标记（```），不要解释。直接输出可执行的代码。';
        break;
      case 'reviewer':
        prompt = REVIEWER_PROMPT;
        break;
      case 'translator':
        prompt = TRANSLATOR_PROMPT + '\n\n重要格式规范：\n1. 必须严格按照 CDD v2.4.1 格式输出\n2. @contract 格式：functionName(param1: Type1, param2: Type2) => ReturnType\n3. @step 格式：[意图] 描述\n4. @boundary 格式：当<条件>时，应<动作>\n5. 每个注释独占一行，以 // 或 # 开头\n6. 不要输出文档注释格式（/** */）\n7. 不要解释代码，只提取意图\n\n示例输出：\n// @contract: add(a: number, b: number) => number\n// @step: [验证] 检查参数类型\n// @step: [计算] 返回 a + b\n// @boundary: 当参数不是数字时，抛出 TypeError';
        break;
      case 'code-translator':
        prompt = '你是代码转译员。将代码的变更同步为注释更新，检测契约冲突。';
        break;
      case 'development-assistant':
        prompt = '你是开发助手。通过多轮对话将用户的模糊需求转化为清晰、无歧义的需求文档。';
        break;
      case 'requirement-translator':
        prompt = REQUIREMENT_TRANSLATOR_PROMPT;
        break;
      default:
        prompt = '你是 CDD 助手。协助用户完成 Comment-Driven Development 相关任务。';
    }

    // 只有 compiler 和 reviewer 才追加 compileSpec
    if ((role === 'compiler' || role === 'reviewer') && compileSpec && compileSpec.trim() !== '') {
      prompt += '\n\n## 项目编译规范\n' + compileSpec;
    }

    return prompt;
  }
  // @end
}
