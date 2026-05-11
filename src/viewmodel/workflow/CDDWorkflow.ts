import * as vscode from 'vscode';
import { WorkflowContext, WorkflowResult, WorkflowType } from './WorkflowTypes';
import { CompilerVM } from '../roles/CompilerVM';
import { ReviewerVM } from '../roles/ReviewerVM';
import { TranslatorVM } from '../roles/TranslatorVM';
import { ClaudeAPIService } from '../../model/services/ClaudeAPIService';
import { CompilerContextManager } from '../context/CompilerContextManager';
import { ReviewerContextManager } from '../context/ReviewerContextManager';
import * as CommentParser from '../../model/services/CommentParser';

// @contract: executeCDDWorkflow(context: WorkflowContext) => Promise<WorkflowResult>
// @step: [WF-01 解析输入] 解析用户选中的文本，判断是注释还是代码
// @step: [WF-02 选择路径] 根据输入类型选择工作流路径（编译路径/审查路径/转译路径）
// @step: [WF-03 编译轮巡] 如果是编译路径，执行编译→审查→重编译循环，最多3次
// @step: [WF-04 处理回溯] 如果审查不通过且达到重试上限，触发回溯请求
// @step: [WF-05 记录日志] 记录完整的工作流执行过程到 WorkSchedule
// @step: [WF-06 返回结果] 返回最终结果和执行摘要
// @boundary: 当 API 调用失败时，记录错误并返回失败结果
// @boundary: 当达到最大重试次数时，提示用户选择路径A或路径B
export async function executeCDDWorkflow(context: WorkflowContext): Promise<WorkflowResult> {
  const executionPath: string[] = [];
  const MAX_RETRY = 3;

  try {
    // WF-01: 解析输入
    const selectedText = context.document.getText(context.selection);
    const workflowType = detectWorkflowType(selectedText, context.document, context.selection.start.line);

    // WF-02: 选择路径
    if (workflowType === 'compile') {
      return await executeCompileWorkflow(context, executionPath, MAX_RETRY);
    } else if (workflowType === 'review') {
      return await executeReviewWorkflow(context, executionPath);
    } else {
      return {
        success: false,
        message: '无法识别工作流类型',
        executionPath
      };
    }
  } catch (error: any) {
    return {
      success: false,
      message: `工作流执行失败: ${error.message}`,
      executionPath
    };
  }
}
// @end

// @contract: detectWorkflowType(selectedText: string, document: any, startLine: number) => WorkflowType
// @step: [检测注释] 尝试解析为 CDD 注释
// @step: [检测代码] 检查是否包含 @end 标记
// @step: [返回类型] 根据检测结果返回工作流类型
// @boundary: 当既有注释又有代码时，返回 'review'
function detectWorkflowType(selectedText: string, document: any, startLine: number): WorkflowType {
  const comment = CommentParser.parseComment(selectedText, document, startLine);
  const hasEnd = selectedText.includes('@end');

  if (comment && !hasEnd) {
    return 'compile';
  } else if (comment && hasEnd) {
    return 'review';
  } else {
    return 'translate';
  }
}
// @end

// @contract: executeCompileWorkflow(context: WorkflowContext, executionPath: string[], maxRetry: number) => Promise<WorkflowResult>
// @step: [准备上下文] 调用 CompilerContextManager.prepare
// @step: [执行编译] 调用 CompilerVM.execute
// @step: [插入代码] 将生成的代码插入到编辑器
// @step: [执行审查] 自动触发审查
// @step: [检查结果] 如果审查不通过，重新编译（最多重试 maxRetry 次）
// @step: [返回结果] 返回最终结果
// @boundary: 当达到最大重试次数时，提示用户选择路径A或路径B
async function executeCompileWorkflow(
  context: WorkflowContext,
  executionPath: string[],
  maxRetry: number
): Promise<WorkflowResult> {
  console.log('[CDDWorkflow] 开始执行编译工作流，最大重试次数:', maxRetry);

  const apiService = new ClaudeAPIService();
  const compilerVM = new CompilerVM(apiService);
  const reviewerVM = new ReviewerVM(apiService);

  let retryCount = 0;
  let lastCode = '';
  let previousCompileSuccess = true;
  let lastCodeInsertPosition: vscode.Position | undefined;

  while (retryCount < maxRetry) {
    console.log(`[CDDWorkflow] 第 ${retryCount + 1} 轮编译开始`);
    executionPath.push('compiler');

    // 如果是重新编译，先删除上次插入的代码
    if (retryCount > 0 && lastCodeInsertPosition) {
      console.log('[CDDWorkflow] 删除上次生成的代码...');
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        await editor.edit(editBuilder => {
          const endPosition = editor.document.positionAt(
            editor.document.offsetAt(lastCodeInsertPosition!) + lastCode.length + 2
          );
          editBuilder.delete(new vscode.Range(lastCodeInsertPosition!, endPosition));
        });
      }
    }

    console.log('[CDDWorkflow] 准备编译上下文...');
    const compileContext = await CompilerContextManager.prepare(
      context.document,
      context.selection,
      context.workspaceRoot,
      context.apiKey,
      context.apiBaseUrl,
      context.modelId,
      context.targetLanguage
    );

    if (!compileContext) {
      console.log('[CDDWorkflow] 编译上下文准备失败');
      return {
        success: false,
        message: '无法准备编译上下文',
        executionPath
      };
    }

    console.log('[CDDWorkflow] 编译上下文准备完成，增量模式:', compileContext.isIncremental);

    console.log('[CDDWorkflow] 调用编译器...');
    const compileResult = await compilerVM.execute(compileContext);

    if (!compileResult.success) {
      console.log('[CDDWorkflow] 编译失败:', compileResult.message);
      return {
        success: false,
        message: compileResult.message,
        executionPath
      };
    }

    console.log('[CDDWorkflow] 编译成功，代码长度:', compileResult.artifacts.length);
    lastCode = compileResult.artifacts;

    if (lastCode.includes('I cannot proceed') ||
        lastCode.includes('Missing Prerequisites') ||
        lastCode.includes('CRITICAL:') ||
        lastCode.length < 50) {
      console.log('[CDDWorkflow] 检测到无效代码，停止执行');
      return {
        success: false,
        message: '编译器返回了无效的代码，请检查输入或配置',
        executionPath
      };
    }

    console.log('[CDDWorkflow] 插入代码到编辑器...');
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const insertPosition = context.selection.end;
      lastCodeInsertPosition = insertPosition;

      await editor.edit(editBuilder => {
        const nextLine = insertPosition.line + 1;
        const hasContentBelow = nextLine < editor.document.lineCount &&
                                editor.document.lineAt(nextLine).text.trim() !== '';
        const separator = hasContentBelow ? '\n\n' : '\n';
        editBuilder.insert(insertPosition, separator + lastCode);
      });
    }

    console.log('[CDDWorkflow] 保存编译历史...');
    await CompilerContextManager.save(
      context.workspaceRoot,
      context.document.fileName,
      compileContext.comment.contract.functionName,
      `${compileContext.comment.contract.functionName}:v1.0`,
      context.document.getText(context.selection),
      lastCode,
      true,
      compileContext.compileSpec
    );

    if (retryCount > 0 && !previousCompileSuccess) {
      console.log('[CDDWorkflow] 跳过自动审查（避免循环）');
      return {
        success: true,
        message: '编译完成（跳过自动审查，避免循环）',
        finalCode: lastCode,
        executionPath
      };
    }

    console.log('[CDDWorkflow] 准备审查上下文...');
    executionPath.push('reviewer');

    // 构建包含注释和代码的完整文本用于审查
    const selectedText = context.document.getText(context.selection);
    const fullTextForReview = selectedText + '\n' + lastCode;

    const reviewContext = await ReviewerContextManager.prepare(
      context.document,
      context.selection,
      context.workspaceRoot,
      context.apiKey,
      context.apiBaseUrl,
      context.modelId
    );

    if (!reviewContext) {
      console.log('[CDDWorkflow] 审查上下文准备失败');
      return {
        success: true,
        message: '编译完成，但无法自动审查',
        finalCode: lastCode,
        executionPath
      };
    }

    // 替换 code 为完整的注释+代码
    reviewContext.code = fullTextForReview;

    // 使用编译上下文中已经解析好的 comment（包含完整的 boundaries）
    // 而不是 ReviewerContextManager 重新解析的（可能不完整）
    reviewContext.comment = compileContext.comment;

    console.log('[CDDWorkflow] 审查内容长度:', reviewContext.code.length);
    console.log('[CDDWorkflow] 审查注释包含的 boundaries 数量:', reviewContext.comment.boundaries.length);

    console.log('[CDDWorkflow] 调用审查员...');
    const reviewResult = await reviewerVM.execute(reviewContext);
    console.log('[CDDWorkflow] 审查结果:', JSON.stringify(reviewResult, null, 2));

    // 提取审查问题列表
    const issues: string[] = [];
    if (reviewResult.artifacts && typeof reviewResult.artifacts === 'object' && 'inconsistencies' in reviewResult.artifacts) {
      const report = reviewResult.artifacts as any;
      console.log('[CDDWorkflow] 审查报告:', JSON.stringify(report, null, 2));
      if (Array.isArray(report.inconsistencies)) {
        issues.push(...report.inconsistencies.map((inc: any) => `${inc.type}: ${inc.description}`));
      }
    }
    console.log('[CDDWorkflow] 提取到的问题数量:', issues.length);

    console.log('[CDDWorkflow] 保存审查结果到历史记录...');
    await ReviewerContextManager.save(
      context.workspaceRoot,
      context.document.fileName,
      reviewContext.comment.contract.functionName,
      `${reviewContext.comment.contract.functionName}:v1.0`,
      reviewContext.comment,
      lastCode,
      reviewResult.success,
      issues,
      reviewContext.compileSpec
    );

    if (reviewResult.success) {
      console.log('[CDDWorkflow] 审查通过！');
      return {
        success: true,
        message: '编译并审查通过',
        finalCode: lastCode,
        reviewPassed: true,
        retryCount,
        executionPath
      };
    }

    console.log('[CDDWorkflow] 审查不通过，准备询问用户...');
    retryCount++;
    previousCompileSuccess = compileResult.success;

    if (retryCount >= maxRetry) {
      console.log('[CDDWorkflow] 达到最大重试次数，触发裁决对话框');
      const choice = await vscode.window.showWarningMessage(
        `经过 ${maxRetry} 次编译，代码仍未通过审查。\n\n路径A（注释为准）：删除代码，修改注释后重新编译\n路径B（代码为准）：保留代码，执行"转译代码为注释"`,
        '路径A：重新编译',
        '路径B：反向同步',
        '取消'
      );

      console.log('[CDDWorkflow] 用户选择:', choice);

      if (choice === '路径A：重新编译') {
        vscode.window.showInformationMessage('请删除当前代码，修改注释后重新执行编译');
      } else if (choice === '路径B：反向同步') {
        vscode.window.showInformationMessage('请选中代码并执行"CDD: 转译代码为注释"');
      }

      return {
        success: false,
        message: `审查未通过，已重试 ${maxRetry} 次`,
        finalCode: lastCode,
        reviewPassed: false,
        retryCount,
        executionPath
      };
    }

    console.log('[CDDWorkflow] 弹出用户选择对话框...');
    const continueChoice = await vscode.window.showWarningMessage(
      `审查未通过（第 ${retryCount} 次）。是否根据审查反馈重新编译？`,
      '重新编译',
      '停止（保留当前代码）'
    );

    console.log('[CDDWorkflow] 用户选择:', continueChoice);

    if (continueChoice !== '重新编译') {
      console.log('[CDDWorkflow] 用户选择停止，结束工作流');
      return {
        success: true,
        message: '编译完成，但审查未通过（用户选择停止重试）',
        finalCode: lastCode,
        reviewPassed: false,
        retryCount,
        executionPath
      };
    }

    console.log('[CDDWorkflow] 用户选择继续，准备下一轮编译');
    vscode.window.showInformationMessage(`正在重新编译（第 ${retryCount + 1} 次）...`);
  }

  console.log('[CDDWorkflow] 工作流异常结束');
  return {
    success: false,
    message: '未知错误',
    executionPath
  };
}
// @end

// @contract: executeReviewWorkflow(context: WorkflowContext, executionPath: string[]) => Promise<WorkflowResult>
// @step: [准备上下文] 调用 ReviewerContextManager.prepare
// @step: [执行审查] 调用 ReviewerVM.execute
// @step: [返回结果] 返回审查结果
async function executeReviewWorkflow(
  context: WorkflowContext,
  executionPath: string[]
): Promise<WorkflowResult> {
  executionPath.push('reviewer');

  const apiService = new ClaudeAPIService();
  const reviewerVM = new ReviewerVM(apiService);

  const reviewContext = await ReviewerContextManager.prepare(
    context.document,
    context.selection,
    context.workspaceRoot,
    context.apiKey,
    context.apiBaseUrl,
    context.modelId
  );

  if (!reviewContext) {
    return {
      success: false,
      message: '无法准备审查上下文',
      executionPath
    };
  }

  const reviewResult = await reviewerVM.execute(reviewContext);

  return {
    success: reviewResult.success,
    message: reviewResult.message,
    reviewPassed: reviewResult.success,
    executionPath
  };
}
// @end
