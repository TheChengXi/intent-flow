import { CoreDIContainer } from '../../application/CoreDIContainer';
// @warn: HookManager/Hooks 已废弃（移至 .archive/retired-vscode.005/application/hooks）
import * as Tools from './tools';

/**
 * @intent
 * MCP 适配器的依赖注入容器，在 CoreDIContainer 之上注入 MCP 特定依赖（2 个 Tool）。
 * 屏蔽：CoreDIContainer 的实例化细节对 Tools 透明
 * 边界：其余两个 MCP 工具已移除（mcp-tools-removal），
 * 对应 use case 仍由 CLI 适配器使用，保留在 CoreDIContainer 中。
 *
 * 验收条件：
 * - getAllTools() 仅返回 checkFileSizeTool 与 projectIntentTool
 * - 无对已删工具类的引用
 */
// @note: HookManager 是 MCP 适配器的专属基础设施，不放在 CoreDIContainer 中

export class DIContainer {
  private static instance: DIContainer;

  // ==================== 核心依赖容器 ====================
  // @note: 所有核心依赖（数据层、核心应用层、基础用例）都由 CoreDIContainer 管理
  private core: CoreDIContainer;

  // ==================== MCP 特定依赖 ====================
  // @warn: hookManager 已废弃

  // @note: MCP Tools 封装基础用例，提供 MCP 协议接口
  public checkFileSizeTool: Tools.CheckFileSizeTool;
  public projectIntentTool: Tools.ProjectIntentTool;

  private constructor() {
    // 初始化核心依赖容器
    this.core = new CoreDIContainer();

    // @warn: HookManager + Hooks 注册已废弃

    // 初始化 MCP Tools（使用核心容器中的用例和 MCP 的 HookManager）
    this.checkFileSizeTool = new Tools.CheckFileSizeTool(
      this.core.checkFileSizeUseCase
    );
    this.projectIntentTool = new Tools.ProjectIntentTool(
      this.core.projectIntentUseCase
    );
  }

  // @warn: registerHooks() 已废弃（hooks 全部移至 .archive/retired-vscode.005）

  // @contract: getInstance() => DIContainer
  // @step: [单例模式] 如果实例不存在，创建新实例
  // @step: [返回实例] 返回单例实例
  // @boundary: 全局只有一个实例
  static getInstance(): DIContainer {
    if (!DIContainer.instance) {
      DIContainer.instance = new DIContainer();
    }
    return DIContainer.instance;
  }

  // @contract: getAllTools() => MCPToolHandler[]
  // @step: [返回工具列表] 返回所有 MCP Tools
  // @boundary: 返回的工具列表现在是 2 个工具
  getAllTools() {
    return [
      this.checkFileSizeTool,
      this.projectIntentTool
    ];
  }

  // @contract: getCore() => CoreDIContainer
  // @step: [返回核心容器] 返回核心依赖容器
  // @note: 提供对核心依赖的访问（用于测试或特殊场景）
  getCore(): CoreDIContainer {
    return this.core;
  }
}
