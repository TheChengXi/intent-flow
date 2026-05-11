import * as vscode from 'vscode';
import { PlannerVM, PlannerContext } from '../roles/PlannerVM';
import { ClaudeAPIService } from '../../model/services/ClaudeAPIService';
import * as WorkScheduleRepo from '../../model/repositories/WorkScheduleRepo';

// @contract: execute() => Promise<void>
// @step: [分析] 调用 PlannerVM.analyzeImpact
// @step: [显示报告] 在 OutputPanel 显示影响分析报告
// @step: [记录日志] 调用 WorkScheduleRepo.addRecord
// @boundary: 当 CHANGELOG.md 不存在时，按 BUSINESS_RULES 流程4异常处理
export async function execute(): Promise<void> {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
  if (!workspaceRoot) {
    vscode.window.showErrorMessage('未打开工作区');
    return;
  }

  const apiService = new ClaudeAPIService();
  const plannerVM = new PlannerVM(apiService);

  const context: PlannerContext = {
    workspaceRoot
  };

  const result = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: '正在分析变更影响...',
      cancellable: false
    },
    async () => {
      return await plannerVM.execute(context);
    }
  );

  if (!result.success) {
    vscode.window.showErrorMessage(`分析失败：${result.message}`);
    return;
  }

  const report = result.artifacts;

  let reportText = '# 变更影响分析报告\n\n';
  reportText += `## 最新变更\n${report.latestChange ? report.latestChange.content : '无变更'}\n\n`;
  reportText += `## 受影响的函数\n`;
  if (report.affectedFunctions.length > 0) {
    reportText += report.affectedFunctions.map((f: string) => `- ${f}`).join('\n');
  } else {
    reportText += '无';
  }
  reportText += `\n\n## 建议\n${report.recommendation}\n`;

  const doc = await vscode.workspace.openTextDocument({
    content: reportText,
    language: 'markdown'
  });
  await vscode.window.showTextDocument(doc);

  const now = new Date();
  await WorkScheduleRepo.addRecord(
    {
      date: now.toISOString().split('T')[0],
      time: now.toTimeString().split(' ')[0],
      role: '迭代规划师',
      description: '分析变更影响',
      duration: 0,
      dependencies: []
    },
    workspaceRoot
  );

  vscode.window.showInformationMessage(`影响分析完成：${report.affectedFunctions.length} 个函数受影响`);
}
// @end
