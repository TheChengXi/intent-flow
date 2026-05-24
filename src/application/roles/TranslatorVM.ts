// @intent: 将自然语言需求或代码转译为 CDD 格式的注释

import { BaseRole, RoleResult } from './BaseRole';
import { ClaudeAPIService, ClaudeAPIRequest } from '../../data/services/ClaudeAPIService';
import { LogicUnclearError } from '../../data/entities/Errors';

// @entity: TranslateContext
// 转译上下文
export interface TranslateContext {
  code: string;
  compileSpec: string;
  apiKey: string;
  apiBaseUrl?: string;
  modelId?: string;
  lastTranslateResult?: string;
  filePath?: string;
  languageId?: string;
  targetLanguage?: string;
  existingComment?: string;
  functionName?: string;
}

export class TranslatorVM extends BaseRole {
  constructor(apiService: ClaudeAPIService) {
    super(apiService);
  }

  // @contract: execute(context: TranslateContext) => Promise<RoleResult>
  // @step: [验证输入] 检查代码是否为空
  // @step: [检测语言] 从 targetLanguage、languageId 或 filePath 检测目标语言
  // @step: [构建 Prompt] 构建用户消息，包含 code、targetLanguage 和可选的 context
  // @step: [调用 API] 通过 apiService.callAPI 生成注释
  // @step: [检查 BACKTRACK] 检查 API 是否返回 <<BACKTRACK>>
  // @step: [清理输出] 去除代码块标记、解释文本等
  // @step: [提取注释] 提取有效的 CDD 注释块
  // @step: [返回结果] 返回 success: true，artifacts 包含生成的注释文本
  // @boundary: 当代码为空时，返回 success: false 和 ValidationError
  // @boundary: 当 API 返回 <<BACKTRACK>> 时，返回 success: false 和错误信息
  // @boundary: 当 API 调用失败时，返回 success: false 和 APIError
  async execute(context: TranslateContext): Promise<RoleResult> {
    try {
      if (!context.code || context.code.trim() === '') {
        return {
          success: false,
          message: '代码为空，无法转译',
          artifacts: null
        };
      }

      const language = this.detectLanguage(context.filePath, context.languageId, context.targetLanguage);
      const commentPrefix = this.getCommentPrefix(language);

      // 构建用户消息（支持 context 参数）
      const hasExistingComment = context.existingComment && context.existingComment.trim() !== '';
      const hasFunctionName = context.functionName && context.functionName.trim() !== '';

      let contextText = '';
      if (hasExistingComment || hasFunctionName) {
        contextText = '\n\ncontext:\n';
        if (hasExistingComment) {
          contextText += `existingComment:\n${context.existingComment}\n`;
        }
        if (hasFunctionName) {
          contextText += `functionName: ${context.functionName}\n`;
        }
      }

      const userMessage = this.buildUserMessage(context.code, language, contextText);

      const request: ClaudeAPIRequest = {
        role: 'translator',
        userMessage: userMessage
      };

      const response = await this.apiService.callAPI(request, context.apiKey, context.apiBaseUrl, context.modelId);

      let comments = response.content.trim();
      console.log('[TranslatorVM] API 返回的原始内容:');
      console.log('='.repeat(80));
      console.log(comments);
      console.log('='.repeat(80));

      // 检查是否返回 <<BACKTRACK>>
      if (comments.includes('<<BACKTRACK>>')) {
        const reason = comments.replace('<<BACKTRACK>>', '').trim();
        throw new LogicUnclearError(reason || '无法转译代码');
      }

      // 清理输出：去除代码块标记
      comments = comments.replace(/^```[\w]*\n/gm, '').replace(/\n```$/gm, '');

      // 清理解释性文本（markdown 标题、加粗等）
      // 注意：只清理 Markdown 标题（# 后面必须有空格且不包含 @contract/@step/@boundary/@end）
      comments = comments.replace(/^#+\s+(?!@contract|@step|@boundary|@end).*$/gm, '');
      comments = comments.replace(/\*\*.*?\*\*/g, '');

      // 清理完成标记
      comments = comments.replace(/[✅✓]\s*(转译完成|完成|Done|Completed).*/gi, '');

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
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
        artifacts: error
      };
    }
  }
  // @end

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
      const languageMap: { [key: string]: string } = {
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
      const extMap: { [key: string]: string } = {
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
  private getCommentPrefix(language: string): string {
    const prefixMap: { [key: string]: string } = {
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
  private extractValidComments(output: string, commentPrefix: string): string {
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
    const validLines: string[] = [];
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

  // @contract: buildUserMessage(code: string, language: string, contextText: string) => string
  // @step: [构建参数] 按函数调用风格构建参数列表
  // @step: [添加必需参数] 添加 code 和 targetLanguage
  // @step: [添加可选参数] 如果 contextText 不为空，添加 context
  // @step: [返回] 返回完整的用户消息
  private buildUserMessage(code: string, language: string, contextText: string): string {
    let message = '';

    message += `code:\n${code}\n\n`;
    message += `targetLanguage: ${language}`;

    if (contextText && contextText.trim() !== '') {
      message += contextText;
    }

    return message.trim();
  }
  // @end

  // @contract: translateRequirement(requirement: string, context?: { existingFiles?: string[], existingModules?: string[], projectIntent?: string }) => Promise<string>
  // @step: [读取配置] 读取 API 配置
  // @step: [读取提示词] 读取 requirement-translator.md 提示词模板
  // @step: [构建提示] 将需求和上下文填入提示词
  // @step: [调用 API] 调用 Claude API 生成注释
  // @step: [返回注释] 返回生成的 CDD 注释
  // @boundary: 当 API 调用失败时，抛出错误
  // @boundary: 当提示词文件不存在时，使用默认提示词
  static async translateRequirement(
    requirement: string,
    context?: {
      existingFiles?: string[],
      existingModules?: string[],
      projectIntent?: string
    }
  ): Promise<string> {
    const vscode = require('vscode');

    // 读取配置
    const config = vscode.workspace.getConfiguration('cdd');
    const apiKey = (config.get('apiKey') as string) || '';
    const apiBaseUrl = (config.get('apiBaseUrl') as string) || 'https://api.anthropic.com';
    const modelId = (config.get('modelId') as string) || 'claude-sonnet-4-20250514';

    if (!apiKey) {
      throw new Error('API Key not configured. Please set cdd.apiKey in settings.');
    }

    // 读取提示词模板
    const promptTemplate = await this.loadRequirementPromptTemplate();

    // 构建提示
    const prompt = this.buildRequirementPrompt(promptTemplate, requirement, context);

    // 调用 API
    const apiService = new ClaudeAPIService();
    const response = await apiService.callAPI(
      {
        role: 'translator',
        userMessage: prompt
      },
      apiKey,
      apiBaseUrl,
      modelId
    );

    return response.content.trim();
  }

  // @contract: loadRequirementPromptTemplate() => Promise<string>
  // @step: [读取文件] 读取 _source/prompts/requirement-translator.md
  // @step: [返回内容] 返回文件内容
  // @boundary: 当文件不存在时，返回默认提示词
  private static async loadRequirementPromptTemplate(): Promise<string> {
    const fs = require('fs').promises;
    const path = require('path');
    const vscode = require('vscode');

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return this.getDefaultRequirementPrompt();
    }

    const promptPath = path.join(workspaceFolders[0].uri.fsPath, '_source', 'prompts', 'requirement-translator.md');

    try {
      const content = await fs.readFile(promptPath, 'utf-8');
      return content;
    } catch (error) {
      console.warn('[TranslatorVM] Failed to load requirement prompt template, using default');
      return this.getDefaultRequirementPrompt();
    }
  }

  // @contract: buildRequirementPrompt(template: string, requirement: string, context?: any) => string
  // @step: [格式化上下文] 将上下文格式化为可读字符串
  // @step: [替换变量] 将模板中的变量替换为实际值
  // @step: [返回] 返回构建好的提示
  private static buildRequirementPrompt(
    template: string,
    requirement: string,
    context?: any
  ): string {
    let contextText = '';
    if (context) {
      if (context.projectIntent) {
        contextText += `Project Intent: ${context.projectIntent}\n\n`;
      }
      if (context.existingModules && context.existingModules.length > 0) {
        contextText += `Existing Modules: ${context.existingModules.join(', ')}\n\n`;
      }
      if (context.existingFiles && context.existingFiles.length > 0) {
        contextText += `Existing Files: ${context.existingFiles.join(', ')}\n\n`;
      }
    }

    let prompt = template;
    prompt = prompt.replace('{{requirement}}', requirement);
    prompt = prompt.replace('{{context}}', contextText || 'No additional context');

    return prompt;
  }

  // @contract: getDefaultRequirementPrompt() => string
  // @step: [返回] 返回默认的需求转译提示词
  private static getDefaultRequirementPrompt(): string {
    return `Translate the following requirement to CDD comments.

Requirement: {{requirement}}

Context:
{{context}}

Output format:
// @contract: functionName(param: Type) => ReturnType
// @step: [intent] description
// @boundary: when..., should...`;
  }
}
