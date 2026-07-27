import * as vscode from 'vscode';
import * as path from 'path';
import { VSCodeDIContainer } from '../VSCodeDIContainer';
import { TranslateCodeUseCase } from '../application/useCases/TranslateCodeUseCase';
import * as CommentParser from '../services/CommentParser';

/**
 * @deprecated MCP 工具已取代此功能（见 project_intent / trace_dependency_chain）。
 *             VSCode 命令保留仅作为遗留入口，不再主动开发。
 * @intent
 * VSCode 转译命令 - 将选中的代码转译为 CDD 注释（已废弃）。
 * 旧系统的保留残留，通过 VSCodeDIContainer 获取依赖。
 * 边界：当未选中文本或未打开编辑器时，显示错误
 */
export async function execute(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('未打开编辑器');
    return;
  }

  const selection = editor.selection;
  if (selection.isEmpty) {
    vscode.window.showErrorMessage('请选中要转译的代码块');
    return;
  }

  const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
  if (!workspaceRoot) {
    vscode.window.showErrorMessage('未打开工作区');
    return;
  }

  const container = VSCodeDIContainer.getInstance();

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: '正在转译为注释...',
      cancellable: false
    },
    async (progress) => {
      try {
        progress.report({ message: '读取编译规范...' });
        const specPath = path.join(workspaceRoot, '.cdd', 'compile-spec.md');
        const fileRepo = container.getCore().fileRepo;
        const compileSpec = (await fileRepo.exists(specPath))
          ? await fileRepo.readFile(specPath)
          : '';

        progress.report({ message: '转译代码...' });
        const selectedText = editor.document.getText(selection);

        const translateUseCase = new TranslateCodeUseCase(
          container.aiService,
          container.getCore().fileRepo
        );

        const result = await translateUseCase.execute({
          code: selectedText,
          compileSpec,
          filePath: editor.document.uri.fsPath,
          languageId: editor.document.languageId,
          targetLanguage: container.configAdapter.get<string>('targetLanguage')
        });

        progress.report({ message: '插入注释...' });
        const insertPosition = selection.start;
        await editor.edit(editBuilder => {
          editBuilder.insert(insertPosition, result.comments + '\n');
        });

        vscode.window.showInformationMessage('✅ 注释已生成，请人工审查后再编译');

      } catch (error: any) {
        vscode.window.showErrorMessage(`❌ 转译失败：${error.message}`);
      }
    }
  );
}
