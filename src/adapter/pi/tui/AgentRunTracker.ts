/**
 * @intent 子 agent 运行状态管理中心。所有工具(spawn_agent/subagent)
 * 在执行过程中向此 tracker 推送事件，AgentDashboard 从中读取并渲染。
 * 支持监听者模式——状态变更时通知 dashboard 重新渲染。
 */

// ==================== 日志条目类型 ====================

export type LogLevel = 'info' | 'thinking' | 'tool_call' | 'tool_result' | 'output' | 'error' | 'done';

export interface LogEntry {
  /** 时间戳 */
  timestamp: number;
  /** 日志级别（决定图标和颜色） */
  level: LogLevel;
  /** 日志文本 */
  text: string;
  /** 关联的工具名称（tool_call 时） */
  toolName?: string;
  /** 关联的工具参数（tool_call 时，截断后显示） */
  toolArgs?: string;
}

// ==================== 运行状态类型 ====================

export type RunStatus = 'running' | 'completed' | 'failed' | 'aborted';

/** 单个子 agent 运行记录 */
export interface AgentRunState {
  /** 工具调用 ID（spawn_agent 或 subagent 的 toolCallId） */
  toolCallId: string;
  /** 调用的工具名（spawn_agent / subagent） */
  toolName: string;
  /** Agent 名称 */
  agent: string;
  /** 任务描述 */
  task: string;
  /** 运行模式：single / chain / parallel */
  mode: 'single' | 'chain' | 'parallel';
  /** 当前状态 */
  status: RunStatus;
  /** 开始时间戳 */
  startedAt: number;
  /** 完成时间戳 */
  completedAt?: number;
  /** 耗时（毫秒） */
  durationMs?: number;
  /** 日志条目列表 */
  logs: LogEntry[];
  /** 轮次 */
  turns: number;
  /** 消耗金额 */
  cost: number;
  /** 模型名称 */
  model?: string;
  /** 错误信息 */
  error?: string;
  /** 输出文本 */
  output?: string;
  /** Chain 子步骤（仅 chain 模式） */
  steps?: ChainStepState[];
  /** 并行子任务（仅 parallel 模式） */
  parallelTasks?: ParallelTaskState[];
}

/** Chain 模式中的一步 */
export interface ChainStepState {
  /** 步骤序号（1-based） */
  index: number;
  /** Agent 名称 */
  agent: string;
  /** 任务描述 */
  task: string;
  /** 状态 */
  status: RunStatus;
  /** 日志 */
  logs: LogEntry[];
  /** 输出 */
  output?: string;
  /** 轮次 */
  turns: number;
  /** 耗时 */
  durationMs?: number;
}

/** Parallel 模式中的单个任务 */
export interface ParallelTaskState {
  /** Agent 名称 */
  agent: string;
  /** 任务描述 */
  task: string;
  /** 状态 */
  status: RunStatus;
  /** 日志 */
  logs: LogEntry[];
  /** 输出 */
  output?: string;
  /** 轮次 */
  turns: number;
}

// ==================== Tracker 实现 ====================

export type TrackerListener = () => void;

export class AgentRunTracker {
  private runs: Map<string, AgentRunState> = new Map();
  /** 运行顺序（用于保持显示顺序） */
  private runOrder: string[] = [];
  private listeners: Set<TrackerListener> = new Set();

  /** 防抖：50ms 窗口内多次 notify 合并一次通知 */
  private notifyTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly NOTIFY_DEBOUNCE_MS = 50;

  // ==================== 监听者管理 ====================

  subscribe(listener: TrackerListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    if (this.notifyTimer) return; // 已有排期，跳过
    this.notifyTimer = setTimeout(() => {
      this.notifyTimer = null;
      for (const listener of this.listeners) {
        try { listener(); } catch { /* 忽略单个监听者异常 */ }
      }
    }, this.NOTIFY_DEBOUNCE_MS);
  }

  // ==================== 运行管理 ====================

  /** 开始一个新的子 agent 运行 */
  startRun(params: {
    toolCallId: string;
    toolName: string;
    agent: string;
    task: string;
    mode: 'single' | 'chain' | 'parallel';
  }): void {
    const prev = this.runs.get(params.toolCallId);
    if (prev) return; // 已存在，不允许重复 start

    // 同名 agent 已完成/失败/终止时，复用旧条目（替换），不新增
    // 保证仪表盘上同一个 agent 始终只占一行
    for (const [id, run] of this.runs) {
      if (run.agent === params.agent && run.status !== 'running') {
        this.runs.delete(id);
        const idx = this.runOrder.indexOf(id);
        if (idx >= 0) this.runOrder.splice(idx, 1);
        break;
      }
    }

    const state: AgentRunState = {
      toolCallId: params.toolCallId,
      toolName: params.toolName,
      agent: params.agent,
      task: params.task,
      mode: params.mode,
      status: 'running',
      startedAt: Date.now(),
      logs: [],
      turns: 0,
      cost: 0,
    };

    this.runs.set(params.toolCallId, state);
    this.runOrder.push(params.toolCallId);
    this.notify();
  }

  /** 追加日志 */
  addLog(toolCallId: string, entry: Omit<LogEntry, 'timestamp'>): void {
    const run = this.runs.get(toolCallId);
    if (!run) return;

    run.logs.push({ ...entry, timestamp: Date.now() });
    // 限制日志数量防止内存泄漏
    if (run.logs.length > 500) {
      run.logs.splice(0, run.logs.length - 500);
    }
    this.notify();
  }

  /** 更新运行状态（中间进度） */
  updateRun(toolCallId: string, partial: Partial<AgentRunState>): void {
    const run = this.runs.get(toolCallId);
    if (!run) return;

    Object.assign(run, partial);
    this.notify();
  }

  /** 完成一次运行 */
  completeRun(toolCallId: string, result: {
    status: RunStatus;
    output?: string;
    error?: string;
    turns: number;
    cost: number;
    model?: string;
  }): void {
    const run = this.runs.get(toolCallId);
    if (!run) return;

    run.status = result.status;
    run.output = result.output;
    run.error = result.error;
    run.turns = result.turns;
    run.cost = result.cost;
    run.model = result.model;
    run.completedAt = Date.now();
    run.durationMs = run.completedAt - run.startedAt;
    this.notify();
  }

  // ==================== Chain 模式支持 ====================

  /** Chain 模式下，开始一个步骤 */
  startChainStep(toolCallId: string, step: { index: number; agent: string; task: string }): void {
    const run = this.runs.get(toolCallId);
    if (!run) return;

    if (!run.steps) run.steps = [];
    run.steps.push({
      ...step,
      status: 'running',
      logs: [],
      turns: 0,
    });
    this.notify();
  }

  /** Chain 模式下，步骤追加日志 */
  addChainStepLog(toolCallId: string, stepIndex: number, entry: Omit<LogEntry, 'timestamp'>): void {
    const run = this.runs.get(toolCallId);
    if (!run?.steps) return;

    const step = run.steps.find(s => s.index === stepIndex);
    if (!step) return;

    step.logs.push({ ...entry, timestamp: Date.now() });
    if (step.logs.length > 200) step.logs.splice(0, step.logs.length - 200);
    this.notify();
  }

  /** Chain 模式下，完成一个步骤 */
  completeChainStep(toolCallId: string, stepIndex: number, result: {
    status: RunStatus;
    output?: string;
    turns: number;
    durationMs: number;
  }): void {
    const run = this.runs.get(toolCallId);
    if (!run?.steps) return;

    const step = run.steps.find(s => s.index === stepIndex);
    if (!step) return;

    step.status = result.status;
    step.output = result.output;
    step.turns = result.turns;
    step.durationMs = result.durationMs;
    this.notify();
  }

  // ==================== 查询 ====================

  /** 获取所有运行记录（按启动顺序） */
  getAllRuns(): AgentRunState[] {
    return this.runOrder
      .map(id => this.runs.get(id))
      .filter((r): r is AgentRunState => r !== undefined);
  }

  /** 获取正在运行的记录 */
  getRunningRuns(): AgentRunState[] {
    return this.getAllRuns().filter(r => r.status === 'running');
  }

  /** 获取单条运行记录 */
  getRun(toolCallId: string): AgentRunState | undefined {
    return this.runs.get(toolCallId);
  }

  /** 获取统计摘要 */
  getSummary(): { total: number; running: number; completed: number; failed: number; aborted: number } {
    const runs = this.getAllRuns();
    return {
      total: runs.length,
      running: runs.filter(r => r.status === 'running').length,
      completed: runs.filter(r => r.status === 'completed').length,
      failed: runs.filter(r => r.status === 'failed').length,
      aborted: runs.filter(r => r.status === 'aborted').length,
    };
  }

  /** 清除所有已完成/失败的历史记录 */
  clearCompleted(): void {
    for (const [id, run] of this.runs) {
      if (run.status !== 'running') {
        this.runs.delete(id);
        const idx = this.runOrder.indexOf(id);
        if (idx >= 0) this.runOrder.splice(idx, 1);
      }
    }
    this.notify();
  }
}
