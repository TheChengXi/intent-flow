import { IUseCase } from '../../../../application/useCases/IUseCase';
import { IAIService, AIRequest } from '../services/IAIService';
import { IFileRepository } from '../../../../data/repositories/IFileRepository';

// @intent: VSCode 特定用例 - 规划任务，生成实施步骤

// @entity: PlanTaskInput
// 任务规划输入参数
export interface PlanTaskInput {
  task: string;
  context?: string;
}

// @entity: PlanTaskOutput
// 任务规划输出结果
export interface PlanTaskOutput {
  plan: string;
  steps: string[];
}

export class PlanTaskUseCase implements IUseCase<PlanTaskInput, PlanTaskOutput> {
  constructor(
    private aiService: IAIService,
    private fileRepo: IFileRepository
  ) {}

  // @contract: execute(input: PlanTaskInput) => Promise<PlanTaskOutput>
  // @step: [验证输入] 检查任务是否为空
  // @step: [构建 AI 请求] 构建任务规划请求的 systemPrompt 和 userMessage
  // @step: [调用 AI] 通过 aiService.generate 生成规划
  // @step: [解析步骤] 从 AI 返回内容中提取步骤列表
  // @step: [返回结果] 返回规划文本和步骤列表
  // @boundary: 当任务为空时，抛出 ValidationError
  async execute(input: PlanTaskInput): Promise<PlanTaskOutput> {
    if (!input.task || input.task.trim() === '') {
      throw new Error('任务为空，无法规划');
    }

    const aiRequest = this.buildAIRequest(input);
    const aiResponse = await this.aiService.generate(aiRequest);
    const steps = this.extractSteps(aiResponse.content);

    return {
      plan: aiResponse.content,
      steps
    };
  }

  private buildAIRequest(input: PlanTaskInput): AIRequest {
    const systemPrompt = `你是任务规划员。将任务分解为可执行的步骤。

输出格式：
1. 任务概述
2. 实施步骤（编号列表）
3. 注意事项

保持简洁，每个步骤一句话。`;

    let userMessage = `请规划以下任务：\n\n${input.task}`;
    if (input.context) {
      userMessage += `\n\n上下文：\n${input.context}`;
    }

    return {
      systemPrompt,
      userMessage,
      options: { maxTokens: 2048, temperature: 0.7 }
    };
  }

  private extractSteps(content: string): string[] {
    const lines = content.split('\n');
    const steps: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      const match = trimmed.match(/^(\d+\.|[-*])\s+(.+)$/);
      if (match) {
        steps.push(match[2].trim());
      }
    }

    return steps;
  }
}
// @end
