"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewerVM = void 0;
const BaseRole_1 = require("./BaseRole");
const Errors_1 = require("../../model/entities/Errors");
class ReviewerVM extends BaseRole_1.BaseRole {
    constructor(apiService) {
        super(apiService);
    }
    // @contract: execute(context: ReviewContext) => Promise<RoleResult>
    // @step: [验证完整性] 检查代码块是否包含 @contract 和 // @end
    // @step: [构建 Prompt] 将 comment + code + 审查维度（BR-001）构建为 ClaudeAPIRequest
    // @step: [调用 API] 通过 apiService.callAPI 执行审查
    // @step: [解析结果] 解析 API 返回的审查报告，提取不一致项
    // @step: [判断结论] 根据 BR-002 判断 PASS/MINOR_DEVIATION/MAJOR_VIOLATION
    // @step: [构建报告] 构建 ReviewReport 对象
    // @step: [返回结果] 返回 success: true，artifacts 包含 ReviewReport
    // @boundary: 当代码块不完整时，返回 success: false 和 ValidationError
    // @boundary: 当发现严重违规时，结论为 MAJOR_VIOLATION，需触发裁决
    // @boundary: 当 API 调用失败时，返回 success: false 和 APIError
    async execute(context) {
        try {
            console.log('[ReviewerVM] 开始执行审查');
            if (!context.comment.contract.functionName) {
                throw new Errors_1.ValidationError('代码块不完整：缺少 @contract');
            }
            if (!context.code.includes('@end')) {
                throw new Errors_1.ValidationError('代码块不完整：缺少 @end 标记');
            }
            const dimensions = this.buildReviewDimensions();
            const commentText = this.formatComment(context.comment);
            console.log('[ReviewerVM] 构建 API 请求...');
            const request = {
                role: 'reviewer',
                context: {
                    comment: commentText,
                    code: context.code,
                    compileSpec: context.compileSpec
                },
                prompt: `审查代码是否符合注释。检查以下维度：\n${dimensions.map((d, i) => `${i + 1}. ${d}`).join('\n')}\n\n输出格式：\n- 每个维度的状态（PASS/WARN/FAIL）\n- 不一致项列表（如有）`
            };
            console.log('[ReviewerVM] 调用 API...');
            const response = await this.apiService.callAPI(request, context.apiKey, context.apiBaseUrl, context.modelId);
            console.log('[ReviewerVM] API 返回内容长度:', response.content.length);
            console.log('[ReviewerVM] API 返回内容:', response.content);
            console.log('[ReviewerVM] 解析不一致项...');
            const inconsistencies = this.parseInconsistencies(response.content);
            console.log('[ReviewerVM] 解析到的不一致项数量:', inconsistencies.length);
            console.log('[ReviewerVM] 不一致项详情:', JSON.stringify(inconsistencies, null, 2));
            const conclusion = this.determineConclusion(inconsistencies);
            console.log('[ReviewerVM] 审查结论:', conclusion);
            const report = {
                functionName: context.comment.contract.functionName,
                date: new Date().toISOString().split('T')[0],
                dimensions: this.parseDimensions(response.content, dimensions),
                conclusion,
                inconsistencies
            };
            return {
                success: conclusion === 'PASS',
                message: `审查完成：${conclusion}`,
                artifacts: report
            };
        }
        catch (error) {
            console.error('[ReviewerVM] 审查失败:', error);
            return {
                success: false,
                message: error.message,
                artifacts: error
            };
        }
    }
    // @end
    // @contract: triggerArbitration(inconsistencies: Inconsistency[]) => Promise<ArbitrationChoice>
    // @step: [格式化输出] 按 BR-008 格式输出路径A和路径B
    // @step: [等待用户] 通过 VSCode QuickPick 等待用户选择
    // @step: [返回选择] 返回用户的选择
    // @boundary: 当用户取消时，返回 'CANCEL'
    async triggerArbitration(inconsistencies) {
        // 注意：这个方法需要 vscode 模块，但 ViewModel 层不应直接依赖 VSCode API
        // 在 MVP 阶段，这个功能应该由 Command 层调用，而不是 VM 层直接实现
        // 因此这里抛出错误，提示应该在 ReviewCommand 中处理裁决逻辑
        throw new Error('Arbitration should be handled in ReviewCommand layer, not in ViewModel');
    }
    // @end
    // @contract: buildReviewDimensions() => string[]
    // @step: [返回] 返回 BR-001 定义的 6 个审查维度
    buildReviewDimensions() {
        return [
            '@contract 匹配：函数签名、返回类型、异常类型',
            '@step 一致性：每个 @step 在代码中有对应实现（@simple 跳过）',
            '@boundary 处理：边界条件的 if/throw 逻辑',
            '多余行为：代码中存在但注释未提及的逻辑',
            'COMPILE_SPEC 合规：命名、格式、平台规则',
            '@end 完整性：是否存在且位置正确'
        ];
    }
    // @contract: formatComment(comment: CDDComment) => string
    // @step: [构建契约] 拼接 @contract 行
    // @step: [构建步骤] 拼接所有 @step 行
    // @step: [构建边界] 拼接所有 @boundary 行
    formatComment(comment) {
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
    // @contract: parseInconsistencies(content: string) => Inconsistency[]
    // @step: [解析维度] 从 API 返回内容中提取每个维度的状态
    // @step: [提取不一致] 查找标记为 WARN 或 FAIL 的维度
    // @step: [构建对象] 为每个不一致项构建 Inconsistency 对象
    // @boundary: 当 API 返回格式无法解析时，返回空数组
    // @boundary: 当内容为空时，返回空数组
    parseInconsistencies(content) {
        if (!content || content.trim() === '') {
            return [];
        }
        const inconsistencies = [];
        // 检测审查员是否拒绝审查（返回了解释性文本而不是审查报告）
        const refusalKeywords = [
            '无法验证',
            '无法审查',
            '无法进行',
            '缺少实际代码',
            '缺少代码实现',
            '没有实际的可执行代码',
            '不是代码',
            '非实现代码',
            'cannot verify',
            'cannot review',
            'missing code',
            'no actual code',
            'not executable code'
        ];
        const hasRefusal = refusalKeywords.some(keyword => content.toLowerCase().includes(keyword.toLowerCase()));
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
                    type: 'EXTRA_BEHAVIOR',
                    description: specMatch[2].trim()
                });
            }
        }
        return inconsistencies;
    }
    // @end
    // @contract: parseDimensions(content: string, dimensionNames: string[]) => ReviewDimension[]
    // @step: [初始化] 为每个维度创建默认 PASS 状态
    // @step: [解析状态] 从 API 返回内容中提取每个维度的实际状态
    // @step: [更新状态] 根据解析结果更新维度状态和详情
    // @boundary: 当无法解析时，保持默认 PASS 状态
    parseDimensions(content, dimensionNames) {
        const dimensions = dimensionNames.map(name => ({
            name,
            status: 'PASS',
            details: ''
        }));
        const lines = content.split('\n');
        for (const line of lines) {
            // 匹配 "维度名: STATUS - 详情" 格式
            for (let i = 0; i < dimensionNames.length; i++) {
                const dimName = dimensionNames[i];
                const regex = new RegExp(`${dimName.split('：')[0]}.*?(PASS|WARN|FAIL)\\s*-?\\s*(.*)`, 'i');
                const match = line.match(regex);
                if (match) {
                    const status = match[1].toUpperCase();
                    dimensions[i].status = status;
                    dimensions[i].details = match[2].trim();
                    break;
                }
            }
        }
        return dimensions;
    }
    // @end
    // @contract: determineConclusion(inconsistencies: Inconsistency[]) => ReviewConclusion
    // @step: [判断] 根据不一致项数量和类型判断结论
    // @step: [无问题] 返回 PASS
    // @step: [轻微] 返回 MINOR_DEVIATION
    // @step: [严重] 返回 MAJOR_VIOLATION
    determineConclusion(inconsistencies) {
        if (inconsistencies.length === 0) {
            return 'PASS';
        }
        const hasMajor = inconsistencies.some(i => i.type === 'CONTRACT_MISMATCH' || i.type === 'STEP_MISSING');
        return hasMajor ? 'MAJOR_VIOLATION' : 'MINOR_DEVIATION';
    }
}
exports.ReviewerVM = ReviewerVM;
//# sourceMappingURL=ReviewerVM.js.map