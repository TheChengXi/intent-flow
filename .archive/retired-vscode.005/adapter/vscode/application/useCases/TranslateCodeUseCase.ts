import { IUseCase } from '../../../../application/useCases/IUseCase';
import { IAIService, AIRequest } from '../services/IAIService';
import { IFileRepository } from '../../../../data/repositories/IFileRepository';
import { LogicUnclearError } from '../../../../data/entities/Errors';

// @intent: VSCode 特定用例 - 将代码转译为 CDD 格式的注释

// @entity: TranslateCodeInput
// 转译输入参数
export interface TranslateCodeInput {
  code: string;
  compileSpec: string;
  filePath?: string;
  languageId?: string;
  targetLanguage?: string;
  existingComment?: string;
  functionName?: string;
}

// @entity: TranslateCodeOutput
// 转译输出结果
export interface TranslateCodeOutput {
  comments: string;
  needsReview: boolean;
}

export class TranslateCodeUseCase implements IUseCase<TranslateCodeInput, TranslateCodeOutput> {
  constructor(
    private aiService: IAIService,
    private fileRepo: IFileRepository
  ) {}

  // @contract: execute(input: TranslateCodeInput) => Promise<TranslateCodeOutput>
  // @step: [验证输入] 检查代码是否为空
  // @step: [检测语言] 从 targetLanguage、languageId 或 filePath 检测目标语言
  // @step: [构建 AI 请求] 构建转译请求的 systemPrompt 和 userMessage
  // @step: [调用 AI] 通过 aiService.generate 生成注释
  // @step: [检查 BACKTRACK] 检查 AI 是否返回 <<BACKTRACK>>
  // @step: [清理输出] 去除代码块标记、解释文本等
  // @step: [提取注释] 提取有效的 CDD 注释块
  // @step: [返回结果] 返回生成的注释文本
  // @boundary: 当代码为空时，抛出 ValidationError
  // @boundary: 当 AI 返回 <<BACKTRACK>> 时，抛出 LogicUnclearError
  async execute(input: TranslateCodeInput): Promise<TranslateCodeOutput> {
    // 1. 验证输入
    if (!input.code || input.code.trim() === '') {
      throw new Error('代码为空，无法转译');
    }

    // 2. 检测语言
    const language = this.detectLanguage(input.filePath, input.languageId, input.targetLanguage);
    const commentPrefix = this.getCommentPrefix(language);

    // 3. 构建 AI 请求
    const aiRequest = this.buildAIRequest(input, language);

    // 4. 调用 AI 服务
    const aiResponse = await this.aiService.generate(aiRequest);

    // 5. 检查 BACKTRACK
    if (aiResponse.content.includes('<<BACKTRACK>>')) {
      const reason = aiResponse.content.replace('<<BACKTRACK>>', '').trim();
      throw new LogicUnclearError(reason || '无法转译代码');
    }

    // 6. 清理输出
    let comments = this.cleanOutput(aiResponse.content);

    // 7. 提取有效注释
    comments = this.extractValidComments(comments, commentPrefix);

    if (!comments) {
      throw new Error('未找到有效的 CDD 注释块');
    }

    // 8. 返回结果
    return {
      comments,
      needsReview: true
    };
  }

  // @contract: detectLanguage(filePath?: string, languageId?: string, targetLanguage?: string) => string
  // @step: [优先 targetLanguage] 如果 targetLanguage 存在，直接返回
  // @step: [优先 languageId] 如果 languageId 存在，映射到语言名称
  // @step: [检测扩展名] 从 filePath 提取扩展名，映射到语言名称
  // @step: [兜底] 无法识别时返回 'TypeScript'
  private detectLanguage(filePath?: string, languageId?: string, targetLanguage?: string): string {
    if (targetLanguage) {
      return targetLanguage;
    }

    if (languageId) {
      const languageMap: Record<string, string> = {
        'typescript': 'TypeScript',
        'javascript': 'JavaScript',
        'python': 'Python',
        'go': 'Go',
        'rust': 'Rust',
        'java': 'Java',
        'cpp': 'C++',
        'c': 'C'
      };
      return languageMap[languageId] || 'TypeScript';
    }

    if (filePath) {
      const ext = filePath.split('.').pop()?.toLowerCase();
      const extMap: Record<string, string> = {
        'ts': 'TypeScript',
        'js': 'JavaScript',
        'py': 'Python',
        'go': 'Go',
        'rs': 'Rust',
        'java': 'Java',
        'cpp': 'C++',
        'c': 'C'
      };
      return extMap[ext || ''] || 'TypeScript';
    }

    return 'TypeScript';
  }

  // @contract: getCommentPrefix(language: string) => string
  // @step: [映射] 根据语言返回注释前缀
  // @boundary: 默认返回 '//'
  private getCommentPrefix(language: string): string {
    const prefixMap: Record<string, string> = {
      'Python': '#',
      'Ruby': '#',
      'Shell': '#',
      'Bash': '#'
    };
    return prefixMap[language] || '//';
  }

  // @contract: buildAIRequest(input: TranslateCodeInput, language: string) => AIRequest
  // @step: [构建系统提示词] 定义转译员的角色和行为
  // @step: [构建上下文] 如果有 existingComment 或 functionName，添加到 userMessage
  // @step: [构建用户消息] 组合代码、语言、上下文
  // @step: [返回请求] 返回完整的 AIRequest
  private buildAIRequest(input: TranslateCodeInput, language: string): AIRequest {
    const systemPrompt = this.buildSystemPrompt();

    // 构建上下文
    let contextText = '';
    if (input.existingComment || input.functionName) {
      contextText = '\n\ncontext:\n';
      if (input.existingComment) {
        contextText += `existingComment:\n${input.existingComment}\n`;
      }
      if (input.functionName) {
        contextText += `functionName: ${input.functionName}\n`;
      }
    }

    const userMessage = this.buildUserMessage(input.code, language, contextText);

    return {
      systemPrompt,
      userMessage,
      options: {
        maxTokens: 4096,
        temperature: 0.5
      }
    };
  }

  // @contract: buildSystemPrompt() => string
  // @step: [基础提示词] 定义转译员的角色和行为
  // @step: [添加格式规范] 说明 CDD v2.4.1 格式
  // @step: [返回] 返回完整的系统提示词
  private buildSystemPrompt(): string {
    return `你是 CDD 转译员。将代码转译为 CDD 格式的注释。

重要格式规范：
1. 必须严格按照 CDD v2.4.1 格式输出
2. @contract 格式：functionName(param1: Type1, param2: Type2) => ReturnType
3. @step 格式：[意图] 描述
4. @boundary 格式：当<条件>时，应<动作>
5. 每个注释独占一行，以 // 或 # 开头
6. 不要输出文档注释格式（/** */）
7. 不要解释代码，只提取意图

示例输出：
// @contract: add(a: number, b: number) => number
// @step: [验证] 检查参数类型
// @step: [计算] 返回 a + b
// @boundary: 当参数不是数字时，抛出 TypeError

如果代码逻辑不清晰，无法提取意图，返回：<<BACKTRACK>> 原因`;
  }

  // @contract: buildUserMessage(code: string, language: string, contextText: string) => string
  // @step: [构建标题] 添加转译任务标题
  // @step: [添加代码] 添加待转译的代码
  // @step: [添加上下文] 如果有上下文，添加到消息
  // @step: [返回] 返回完整的用户消息
  private buildUserMessage(code: string, language: string, contextText: string): string {
    let message = `请将以下 ${language} 代码转译为 CDD 注释：\n\n`;
    message += `\`\`\`${language.toLowerCase()}\n${code}\n\`\`\``;

    if (contextText) {
      message += contextText;
    }

    return message;
  }

  // @contract: cleanOutput(content: string) => string
  // @step: [清理代码块] 去除 ``` 标记
  // @step: [清理标题] 去除 Markdown 标题（不包含 CDD 注释）
  // @step: [清理加粗] 去除 ** 标记
  // @step: [清理完成标记] 去除 ✅、Done 等标记
  // @step: [返回] 返回清理后的内容
  private cleanOutput(content: string): string {
    let cleaned = content.trim();

    // 清理代码块标记
    cleaned = cleaned.replace(/^```[\w]*\n/gm, '').replace(/\n```$/gm, '');

    // 清理 Markdown 标题（不包含 CDD 注释）
    cleaned = cleaned.replace(/^#+\s+(?!@contract|@step|@boundary|@end).*$/gm, '');

    // 清理加粗
    cleaned = cleaned.replace(/\*\*.*?\*\*/g, '');

    // 清理完成标记
    cleaned = cleaned.replace(/[✅✓]\s*(转译完成|完成|Done|Completed).*/gi, '');

    return cleaned.trim();
  }

  // @contract: extractValidComments(content: string, commentPrefix: string) => string
  // @step: [分割行] 将内容按行分割
  // @step: [过滤有效行] 只保留以 commentPrefix 开头且包含 CDD 标记的行
  // @step: [拼接] 将有效行拼接为字符串
  // @step: [返回] 返回有效的 CDD 注释块
  // @boundary: 当没有有效行时，返回空字符串
  private extractValidComments(content: string, commentPrefix: string): string {
    const lines = content.split('\n');
    const validLines: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      // 检查是否是有效的 CDD 注释行
      if (trimmed.startsWith(commentPrefix)) {
        const commentContent = trimmed.substring(commentPrefix.length).trim();

        // 检查是否包含 CDD 标记
        if (
          commentContent.startsWith('@contract:') ||
          commentContent.startsWith('@step:') ||
          commentContent.startsWith('@boundary:') ||
          commentContent.startsWith('@end')
        ) {
          validLines.push(line);
        }
      }
    }

    return validLines.join('\n');
  }
}
// @end
