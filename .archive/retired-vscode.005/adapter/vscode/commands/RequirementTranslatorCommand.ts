import * as vscode from 'vscode';
import { VSCodeDIContainer } from '../VSCodeDIContainer';
import { TranslateRequirementUseCase } from '../application/useCases/TranslateRequirementUseCase';

/**
 * @deprecated MCP 工具已取代此功能（见 project_intent / trace_dependency_chain）。
 *             VSCode 命令保留仅作为遗留入口，不再主动开发。
 * @intent
 * VSCode 需求转译命令 - 将自然语言需求转译为 CDD 格式的注释（已废弃）。
 * 旧系统的保留残留，通过 VSCodeDIContainer 获取依赖。
 * 边界：当未打开编辑器时，显示错误；当未输入需求时，取消操作
 */
export async function execute(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('未打开编辑器');
    return;
  }

  const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
  if (!workspaceRoot) {
    vscode.window.showErrorMessage('未打开工作区');
    return;
  }

  // 优先使用选中的文本作为需求，否则弹出输入框
  const selection = editor.selection;
  let requirement: string | undefined;

  if (!selection.isEmpty) {
    requirement = editor.document.getText(selection);
  } else {
    requirement = await vscode.window.showInputBox({
      prompt: '请输入需求描述',
      placeHolder: '例如：实现一个计算折扣价格的函数'
    });
  }

  if (!requirement) {
    return;
  }

  const container = VSCodeDIContainer.getInstance();

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: '正在转译需求...',
      cancellable: false
    },
    async (progress) => {
      try {
        progress.report({ message: '生成 CDD 注释...' });
        const translateUseCase = new TranslateRequirementUseCase(
          container.aiService,
          container.getCore().fileRepo
        );

        const result = await translateUseCase.execute({
          requirement,
          targetLanguage: container.configAdapter.get<string>('targetLanguage')
        });

        progress.report({ message: '插入注释...' });
        const insertPosition = selection.isEmpty ? editor.selection.active : selection.start;
        await editor.edit(editBuilder => {
          editBuilder.insert(insertPosition, result.comments + '\n\n');
        });

        vscode.window.showInformationMessage('✅ 需求转译完成，请人工审查后再编译');

      } catch (error: any) {
        vscode.window.showErrorMessage(`❌ 需求转译失败：${error.message}`);
      }
    }
  );
}
