"use strict";
// @intent: 处理 CDD Chat Participant 的对话请求，路由到不同的功能模块
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleCDDChat = handleCDDChat;
const PlannerVM_1 = require("../viewmodel/roles/PlannerVM");
const TranslatorVM_1 = require("../viewmodel/roles/TranslatorVM");
// @contract: handleCDDChat(request: vscode.ChatRequest, context: vscode.ChatContext, stream: vscode.ChatResponseStream, token: vscode.CancellationToken) => Promise<vscode.ChatResult>
// @step: [解析命令] 从 request.command 获取子命令
// @step: [路由处理] 根据命令路由到对应的处理函数
// @step: [返回结果] 返回 ChatResult
// @boundary: 当发生错误时，在 stream 中输出错误信息
async function handleCDDChat(request, context, stream, token) {
    const command = request.command;
    const prompt = request.prompt;
    try {
        switch (command) {
            case 'plan':
                return await handlePlan(prompt, stream, token);
            case 'translate':
                return await handleTranslate(prompt, stream, token);
            default:
                return await handleGeneral(prompt, stream, token);
        }
    }
    catch (error) {
        stream.markdown(`❌ Error: ${error.message}\n`);
        return { metadata: { command } };
    }
}
// @contract: handlePlan(prompt: string, stream: vscode.ChatResponseStream, token: vscode.CancellationToken) => Promise<vscode.ChatResult>
// @step: [输出提示] 输出分析提示信息
// @step: [读取项目结构] 调用 readProjectIntents 读取项目的所有 @intent
// @step: [调用规划师] 调用 PlannerVM.generatePlan 生成计划
// @step: [输出计划] 将计划格式化输出到 stream
// @step: [返回结果] 返回 ChatResult
// @boundary: 当读取项目结构失败时，使用空的项目结构
async function handlePlan(prompt, stream, token) {
    stream.markdown('🔍 Analyzing change impact...\n\n');
    // 读取项目结构（所有 @intent）
    const projectState = await readProjectIntents();
    // 调用迭代规划师
    const plan = await PlannerVM_1.PlannerVM.generatePlan(prompt, projectState);
    // 输出计划
    stream.markdown(`## Change Plan: ${prompt}\n\n`);
    stream.markdown(`### Impact Analysis\n`);
    stream.markdown(`- Affected modules: ${plan.impact.affectedModules.join(', ')}\n`);
    stream.markdown(`- Affected files: ${plan.impact.affectedFiles.join(', ')}\n\n`);
    stream.markdown(`### Task List\n`);
    plan.tasks.forEach((task, index) => {
        stream.markdown(`${index + 1}. ${task.description}\n`);
        stream.markdown(`   - Agent: ${task.agent}\n`);
        stream.markdown(`   - Estimated time: ${task.estimatedTime}\n\n`);
    });
    if (plan.risks.length > 0) {
        stream.markdown(`### Risks\n`);
        plan.risks.forEach(risk => {
            stream.markdown(`- ⚠️ ${risk}\n`);
        });
    }
    return { metadata: { command: 'plan' } };
}
// @contract: handleTranslate(prompt: string, stream: vscode.ChatResponseStream, token: vscode.CancellationToken) => Promise<vscode.ChatResult>
// @step: [输出提示] 输出转译提示信息
// @step: [调用转译器] 调用 TranslatorVM.translateRequirement 转译需求
// @step: [输出注释] 将生成的注释输出到 stream
// @step: [添加按钮] 添加"插入到编辑器"按钮
// @step: [返回结果] 返回 ChatResult
async function handleTranslate(prompt, stream, token) {
    stream.markdown('✍️ Translating requirement to CDD comments...\n\n');
    // 调用自然语言转译器
    const comment = await TranslatorVM_1.TranslatorVM.translateRequirement(prompt);
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
// @contract: handleGeneral(prompt: string, stream: vscode.ChatResponseStream, token: vscode.CancellationToken) => Promise<vscode.ChatResult>
// @step: [输出欢迎] 输出欢迎信息和可用命令列表
// @step: [返回结果] 返回 ChatResult
async function handleGeneral(prompt, stream, token) {
    stream.markdown('👋 Hi! I\'m the CDD Assistant.\n\n');
    stream.markdown('I can help you with:\n');
    stream.markdown('- `/plan` - Analyze change impact and generate implementation plan\n');
    stream.markdown('- `/translate` - Translate requirements to CDD comments\n\n');
    stream.markdown('What would you like to do?\n');
    return { metadata: { command: 'general' } };
}
// @contract: readProjectIntents() => Promise<ProjectState>
// @step: [TODO] 读取项目中所有的 @intent
// @step: [返回] 返回项目结构
// @boundary: 当读取失败时，返回空的项目结构
async function readProjectIntents() {
    // TODO: 实现读取项目 @intent 的逻辑
    return {
        intent: 'CDD Framework',
        modules: []
    };
}
//# sourceMappingURL=CDDChatHandler.js.map