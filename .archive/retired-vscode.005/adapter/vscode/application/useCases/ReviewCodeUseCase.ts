import { IUseCase } from '../../../../application/useCases/IUseCase';
import { IAIService, AIRequest } from '../services/IAIService';
import { IFileRepository } from '../../../../data/repositories/IFileRepository';
import { CDDComment } from '../../../../data/entities/CDDComment';
import { ReviewReport, ReviewDimension, Inconsistency, ReviewConclusion } from '../../../../data/entities/ReviewReport';
import { ValidationError } from '../../../../data/entities/Errors';

// @intent: VSCode 特定用例 - 审查代码是否符合 CDD 注释

// @entity: ReviewCodeInput
// 审查输入参数
export interface ReviewCodeInput {
  comment: CDDComment;
  code: string;
  compileSpec: string;
}

// @entity: ReviewCodeOutput
// 审查输出结果
export interface ReviewCodeOutput {
  report: ReviewReport;
  needsArbitration: boolean;
}

export class ReviewCodeUseCase implements IUseCase<ReviewCodeInput, ReviewCodeOutput> {
  constructor(
    private aiService: IAIService,
    private fileRepo: IFileRepository
  ) {}

  // @contract: execute(input: ReviewCodeInput) => Promise<ReviewCodeOutput>
  // @step: [验证完整性] 检查代码块是否包含 @contract 和 @end
  // @step: [构建 AI 请求] 构建审查请求的 systemPrompt 和 userMessage
  // @step: [调用 AI] 通过 aiService.generate 执行审查
  // @step: [解析结果] 解析 AI 返回的审查报告，提取不一致项
  // @step: [判断结论] 根据不一致项判断 PASS/MINOR_DEVIATION/MAJOR_VIOLATION
  // @step: [构建报告] 构建 ReviewReport 对象
  // @step: [返回结果] 返回审查报告和是否需要裁决
  // @boundary: 当代码块不完整时，抛出 ValidationError
  // @boundary: 当发现严重违规时，结论为 MAJOR_VIOLATION，需触发裁决
  async execute(input: ReviewCodeInput): Promise<ReviewCodeOutput> {
    // 1. 验证完整性
    if (!input.comment.contract.functionName) {
      throw new ValidationError('代码块不完整：缺少 @contract');
    }

    if (!input.code.includes('@end')) {
      throw new ValidationError('代码块不完整：缺少 @end 标记');
    }

    // 2. 构建 AI 请求
    const aiRequest = this.buildAIRequest(input);

    // 3. 调用 AI 服务
    const aiResponse = await this.aiService.generate(aiRequest);

    // 4. 解析不一致项
    const inconsistencies = this.parseInconsistencies(aiResponse.content);

    // 5. 判断结论
    const conclusion = this.determineConclusion(inconsistencies);

    // 6. 解析维度
    const dimensions = this.parseDimensions(aiResponse.content);

    // 7. 构建报告
    const report: ReviewReport = {
      functionName: input.comment.contract.functionName,
      date: new Date().toISOString().split('T')[0],
      dimensions,
      conclusion,
      inconsistencies
    };

    // 8. 返回结果
    return {
      report,
      needsArbitration: conclusion === 'MAJOR_VIOLATION'
    };
  }

  // @contract: buildAIRequest(input: ReviewCodeInput) => AIRequest
  // @step: [构建系统提示词] 定义审查员的角色和审查维度
  // @step: [格式化注释] 将 CDDComment 格式化为文本
  // @step: [构建用户消息] 组合注释、代码、编译规范
  // @step: [返回请求] 返回完整的 AIRequest
  private buildAIRequest(input: ReviewCodeInput): AIRequest {
    const systemPrompt = this.buildSystemPrompt(input.compileSpec);
    const commentText = this.formatComment(input.comment);
    const userMessage = this.buildUserMessage(commentText, input.code, input.compileSpec);

    return {
      systemPrompt,
      userMessage,
      options: {
        maxTokens: 4096,
        temperature: 0.3
      }
    };
  }

  // @contract: buildSystemPrompt(compileSpec: string) => string
  // @step: [基础提示词] 定义审查员的角色和行为
  // @step: [添加审查维度] 列出 6 个审查维度
  // @step: [添加规范] 如果有 compileSpec，追加到提示词
  // @step: [返回] 返回完整的系统提示词
  private buildSystemPrompt(compileSpec: string): string {
    let prompt = `你是 CDD 审查员。审查代码是否符合 CDD 注释的描述。

审查维度（BR-001）：
1. @contract 匹配：函数签名、返回类型、异常类型
2. @step 一致性：每个 @step 在代码中有对应实现
3. @boundary 处理：边界条件的 if/throw 逻辑
4. 多余行为：代码中存在但注释未提及的逻辑
5. COMPILE_SPEC 合规：命名、格式、平台规则
6. @end 完整性：是否存在且位置正确

输出格式：
对于每个维度，输出：
- 维度名: PASS（如果通过）
- 维度名: WARN - 描述（如果有轻微偏差）
- 维度名: FAIL - 描述（如果有严重违规）`;

    if (compileSpec && compileSpec.trim() !== '') {
      prompt += `\n\n## 项目编译规范\n${compileSpec}`;
    }

    return prompt;
  }

  // @contract: formatComment(comment: CDDComment) => string
  // @step: [构建契约] 拼接 @contract 行
  // @step: [构建步骤] 拼接所有 @step 行
  // @step: [构建边界] 拼接所有 @boundary 行
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

  // @contract: buildUserMessage(commentText: string, code: string, compileSpec: string) => string
  // @step: [构建标题] 添加审查任务标题
  // @step: [添加注释] 添加 CDD 注释
  // @step: [添加代码] 添加待审查的代码
  // @step: [返回] 返回完整的用户消息
  private buildUserMessage(commentText: string, code: string, compileSpec: string): string {
    let message = `请审查以下代码是否符合 CDD 注释：\n\n`;
    message += `## CDD 注释\n${commentText}\n\n`;
    message += `## 代码实现\n\`\`\`\n${code}\n\`\`\`\n\n`;
    message += `请按照审查维度逐一检查，并输出每个维度的结果。`;

    return message;
  }

  // @contract: parseInconsistencies(content: string) => Inconsistency[]
  // @step: [检查空内容] 如果内容为空，返回空数组
  // @step: [检测拒绝] 检测审查员是否拒绝审查
  // @step: [解析维度] 从 AI 返回内容中提取每个维度的状态
  // @step: [提取不一致] 查找标记为 WARN 或 FAIL 的维度
  // @step: [构建对象] 为每个不一致项构建 Inconsistency 对象
  // @step: [返回] 返回不一致项数组
  // @boundary: 当 API 返回格式无法解析时，返回空数组
  private parseInconsistencies(content: string): Inconsistency[] {
    if (!content || content.trim() === '') {
      return [];
    }

    const inconsistencies: Inconsistency[] = [];

    // 检测审查员是否拒绝审查
    const refusalKeywords = [
      '无法验证', '无法审查', '缺少实际代码', '不是代码',
      'cannot verify', 'cannot review', 'missing code'
    ];

    const hasRefusal = refusalKeywords.some(keyword =>
      content.toLowerCase().includes(keyword.toLowerCase())
    );

    if (hasRefusal) {
      inconsistencies.push({
        line: 0,
        type: 'CONTRACT_MISMATCH',
        description: '编译器未生成有效代码，审查员拒绝审查'
      });
      return inconsistencies;
    }

    // 解析格式：查找 "维度名: FAIL" 或 "维度名: WARN" 模式
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // 匹配 "@contract 匹配: FAIL - 描述" 格式
      const contractMatch = line.match(/@contract.*?(FAIL|WARN)\s*-?\s*(.+)/i);
      if (contractMatch) {
        inconsistencies.push({
          line: i + 1,
          type: 'CONTRACT_MISMATCH',
          description: contractMatch[2].trim()
        });
        continue;
      }

      // 匹配 "@step 一致性: FAIL - 描述" 格式
      const stepMatch = line.match(/@step.*?(FAIL|WARN)\s*-?\s*(.+)/i);
      if (stepMatch) {
        inconsistencies.push({
          line: i + 1,
          type: 'STEP_MISSING',
          description: stepMatch[2].trim()
        });
        continue;
      }

      // 匹配 "@boundary 处理: FAIL - 描述" 格式
      const boundaryMatch = line.match(/@boundary.*?(FAIL|WARN)\s*-?\s*(.+)/i);
      if (boundaryMatch) {
        inconsistencies.push({
          line: i + 1,
          type: 'BOUNDARY_MISSING',
          description: boundaryMatch[2].trim()
        });
        continue;
      }

      // 匹配 "多余行为: FAIL - 描述" 格式
      const extraMatch = line.match(/多余行为.*?(FAIL|WARN)\s*-?\s*(.+)/i);
      if (extraMatch) {
        inconsistencies.push({
          line: i + 1,
          type: 'EXTRA_BEHAVIOR',
          description: extraMatch[2].trim()
        });
        continue;
      }

      // 匹配 "COMPILE_SPEC 合规: FAIL - 描述" 格式
      const specMatch = line.match(/COMPILE_SPEC.*?(FAIL|WARN)\s*-?\s*(.+)/i);
      if (specMatch) {
        inconsistencies.push({
          line: i + 1,
          type: 'SPEC_VIOLATION',
          description: specMatch[2].trim()
        });
        continue;
      }
    }

    return inconsistencies;
  }

  // @contract: determineConclusion(inconsistencies: Inconsistency[]) => ReviewConclusion
  // @step: [检查空] 如果没有不一致项，返回 PASS
  // @step: [检查严重] 如果有 CONTRACT_MISMATCH 或 SPEC_VIOLATION，返回 MAJOR_VIOLATION
  // @step: [检查轻微] 否则返回 MINOR_DEVIATION
  // @boundary: 当不一致项为空数组时，返回 PASS
  private determineConclusion(inconsistencies: Inconsistency[]): ReviewConclusion {
    if (inconsistencies.length === 0) {
      return 'PASS';
    }

    // 检查是否有严重违规
    const hasMajorViolation = inconsistencies.some(inc =>
      inc.type === 'CONTRACT_MISMATCH' || inc.type === 'SPEC_VIOLATION'
    );

    if (hasMajorViolation) {
      return 'MAJOR_VIOLATION';
    }

    return 'MINOR_DEVIATION';
  }

  // @contract: parseDimensions(content: string) => ReviewDimension[]
  // @step: [定义维度] 定义 6 个审查维度
  // @step: [解析状态] 从内容中提取每个维度的状态
  // @step: [构建对象] 为每个维度构建 ReviewDimension 对象
  // @step: [返回] 返回维度数组
  private parseDimensions(content: string): ReviewDimension[] {
    const dimensionNames = [
      '@contract 匹配',
      '@step 一致性',
      '@boundary 处理',
      '多余行为',
      'COMPILE_SPEC 合规',
      '@end 完整性'
    ];

    const dimensions: ReviewDimension[] = [];

    for (const name of dimensionNames) {
      // 查找维度状态
      const regex = new RegExp(`${name}.*?(PASS|WARN|FAIL)`, 'i');
      const match = content.match(regex);

      const status = match ? match[1].toUpperCase() : 'PASS';

      dimensions.push({
        name,
        status: status as 'PASS' | 'WARN' | 'FAIL',
        details: ''
      });
    }

    return dimensions;
  }
}
// @end
