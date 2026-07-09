/**
 * @intent
 * AI API 调用的核心数据服务层。封装 Anthropic SDK 和 OpenAI SDK 的差异。
 * 职责纯粹：只做 API 通信（SDK 调用、重试、超时、响应解析）。
 * 不涉及任何提示词构建——由调用方或 buildSystemPrompt 注册表负责。
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { ConfigurationError, APIError, TimeoutError } from '../../entities/Errors';

/** API 提供商类型 */
export type APIProvider = 'anthropic' | 'openai';

/** API 调用配置 */
export interface APICallConfig {
  apiKey: string;
  provider?: APIProvider;
  baseURL?: string;
  model?: string;
}

/** API 调用结果 */
export interface APICallResult {
  content: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

export class APIService {
  /**
   * @contract
   * 调用 AI API，返回生成的文本内容。
   * 输入：
   *   systemPrompt - 系统提示词（由调用方或 buildSystemPrompt 提供）
   *   userMessage  - 用户消息
   *   config       - API 调用配置（apiKey / provider / baseURL / model）
   * 输出：{ content, usage }
   * @boundary apiKey 为空时抛出 ConfigurationError
   * @boundary 失败后自动重试 1 次（间隔 2s）
   * @boundary 超时 60s 时抛出 TimeoutError
   */
  async call(
    systemPrompt: string,
    userMessage: string,
    config: APICallConfig
  ): Promise<APICallResult> {
    if (!config.apiKey || config.apiKey.trim() === '') {
      throw new ConfigurationError('API Key 未配置');
    }

    const provider = config.provider || this.detectProvider(config.baseURL);

    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        if (provider === 'openai') {
          return await this.callOpenAI(systemPrompt, userMessage, config);
        } else {
          return await this.callAnthropic(systemPrompt, userMessage, config);
        }
      } catch (error: unknown) {
        lastError = error;
        if (attempt === 0) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }

    const errorMessage = lastError instanceof Error ? lastError.message : String(lastError);
    throw new APIError(`API 调用失败: ${errorMessage}`, lastError);
  }

  // ==================== OpenAI ====================

  private async callOpenAI(
    systemPrompt: string,
    userMessage: string,
    config: APICallConfig
  ): Promise<APICallResult> {
    const clientConfig: { apiKey: string; baseURL?: string } = { apiKey: config.apiKey };
    if (config.baseURL) {
      clientConfig.baseURL = config.baseURL;
    }
    const client = new OpenAI(clientConfig);

    const model = config.model || 'gpt-4o-mini';

    const response = await Promise.race([
      client.chat.completions.create({
        model,
        max_tokens: 8192,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new TimeoutError('API 调用超时（60s）')), 60000)
      ),
    ]) as OpenAI.Chat.Completions.ChatCompletion;

    if (!response.choices || response.choices.length === 0) {
      let errorMsg = 'API 返回空响应';
      if (response.id === '' && response.created === 0) {
        errorMsg += '（可能是速率限制或配额用完）';
      }
      throw new APIError(errorMsg);
    }

    const content = response.choices[0].message.content || '';
    if (!content || content.trim() === '') {
      throw new APIError('API 返回空内容（可能是内容被过滤或模型拒绝生成）');
    }

    return {
      content,
      usage: {
        inputTokens: response.usage?.prompt_tokens || 0,
        outputTokens: response.usage?.completion_tokens || 0,
      },
    };
  }

  // ==================== Anthropic ====================

  private async callAnthropic(
    systemPrompt: string,
    userMessage: string,
    config: APICallConfig
  ): Promise<APICallResult> {
    const clientConfig: { apiKey: string; baseURL?: string } = { apiKey: config.apiKey };
    if (config.baseURL) {
      clientConfig.baseURL = config.baseURL;
    }
    const client = new Anthropic(clientConfig);

    const model = config.model || 'claude-sonnet-4-20250514';

    const response = await Promise.race([
      client.messages.create({
        model,
        max_tokens: 8192,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new TimeoutError('API 调用超时（60s）')), 60000)
      ),
    ]) as Anthropic.Message;

    const content = response.content[0].type === 'text' ? response.content[0].text : '';

    return {
      content,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  }

  // ==================== 工具方法 ====================

  /**
   * @contract
   * 根据 baseURL 自动检测 API 提供商。
   * 输入：baseURL - 可选的 API 地址
   * 输出：'openai' | 'anthropic'
   */
  private detectProvider(baseURL?: string): APIProvider {
    if (!baseURL) {
      return 'openai';
    }

    const url = baseURL.toLowerCase();
    if (
      url.includes('openai') ||
      url.includes('v1/chat') ||
      url.includes('modelscope') ||
      url.includes('deepseek')
    ) {
      return 'openai';
    }

    return 'anthropic';
  }
}
