import { IUseCase } from '../../../../application/useCases/IUseCase';
import { IAIService, AIRequest } from '../services/IAIService';
import { IFileRepository } from '../../../../data/repositories/IFileRepository';

// @intent: VSCode 特定用例 - 将自然语言需求转译为 CDD 格式的注释

// @entity: TranslateRequirementInput
// 需求转译输入参数
export interface TranslateRequirementInput {
  requirement: string;
  targetLanguage?: string;
}

// @entity: TranslateRequirementOutput
// 需求转译输出结果
export interface TranslateRequirementOutput {
  comments: string;
  needsReview: boolean;
}

export class TranslateRequirementUseCase implements IUseCase<TranslateRequirementInput, TranslateRequirementOutput> {
  constructor(
    private aiService: IAIService,
    private fileRepo: IFileRepository
  ) {}

  // @contract: execute(input: TranslateRequirementInput) => Promise<TranslateRequirementOutput>
  // @step: [验证输入] 检查需求是否为空
  // @step: [检测语言] 确定目标语言，默认为 TypeScript
  // @step: [构建 AI 请求] 构建需求转译请求的 systemPrompt 和 userMessage
  // @step: [调用 AI] 通过 aiService.generate 生成注释
  // @step: [清理输出] 去除代码块标记、解释文本等
  // @step: [提取注释] 提取有效的 CDD 注释块
  // @step: [返回结果] 返回生成的注释文本
  // @boundary: 当需求为空时，抛出 ValidationError
  async execute(input: TranslateRequirementInput): Promise<TranslateRequirementOutput> {
    if (!input.requirement || input.requirement.trim() === '') {
      throw new Error('需求为空，无法转译');
    }

    const language = input.targetLanguage || 'TypeScript';
    const commentPrefix = this.getCommentPrefix(language);
    const aiRequest = this.buildAIRequest(input, language);
    const aiResponse = await this.aiService.generate(aiRequest);
    let comments = this.cleanOutput(aiResponse.content);
    comments = this.extractValidComments(comments, commentPrefix);

    if (!comments) {
      throw new Error('未找到有效的 CDD 注释块');
    }

    return { comments, needsReview: true };
  }

  private getCommentPrefix(language: string): string {
    const prefixMap: Record<string, string> = {
      'Python': '#', 'Ruby': '#', 'Shell': '#', 'Bash': '#'
    };
    return prefixMap[language] || '//';
  }

  private buildAIRequest(input: TranslateRequirementInput, language: string): AIRequest {
    return {
      systemPrompt: `你是 CDD 需求转译员。将自然语言需求转译为 CDD 格式的注释。

重要格式规范：
1. 必须严格按照 CDD v2.4.1 格式输出
2. @contract 格式：functionName(param1: Type1, param2: Type2) => ReturnType
3. @step 格式：[意图] 描述
4. @boundary 格式：当<条件>时，应<动作>
5. 每个注释独占一行，以 // 或 # 开头
6. 根据需求推断合理的函数名、参数、返回类型`,
      userMessage: `请将以下需求转译为 ${language} 的 CDD 注释：\n\n需求：${input.requirement}`,
      options: { maxTokens: 4096, temperature: 0.5 }
    };
  }

  private cleanOutput(content: string): string {
    return content.trim()
      .replace(/^```[\w]*\n/gm, '').replace(/\n```$/gm, '')
      .replace(/^#+\s+(?!@contract|@step|@boundary|@end).*$/gm, '')
      .replace(/\*\*.*?\*\*/g, '')
      .replace(/[✅✓]\s*(转译完成|完成|Done|Completed).*/gi, '')
      .trim();
  }

  private extractValidComments(content: string, commentPrefix: string): string {
    const lines = content.split('\n');
    const validLines: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith(commentPrefix)) {
        const commentContent = trimmed.substring(commentPrefix.length).trim();
        if (commentContent.startsWith('@contract:') || commentContent.startsWith('@step:') ||
            commentContent.startsWith('@boundary:') || commentContent.startsWith('@end')) {
          validLines.push(line);
        }
      }
    }
    return validLines.join('\n');
  }
}
// @end
