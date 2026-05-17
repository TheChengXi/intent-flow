import * as vscode from 'vscode';
import { PlannerVM, PlannerContext } from '../roles/PlannerVM';
import { ClaudeAPIService } from '../../model/services/ClaudeAPIService';
import * as WorkScheduleRepo from '../../model/repositories/WorkScheduleRepo';


// @contract: execute() => Promise<void>
// @step: [验证] 检查工作区是否打开，未打开则显示错误并返回
// @step: [初始化] 创建 ClaudeAPIService 和 PlannerVM 实例
// @step: [执行] 在进度通知中运行 plannerVM.execute() 分析变更影响
// @step: [检查] 若分析失败，显示错误消息并返回
// @step: [生成] 构建 Markdown 格式的变更影响分析报告
// @step: [展示] 在编辑器中打开并显示报告文档
// @step: [记录] 将分析操作记录到工作计划仓库
// @step: [通知] 显示完成消息，包含受影响函数数量
// @boundary: 当工作区未打开时，显示错误消息 '未打开工作区' 并返回
// @boundary: 当 plannerVM.execute() 返回失败结果时，显示错误消息并返回
// @boundary: 当受影响函数列表为空时，报告中显示 '无'
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
