import * as vscode from 'vscode';
import { VSCodeDIContainer } from '../VSCodeDIContainer';
import { ReviewCodeUseCase } from '../application/useCases/ReviewCodeUseCase';
import * as CommentParser from '../services/CommentParser';

/**
 * @deprecated MCP 工具已取代此功能（AI 工具链可直接审查代码）。
 *             VSCode 命令保留仅作为遗留入口，不再主动开发。
 * @intent
 * VSCode 审查命令 - 审查代码是否符合 CDD 注释（已废弃）。
 * 旧系统的保留残留，通过 VSCodeDIContainer 获取依赖。
 * 边界：当未打开编辑器时，显示错误
 */
export async function execute(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('未打开编辑器');
    return;
  }

  const selection = editor.selection;
  if (selection.isEmpty) {
    vscode.window.showErrorMessage('请选中包含 @contract 的函数');
    return;
  }

  const container = VSCodeDIContainer.getInstance();

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: '正在审查代码...',
      cancellable: false
    },
    async (progress) => {
      try {
        progress.report({ message: '解析注释...' });
        const selectedText = editor.document.getText(selection);
        const comment = CommentParser.parseComment(selectedText, editor.document, selection.start.line);

        if (!comment) {
          throw new Error('无法解析 CDD 注释，请检查格式');
        }

        // 从选区末尾到文件末尾取代码
        const codeStartOffset = editor.document.offsetAt(selection.end);
        const code = editor.document.getText().slice(codeStartOffset).trim();
        if (!code) {
          throw new Error('未找到待审查的代码');
        }

        progress.report({ message: '调用 AI 审查...' });
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
        const reviewUseCase = new ReviewCodeUseCase(
          container.aiService,
          container.getCore().fileRepo
        );

        const result = await reviewUseCase.execute({
          comment,
          code,
          compileSpec: ''
        });

        // 显示审查结果
        const outputChannel = vscode.window.createOutputChannel('CDD - 审查报告');
        outputChannel.clear();
        outputChannel.appendLine('=== 审查报告 ===\n');
        outputChannel.appendLine(`函数：${result.report.functionName}`);
        outputChannel.appendLine(`结论：${result.report.conclusion}`);
        outputChannel.appendLine('');
        outputChannel.appendLine('维度评分：');
        for (const dim of result.report.dimensions) {
          const icon = dim.status === 'PASS' ? '✓' : dim.status === 'WARN' ? '⚠' : '✗';
          outputChannel.appendLine(`  ${icon} ${dim.name}: ${dim.status}`);
        }
        if (result.report.inconsistencies.length > 0) {
          outputChannel.appendLine('\n不一致项：');
          for (const inc of result.report.inconsistencies) {
            outputChannel.appendLine(`  - [${inc.type}] ${inc.description}`);
          }
        }
        outputChannel.show();

        const summary = result.report.conclusion === 'PASS'
          ? '✅ 代码通过审查'
          : result.needsArbitration
            ? '⚠️ 发现严重违规，需要人工裁决'
            : '⚠️ 发现轻微偏差';
        vscode.window.showInformationMessage(summary);

      } catch (error: any) {
        vscode.window.showErrorMessage(`❌ 审查失败：${error.message}`);
      }
    }
  );
}
