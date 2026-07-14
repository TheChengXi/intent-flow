/**
 * @intent pi 适配器依赖注入容器。管理 pi 特定依赖的实例化：
 * SubSkillRepository（发现）、RpcProcessPool（进程池）、SubProcessRunner（运行器）、
 * DiscoverAgentsUseCase、SpawnAgentUseCase。
 * Phase 1 仅有 SubProcessRunner(spawn 一次性)，Phase 1.5 注入 RpcProcessPool。
 */

import { SubSkillRepository } from './repositories/SubSkillRepository';
import { RpcProcessPool } from './runtime/RpcProcessPool';
import { SubProcessRunner } from './runtime/SubProcessRunner';
import { DiscoverAgentsUseCase } from '../../application/useCases/DiscoverAgentsUseCase';
import { SpawnAgentUseCase } from '../../application/useCases/SpawnAgentUseCase';
import { SpawnAgentTool } from './tools/SpawnAgentTool';
import { ToolAccessGuard } from './tools/ToolAccessGuard';
import { ListAgentsTool } from './tools/ListAgentsTool';
import { AgentRunTracker } from './tui/AgentRunTracker';
import { ScopePolicy } from './services/ScopePolicy';
import type { IAccessPolicyService } from '../../application/services/IAccessPolicyService';

export class DIContainer {
  private static instance: DIContainer;

  // ==================== 状态管理 ====================
  public agentTracker: AgentRunTracker;

  // ==================== 仓库 ====================
  public agentRepo: SubSkillRepository;

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

  private constructor() {
    // 初始化状态管理
    this.agentTracker = new AgentRunTracker();

    // 初始化仓库
    this.agentRepo = new SubSkillRepository();

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
    this.toolAccessGuard = new ToolAccessGuard(this.accessPolicy);
  }

  static getInstance(): DIContainer {
    if (!DIContainer.instance) {
      DIContainer.instance = new DIContainer();
    }
    return DIContainer.instance;
  }
}
