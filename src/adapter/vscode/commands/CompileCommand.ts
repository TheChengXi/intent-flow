import * as vscode from 'vscode';
import * as path from 'path';
import { VSCodeDIContainer } from '../VSCodeDIContainer';
import { CompileCodeUseCase } from '../application/useCases/CompileCodeUseCase';
import * as CommentParser from '../services/CommentParser';

/**
 * @deprecated MCP 工具已取代此功能（见 trace_dependency_chain / check_file_size）。
 *             VSCode 命令保留仅作为遗留入口，不再主动开发。
 * @intent
 * VSCode 编译命令 - 将选中的 CDD 注释编译为代码（已废弃）。
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
    vscode.window.showErrorMessage('请选中包含 @contract 的函数');
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
      title: '正在编译 CDD 注释...',
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

        progress.report({ message: '读取编译规范...' });
        const specPath = path.join(workspaceRoot, '.cdd', 'compile-spec.md');
        const fileRepo = container.getCore().fileRepo;
        const compileSpec = (await fileRepo.exists(specPath))
          ? await fileRepo.readFile(specPath)
          : '';

        progress.report({ message: '生成代码...' });
        const compileUseCase = new CompileCodeUseCase(
          container.getCore().extractFullContextUseCase,
          container.aiService,
          container.getCore().fileRepo
        );

        const result = await compileUseCase.execute({
          comment,
          compileSpec,
          filePath: editor.document.uri.fsPath,
          targetLanguage: container.configAdapter.get<string>('targetLanguage')
        });

        progress.report({ message: '插入代码...' });
        await editor.edit(editBuilder => {
          editBuilder.replace(selection, result.code);
        });

        let message = `✅ 编译完成：${comment.contract.functionName}`;
        if (result.missingContracts.length > 0) {
          message += `\n⚠️ 警告：发现未知依赖函数：${result.missingContracts.join(', ')}`;
        }
        vscode.window.showInformationMessage(message);

      } catch (error: any) {
        vscode.window.showErrorMessage(`❌ 编译失败：${error.message}`);
      }
    }
  );
}
