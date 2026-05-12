import { BaseRole, RoleResult } from './BaseRole';
import { CDDComment } from '../../model/entities/CDDComment';
import { ClaudeAPIService, ClaudeAPIRequest } from '../../model/services/ClaudeAPIService';
import * as DependencyTracker from '../../model/services/DependencyTracker';
import { ValidationError } from '../../model/entities/Errors';
import { ContractDependency } from '../../model/entities/CompileRecord';
import { StepDiff } from '../../model/services/StepDiffDetector';
import { CallGraphService } from '../../model/services/CallGraphService';

// @entity: CompileContext
// 编译上下文
export interface CompileContext {
  comment: CDDComment;
  compileSpec: string;
  apiKey: string;
  apiBaseUrl?: string;
  modelId?: string;
  filePath?: string;
  targetLanguage?: string;
  referencedContracts?: string[];
  reviewFeedback?: string;
  previousCode?: string;
  stepDiff?: StepDiff;
  isIncremental?: boolean;
}

// @entity: CompileResult
// 编译结果（特殊标记）
export const NEEDS_SPLIT = Symbol('NEEDS_SPLIT');

export class CompilerVM extends BaseRole {
  constructor(apiService: ClaudeAPIService) {
    super(apiService);
  }

  // @contract: execute(context: CompileContext) => Promise<RoleResult>
  // @step: [验证] 检查 comment.contract 格式是否符合 BR-007
  // @step: [检测语言] 从文件扩展名推断目标语言，如无法识别则使用配置项
  // @step: [估算] 根据 steps 数量估算代码行数（每个 step 约 10-20 行）
  // @step: [暂停检查] 预计超过 200 行时，返回 artifacts: NEEDS_SPLIT
  // @step: [检查规范] 检查 compileSpec 是否存在，动态调整提示词
  // @step: [增量模式] 如果 isIncremental 为 true，构建增量编译提示词
  // @step: [构建请求] 将 comment + compileSpec + 目标语言构建为 ClaudeAPIRequest
  // @step: [调用 API] 通过 apiService.callAPI 生成代码
  // @step: [清理代码] 去除代码块标记和原始注释
  // @step: [添加标记] 在代码末尾添加 // @end
  // @step: [提取依赖] 使用正则提取代码中调用的函数名
  // @step: [记录依赖] 调用 dependencyTracker.recordDependency
  // @step: [返回结果] 返回 success: true，artifacts 包含生成的代码
  // @boundary: 当注释格式不符合 BR-007 时，返回 success: false 和 ValidationError
  // @boundary: 当 API 调用失败时，返回 success: false 和 APIError
  async execute(context: CompileContext): Promise<RoleResult> {
    try {
      if (!context.comment.contract.functionName) {
        throw new ValidationError('@contract 格式不符合 BR-007：缺少函数名');
      }

      const estimatedLines = this.estimateLines(context.comment.steps.length);
      if (estimatedLines > 200) {
        return {
          success: false,
          message: `预计生成 ${estimatedLines} 行代码，建议拆分函数`,
          artifacts: NEEDS_SPLIT
        };
      }

      const language = this.detectLanguage(context.filePath, context.targetLanguage);
      const commentText = this.formatComment(context.comment);

      const hasReferencedContracts = context.referencedContracts && context.referencedContracts.length > 0;
      const hasReviewFeedback = context.reviewFeedback && context.reviewFeedback.trim() !== '';
      const isIncremental = context.isIncremental && context.stepDiff;

      // 构建引用契约的文本
      let referencedContractsText = '';
      if (hasReferencedContracts) {
        // 分离类型定义和函数契约
        const typeDefinitions: string[] = [];
        const functionContracts: string[] = [];

        for (const contract of context.referencedContracts!) {
          // 判断是类型定义还是函数契约
          if (contract.match(/^\s*(export\s+)?(interface|type|class|enum)\s+/m)) {
            typeDefinitions.push(contract);
          } else {
            functionContracts.push(contract);
          }
        }

        // 按字母序排序，保证提示词稳定性，最大化缓存命中率
        if (typeDefinitions.length > 0) {
          const sortedTypes = [...typeDefinitions].sort();
          referencedContractsText += '\n\n## 项目中已存在的类型定义\n以下类型已在项目中定义，请直接使用，不要重复创建：\n\n' + sortedTypes.join('\n\n');
        }

        if (functionContracts.length > 0) {
          const sortedContracts = [...functionContracts].sort();
          referencedContractsText += '\n\n## 引用的函数契约\n' + sortedContracts.join('\n\n');
        }
      }

      // 构建审查反馈文本
      let reviewFeedbackText = '';
      if (hasReviewFeedback) {
        reviewFeedbackText = '\n\n## 上次审查反馈\n' + context.reviewFeedback!;
        if (context.previousCode) {
          reviewFeedbackText += '\n\n## 上次生成的代码\n```\n' + context.previousCode + '\n```';
        }
      }

      // 构建增量编译文本
      let incrementalText = '';
      if (isIncremental && context.stepDiff && context.previousCode) {
        incrementalText = '\n\n## 增量编译模式\n';
        incrementalText += `未变化步骤占比: ${(context.stepDiff.unchangedRatio * 100).toFixed(1)}%\n\n`;

        if (context.stepDiff.unchanged.length > 0) {
          incrementalText += '### 未变化的步骤（保持原实现）:\n';
          context.stepDiff.unchanged.forEach(step => {
            incrementalText += `- ${step.description}\n`;
          });
        }

        if (context.stepDiff.added.length > 0) {
          incrementalText += '\n### 新增的步骤（需要实现）:\n';
          context.stepDiff.added.forEach(step => {
            incrementalText += `- ${step.description}\n`;
          });
        }

        if (context.stepDiff.deleted.length > 0) {
          incrementalText += '\n### 删除的步骤（移除相关代码）:\n';
          context.stepDiff.deleted.forEach(step => {
            incrementalText += `- ${step.description}\n`;
          });
        }

        incrementalText += '\n### 上次生成的代码（作为基础）:\n```\n' + context.previousCode + '\n```\n';
        incrementalText += '\n请基于上次代码进行增量修改，保留未变化步骤的实现，只修改新增和删除步骤相关的部分。';
      }

      // 构建用户消息（函数调用风格）
      const userMessage = this.buildUserMessage(
        commentText,
        language,
        referencedContractsText,
        reviewFeedbackText,
        incrementalText
      );

      const request: ClaudeAPIRequest = {
        role: 'compiler',
        userMessage: userMessage,
        compileSpec: context.compileSpec
      };

      const response = await this.apiService.callAPI(request, context.apiKey, context.apiBaseUrl, context.modelId);

      let code = response.content.trim();
      console.log('[CompilerVM] API 返回的原始内容:');
      console.log('='.repeat(80));
      console.log(code);
      console.log('='.repeat(80));

      // 清理代码块标记
      code = code.replace(/^```[\w]*\n/gm, '').replace(/\n```$/gm, '');

      // 清理 agent handoff 元数据（LLM 可能自作主张添加的交接信息）
      // 匹配从 @end 后的任何 markdown 标题、加粗文本、WorkSchedule 等
      code = code.replace(/(@end)\s*\n\s*\*\*.*?\*\*[\s\S]*$/m, '$1');
      code = code.replace(/(@end)\s*\n\s*WorkSchedule:[\s\S]*$/m, '$1');
      code = code.replace(/(@end)\s*\n\s*#+\s+.*[\s\S]*$/m, '$1');

      // 清理完成标记（✅、✓、Done、完成等）
      code = code.replace(/(@end)\s*\n\s*[✅✓].*$/m, '$1');
      code = code.replace(/(@end)\s*\n\s*(Done|完成|Completed).*$/m, '$1');

      // 清理原始注释（@contract、@step、@boundary）
      const lines = code.split('\n');
      const cleanedLines = lines.filter(line => {
        const trimmed = line.trim();
        // 支持多语言注释符号
        return !trimmed.match(/^(\/\/|#)\s*@contract:/) &&
               !trimmed.match(/^(\/\/|#)\s*@step:/) &&
               !trimmed.match(/^(\/\/|#)\s*@boundary:/);
      });
      code = cleanedLines.join('\n').trim();

      // 根据语言添加对应的 @end 标记
      const targetLang = this.detectLanguage(context.filePath, context.targetLanguage);
      const commentPrefix = this.getCommentPrefix(targetLang);

      // 清理 LLM 可能输出的各种 @end 格式（带或不带注释符）
      code = code.replace(/^(\/\/|#)?\s*@end\s*$/gm, '').trim();

      // 统一添加符合当前语言规范的 @end 标记
      code += `\n${commentPrefix} @end`;

      const dependencies = await this.extractDependencies(code, context.filePath, targetLang);
      DependencyTracker.recordDependency(context.comment.contract.functionName, dependencies);

      // 问题 4 修复：验证依赖是否存在契约
      const missingContracts: string[] = [];
      const referencedContractNames = new Set(
        (context.referencedContracts || []).map(contract => {
          const match = contract.match(/@contract:\s*(\w+)\s*\(/);
          return match ? match[1] : '';
        }).filter(name => name !== '')
      );

      for (const dep of dependencies) {
        if (!referencedContractNames.has(dep.contractName)) {
          missingContracts.push(dep.contractName);
        }
      }

      let message = `编译完成：${context.comment.contract.functionName}${isIncremental ? '（增量模式）' : ''}`;
      if (missingContracts.length > 0) {
        message += `\n⚠️ 警告：发现未知依赖函数（未提供契约）：${missingContracts.join(', ')}`;
        console.warn('[CompilerVM] 发现未知依赖:', missingContracts);
      }

      return {
        success: true,
        message: message,
        artifacts: code
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

  // @contract: estimateLines(steps: number) => number
  // @step: [计算] 每个 step 按 15 行估算（10-20 行的中位数）
  // @step: [基础] 加上函数签名、返回语句等基础 20 行
  // @boundary: 当 steps 为 0 时，返回 20
  private estimateLines(steps: number): number {
    return steps * 15 + 20;
  }

  // @contract: formatComment(comment: CDDComment) => string
  // @step: [构建契约] 拼接 @contract 行，包含函数名、参数、返回类型、异常
  // @step: [构建步骤] 遍历 steps，拼接每个 @step 行
  // @step: [构建边界] 遍历 boundaries，拼接每个 @boundary 行
  // @step: [返回] 返回完整的注释文本
  private formatComment(comment: CDDComment): string {
    let text = `// @contract: ${comment.contract.functionName}(`;
    text += comment.contract.parameters.map(p => `${p.name}: ${p.type}`).join(', ');
    text += `) => ${comment.contract.returnType}`;
    if (comment.contract.throwsTypes.length > 0) {
      text += ` | throws ${comment.contract.throwsTypes.join(', ')}`;
    }
    text += '\n';

    for (const step of comment.steps) {
      text += `// @step: ${step.description}\n`;
    }

    for (const boundary of comment.boundaries) {
      text += `// @boundary: ${boundary.description}\n`;
    }

    return text;
  }
  // @end

  // @contract: extractDependencies(code: string, filePath?: string, language?: string) => Promise<ContractDependency[]>
  // @step: [尝试 Tree-sitter] 如果提供了 filePath 和 language，尝试使用 CallGraphService
  // @step: [正则匹配] 使用正则提取所有函数调用（函数名后跟括号）作为兜底方案
  // @step: [去重] 使用 Set 去除重复的函数名
  // @step: [过滤标准库] 过滤掉标准库函数和内置函数
  // @step: [构建依赖] 为每个函数名构建 ContractDependency 对象，版本默认 v1.0
  // @step: [返回] 返回依赖数组
  private async extractDependencies(code: string, filePath?: string, language?: string): Promise<ContractDependency[]> {
    const dependencies: ContractDependency[] = [];
    const seen = new Set<string>();

    // 标准库函数列表（问题 4 修复）
    const STDLIB_FUNCTIONS = new Set([
      // JavaScript/TypeScript
      'console', 'Math', 'Date', 'Array', 'Object', 'String', 'Number', 'Boolean',
      'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'Promise', 'JSON',
      'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURI', 'decodeURI',
      'encodeURIComponent', 'decodeURIComponent', 'eval', 'Map', 'Set', 'WeakMap', 'WeakSet',
      'Symbol', 'Proxy', 'Reflect', 'Error', 'TypeError', 'ReferenceError', 'SyntaxError',
      'RegExp', 'Function', 'ArrayBuffer', 'DataView', 'Int8Array', 'Uint8Array',
      // Python
      'print', 'len', 'range', 'enumerate', 'zip', 'map', 'filter', 'reduce',
      'sorted', 'reversed', 'sum', 'min', 'max', 'abs', 'round', 'pow',
      'open', 'input', 'type', 'isinstance', 'hasattr', 'getattr', 'setattr',
      'dir', 'help', 'id', 'hash', 'hex', 'oct', 'bin', 'chr', 'ord',
      // C/C++
      'printf', 'scanf', 'malloc', 'free', 'sizeof', 'strlen', 'strcpy', 'strcmp',
      'memcpy', 'memset', 'fopen', 'fclose', 'fread', 'fwrite', 'fprintf', 'fscanf',
      // Go
      'make', 'len', 'cap', 'append', 'copy', 'delete', 'panic', 'recover',
      'close', 'new', 'println', 'printf'
    ]);

    // 尝试使用 CallGraphService（更精确）
    if (filePath && language) {
      try {
        // 临时写入代码到文件以供 CallGraphService 分析
        const fs = require('fs/promises');
        const tempFile = filePath + '.tmp';
        await fs.writeFile(tempFile, code, 'utf-8');

        const graph = await CallGraphService.buildFileCallGraph(tempFile, language);

        // 清理临时文件
        await fs.unlink(tempFile);

        // 收集所有函数调用
        for (const [funcName, node] of graph.nodes) {
          for (const callee of node.callees) {
            if (!seen.has(callee) && !STDLIB_FUNCTIONS.has(callee)) {
              seen.add(callee);
              dependencies.push({
                contractName: callee,
                version: 'v1.0'
              });
            }
          }
        }

        if (dependencies.length > 0) {
          return dependencies;
        }
      } catch (error) {
        console.warn('CallGraphService failed, falling back to regex:', error);
      }
    }

    // 兜底方案：使用正则匹配
    const functionCallRegex = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;
    let match;
    while ((match = functionCallRegex.exec(code)) !== null) {
      const funcName = match[1];
      if (!seen.has(funcName) && !STDLIB_FUNCTIONS.has(funcName)) {
        seen.add(funcName);
        dependencies.push({
          contractName: funcName,
          version: 'v1.0'
        });
      }
    }

    return dependencies;
  }
  // @end

  // @contract: detectLanguage(filePath?: string, targetLanguage?: string) => string
  // @step: [优先配置] 如果 targetLanguage 已配置，直接返回
  // @step: [检测扩展名] 从 filePath 提取扩展名，映射到语言名称
  // @step: [兜底] 无法识别时返回 'TypeScript'
  // @boundary: 当 filePath 为空且 targetLanguage 为空时，返回 'TypeScript'
  private detectLanguage(filePath?: string, targetLanguage?: string): string {
    if (targetLanguage) {
      return targetLanguage;
    }

    if (!filePath) {
      return 'TypeScript';
    }

    const ext = filePath.split('.').pop()?.toLowerCase();
    const languageMap: { [key: string]: string } = {
      'ts': 'TypeScript',
      'js': 'JavaScript',
      'py': 'Python',
      'cpp': 'C++',
      'c': 'C',
      'java': 'Java',
      'go': 'Go',
      'rs': 'Rust',
      'ets': 'ArkTS',
      'kt': 'Kotlin',
      'swift': 'Swift',
      'cs': 'C#',
      'rb': 'Ruby',
      'php': 'PHP'
    };

    return languageMap[ext || ''] || 'TypeScript';
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
      'PHP': '//',
      'ArkTS': '//'
    };
    return prefixMap[language] || '//';
  }
  // @end

  // @contract: buildUserMessage(commentText: string, language: string, referencedContracts?: string, reviewFeedback?: string, incrementalText?: string) => string
  // @step: [构建参数] 按函数调用风格构建参数列表
  // @step: [添加必需参数] 添加 comment 和 targetLanguage
  // @step: [添加可选参数] 如果存在，添加 referencedContracts、context
  // @step: [返回] 返回完整的用户消息
  private buildUserMessage(
    commentText: string,
    language: string,
    referencedContracts?: string,
    reviewFeedback?: string,
    incrementalText?: string
  ): string {
    let message = '';

    // 必需参数
    message += `comment:\n${commentText}\n\n`;
    message += `targetLanguage: ${language}\n\n`;

    // 可选参数：referencedContracts
    if (referencedContracts && referencedContracts.trim() !== '') {
      message += `referencedContracts:\n${referencedContracts}\n\n`;
    }

    // 可选参数：context（包含 reviewFeedback 和 incrementalText）
    if (reviewFeedback || incrementalText) {
      message += `context:\n`;
      if (reviewFeedback) {
        message += reviewFeedback + '\n';
      }
      if (incrementalText) {
        message += incrementalText + '\n';
      }
      message += '\n';
    }

    return message.trim();
  }
  // @end
}
