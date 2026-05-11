import { BaseRole, RoleResult } from './BaseRole';
import { CDDComment } from '../../model/entities/CDDComment';
import { ClaudeAPIService } from '../../model/services/ClaudeAPIService';

// @entity: CodeTranslateContext
// 代码转译上下文
export interface CodeTranslateContext {
  code: string;
  oldComment: CDDComment;
  apiKey: string;
}

export class CodeTranslatorVM extends BaseRole {
  constructor(apiService: ClaudeAPIService) {
    super(apiService);
  }

  // @contract: execute(context: CodeTranslateContext) => Promise<RoleResult>
  // @step: [对比] 比较 code 与 oldComment 的差异
  // @step: [调用 API] 要求 API 更新注释以匹配代码
  // @step: [冲突检测] 检查是否违背旧 @contract
  // @step: [返回结果] 返回 success: true，artifacts 包含更新后的注释
  // @boundary: 当检测到契约冲突时，返回 success: false 并输出《契约冲突请裁决》
  // @boundary: 当 API 调用失败时，返回 success: false 和 APIError
  async execute(context: CodeTranslateContext): Promise<RoleResult> {
    try {
      const oldContractStr = `${context.oldComment.contract.functionName}(${context.oldComment.contract.parameters.map(p => `${p.name}: ${p.type}`).join(', ')}) => ${context.oldComment.contract.returnType}`;

      const request = {
        role: 'code-translator' as const,
        context: {
          code: context.code,
          comment: oldContractStr
        },
        prompt: '根据代码更新生成新的 CDD 注释。如果函数签名、返回类型或异常类型发生变化，请明确标注"契约冲突"。'
      };

      const response = await this.apiService.callAPI(request, context.apiKey);

      if (response.content.includes('契约冲突')) {
        return {
          success: false,
          message: '《契约冲突请裁决》：代码修改违背了原有 @contract',
          artifacts: null
        };
      }

      return {
        success: true,
        message: '注释已同步',
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

  // @contract: detectContractConflict(oldContract: string, newContract: string) => boolean
  // @step: [比较] 比较函数签名、返回类型、异常类型
  // @step: [判断] 任一项不同则返回 true
  // @boundary: 当两个契约相同时，返回 false
  private detectContractConflict(oldContract: string, newContract: string): boolean {
    return oldContract !== newContract;
  }
  // @end
}
