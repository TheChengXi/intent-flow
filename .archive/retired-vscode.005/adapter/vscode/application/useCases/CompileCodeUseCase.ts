import { IUseCase } from '../../../../application/useCases/IUseCase';
// @warn: IAIService 已废弃，AI 调用功能已移除
import { ExtractFullContextUseCase } from '../../../../application/useCases/ExtractFullContextUseCase';
import { IFileRepository } from '../../../../data/repositories/IFileRepository';
import { CDDComment } from '../../../../data/entities/CDDComment';
import { ValidationError } from '../../../../data/entities/Errors';
import { ContractDependency } from '../../../../data/entities/CompileRecord';
import { StepDiff } from '../../../../data/services/StepDiffDetector';
import * as DependencyTracker from '../../../../data/services/DependencyTracker';
import { CallGraphService } from '../../../../data/services/CallGraphService';

// @intent: VSCode 特定用例 - 编译 CDD 注释为可执行代码

// @entity: CompileCodeInput
// 编译输入参数
export interface CompileCodeInput {
  comment: CDDComment;
  compileSpec: string;
  filePath?: string;
  targetLanguage?: string;
  referencedContracts?: string[];
  reviewFeedback?: string;
  previousCode?: string;
  stepDiff?: StepDiff;
  isIncremental?: boolean;
}

// @entity: CompileCodeOutput
// 编译输出结果
export interface CompileCodeOutput {
  code: string;
  dependencies: ContractDependency[];
  missingContracts: string[];
  isIncremental: boolean;
}

// @entity: CompileResult
// 编译结果（特殊标记）
export const NEEDS_SPLIT = Symbol('NEEDS_SPLIT');

export class CompileCodeUseCase implements IUseCase<CompileCodeInput, CompileCodeOutput> {
  constructor(
    private extractFullContextUseCase: ExtractFullContextUseCase,
    private fileRepo: IFileRepository
  ) {}

  // @contract: execute(input: CompileCodeInput) => Promise<CompileCodeOutput>
  // @step: [验证] 检查 comment.contract 格式是否符合 BR-007
  // @step: [检测语言] 从文件扩展名推断目标语言
  // @step: [估算] 根据 steps 数量估算代码行数
  // @step: [暂停检查] 预计超过 200 行时，抛出错误
  // @step: [构建提示词] 构建 AI 请求的 systemPrompt 和 userMessage
  // @step: [调用 AI] 通过 aiService.generate 生成代码
  // @step: [清理代码] 去除代码块标记和原始注释
  // @step: [添加标记] 在代码末尾添加 @end
  // @step: [提取依赖] 提取代码中调用的函数名
  // @step: [记录依赖] 调用 dependencyTracker.recordDependency
  // @step: [验证依赖] 检查依赖是否存在契约
  // @step: [返回结果] 返回生成的代码和依赖信息
  // @boundary: 当注释格式不符合 BR-007 时，抛出 ValidationError
  // @boundary: 当预计代码超过 200 行时，抛出 ValidationError
  // @boundary: 当 AI 调用失败时，抛出 AIError
  async execute(input: CompileCodeInput): Promise<CompileCodeOutput> {
    // 1. 验证
    if (!input.comment.contract.functionName) {
      throw new ValidationError('@contract 格式不符合 BR-007：缺少函数名');
    }

    // 2. 估算代码行数
    const estimatedLines = this.estimateLines(input.comment.steps.length);
    if (estimatedLines > 200) {
      throw new ValidationError(
        `预计生成 ${estimatedLines} 行代码，建议拆分函数`
      );
    }

    // 3. 检测语言
    const language = this.detectLanguage(input.filePath, input.targetLanguage);

    // @warn: AI 服务调用已废弃（IAIService 已移除），使用空代码占位
    let code = '';  // TODO: 需要重构以移除此 useCase 或替换 AI 调用方式

    // 7. 提取依赖
    const dependencies = await this.extractDependencies(
      code,
      input.filePath,
      language
    );

    // 8. 记录依赖
    DependencyTracker.recordDependency(
      input.comment.contract.functionName,
      dependencies
    );

    // 9. 验证依赖
    const missingContracts = this.validateDependencies(
      dependencies,
      input.referencedContracts || []
    );

    // 10. 返回结果
    return {
      code,
      dependencies,
      missingContracts,
      isIncremental: input.isIncremental || false
    };
  }

  // @contract: estimateLines(steps: number) => number
  // @step: [计算] 每个 step 按 15 行估算
  // @step: [基础] 加上函数签名等基础 20 行
  // @boundary: 当 steps 为 0 时，返回 20
  private estimateLines(steps: number): number {
    return steps * 15 + 20;
  }

  // @contract: detectLanguage(filePath?: string, targetLanguage?: string) => string
  // @step: [优先配置] 如果提供了 targetLanguage，直接返回
  // @step: [推断扩展名] 从 filePath 提取扩展名
  // @step: [映射语言] 根据扩展名映射到语言名称
  // @step: [默认] 返回 'typescript'
  private detectLanguage(filePath?: string, targetLanguage?: string): string {
    if (targetLanguage) {
      return targetLanguage;
    }

    if (filePath) {
      const ext = filePath.split('.').pop()?.toLowerCase();
      const langMap: Record<string, string> = {
        'ts': 'typescript',
        'js': 'javascript',
        'py': 'python',
        'go': 'go',
        'java': 'java',
        'cpp': 'cpp',
        'c': 'c',
        'rs': 'rust'
      };
      return langMap[ext || ''] || 'typescript';
    }

    return 'typescript';
  }

  // @contract: buildAIRequest(input: CompileCodeInput, language: string) => AIRequest
  // @step: [构建系统提示词] 根据编译规范构建 systemPrompt
  // @step: [格式化注释] 将 CDDComment 格式化为文本
  // @step: [构建引用契约] 如果有引用契约，添加到 userMessage
  // @step: [构建审查反馈] 如果有审查反馈，添加到 userMessage
  // @step: [构建增量模式] 如果是增量模式，添加 stepDiff 信息
  // @step: [返回请求] 返回完整的 AIRequest
  private buildAIRequest(input: CompileCodeInput, language: string): AIRequest {
    // 系统提示词
    const systemPrompt = this.buildSystemPrompt(input.compileSpec);

    // 格式化注释
    const commentText = this.formatComment(input.comment);

    // 构建用户消息
    let userMessage = `请将以下 CDD 注释编译为 ${language} 代码：\n\n${commentText}`;

    // 添加引用契约
    if (input.referencedContracts && input.referencedContracts.length > 0) {
      userMessage += this.buildReferencedContractsText(input.referencedContracts);
    }

    // 添加审查反馈
    if (input.reviewFeedback) {
      userMessage += `\n\n## 上次审查反馈\n${input.reviewFeedback}`;
      if (input.previousCode) {
        userMessage += `\n\n## 上次生成的代码\n\`\`\`\n${input.previousCode}\n\`\`\``;
      }
    }

    // 添加增量模式信息
    if (input.isIncremental && input.stepDiff && input.previousCode) {
      userMessage += this.buildIncrementalText(input.stepDiff, input.previousCode);
    }

    return {
      systemPrompt,
      userMessage,
      options: {
        maxTokens: 8192,
        temperature: 0.7
      }
    };
  }

  // @contract: buildSystemPrompt(compileSpec: string) => string
  // @step: [基础提示词] 定义编译器的角色和行为
  // @step: [添加规范] 如果有 compileSpec，追加到提示词
  // @step: [返回] 返回完整的系统提示词
  private buildSystemPrompt(compileSpec: string): string {
    let prompt = `你是 CDD 编译器。将 CDD 格式的注释编译为可执行代码。

重要规则：
1. 只输出纯代码，不要包含任何注释（包括原始的 @contract、@step、@boundary 注释）
2. 不要添加代码块标记（\`\`\`）
3. 不要解释代码
4. 直接输出可执行的代码`;

    if (compileSpec && compileSpec.trim() !== '') {
      prompt += `\n\n## 项目编译规范\n${compileSpec}`;
    }

    return prompt;
  }

  // @contract: formatComment(comment: CDDComment) => string
  // @step: [构建契约] 拼接 @contract 行
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

  // @contract: buildReferencedContractsText(contracts: string[]) => string
  // @step: [分离类型] 将类型定义和函数契约分离
  // @step: [排序] 按字母序排序，保证提示词稳定性
  // @step: [构建文本] 拼接类型定义和函数契约
  // @step: [返回] 返回引用契约文本
  private buildReferencedContractsText(contracts: string[]): string {
    const typeDefinitions: string[] = [];
    const functionContracts: string[] = [];

    for (const contract of contracts) {
      if (contract.match(/^\s*(export\s+)?(interface|type|class|enum)\s+/m)) {
        typeDefinitions.push(contract);
      } else {
        functionContracts.push(contract);
      }
    }

    let text = '';

    if (typeDefinitions.length > 0) {
      const sortedTypes = [...typeDefinitions].sort();
      text += '\n\n## 项目中已存在的类型定义\n以下类型已在项目中定义，请直接使用，不要重复创建：\n\n';
      text += sortedTypes.join('\n\n');
    }

    if (functionContracts.length > 0) {
      const sortedContracts = [...functionContracts].sort();
      text += '\n\n## 引用的函数契约\n';
      text += sortedContracts.join('\n\n');
    }

    return text;
  }

  // @contract: buildIncrementalText(stepDiff: StepDiff, previousCode: string) => string
  // @step: [构建标题] 添加增量编译模式标题
  // @step: [添加统计] 添加未变化步骤占比
  // @step: [添加未变化步骤] 列出未变化的步骤
  // @step: [添加新增步骤] 列出新增的步骤
  // @step: [添加删除步骤] 列出删除的步骤
  // @step: [添加上次代码] 添加上次生成的代码作为基础
  // @step: [返回] 返回增量模式文本
  private buildIncrementalText(stepDiff: StepDiff, previousCode: string): string {
    let text = '\n\n## 增量编译模式\n';
    text += `未变化步骤占比: ${(stepDiff.unchangedRatio * 100).toFixed(1)}%\n\n`;

    if (stepDiff.unchanged.length > 0) {
      text += '### 未变化的步骤（保持原实现）:\n';
      stepDiff.unchanged.forEach(step => {
        text += `- ${step.description}\n`;
      });
    }

    if (stepDiff.added.length > 0) {
      text += '\n### 新增的步骤（需要实现）:\n';
      stepDiff.added.forEach(step => {
        text += `- ${step.description}\n`;
      });
    }

    if (stepDiff.deleted.length > 0) {
      text += '\n### 删除的步骤（移除相关代码）:\n';
      stepDiff.deleted.forEach(step => {
        text += `- ${step.description}\n`;
      });
    }

    text += `\n### 上次生成的代码（作为基础）:\n\`\`\`\n${previousCode}\n\`\`\`\n`;
    text += '\n请基于上次代码进行增量修改，保留未变化步骤的实现，只修改新增和删除步骤相关的部分。';

    return text;
  }

  // @contract: cleanCode(code: string, language: string) => string
  // @step: [清理代码块] 去除 ``` 标记
  // @step: [清理元数据] 去除 agent handoff 元数据
  // @step: [清理完成标记] 去除 ✅、Done 等标记
  // @step: [清理原始注释] 去除 @contract、@step、@boundary 注释
  // @step: [添加 @end] 根据语言添加对应的 @end 标记
  // @step: [返回] 返回清理后的代码
  private cleanCode(code: string, language: string): string {
    code = code.trim();

    // 清理代码块标记
    code = code.replace(/^```[\w]*\n/gm, '').replace(/\n```$/gm, '');

    // 清理 agent handoff 元数据
    code = code.replace(/(@end)\s*\n\s*\*\*.*?\*\*[\s\S]*$/m, '$1');
    code = code.replace(/(@end)\s*\n\s*WorkSchedule:[\s\S]*$/m, '$1');
    code = code.replace(/(@end)\s*\n\s*#+\s+.*[\s\S]*$/m, '$1');

    // 清理完成标记
    code = code.replace(/(@end)\s*\n\s*[✅✓].*$/m, '$1');
    code = code.replace(/(@end)\s*\n\s*(Done|完成|Completed).*$/m, '$1');

    // 清理原始注释
    const lines = code.split('\n');
    const cleanedLines = lines.filter(line => {
      const trimmed = line.trim();
      return !trimmed.match(/^(\/\/|#)\s*@contract:/) &&
             !trimmed.match(/^(\/\/|#)\s*@step:/) &&
             !trimmed.match(/^(\/\/|#)\s*@boundary:/);
    });
    code = cleanedLines.join('\n').trim();

    // 清理已有的 @end 标记
    code = code.replace(/^(\/\/|#)?\s*@end\s*$/gm, '').trim();

    // 添加符合当前语言规范的 @end 标记
    const commentPrefix = this.getCommentPrefix(language);
    code += `\n${commentPrefix} @end`;

    return code;
  }

  // @contract: getCommentPrefix(language: string) => string
  // @step: [映射] 根据语言返回注释前缀
  // @boundary: 默认返回 '//'
  private getCommentPrefix(language: string): string {
    const prefixMap: Record<string, string> = {
      'python': '#',
      'ruby': '#',
      'shell': '#',
      'bash': '#'
    };
    return prefixMap[language] || '//';
  }

  // @contract: extractDependencies(code: string, filePath?: string, language?: string) => Promise<ContractDependency[]>
  // @step: [尝试 Tree-sitter] 如果提供了 filePath 和 language，尝试使用 CallGraphService
  // @step: [正则匹配] 使用正则提取所有函数调用作为兜底方案
  // @step: [去重] 使用 Set 去除重复的函数名
  // @step: [过滤标准库] 过滤掉标准库函数
  // @step: [构建依赖] 为每个函数名构建 ContractDependency 对象
  // @step: [返回] 返回依赖数组
  private async extractDependencies(
    code: string,
    filePath?: string,
    language?: string
  ): Promise<ContractDependency[]> {
    const dependencies: ContractDependency[] = [];
    const seen = new Set<string>();

    // 标准库函数列表
    const STDLIB_FUNCTIONS = new Set([
      'console', 'Math', 'Date', 'Array', 'Object', 'String', 'Number', 'Boolean',
      'setTimeout', 'setInterval', 'Promise', 'JSON', 'parseInt', 'parseFloat',
      'print', 'len', 'range', 'enumerate', 'zip', 'map', 'filter', 'reduce',
      'printf', 'scanf', 'malloc', 'free', 'sizeof', 'strlen'
    ]);

    // 尝试使用 CallGraphService
    if (filePath && language) {
      try {
        const fs = require('fs/promises');
        const tempFile = filePath + '.tmp';
        await fs.writeFile(tempFile, code, 'utf-8');

        const graph = await CallGraphService.buildFileCallGraph(tempFile, language);
        await fs.unlink(tempFile);

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
        console.warn('[CompileCodeUseCase] CallGraphService failed, falling back to regex:', error);
      }
    }

    // 兜底方案：正则匹配
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

  // @contract: validateDependencies(dependencies: ContractDependency[], referencedContracts: string[]) => string[]
  // @step: [提取契约名] 从 referencedContracts 提取所有契约名称
  // @step: [检查依赖] 检查每个依赖是否存在契约
  // @step: [收集缺失] 收集缺失契约的函数名
  // @step: [返回] 返回缺失契约列表
  private validateDependencies(
    dependencies: ContractDependency[],
    referencedContracts: string[]
  ): string[] {
    const referencedContractNames = new Set(
      referencedContracts.map(contract => {
        const match = contract.match(/@contract:\s*(\w+)\s*\(/);
        return match ? match[1] : '';
      }).filter(name => name !== '')
    );

    const missingContracts: string[] = [];
    for (const dep of dependencies) {
      if (!referencedContractNames.has(dep.contractName)) {
        missingContracts.push(dep.contractName);
      }
    }

    return missingContracts;
  }
}
// @end
