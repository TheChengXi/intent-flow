/**
 * @intent
 * pi 适配器依赖注入容器。管理 pi 特定依赖的实例化：
 * AgentRepositoryImpl（发现，自 pi-adapter-layer-reorg 起经 CoreDIContainer 获取，adapter 不直接 new data 实现）、RpcProcessPool（进程池）、SubProcessRunner（运行器）、DiscoverAgentsUseCase、SpawnAgentUseCase。
 * Phase 1 仅有 SubProcessRunner(spawn 一次性)，Phase 1.5 注入 RpcProcessPool。
 * guard-toggle 起：guardToggleService（经 core 获取）注入 ToolAccessGuard，并暴露给 GuardToggleCommand。
 * 边界：本容器不 import data 层任何模块；data 实现统一经 CoreDIContainer（application）获取。
 */



import { RpcProcessPool } from './runtime/RpcProcessPool';
import { SubProcessRunner } from './runtime/SubProcessRunner';
import { DiscoverAgentsUseCase } from '../../application/useCases/DiscoverAgentsUseCase';
import { SpawnAgentUseCase } from '../../application/useCases/SpawnAgentUseCase';
import { SpawnAgentTool } from './tools/SpawnAgentTool';
import { ToolAccessGuard } from './tools/ToolAccessGuard';
import { ListAgentsTool } from './tools/ListAgentsTool';
import { AgentRunTracker } from './tui/AgentRunTracker';
import { ScopePolicy } from '../../application/services/ScopePolicy';
import { CoreDIContainer } from '../../application/CoreDIContainer';
import type { IAccessPolicyService } from '../../application/services/IAccessPolicyService';
import type { IGuardToggleService } from '../../application/services/IGuardToggleService';
import type { IAgentRepository } from '../../application/services/agentRepository';

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

  // ==================== 运行器 ====================
  public subProcessRunner: SubProcessRunner;

  // ==================== 用例 ====================
  public discoverAgentsUseCase: DiscoverAgentsUseCase;
  public spawnAgentUseCase: SpawnAgentUseCase;

  // ==================== 工具 ====================
  public spawnAgentTool: SpawnAgentTool;
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

    // 初始化运行器（委托 RpcProcessPool）
    this.subProcessRunner = new SubProcessRunner(this.rpcPool);

    // 初始化用例
    this.discoverAgentsUseCase = new DiscoverAgentsUseCase(this.agentRepo);
    this.spawnAgentUseCase = new SpawnAgentUseCase(this.agentRepo, this.subProcessRunner);

    // 初始化工具
    this.spawnAgentTool = new SpawnAgentTool(this.spawnAgentUseCase, this.agentTracker);
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
