// @intent: 管理产品经理 Agent 的对话上下文，持久化对话历史

import * as fs from 'fs';
import * as path from 'path';
import { ConversationTurn, ProductManagerPhase, CollectedInfo } from '../roles/ProductManagerVM';

// @entity: ProductManagerSession
// 产品经理会话
export interface ProductManagerSession {
  sessionId: string;
  workspaceRoot: string;
  conversationHistory: ConversationTurn[];
  currentPhase: ProductManagerPhase;
  collectedInfo: CollectedInfo;
  createdAt: number;
  updatedAt: number;
}

export class ProductManagerContextManager {
  private static readonly CONTEXT_DIR = '.cdd';
  private static readonly SESSION_FILE = 'product-manager-session.json';

  // @contract: saveSession(session: ProductManagerSession) => Promise<void>
  // @step: [构建路径] 构建会话文件路径
  // @step: [确保目录] 确保 .cdd 目录存在
  // @step: [序列化] 将会话对象序列化为 JSON
  // @step: [写入文件] 写入会话文件
  // @boundary: 当写入失败时，抛出错误
  static async saveSession(session: ProductManagerSession): Promise<void> {
    const sessionPath = this.getSessionPath(session.workspaceRoot);

    // 确保目录存在
    const dir = path.dirname(sessionPath);
    await fs.promises.mkdir(dir, { recursive: true });

    // 更新时间戳
    session.updatedAt = Date.now();

    // 写入文件
    const content = JSON.stringify(session, null, 2);
    await fs.promises.writeFile(sessionPath, content, 'utf-8');
  }
  // @end

  // @contract: loadSession(workspaceRoot: string) => Promise<ProductManagerSession | null>
  // @step: [构建路径] 构建会话文件路径
  // @step: [检查存在] 检查文件是否存在
  // @step: [读取文件] 读取会话文件
  // @step: [反序列化] 将 JSON 反序列化为会话对象
  // @step: [返回] 返回会话对象或 null
  // @boundary: 当文件不存在时，返回 null
  // @boundary: 当文件格式错误时，返回 null
  static async loadSession(workspaceRoot: string): Promise<ProductManagerSession | null> {
    const sessionPath = this.getSessionPath(workspaceRoot);

    try {
      // 检查文件是否存在
      await fs.promises.access(sessionPath);

      // 读取文件
      const content = await fs.promises.readFile(sessionPath, 'utf-8');

      // 反序列化
      const session: ProductManagerSession = JSON.parse(content);

      return session;
    } catch (error) {
      // 文件不存在或格式错误
      return null;
    }
  }
  // @end

  // @contract: createSession(workspaceRoot: string) => ProductManagerSession
  // @step: [生成 ID] 生成唯一的会话 ID
  // @step: [初始化] 初始化会话对象
  // @step: [返回] 返回新会话
  static createSession(workspaceRoot: string): ProductManagerSession {
    const sessionId = this.generateSessionId();
    const now = Date.now();

    return {
      sessionId,
      workspaceRoot,
      conversationHistory: [],
      currentPhase: 'intent',
      collectedInfo: {},
      createdAt: now,
      updatedAt: now
    };
  }
  // @end

  // @contract: addTurn(session: ProductManagerSession, role: 'user' | 'assistant', content: string) => void
  // @step: [创建轮次] 创建新的对话轮次
  // @step: [添加到历史] 添加到对话历史
  // @step: [更新时间] 更新会话时间戳
  static addTurn(
    session: ProductManagerSession,
    role: 'user' | 'assistant',
    content: string
  ): void {
    const turn: ConversationTurn = {
      role,
      content,
      timestamp: Date.now()
    };

    session.conversationHistory.push(turn);
    session.updatedAt = Date.now();
  }
  // @end

  // @contract: updatePhase(session: ProductManagerSession, phase: ProductManagerPhase) => void
  // @step: [更新阶段] 更新当前阶段
  // @step: [更新时间] 更新会话时间戳
  static updatePhase(session: ProductManagerSession, phase: ProductManagerPhase): void {
    session.currentPhase = phase;
    session.updatedAt = Date.now();
  }
  // @end

  // @contract: clearSession(workspaceRoot: string) => Promise<void>
  // @step: [构建路径] 构建会话文件路径
  // @step: [删除文件] 删除会话文件
  // @boundary: 当文件不存在时，忽略错误
  static async clearSession(workspaceRoot: string): Promise<void> {
    const sessionPath = this.getSessionPath(workspaceRoot);

    try {
      await fs.promises.unlink(sessionPath);
    } catch (error) {
      // 文件不存在，忽略
    }
  }
  // @end

  // @contract: getSessionPath(workspaceRoot: string) => string
  // @step: [构建路径] 构建 .cdd/product-manager-session.json 路径
  // @step: [返回] 返回路径
  private static getSessionPath(workspaceRoot: string): string {
    return path.join(workspaceRoot, this.CONTEXT_DIR, this.SESSION_FILE);
  }
  // @end

  // @contract: generateSessionId() => string
  // @step: [生成 ID] 生成基于时间戳和随机数的唯一 ID
  // @step: [返回] 返回 ID
  private static generateSessionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 9);
    return `pm-${timestamp}-${random}`;
  }
  // @end

  // @contract: getConversationSummary(session: ProductManagerSession) => string
  // @step: [统计] 统计对话轮次
  // @step: [格式化] 格式化会话摘要
  // @step: [返回] 返回摘要字符串
  static getConversationSummary(session: ProductManagerSession): string {
    const turnCount = session.conversationHistory.length;
    const duration = session.updatedAt - session.createdAt;
    const durationMinutes = Math.floor(duration / 60000);

    return `会话 ${session.sessionId}
- 阶段: ${this.getPhaseLabel(session.currentPhase)}
- 对话轮次: ${turnCount}
- 持续时间: ${durationMinutes} 分钟
- 创建时间: ${new Date(session.createdAt).toLocaleString()}
- 更新时间: ${new Date(session.updatedAt).toLocaleString()}`;
  }
  // @end

  // @contract: getPhaseLabel(phase: ProductManagerPhase) => string
  // @step: [映射] 将阶段代码映射为中文标签
  // @step: [返回] 返回标签
  private static getPhaseLabel(phase: ProductManagerPhase): string {
    const labels: Record<ProductManagerPhase, string> = {
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
}
