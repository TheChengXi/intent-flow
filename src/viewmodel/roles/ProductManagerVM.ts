// @intent: 产品经理 Agent，通过多轮对话将模糊需求转化为结构化需求文档

import { BaseRole, RoleResult } from './BaseRole';
import { ClaudeAPIService } from '../../model/services/ClaudeAPIService';
import * as fs from 'fs';
import * as path from 'path';

// @entity: ProductManagerContext
// 产品经理上下文
export interface ProductManagerContext {
  workspaceRoot: string;
  userMessage: string;
  conversationHistory?: ConversationTurn[];
}

// @entity: ConversationTurn
// 对话轮次
export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

// @entity: ProductManagerPhase
// 产品经理对话阶段
export type ProductManagerPhase =
  | 'intent'           // 理解整体意图
  | 'features'         // 探索功能边界
  | 'data-model'       // 设计数据模型
  | 'architecture'     // 规划架构层次
  | 'details'          // 确认实现细节
  | 'complete';        // 完成

// @entity: CollectedInfo
// 已收集的需求信息
export interface CollectedInfo {
  projectIntent?: string;
  userGroup?: string;
  features?: string[];
  dataModels?: DataModel[];
  architecture?: ArchitectureDecision;
  businessRules?: BusinessRule[];
  implementationDetails?: ImplementationDetail[];
}

export interface DataModel {
  name: string;
  purpose: string;
  fields: Field[];
  relationships: Relationship[];
}

export interface Field {
  name: string;
  type: string;
  description: string;
  required: boolean;
}

export interface Relationship {
  target: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
}

export interface ArchitectureDecision {
  projectType: string;
  techStack: string;
  pattern: string;
  modules: Module[];
}

export interface Module {
  name: string;
  responsibility: string;
}

export interface BusinessRule {
  name: string;
  scenario: string;
  behavior: string;
  exception: string;
}

export interface ImplementationDetail {
  feature: string;
  logic: string;
  validation: string;
  errorHandling: string;
}

export class ProductManagerVM extends BaseRole {
  private promptTemplate: string = '';

  constructor(apiService: ClaudeAPIService) {
    super(apiService);
  }

  // @contract: execute(context: ProductManagerContext) => Promise<RoleResult>
  // @step: [加载提示词] 读取 product-manager.md 提示词模板
  // @step: [构建消息] 构建对话历史和当前用户消息
  // @step: [调用 API] 调用 Claude API 进行对话
  // @step: [解析响应] 解析 AI 响应，判断是否完成需求收集
  // @step: [保存文档] 如果完成，保存需求文档到 _source/BUSINESS_RULES.md
  // @step: [返回结果] 返回对话响应或需求文档路径
  // @boundary: 当工作区路径为空时，返回 success: false
  // @boundary: 当 API 调用失败时，返回错误信息
  // @boundary: 当提示词文件不存在时，使用默认提示词
  async execute(context: ProductManagerContext): Promise<RoleResult> {
    try {
      if (!context.workspaceRoot) {
        return {
          success: false,
          message: '工作区路径为空',
          artifacts: null
        };
      }

      // 加载提示词模板
      if (!this.promptTemplate) {
        this.promptTemplate = await this.loadPromptTemplate(context.workspaceRoot);
      }

      // 构建对话消息
      const messages = this.buildMessages(context);

      // 调用 API
      const apiResponse = await this.apiService.callAPI(
        {
          role: 'product-manager',
          userMessage: context.userMessage,
          conversationHistory: messages
        },
        '', // API key 从配置读取
        '', // API base URL 从配置读取
        ''  // Model ID 从配置读取
      );

      // 提取响应内容
      const response = apiResponse.content;

      // 检查是否完成需求收集
      const isComplete = this.checkIfComplete(response);

      if (isComplete) {
        // 保存需求文档
        const docPath = await this.saveRequirementDocument(
          context.workspaceRoot,
          response
        );

        return {
          success: true,
          message: '需求文档已生成',
          artifacts: {
            documentPath: docPath,
            content: response,
            phase: 'complete'
          }
        };
      }

      // 返回对话响应
      return {
        success: true,
        message: '继续对话',
        artifacts: {
          response,
          phase: this.detectPhase(response)
        }
      };

    } catch (error: any) {
      return {
        success: false,
        message: error.message,
        artifacts: error
      };
    }
  }
  // @end

  // @contract: loadPromptTemplate(workspaceRoot: string) => Promise<string>
  // @step: [构建路径] 构建 _source/prompts/product-manager.md 路径
  // @step: [读取文件] 读取提示词文件
  // @step: [返回内容] 返回文件内容
  // @boundary: 当文件不存在时，返回默认提示词
  private async loadPromptTemplate(workspaceRoot: string): Promise<string> {
    const promptPath = path.join(
      workspaceRoot,
      '_source',
      'prompts',
      'product-manager.md'
    );

    try {
      const content = await fs.promises.readFile(promptPath, 'utf-8');
      return content;
    } catch (error) {
      console.warn('[ProductManagerVM] 提示词文件不存在，使用默认提示词');
      return this.getDefaultPrompt();
    }
  }
  // @end

  // @contract: buildMessages(context: ProductManagerContext) => any[]
  // @step: [添加系统消息] 将提示词模板作为系统消息
  // @step: [添加历史] 添加对话历史
  // @step: [添加当前消息] 添加当前用户消息
  // @step: [返回] 返回消息数组
  private buildMessages(context: ProductManagerContext): any[] {
    const messages: any[] = [];

    // 添加系统消息（提示词模板）
    messages.push({
      role: 'system',
      content: this.promptTemplate
    });

    // 添加对话历史
    if (context.conversationHistory && context.conversationHistory.length > 0) {
      for (const turn of context.conversationHistory) {
        messages.push({
          role: turn.role,
          content: turn.content
        });
      }
    }

    // 添加当前用户消息
    messages.push({
      role: 'user',
      content: context.userMessage
    });

    return messages;
  }
  // @end

  // @contract: checkIfComplete(response: string) => boolean
  // @step: [检查标记] 检查响应中是否包含完成标记
  // @step: [返回] 返回是否完成
  private checkIfComplete(response: string): boolean {
    // 检查是否包含完成标记
    return response.includes('✅ 产品经理完成') ||
           response.includes('# 需求文档：');
  }
  // @end

  // @contract: detectPhase(response: string) => ProductManagerPhase
  // @step: [关键词匹配] 根据响应内容中的关键词判断当前阶段
  // @step: [返回阶段] 返回当前阶段
  private detectPhase(response: string): ProductManagerPhase {
    const lowerResponse = response.toLowerCase();

    if (lowerResponse.includes('核心目标') || lowerResponse.includes('主要解决')) {
      return 'intent';
    }
    if (lowerResponse.includes('功能模块') || lowerResponse.includes('功能范围')) {
      return 'features';
    }
    if (lowerResponse.includes('数据模型') || lowerResponse.includes('实体') || lowerResponse.includes('字段')) {
      return 'data-model';
    }
    if (lowerResponse.includes('架构') || lowerResponse.includes('技术栈') || lowerResponse.includes('模块划分')) {
      return 'architecture';
    }
    if (lowerResponse.includes('实现细节') || lowerResponse.includes('计算逻辑')) {
      return 'details';
    }

    return 'intent';
  }
  // @end

  // @contract: saveRequirementDocument(workspaceRoot: string, content: string) => Promise<string>
  // @step: [构建路径] 构建 _source/BUSINESS_RULES.md 路径
  // @step: [确保目录] 确保 _source 目录存在
  // @step: [写入文件] 写入需求文档
  // @step: [返回路径] 返回文件路径
  // @boundary: 当写入失败时，抛出错误
  private async saveRequirementDocument(
    workspaceRoot: string,
    content: string
  ): Promise<string> {
    const docPath = path.join(workspaceRoot, '_source', 'BUSINESS_RULES.md');

    // 确保目录存在
    const dir = path.dirname(docPath);
    await fs.promises.mkdir(dir, { recursive: true });

    // 写入文件
    await fs.promises.writeFile(docPath, content, 'utf-8');

    return docPath;
  }
  // @end

  // @contract: getDefaultPrompt() => string
  // @step: [返回] 返回默认的产品经理提示词
  private getDefaultPrompt(): string {
    return `你是产品经理。你的职责是通过对话将用户的模糊需求转化为清晰、无歧义的需求文档。

## 你的工作流程

1. 理解整体意图：询问项目核心目标、解决的问题、目标用户
2. 探索功能边界：逐步细化功能范围，使用具体场景验证理解
3. 设计数据模型：询问实体字段、类型、关系
4. 规划架构层次：识别项目类型、技术栈、架构模式
5. 确认实现细节：询问计算逻辑、验证规则、错误处理

## 对话原则

- 渐进式提问：从大到小，从抽象到具体
- 一次一个主题：不要同时问多个不相关的问题
- 提供推荐答案：对于每个问题，给出你的建议
- 使用具体场景：用实际例子帮助用户思考
- 验证理解：定期总结已确认的内容

## 输出格式

当所有信息收集完毕后，输出完整的需求文档，包含：
- 项目意图
- 用户群体
- 核心功能
- 数据模型
- 架构决策
- 业务规则
- 实现细节
- 非功能需求
- MVP 范围

最后添加标记：✅ 产品经理完成。建议下一步：架构探讨者。`;
  }
  // @end
}
