import { BaseRole, RoleResult } from './BaseRole';
import { ClaudeAPIService, ClaudeAPIRequest } from '../../data/services/ClaudeAPIService';

// @intent: 将自然语言需求转译为 CDD 格式的注释

// @entity: RequirementTranslateContext
// 需求转译上下文
export interface RequirementTranslateContext {
  intent: string; // 用户的自然语言需求描述
  dependencies: DependencyInfo; // 项目依赖信息（由 CallGraphService 和 IntentExtractor 自动提取）
  apiKey: string;
}

// @entity: DependencyInfo
// 依赖信息
export interface DependencyInfo {
  fileNames: string[]; // 文件名列表
  intents: Map<string, string>; // 文件名 -> @intent 注释
  typeDefinitions?: Map<string, string>; // 类型名 -> 类型定义（可选）
  functionSignatures?: Map<string, string>; // 函数名 -> 函数签名（可选）
}

// @contract: RequirementTranslatorVM
// 需求转译器 ViewModel
export class RequirementTranslatorVM extends BaseRole {
  constructor(apiService: ClaudeAPIService) {
    super(apiService);
  }

  // @contract: execute(context: RequirementTranslateContext) => Promise<RoleResult>
  // @step: [构建消息] 构建包含 @intent 和 dependencies 的用户消息
  // @step: [调用 API] 调用 Claude API 进行转译
  // @step: [检查回溯] 检查响应是否包含 <<BACKTRACK>>
  // @step: [返回结果] 如果成功，返回 CDD 注释；如果回溯，返回失败和原因
  // @boundary: 当 API 调用失败时，返回 success: false 和 APIError
  // @boundary: 当响应包含 <<BACKTRACK>> 时，返回 success: false 和回溯原因
  async execute(context: RequirementTranslateContext): Promise<RoleResult> {
    try {
      // 构建用户消息
      const userMessage = this.buildUserMessage(context.intent, context.dependencies);

      const request: ClaudeAPIRequest = {
        role: 'requirement-translator' as const,
        userMessage: userMessage
      };

      const response = await this.apiService.callAPI(request, context.apiKey);

      // 检查是否需要回溯
      if (response.content.includes('<<BACKTRACK>>')) {
        const backtrackReason = this.extractBacktrackReason(response.content);
        return {
          success: false,
          message: `需求信息不足：${backtrackReason}`,
          artifacts: null
        };
      }

      return {
        success: true,
        message: '需求转译成功',
        artifacts: response.content
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

  // @contract: buildUserMessage(intent: string, dependencies: DependencyInfo) => string
  // @step: [添加 @intent] 添加用户的自然语言需求
  // @step: [添加 dependencies] 格式化并添加依赖信息
  // @step: [返回] 返回完整的用户消息
  private buildUserMessage(intent: string, dependencies: DependencyInfo): string {
    let message = '';

    // 添加 @intent
    message += `@intent:\n${intent}\n\n`;

    // 添加 dependencies
    message += `dependencies:\n`;
    message += `  fileNames: [${dependencies.fileNames.join(', ')}]\n`;

    // 添加 intents
    if (dependencies.intents.size > 0) {
      message += `  intents:\n`;
      for (const [fileName, intent] of dependencies.intents.entries()) {
        message += `    - ${fileName}: ${intent}\n`;
      }
    }

    // 添加 typeDefinitions（如果有）
    if (dependencies.typeDefinitions && dependencies.typeDefinitions.size > 0) {
      message += `  typeDefinitions:\n`;
      for (const [typeName, typeDef] of dependencies.typeDefinitions.entries()) {
        message += `    - ${typeName}: ${typeDef}\n`;
      }
    }

    // 添加 functionSignatures（如果有）
    if (dependencies.functionSignatures && dependencies.functionSignatures.size > 0) {
      message += `  functionSignatures:\n`;
      for (const [funcName, funcSig] of dependencies.functionSignatures.entries()) {
        message += `    - ${funcName}: ${funcSig}\n`;
      }
    }

    return message.trim();
  }
  // @end

  // @contract: extractBacktrackReason(response: string) => string
  // @step: [正则匹配] 使用正则提取 <<BACKTRACK>> 后的原因
  // @step: [返回] 返回原因字符串
  // @boundary: 当无法提取原因时，返回完整响应
  private extractBacktrackReason(response: string): string {
    const match = response.match(/<<BACKTRACK>>\s*(.+)/);
    if (match) {
      return match[1].trim();
    }
    return response;
  }
  // @end
}
