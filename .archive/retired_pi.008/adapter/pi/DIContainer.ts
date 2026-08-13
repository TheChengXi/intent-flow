/**
 * @intent
 * pi 适配器依赖注入容器。管理：agentRepo（经 CoreDIContainer 获取，adapter 不直接 new data 实现）、rpcPool（进程池）、agentMessagingService（通信服务）、agentRequestUseCase（send+await 合成用例，agent_chat 工具的后端）、agentCommTools（单工具 agent_chat）、listAgentsTool、toolAccessGuard、guardToggleService、agentTracker。spawn_agent 组件（SpawnAgentUseCase/SpawnAgentTool/SubProcessRunner）已移除，由通信组件取代。
 * 边界：本容器不 import data 层任何模块；data 实现统一经 CoreDIContainer（application）获取。
 * 验收条件：
 * - 容器组装后 agentCommTools/agentMessagingService/agentRequestUseCase 均可实例化
 * - 不出现 spawnAgentUseCase/spawnAgentTool/subProcessRunner 残留引用
 */




import { RpcProcessPool } from './runtime/RpcProcessPool';
import { AgentMessagingService } from './runtime/AgentMessagingService';
import { DiscoverAgentsUseCase } from '../../application/useCases/DiscoverAgentsUseCase';
import { AgentRequestUseCase } from '../../application/useCases/AgentRequestUseCase';
import { AgentCommTools } from './tools/AgentCommTools';
import { ToolAccessGuard } from './tools/ToolAccessGuard';
import { ListAgentsTool } from './tools/ListAgentsTool';
import { AgentRunTracker } from './tui/AgentRunTracker';
import { ScopePolicy } from '../../application/services/ScopePolicy';
import { CoreDIContainer } from '../../application/CoreDIContainer';
import type { IAccessPolicyService } from '../../application/services/IAccessPolicyService';
import type { IGuardToggleService } from '../../application/services/IGuardToggleService';
import type { IAgentRepository } from '../../application/services/agentRepository';
import type { IAgentMessagingService } from '../../application/services/IAgentMessagingService';

export class DIContainer {
  private static instance: DIContainer;

  /** 核心容器（data 实现统一经此获取） */
  private core: CoreDIContainer;

  // ==================== 状态管理 ====================
  public agentTracker: AgentRunTracker;

  // ==================== 仓库（经 CoreDIContainer 获取，不直接 new data 实现） ====================
  public agentRepo: IAgentRepository;

  // ==================== 进程池 (Phase 1.5+) ====================
  public rpcPool: RpcProcessPool;

  // ==================== 通信服务 ====================
  public agentMessagingService: IAgentMessagingService;

  // ==================== 用例 ====================
  public discoverAgentsUseCase: DiscoverAgentsUseCase;
  public agentRequestUseCase: AgentRequestUseCase;

  // ==================== 工具 ====================
  public agentCommTools: AgentCommTools;
  public listAgentsTool: ListAgentsTool;

  // ==================== 访问策略 ====================
  public accessPolicy: IAccessPolicyService;
  public toolAccessGuard: ToolAccessGuard;

  // ==================== 守卫开关 (guard-toggle) ====================
  public guardToggleService: IGuardToggleService;

  private constructor() {
    // 初始化状态管理
    this.agentTracker = new AgentRunTracker();

    // 初始化核心容器（data 实现统一在 application 组装）
    this.core = new CoreDIContainer();

    // 初始化仓库
    this.agentRepo = this.core.agentRepo;

    // 初始化进程池（需要 warmUp 才会启动子进程）
    this.rpcPool = new RpcProcessPool(this.agentRepo);

    // 初始化通信服务（消息级通道，委托 RpcProcessPool）
    this.agentMessagingService = new AgentMessagingService(this.rpcPool);

    // 初始化用例
    this.discoverAgentsUseCase = new DiscoverAgentsUseCase(this.agentRepo);
    this.agentRequestUseCase = new AgentRequestUseCase(this.agentRepo, this.agentMessagingService);

    // 初始化工具
    this.agentCommTools = new AgentCommTools(this.agentRequestUseCase, this.agentTracker);
    this.listAgentsTool = new ListAgentsTool(this.discoverAgentsUseCase);

    // 初始化访问策略
    this.accessPolicy = new ScopePolicy();

    // 初始化守卫开关（data 实现统一在 core 组装，经此获取）
    this.guardToggleService = this.core.guardToggleService;
    this.toolAccessGuard = new ToolAccessGuard(this.accessPolicy, this.guardToggleService);
  }

  static getInstance(): DIContainer {
    if (!DIContainer.instance) {
      DIContainer.instance = new DIContainer();
    }
    return DIContainer.instance;
  }
}
