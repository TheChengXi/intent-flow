// @intent: 处理 CDD Chat Participant 的对话请求，路由到不同的功能模块

import * as vscode from 'vscode';
import { PlannerVM } from '../application/roles/PlannerVM';
import { TranslatorVM } from '../application/roles/TranslatorVM';
import { DevelopmentAssistantVM, DevelopmentAssistantContext } from '../application/roles/DevelopmentAssistantVM';
import { DevelopmentAssistantContextManager } from '../application/context/DevelopmentAssistantContextManager';
import { ClaudeAPIService } from '../data/services/ClaudeAPIService';

// @contract: handleCDDChat(request: vscode.ChatRequest, context: vscode.ChatContext, stream: vscode.ChatResponseStream, token: vscode.CancellationToken) => Promise<vscode.ChatResult>
// @step: [解析命令] 从 request.command 获取子命令
// @step: [路由处理] 根据命令路由到对应的处理函数
// @step: [返回结果] 返回 ChatResult
// @boundary: 当发生错误时，在 stream 中输出错误信息
export async function handleCDDChat(
  request: vscode.ChatRequest,
  context: vscode.ChatContext,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken
): Promise<vscode.ChatResult> {

  const command = request.command;
  const prompt = request.prompt;

  try {
    switch (command) {
      case 'plan':
        return await handlePlan(prompt, stream, token);

      case 'translate':
        return await handleTranslate(prompt, stream, token);

      case 'da':
      case 'dev-assistant':
      case 'development-assistant':
        return await handleDevelopmentAssistant(prompt, stream, context, token);

      default:
        return await handleGeneral(prompt, stream, token);
    }
  } catch (error: any) {
    stream.markdown(`❌ Error: ${error.message}\n`);
    return { metadata: { command } };
  }
}

// @contract: handlePlan(prompt: string, stream: vscode.ChatResponseStream, token: vscode.CancellationToken) => Promise<vscode.ChatResult>
// @step: [输出提示] 输出分析提示信息
// @step: [获取工作区] 获取当前工作区路径
// @step: [调用规划器] 调用 PlannerVM.generateArchitectureView 生成架构视图
// @step: [输出架构] 将架构视图格式化输出到 stream
// @step: [返回结果] 返回 ChatResult
// @boundary: 当工作区为空时，提示用户打开工作区
async function handlePlan(
  prompt: string,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken
): Promise<vscode.ChatResult> {

  stream.markdown('🔍 Analyzing project architecture...\n\n');

  // 获取工作区路径
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    stream.markdown('❌ Please open a workspace first.\n');
    return { metadata: { command: 'plan' } };
  }

  const workspaceRoot = workspaceFolders[0].uri.fsPath;

  // 调用项目规划器生成架构视图
  const view = await PlannerVM.generateArchitectureView(workspaceRoot, prompt || undefined);

  // 格式化输出
  const formattedOutput = PlannerVM.formatArchitectureView(view);
  stream.markdown(formattedOutput);

  return { metadata: { command: 'plan' } };
}

// @contract: handleTranslate(prompt: string, stream: vscode.ChatResponseStream, token: vscode.CancellationToken) => Promise<vscode.ChatResult>
// @step: [输出提示] 输出转译提示信息
// @step: [调用转译器] 调用 TranslatorVM.translateRequirement 转译需求
// @step: [输出注释] 将生成的注释输出到 stream
// @step: [添加按钮] 添加"插入到编辑器"按钮
// @step: [返回结果] 返回 ChatResult
async function handleTranslate(
  prompt: string,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken
): Promise<vscode.ChatResult> {

  stream.markdown('✍️ Translating requirement to CDD comments...\n\n');

  // 调用自然语言转译器
  const comment = await TranslatorVM.translateRequirement(prompt);

  // 输出注释
  stream.markdown('```typescript\n');
  stream.markdown(comment);
  stream.markdown('\n```\n\n');

  // 提供操作按钮
  stream.button({
    command: 'cdd.insertComment',
    title: 'Insert to Editor',
    arguments: [comment]
  });

  return { metadata: { command: 'translate' } };
}

// @contract: handleDevelopmentAssistant(prompt: string, stream: vscode.ChatResponseStream, context: vscode.ChatContext, token: vscode.CancellationToken) => Promise<vscode.ChatResult>
// @step: [获取工作区] 获取当前工作区路径
// @step: [加载会话] 加载或创建开发助手会话
// @step: [调用开发助手] 调用 DevelopmentAssistantVM 处理对话
// @step: [输出响应] 将响应输出到 stream
// @step: [保存会话] 保存会话状态
// @step: [检查完成] 如果完成，显示文档路径
// @boundary: 当工作区为空时，提示用户打开工作区
// @boundary: 当 API 调用失败时，显示错误信息
async function handleDevelopmentAssistant(
  prompt: string,
  stream: vscode.ChatResponseStream,
  context: vscode.ChatContext,
  token: vscode.CancellationToken
): Promise<vscode.ChatResult> {

  stream.markdown('💼 开发助手正在思考...\n\n');

  // 获取工作区路径
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    stream.markdown('❌ 请先打开一个工作区\n');
    return { metadata: { command: 'development-assistant' } };
  }

  const workspaceRoot = workspaceFolders[0].uri.fsPath;

  try {
    // 加载或创建会话
    let session = await DevelopmentAssistantContextManager.loadSession(workspaceRoot);
    if (!session) {
      session = DevelopmentAssistantContextManager.createSession(workspaceRoot);
      stream.markdown('👋 你好！我是开发助手。我会通过对话帮你将模糊的需求转化为清晰的需求文档。\n\n');
    }

    // 添加用户消息到会话
    DevelopmentAssistantContextManager.addTurn(session, 'user', prompt);

    // 调用开发助手 VM
    const apiService = new ClaudeAPIService();
    const vm = new DevelopmentAssistantVM(apiService);

    const daContext: DevelopmentAssistantContext = {
      workspaceRoot,
      userMessage: prompt,
      conversationHistory: session.conversationHistory
    };

    const result = await vm.execute(daContext);

    if (!result.success) {
      stream.markdown(`❌ 开发助手响应失败: ${result.message}\n`);
      return { metadata: { command: 'development-assistant' } };
    }

    // 提取响应
    const response = result.artifacts.response || result.artifacts.content;
    const phase = result.artifacts.phase;

    // 添加 AI 响应到会话
    DevelopmentAssistantContextManager.addTurn(session, 'assistant', response);

    // 更新阶段
    if (phase) {
      DevelopmentAssistantContextManager.updatePhase(session, phase);
    }

    // 保存会话
    await DevelopmentAssistantContextManager.saveSession(session);

    // 输出响应
    stream.markdown(response);
    stream.markdown('\n\n');

    // 显示当前阶段
    const phaseLabel = getPhaseLabel(phase);
    stream.markdown(`**当前阶段**: ${phaseLabel}\n\n`);

    // 检查是否完成
    if (phase === 'complete') {
      const docPath = result.artifacts.documentPath;
      stream.markdown(`✅ **需求文档已生成！**\n`);
      stream.markdown(`路径: \`${docPath}\`\n\n`);

      // 添加按钮
      stream.button({
        command: 'vscode.open',
        title: '打开需求文档',
        arguments: [vscode.Uri.file(docPath)]
      });

      stream.button({
        command: 'cdd.clearDevelopmentAssistantSession',
        title: '清除会话'
      });
    } else {
      stream.markdown('💬 继续对话，或使用 `/da clear` 清除会话\n');
    }

    return { metadata: { command: 'development-assistant', phase } };

  } catch (error: any) {
    stream.markdown(`❌ 错误: ${error.message}\n`);
    return { metadata: { command: 'development-assistant' } };
  }
}

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

// @contract: handleGeneral(prompt: string, stream: vscode.ChatResponseStream, token: vscode.CancellationToken) => Promise<vscode.ChatResult>
// @step: [输出欢迎] 输出欢迎信息和可用命令列表
// @step: [返回结果] 返回 ChatResult
async function handleGeneral(
  prompt: string,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken
): Promise<vscode.ChatResult> {

  stream.markdown('👋 Hi! I\'m the CDD Assistant.\n\n');
  stream.markdown('I can help you with:\n');
  stream.markdown('- `/plan` - Analyze project architecture\n');
  stream.markdown('- `/translate` - Translate requirements to CDD comments\n');
  stream.markdown('- `/da` - Development Assistant conversation (collect requirements)\n\n');
  stream.markdown('What would you like to do?\n');

  return { metadata: { command: 'general' } };
}
