// @intent: AI 服务接口，定义核心的 AI 生成能力。不绑定任何特定 AI 提供商（Claude、OpenAI 等），由适配层负责实现

// @entity: AIRequest
// AI 请求参数
export interface AIRequest {
  // 系统提示词，定义 AI 的角色和行为
  systemPrompt: string;

  // 用户消息，包含具体的任务描述
  userMessage: string;

  // 可选的对话历史（用于多轮对话场景）
  conversationHistory?: AIMessage[];

  // 可选的生成参数
  options?: AIGenerationOptions;
}

// @entity: AIMessage
// 对话消息
export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
}

// @entity: AIGenerationOptions
// AI 生成参数
export interface AIGenerationOptions {
  // 最大生成 token 数
  maxTokens?: number;

  // 温度参数（0-1，控制随机性）
  temperature?: number;

  // 超时时间（毫秒）
  timeout?: number;
}

// @entity: AIResponse
// AI 响应结果
export interface AIResponse {
  // 生成的内容
  content: string;

  // Token 使用统计
  usage: AIUsage;

  // 可选的元数据（如模型版本、请求 ID 等）
  metadata?: Record<string, any>;
}

// @entity: AIUsage
// Token 使用统计
export interface AIUsage {
  // 输入 token 数
  inputTokens: number;

  // 输出 token 数
  outputTokens: number;

  // 总 token 数
  totalTokens?: number;
}

// @interface: IAIService
// AI 服务接口
export interface IAIService {
  // @contract: generate(request: AIRequest) => Promise<AIResponse>
  // @step: [验证请求] 检查请求参数的有效性
  // @step: [调用 AI] 调用底层 AI 服务生成内容
  // @step: [解析响应] 解析 AI 服务的响应
  // @step: [返回结果] 返回标准化的 AIResponse
  // @boundary: 当请求参数无效时，抛出 ValidationError
  // @boundary: 当 AI 服务调用失败时，抛出 AIError
  // @boundary: 当超时时，抛出 TimeoutError
  generate(request: AIRequest): Promise<AIResponse>;
}
