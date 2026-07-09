import { IUseCase } from '../../../../application/useCases/IUseCase';
import { IAIService, AIRequest, AIMessage } from '../services/IAIService';
import { IFileRepository } from '../../../../data/repositories/IFileRepository';

// @intent: VSCode 特定用例 - 开发助手多轮对话

// @entity: AssistDevelopmentInput
// 开发助手输入参数
export interface AssistDevelopmentInput {
  userMessage: string;
  conversationHistory?: AIMessage[];
}

// @entity: AssistDevelopmentOutput
// 开发助手输出结果
export interface AssistDevelopmentOutput {
  response: string;
  conversationHistory: AIMessage[];
}

export class AssistDevelopmentUseCase implements IUseCase<AssistDevelopmentInput, AssistDevelopmentOutput> {
  constructor(
    private aiService: IAIService,
    private fileRepo: IFileRepository
  ) {}

  // @contract: execute(input: AssistDevelopmentInput) => Promise<AssistDevelopmentOutput>
  // @step: [验证输入] 检查用户消息是否为空
  // @step: [构建 AI 请求] 构建开发助手请求的 systemPrompt 和 userMessage
  // @step: [调用 AI] 通过 aiService.generate 生成回复
  // @step: [更新历史] 将用户消息和 AI 回复添加到对话历史
  // @step: [返回结果] 返回 AI 回复和更新后的对话历史
  // @boundary: 当用户消息为空时，抛出 ValidationError
  async execute(input: AssistDevelopmentInput): Promise<AssistDevelopmentOutput> {
    if (!input.userMessage || input.userMessage.trim() === '') {
      throw new Error('用户消息为空');
    }

    const aiRequest = this.buildAIRequest(input);
    const aiResponse = await this.aiService.generate(aiRequest);

    const conversationHistory: AIMessage[] = [
      ...(input.conversationHistory || []),
      { role: 'user', content: input.userMessage },
      { role: 'assistant', content: aiResponse.content }
    ];

    return {
      response: aiResponse.content,
      conversationHistory
    };
  }

  private buildAIRequest(input: AssistDevelopmentInput): AIRequest {
    return {
      systemPrompt: `你是开发助手。通过多轮对话将用户的模糊需求转化为清晰、无歧义的需求文档。

你的职责：
1. 理解用户的需求
2. 提出澄清问题
3. 提供技术建议
4. 帮助用户细化需求

保持对话简洁、专业。`,
      userMessage: input.userMessage,
      conversationHistory: input.conversationHistory,
      options: { maxTokens: 2048, temperature: 0.7 }
    };
  }
}
// @end
