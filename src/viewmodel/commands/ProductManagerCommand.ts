// @intent: 提供产品经理对话命令，通过多轮对话收集需求

import * as vscode from 'vscode';
import { ProductManagerVM, ProductManagerContext } from '../roles/ProductManagerVM';
import { ProductManagerContextManager, ProductManagerSession } from '../context/ProductManagerContextManager';
import { ClaudeAPIService } from '../../model/services/ClaudeAPIService';

// @contract: execute() => Promise<void>
// @step: [获取工作区] 获取当前工作区根路径
// @step: [加载会话] 尝试加载已有的产品经理会话
// @step: [获取用户输入] 通过输入框获取用户消息
// @step: [调用产品经理] 调用 ProductManagerVM 处理对话
// @step: [显示响应] 显示 AI 响应
// @step: [保存会话] 保存会话状态
// @boundary: 当工作区为空时，提示用户打开工作区
// @boundary: 当用户取消输入时，退出
// @boundary: 当对话完成时，显示需求文档路径
export async function execute(): Promise<void> {
  try {
    // 获取工作区根路径
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showErrorMessage('请先打开一个工作区');
      return;
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;

    // 加载或创建会话
    let session = await ProductManagerContextManager.loadSession(workspaceRoot);
    if (!session) {
      session = ProductManagerContextManager.createSession(workspaceRoot);

      // 显示欢迎消息
      const welcome = `👋 你好！我是产品经理。

我会通过对话帮你将模糊的需求转化为清晰的需求文档。

请告诉我：你想构建什么类型的应用？主要解决什么问题？`;

      vscode.window.showInformationMessage(welcome);
    } else {
      // 显示会话摘要
      const summary = ProductManagerContextManager.getConversationSummary(session);
      vscode.window.showInformationMessage(`继续之前的对话\n${summary}`);
    }

    // 开始对话循环
    await conversationLoop(session, workspaceRoot);

  } catch (error: any) {
    vscode.window.showErrorMessage(`产品经理对话失败: ${error.message}`);
    console.error('[ProductManagerCommand] 执行失败:', error);
  }
}
// @end

// @contract: conversationLoop(session: ProductManagerSession, workspaceRoot: string) => Promise<void>
// @step: [获取输入] 获取用户输入
// @step: [调用 VM] 调用 ProductManagerVM 处理
// @step: [显示响应] 显示 AI 响应
// @step: [更新会话] 更新会话状态
// @step: [保存会话] 保存会话
// @step: [检查完成] 如果完成，显示文档路径并退出
// @step: [继续循环] 否则继续对话
// @boundary: 当用户取消输入时，保存会话并退出
async function conversationLoop(
  session: ProductManagerSession,
  workspaceRoot: string
): Promise<void> {
  while (true) {
    // 获取用户输入
    const userInput = await vscode.window.showInputBox({
      prompt: `产品经理对话 - 阶段: ${getPhaseLabel(session.currentPhase)}`,
      placeHolder: '输入你的回答或需求...',
      ignoreFocusOut: true
    });

    // 用户取消输入
    if (!userInput) {
      await ProductManagerContextManager.saveSession(session);
      vscode.window.showInformationMessage('对话已暂停，下次可以继续');
      return;
    }

    // 添加用户消息到会话
    ProductManagerContextManager.addTurn(session, 'user', userInput);

    // 显示处理中提示
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: '产品经理正在思考...',
        cancellable: false
      },
      async (progress) => {
        progress.report({ increment: 0 });

        // 调用产品经理 VM
        const apiService = new ClaudeAPIService();
        const vm = new ProductManagerVM(apiService);

        const context: ProductManagerContext = {
          workspaceRoot,
          userMessage: userInput,
          conversationHistory: session.conversationHistory
        };

        const result = await vm.execute(context);

        progress.report({ increment: 100 });

        if (!result.success) {
          vscode.window.showErrorMessage(`产品经理响应失败: ${result.message}`);
          return;
        }

        // 提取响应
        const response = result.artifacts.response || result.artifacts.content;
        const phase = result.artifacts.phase;

        // 添加 AI 响应到会话
        ProductManagerContextManager.addTurn(session, 'assistant', response);

        // 更新阶段
        if (phase) {
          ProductManagerContextManager.updatePhase(session, phase);
        }

        // 保存会话
        await ProductManagerContextManager.saveSession(session);

        // 检查是否完成
        if (phase === 'complete') {
          const docPath = result.artifacts.documentPath;

          // 显示完成消息
          const action = await vscode.window.showInformationMessage(
            `✅ 需求文档已生成！\n路径: ${docPath}`,
            '打开文档',
            '清除会话'
          );

          if (action === '打开文档') {
            const doc = await vscode.workspace.openTextDocument(docPath);
            await vscode.window.showTextDocument(doc);
          } else if (action === '清除会话') {
            await ProductManagerContextManager.clearSession(workspaceRoot);
          }

          return;
        }

        // 显示 AI 响应
        await showResponse(response);
      }
    );
  }
}
// @end

// @contract: showResponse(response: string) => Promise<void>
// @step: [创建文档] 创建临时 Markdown 文档
// @step: [写入内容] 写入响应内容
// @step: [显示文档] 在编辑器中显示
// @boundary: 当文档创建失败时，使用消息框显示
async function showResponse(response: string): Promise<void> {
  try {
    // 创建临时 Markdown 文档
    const doc = await vscode.workspace.openTextDocument({
      content: `# 产品经理回复\n\n${response}`,
      language: 'markdown'
    });

    // 在编辑器中显示
    await vscode.window.showTextDocument(doc, {
      preview: true,
      viewColumn: vscode.ViewColumn.Beside
    });
  } catch (error) {
    // 回退到消息框
    vscode.window.showInformationMessage(response, { modal: true });
  }
}
// @end

// @contract: getPhaseLabel(phase: string) => string
// @step: [映射] 将阶段代码映射为中文标签
// @step: [返回] 返回标签
function getPhaseLabel(phase: string): string {
  const labels: Record<string, string> = {
    'intent': '理解整体意图',
    'features': '探索功能边界',
    'data-model': '设计数据模型',
    'architecture': '规划架构层次',
    'details': '确认实现细节',
    'complete': '完成'
  };

  return labels[phase] || phase;
}
// @end

// @contract: clearSession() => Promise<void>
// @step: [获取工作区] 获取当前工作区根路径
// @step: [清除会话] 调用 ProductManagerContextManager.clearSession
// @step: [显示消息] 显示清除成功消息
// @boundary: 当工作区为空时，提示用户打开工作区
export async function clearSession(): Promise<void> {
  try {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showErrorMessage('请先打开一个工作区');
      return;
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;

    await ProductManagerContextManager.clearSession(workspaceRoot);
    vscode.window.showInformationMessage('产品经理会话已清除');
  } catch (error: any) {
    vscode.window.showErrorMessage(`清除会话失败: ${error.message}`);
  }
}
// @end
