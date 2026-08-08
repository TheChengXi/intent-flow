"use strict";
var __create = Object.create;
var __defProp2 = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp2(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp2(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp2(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
const node_child_process = require("node:child_process");
const promises = require("node:fs/promises");
const node_fs = require("node:fs");
const node_path = require("node:path");
const node_os = require("node:os");
const typebox = require("typebox");
const piTui = require("@earendil-works/pi-tui");
const piCodingAgent = require("@earendil-works/pi-coding-agent");
const fs = require("fs");
const path = require("path");
const require$$0 = require("url");
function _interopNamespaceDefault(e) {
  const n = Object.create(null, { [Symbol.toStringTag]: { value: "Module" } });
  if (e) {
    for (const k in e) {
      if (k !== "default") {
        const d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: () => e[k]
        });
      }
    }
  }
  n.default = e;
  return Object.freeze(n);
}
const fs__namespace = /* @__PURE__ */ _interopNamespaceDefault(fs);
const path__namespace = /* @__PURE__ */ _interopNamespaceDefault(path);
const SCOPE_SKIP_ENV = "PI_EXT_SKIP";
function shouldSkip(extensionName) {
  const raw = process.env[SCOPE_SKIP_ENV];
  if (!raw) return false;
  return raw.split(",").map((s) => s.trim()).includes(extensionName);
}
class MessageRouterImpl {
  constructor() {
    this.channels = /* @__PURE__ */ new Map();
  }
  ensure(agent) {
    let ch = this.channels.get(agent);
    if (!ch) {
      ch = { current: null, queue: [], pendingQuestions: [], awaitingReply: null };
      this.channels.set(agent, ch);
    }
    return ch;
  }
  /**
   * 入队任务。返回 true 表示应立即启动（当前无任务），false 表示已排队。
   */
  enqueue(agent, task) {
    const ch = this.ensure(agent);
    if (!ch.current) {
      ch.current = task;
      return true;
    }
    ch.queue.push(task);
    return false;
  }
  /**
   * 绑定等待者。规则：当前任务槽位空闲优先（提问续接），
   * 否则队首未绑定任务（并发 await 排队）。无任务可绑定时返回 null。
   */
  bindWaiter(agent) {
    const ch = this.channels.get(agent);
    if (!ch) return null;
    if (ch.current && !ch.current.waiterBound) {
      ch.current.waiterBound = true;
      return { taskId: ch.current.id };
    }
    for (const t of ch.queue) {
      if (!t.waiterBound) {
        t.waiterBound = true;
        return { taskId: t.id };
      }
    }
    return null;
  }
  /**
   * 释放等待者槽位（等待者 resolve 后或超时后调用），使任务可被重新绑定。
   */
  releaseWaiter(agent, taskId) {
    var _a;
    const ch = this.channels.get(agent);
    if (!ch) return;
    if (((_a = ch.current) == null ? void 0 : _a.id) === taskId) {
      ch.current.waiterBound = false;
      return;
    }
    const t = ch.queue.find((x) => x.id === taskId);
    if (t) t.waiterBound = false;
  }
  /**
   * 消费排队中的提问（await 开始时优先取，FIFO；无则 null）。
   */
  dequeuePending(agent) {
    const ch = this.channels.get(agent);
    if (!ch || ch.pendingQuestions.length === 0) return null;
    const first = ch.pendingQuestions.shift();
    return { kind: "question", ...first, askCount: ch.pendingQuestions.length + 1 };
  }
  /**
   * 取最早未回复提问的 requestId（reply 写回用；无则 null）。
   */
  getPendingRequestId(agent) {
    const ch = this.channels.get(agent);
    if (!ch || ch.pendingQuestions.length === 0) return null;
    return ch.pendingQuestions[0].requestId;
  }
  /**
   * 记录已投递、等待回复的提问（通道分派依据）。
   */
  setAwaitingReply(agent, requestId) {
    this.ensure(agent).awaitingReply = requestId;
  }
  /**
   * 取当前等待回复的提问 requestId（无则 null）。
   */
  getAwaitingReply(agent) {
    const ch = this.channels.get(agent);
    return (ch == null ? void 0 : ch.awaitingReply) ?? null;
  }
  /**
   * 清除等待回复标记（回复已写回时调用）。
   */
  clearAwaitingReply(agent) {
    const ch = this.channels.get(agent);
    if (ch) ch.awaitingReply = null;
  }
  /**
   * 移除已投递/已回复的提问（防重复消费）。
   */
  removeQuestion(agent, requestId) {
    const ch = this.channels.get(agent);
    if (!ch) return;
    ch.pendingQuestions = ch.pendingQuestions.filter((q) => q.requestId !== requestId);
  }
  /**
   * 当前任务完成（agent_end 已投递 result）后调用：
   * 返回下一个应启动的任务（出队），无则 null。
   */
  taskFinished(agent) {
    const ch = this.channels.get(agent);
    if (!ch || !ch.current) return null;
    ch.current = null;
    if (ch.queue.length > 0) {
      ch.current = ch.queue.shift();
      return ch.current;
    }
    return null;
  }
  /**
   * 清空该 agent 的全部状态（进程崩溃/销毁时调用，下个 send 开新上下文）。
   */
  resetChannel(agent) {
    this.channels.delete(agent);
  }
  /**
   * 处理一行 stdout 事件；返回应投递给当前任务等待者的消息（无则 null）。
   * extension_ui_request(input) → 提问入队并返回（投递由调用方按当前任务执行）；
   * agent_end → 解析结果、清空提问队列、返回 result。
   */
  handleLine(agent, line) {
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      return null;
    }
    if (event.type === "extension_ui_request" && event.method === "input") {
      const ch = this.ensure(agent);
      ch.pendingQuestions.push({
        question: event.title ?? event.placeholder ?? "",
        requestId: event.id
      });
      return {
        kind: "question",
        question: ch.pendingQuestions[ch.pendingQuestions.length - 1].question,
        requestId: ch.pendingQuestions[ch.pendingQuestions.length - 1].requestId,
        askCount: ch.pendingQuestions.length
      };
    }
    if (event.type === "agent_end") {
      const ch = this.channels.get(agent);
      if (ch) {
        ch.pendingQuestions = [];
        ch.awaitingReply = null;
      }
      return { kind: "result", result: this.parseAgentEnd(event, agent) };
    }
    return null;
  }
  // ==================== 结果解析 ====================
  /** 从 agent_end 事件中提取结构化结果（与旧 RpcProcessPool.parseAgentEnd 行为一致） */
  parseAgentEnd(event, agent) {
    var _a;
    const messages = event.messages ?? [];
    const usage = { input: 0, output: 0, cost: 0, turns: 0 };
    let output = "";
    let resolvedModel;
    let stopReason;
    let errorMessage;
    for (const msg of messages) {
      if (msg.role !== "assistant") continue;
      usage.turns++;
      if (msg.usage) {
        usage.input += msg.usage.input ?? 0;
        usage.output += msg.usage.output ?? 0;
        usage.cost += ((_a = msg.usage.cost) == null ? void 0 : _a.total) ?? 0;
      }
      if (msg.model) resolvedModel = msg.model;
      if (msg.stopReason) stopReason = msg.stopReason;
      if (msg.errorMessage) errorMessage = msg.errorMessage;
      if (msg.content && Array.isArray(msg.content)) {
        for (const part of msg.content) {
          if (part.type === "text") {
            output += part.text + "\n";
          }
        }
      }
    }
    return {
      agent,
      exitCode: errorMessage ? 1 : 0,
      output: output.trim().slice(0, 50 * 1024),
      error: errorMessage,
      usage,
      model: resolvedModel,
      durationMs: 0,
      // 由调用方填充
      messages,
      stopReason
    };
  }
}
class RpcProcessPool {
  constructor(agentRepo, baseModel) {
    this.processes = /* @__PURE__ */ new Map();
    this.router = new MessageRouterImpl();
    this.currentTaskIds = /* @__PURE__ */ new Map();
    this.waiters = /* @__PURE__ */ new Map();
    this.taskEvents = /* @__PURE__ */ new Map();
    this.taskCounter = 0;
    this.agentRepo = agentRepo;
    this.baseModel = baseModel;
  }
  // ==================== 公开 API ====================
  /**
   * 预热指定 agent 的常驻进程。不传 agentNames 时自动扫描全部 sub-skill。
   * 已有进程的 agent 跳过（幂等）。
   */
  async warmUp(agentNames) {
    if (!agentNames) {
      const { agents } = await this.agentRepo.discoverAll("sub_skill");
      agentNames = agents.map((a) => a.name);
    }
    const errors = [];
    for (const name2 of agentNames) {
      if (this.processes.has(name2)) continue;
      try {
        await this.spawnProcess(name2);
      } catch (err2) {
        errors.push(`${name2}: ${err2.message}`);
      }
    }
    if (errors.length > 0) {
      throw new Error(`预热失败 (${errors.length}/${agentNames.length}):
${errors.join("\n")}`);
    }
  }
  /**
   * 发送消息到指定 agent 会话（非阻塞），自动分派通道：
   * - 该 agent 正在等待回复（awaitingReply）→ 消息作为回答走 extension_ui_response 通道
   * - 否则 → 新消息走 prompt 通道（进程忙碌时入队，FIFO 串行，不丢失）
   */
  async sendMessage(agent, message, options) {
    const awaitingRequestId = this.router.getAwaitingReply(agent);
    if (awaitingRequestId) {
      const managed2 = this.processes.get(agent);
      if (!managed2 || managed2.process.killed || managed2.process.exitCode !== null) {
        throw new Error(`agent 进程不存在: ${agent}`);
      }
      const cmd2 = JSON.stringify({ type: "extension_ui_response", id: awaitingRequestId, value: message }) + "\n";
      managed2.process.stdin.write(cmd2);
      this.router.clearAwaitingReply(agent);
      return;
    }
    const managed = await this.ensureProcess(agent, options == null ? void 0 : options.skipExts, options == null ? void 0 : options.model);
    const taskId = `${agent}-${Date.now()}-${this.taskCounter++}`;
    if (options == null ? void 0 : options.onEvent) this.taskEvents.set(taskId, options.onEvent);
    const start2 = this.router.enqueue(agent, { id: taskId, message, waiterBound: false });
    if (!start2) return;
    managed.state = "busy";
    this.currentTaskIds.set(agent, taskId);
    const cmd = JSON.stringify({ type: "prompt", message }) + "\n";
    managed.process.stdin.write(cmd);
  }
  /**
   * 阻塞等待下一条消息（question/result/timeout/error）。
   * 排队提问优先消费；等待者绑定当前任务（提问续接）或队首任务（并发 await 排队）。
   * 超时只解除等待者，任务继续执行（结果可被后续 await 获取）。
   */
  async awaitMessage(agent, timeoutMs = 10 * 60 * 1e3) {
    const queued = this.router.dequeuePending(agent);
    if (queued) {
      this.router.setAwaitingReply(agent, queued.requestId);
      return queued;
    }
    const bound = this.router.bindWaiter(agent);
    if (!bound) {
      throw new Error(`没有进行中的任务可等待: ${agent}（请先 agent_request）`);
    }
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        const w = this.waiters.get(bound.taskId);
        if (w && !w.released) {
          w.released = true;
          this.waiters.delete(bound.taskId);
          this.router.releaseWaiter(agent, bound.taskId);
          resolve({ kind: "timeout" });
        }
      }, timeoutMs);
      timer.unref();
      this.waiters.set(bound.taskId, { resolve, timer, released: false });
    });
  }
  /**
   * 回答子 agent 的提问（写回 extension_ui_response）。
   * requestId 取该 agent 队列中最早的未回复提问（串行模型下同时只有一个待回复提问）。
   */
  async replyMessage(agent, answer) {
    const managed = this.processes.get(agent);
    if (!managed || managed.process.killed || managed.process.exitCode !== null) {
      throw new Error(`agent 进程不存在: ${agent}（请先 agent_request）`);
    }
    const requestId = this.router.getPendingRequestId(agent);
    if (!requestId) {
      throw new Error(`没有待回复的提问: ${agent}（请先 agent_await 收到提问）`);
    }
    const cmd = JSON.stringify({ type: "extension_ui_response", id: requestId, value: answer }) + "\n";
    managed.process.stdin.write(cmd);
    this.router.removeQuestion(agent, requestId);
  }
  /**
   * 销毁所有进程。/reload / 项目切换时调用。
   */
  async shutdown() {
    for (const [, w] of this.waiters) {
      if (!w.released) {
        w.released = true;
        clearTimeout(w.timer);
        w.resolve({ kind: "error", message: "RPC 进程池已关闭" });
      }
    }
    this.waiters.clear();
    this.currentTaskIds.clear();
    this.taskEvents.clear();
    const cleanupPromises = [];
    for (const [, managed] of this.processes) {
      cleanupPromises.push(this.killProcess(managed));
    }
    await Promise.all(cleanupPromises);
    this.processes.clear();
  }
  /**
   * 获取当前进程池状态摘要，用于 UI 展示/调试。
   */
  getProcessSummary() {
    const summary = [];
    for (const [, managed] of this.processes) {
      summary.push({
        agentName: managed.agentName,
        state: managed.state
      });
    }
    return summary;
  }
  /** 获取当前 busy 状态的子进程数量 */
  getBusyCount() {
    let count = 0;
    for (const [, managed] of this.processes) {
      if (managed.state === "busy") count++;
    }
    return count;
  }
  // ==================== 进程管理 ====================
  /** 确保进程存在且可用，否则自动重建；skipExts/model 变化时重启 */
  async ensureProcess(agentName, skipExts, model) {
    var _a;
    const managed = this.processes.get(agentName);
    if (managed && !managed.process.killed && managed.process.exitCode === null) {
      if (skipExts && ((_a = managed.skipExts) == null ? void 0 : _a.join(",")) !== skipExts.join(",")) {
        await this.killProcess(managed);
        this.processes.delete(agentName);
        return this.spawnProcess(agentName, skipExts, model);
      }
      if (model && managed.model !== model) {
        await this.killProcess(managed);
        this.processes.delete(agentName);
        return this.spawnProcess(agentName, skipExts, model);
      }
      return managed;
    }
    return this.spawnProcess(agentName, skipExts, model);
  }
  /** 启动一个 agent 子进程 */
  async spawnProcess(agentName, skipExts, model) {
    const agentDef = await this.agentRepo.findByName(agentName, "sub_skill");
    if (!agentDef) {
      throw new Error(`未找到 agent 定义: "${agentName}"`);
    }
    const tmpDir = await promises.mkdtemp(node_path.join(node_os.tmpdir(), "iflow-rpc-"));
    const sysPromptFile = node_path.join(tmpDir, "system.md");
    await promises.writeFile(sysPromptFile, agentDef.systemPrompt, "utf-8");
    const args2 = [
      "--mode",
      "rpc",
      "--name",
      agentName,
      "--append-system-prompt",
      sysPromptFile
    ];
    const resolvedModel = model || agentDef.model || this.baseModel;
    if (resolvedModel) {
      args2.push("--model", resolvedModel);
    }
    if (agentDef.tools && agentDef.tools.length > 0) {
      args2.push("--tools", agentDef.tools.join(","));
    }
    if (typeof __filename === "string" && node_fs.existsSync(__filename)) {
      args2.push("--extension", __filename);
    }
    const isWindows = node_os.platform() === "win32";
    const pi = this.piInvocation(args2);
    const childEnv = { ...process.env, IFLOW_CHILD: "1" };
    if (skipExts && skipExts.length > 0) {
      childEnv[SCOPE_SKIP_ENV] = skipExts.join(",");
    }
    const child = node_child_process.spawn(pi.command, pi.args, {
      cwd: process.cwd(),
      shell: isWindows,
      stdio: ["pipe", "pipe", "pipe"],
      env: childEnv
    });
    const managed = {
      process: child,
      agentName,
      state: "idle",
      tmpDir,
      buffer: "",
      skipExts,
      model: resolvedModel
    };
    child.stdout.on("data", (data) => {
      managed.buffer += data.toString();
      const lines = managed.buffer.split("\n");
      managed.buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        this.handleEvent(agentName, trimmed);
      }
    });
    child.stderr.on("data", (data) => {
      process.stderr.write(`[rpc:${agentName}] ${data}`);
    });
    child.on("exit", (code, signal) => {
      promises.rm(managed.tmpDir, { recursive: true, force: true }).catch(() => {
      });
      const failedPrefix = `${agentName}-`;
      for (const [taskId, w] of this.waiters) {
        if (taskId.startsWith(failedPrefix) && !w.released) {
          w.released = true;
          clearTimeout(w.timer);
          w.resolve({
            kind: "error",
            message: signal ? `进程被信号终止: ${signal}` : `进程异常退出 (code=${code})`
          });
        }
      }
      for (const [taskId] of this.waiters) {
        if (taskId.startsWith(failedPrefix)) this.waiters.delete(taskId);
      }
      this.router.resetChannel(agentName);
      this.currentTaskIds.delete(agentName);
      managed.state = "idle";
    });
    this.processes.set(agentName, managed);
    return managed;
  }
  /** 销毁单个进程 */
  async killProcess(managed) {
    if (!managed.process.killed) {
      managed.process.kill("SIGTERM");
      await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          if (!managed.process.killed) managed.process.kill("SIGKILL");
          resolve();
        }, 3e3);
        managed.process.on("exit", () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }
    await promises.rm(managed.tmpDir, { recursive: true, force: true }).catch(() => {
    });
  }
  // ==================== 事件处理 ====================
  /** 处理一行 JSON-L 事件：可视化流 → 路由 → 投递 → 队列推进 */
  handleEvent(agentName, line) {
    var _a;
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      return;
    }
    const taskId = this.currentTaskIds.get(agentName);
    if (taskId) {
      (_a = this.taskEvents.get(taskId)) == null ? void 0 : _a(event);
    }
    const msg = this.router.handleLine(agentName, line);
    if (!msg) return;
    if (taskId) {
      const w = this.waiters.get(taskId);
      if (w && !w.released) {
        w.released = true;
        clearTimeout(w.timer);
        this.waiters.delete(taskId);
        w.resolve(msg);
        if (msg.kind === "question") {
          this.router.setAwaitingReply(agentName, msg.requestId);
          this.router.releaseWaiter(agentName, taskId);
          this.router.removeQuestion(agentName, msg.requestId);
        }
      }
    }
    if (msg.kind === "result") {
      if (taskId) this.taskEvents.delete(taskId);
      this.currentTaskIds.delete(agentName);
      const next = this.router.taskFinished(agentName);
      if (next) {
        const managed = this.processes.get(agentName);
        if (managed && !managed.process.killed && managed.process.exitCode === null) {
          managed.state = "busy";
          this.currentTaskIds.set(agentName, next.id);
          const cmd = JSON.stringify({ type: "prompt", message: next.message }) + "\n";
          managed.process.stdin.write(cmd);
        }
      } else {
        const managed = this.processes.get(agentName);
        if (managed) managed.state = "idle";
      }
    }
  }
  // ==================== 工具函数 ====================
  /** 构造 pi 调用命令（兼容 Windows） */
  piInvocation(args2) {
    const currentScript = process.argv[1];
    if (currentScript && node_fs.existsSync(currentScript)) {
      return { command: process.execPath, args: [currentScript, ...args2] };
    }
    return { command: "pi", args: args2 };
  }
}
class AgentMessagingService {
  constructor(pool) {
    this.pool = pool;
  }
  async send(agent, message, options) {
    await this.pool.sendMessage(agent, message, options);
  }
  await(agent, timeoutMs) {
    return this.pool.awaitMessage(agent, timeoutMs);
  }
}
class DiscoverAgentsUseCase {
  constructor(agentRepo) {
    this.agentRepo = agentRepo;
  }
  /**
   * @contract execute(input: DiscoverAgentsInput) => Promise<DiscoverAgentsOutput>
   * @step 透传 scope 参数到 IAgentRepository.discoverAll()
   * @boundary scope 无效时由仓库层决定默认行为
   */
  async execute(input) {
    return this.agentRepo.discoverAll(input.scope);
  }
}
class AgentRequestUseCase {
  constructor(agentRepo, messaging) {
    this.agentRepo = agentRepo;
    this.messaging = messaging;
  }
  /**
   * @contract execute(input: AgentRequestInput) => Promise<AgentRequestOutput>
   * @step [校验] agent 存在性（findByName scope='sub_skill'）
   * @step [组装] task + context（"## 上下文" 段）
   * @step [发送] send(agent, message, { model, skipExts }?)——进程级选项仅传入时携带
   * @step [等待] await(agent, timeoutMs ?? 600000)
   * @step [返回] AgentAwaitResult 原样透传
   */
  async execute(input) {
    const agent = await this.agentRepo.findByName(input.agent, "sub_skill");
    if (!agent) {
      throw new Error(`Agent not found: "${input.agent}"`);
    }
    let message = input.task;
    if (input.context) {
      message = `${message}

## 上下文

${input.context}`;
    }
    const options = {};
    if (input.model) options.model = input.model;
    if (input.skipExts && input.skipExts.length > 0) options.skipExts = input.skipExts;
    if (input.onEvent) options.onEvent = input.onEvent;
    if (Object.keys(options).length > 0) {
      await this.messaging.send(input.agent, message, options);
    } else {
      await this.messaging.send(input.agent, message);
    }
    const result = await this.messaging.await(input.agent, input.timeoutMs ?? 10 * 60 * 1e3);
    return { result };
  }
}
function formatUsage(result) {
  const parts2 = [];
  if (result.usage.turns) parts2.push(`${result.usage.turns} 轮`);
  if (result.usage.input) parts2.push(`↑${result.usage.input}`);
  if (result.usage.output) parts2.push(`↓${result.usage.output}`);
  if (result.usage.cost > 0) parts2.push(`$${result.usage.cost.toFixed(4)}`);
  if (result.model) parts2.push(result.model);
  return parts2.length > 0 ? parts2.join(" ") : "";
}
function formatToolCall(toolName, args2, fg) {
  if (toolName === "bash") {
    const cmd = args2.command || "";
    return fg("muted", "$ ") + fg("toolOutput", cmd.length > 60 ? cmd.slice(0, 60) + "..." : cmd);
  }
  if (toolName === "read") {
    const p = args2.path || args2.file_path || "";
    return fg("muted", "read ") + fg("accent", p);
  }
  const argsStr = JSON.stringify(args2);
  return fg("accent", toolName) + fg("dim", " " + (argsStr.length > 50 ? argsStr.slice(0, 50) + "..." : argsStr));
}
function getDisplayItems(messages) {
  const items = [];
  for (const msg of messages) {
    if ((msg == null ? void 0 : msg.role) !== "assistant") continue;
    for (const part of msg.content || []) {
      if (part.type === "text") items.push({ type: "text", text: part.text });
      else if (part.type === "toolCall") items.push({ type: "toolCall", name: part.name, args: part.arguments });
    }
  }
  return items;
}
function extractContentText(msg) {
  if (!(msg == null ? void 0 : msg.content)) return "";
  if (typeof msg.content === "string") return msg.content.trim();
  if (Array.isArray(msg.content)) {
    return msg.content.filter((p) => p.type === "text").map((p) => p.text || "").join(" ").trim();
  }
  return "";
}
function getFinalOutput(messages) {
  for (let i2 = messages.length - 1; i2 >= 0; i2--) {
    const msg = messages[i2];
    if ((msg == null ? void 0 : msg.role) === "assistant") {
      for (const part of msg.content || []) {
        if (part.type === "text") return part.text;
      }
    }
  }
  return "";
}
class AgentCommTools {
  constructor(requestUseCase, tracker) {
    this.requestUseCase = requestUseCase;
    this.tracker = tracker;
    this.sessionIds = /* @__PURE__ */ new Map();
  }
  register(pi) {
    this.registerChat(pi);
  }
  // ==================== 会话管理 ====================
  /** 构造子进程事件转发（tracker 实时日志，含防刷） */
  makeEventForwarder(sid) {
    let lastUpdateText = "";
    return (event) => {
      var _a, _b, _c, _d, _e, _f, _g, _h, _i;
      try {
        const type = event.type;
        if (type === "tool_execution_start") {
          const ev = event;
          const argsStr = ev.args ? JSON.stringify(ev.args).slice(0, 80) : "";
          (_a = this.tracker) == null ? void 0 : _a.addLog(sid, {
            level: "tool_call",
            text: `${ev.toolName} ${argsStr}`,
            toolName: ev.toolName,
            toolArgs: argsStr
          });
        } else if (type === "message_update") {
          const ev = event;
          if (((_b = ev.message) == null ? void 0 : _b.role) === "assistant") {
            const text = extractContentText(ev.message);
            if (text && text.length > lastUpdateText.length + 30) {
              lastUpdateText = text;
              (_c = this.tracker) == null ? void 0 : _c.addLog(sid, { level: "output", text: text.slice(0, 200) });
            }
          }
        } else if (type === "message_end") {
          const ev = event;
          if (((_d = ev.message) == null ? void 0 : _d.role) === "assistant") {
            const text = extractContentText(ev.message);
            if (text) {
              (_e = this.tracker) == null ? void 0 : _e.addLog(sid, { level: "output", text: text.slice(0, 200) });
            }
            (_g = this.tracker) == null ? void 0 : _g.updateRun(sid, {
              turns: (((_f = this.tracker.getRun(sid)) == null ? void 0 : _f.turns) ?? 0) + 1,
              model: ev.message.model
            });
          }
        } else if (type === "tool_execution_end") {
          const ev = event;
          const status = ev.isError ? "error" : "tool_result";
          let preview = `${ev.toolName} 完成`;
          if ((_h = ev.result) == null ? void 0 : _h.content) {
            const textContent = extractContentText({ content: ev.result.content });
            if (textContent) {
              preview = `${ev.toolName} → ${textContent.slice(0, 80)}`;
            }
          }
          (_i = this.tracker) == null ? void 0 : _i.addLog(sid, { level: status, text: preview });
        }
      } catch {
      }
    };
  }
  /** 确保 tracker 有该 agent 的会话条目：续会话复用（追加日志），否则新建 */
  ensureSession(agent, toolCallId, task) {
    var _a, _b;
    const existing = this.sessionIds.get(agent);
    if (existing && ((_a = this.tracker) == null ? void 0 : _a.getRun(existing))) {
      this.tracker.updateRun(existing, {
        status: "running",
        task,
        startedAt: Date.now(),
        completedAt: void 0,
        durationMs: void 0,
        output: void 0,
        error: void 0
      });
      return existing;
    }
    (_b = this.tracker) == null ? void 0 : _b.startRun({ toolCallId, toolName: "agent_comm", agent, task, mode: "single" });
    this.sessionIds.set(agent, toolCallId);
    return toolCallId;
  }
  /** 统一分派 await/request 的结果：question 透出、result 完成、timeout/error 标记 */
  handleAwaitResult(sid, agent, r) {
    var _a, _b, _c, _d, _e, _f, _g;
    if (r.kind === "question") {
      (_a = this.tracker) == null ? void 0 : _a.addLog(sid, { level: "question", text: r.question });
      return {
        content: [
          {
            type: "text",
            text: [
              `❓ ${agent} 提问 (${r.askCount}/3): ${r.question}`,
              "",
              "请用 agent_chat 发送你的回答继续对话（工具会自动路由为回复）。"
            ].join("\n")
          }
        ],
        details: { question: r }
      };
    }
    if (r.kind === "result") {
      const result = r.result;
      const status = result.exitCode === 0 ? "completed" : "failed";
      (_b = this.tracker) == null ? void 0 : _b.completeRun(sid, {
        status,
        output: result.output,
        error: result.error,
        turns: result.usage.turns,
        cost: result.usage.cost,
        model: result.model
      });
      (_c = this.tracker) == null ? void 0 : _c.addLog(sid, {
        level: "done",
        text: `${result.agent} ${status === "completed" ? "完成" : "失败"} (${result.durationMs}ms, ${result.usage.turns} 轮)`
      });
      const icon = result.exitCode === 0 ? "✅" : "❌";
      const statusLabel = result.exitCode === 0 ? "完成" : `失败(code=${result.exitCode})`;
      const cost = result.usage.cost > 0 ? ` | $${result.usage.cost.toFixed(4)}` : "";
      const header = `${icon} ${result.agent} ${statusLabel} (${result.durationMs}ms, ${result.usage.turns} 轮${cost})`;
      const modelLine = result.model ? `模型: ${result.model}` : "";
      const errorLine = result.error ? `错误: ${result.error}` : "";
      return {
        content: [
          {
            type: "text",
            text: [header, modelLine, errorLine, "", result.output].filter(Boolean).join("\n")
          }
        ],
        details: { result }
      };
    }
    if (r.kind === "timeout") {
      (_d = this.tracker) == null ? void 0 : _d.completeRun(sid, { status: "aborted", error: "等待超时", turns: 0, cost: 0 });
      (_e = this.tracker) == null ? void 0 : _e.addLog(sid, { level: "error", text: `等待超时: ${agent}` });
      return {
        content: [{ type: "text", text: `⏱️ ${agent} 等待超时（会话保留，可继续通信）` }],
        details: {}
      };
    }
    (_f = this.tracker) == null ? void 0 : _f.completeRun(sid, { status: "failed", error: r.message, turns: 0, cost: 0 });
    (_g = this.tracker) == null ? void 0 : _g.addLog(sid, { level: "error", text: `通道错误: ${r.message}` });
    return {
      content: [{ type: "text", text: `⚠️ ${agent} 通道错误: ${r.message}` }],
      details: {}
    };
  }
  // ==================== agent_chat ====================
  registerChat(pi) {
    pi.registerTool({
      name: "agent_chat",
      label: "Agent Chat",
      description: [
        "向指定 agent 发送一条消息并等待其下一轮回应（send + await 合成）。",
        "自动分派通道：该 agent 正在等待回复时，消息作为回答送达；否则作为新消息派发。",
        "返回提问（子 agent 需要澄清，继续用 agent_chat 发送你的回答）或最终结果。"
      ].join(" "),
      promptSnippet: "Send a message to an agent and wait for its reply",
      promptGuidelines: [
        "Use agent_chat to talk to another agent context: it sends your message and waits for the next reply in one step (replaces spawn_agent).",
        "If it returns a question (kind=question), answer it by calling agent_chat again with your answer — the tool automatically routes it as a reply.",
        "Keep conversing with agent_chat until you get the final result. Messages accumulate in the same session."
      ],
      parameters: typebox.Type.Object({
        agent: typebox.Type.String({ description: "Agent 名称，对应 skills/<skill>/sub-skill/<agent>/SUB-SKILL.md" }),
        message: typebox.Type.String({ description: "要发送的消息（新任务、追问或对提问的回答）" }),
        context: typebox.Type.Optional(
          typebox.Type.String({ description: "可选上下文（追加到消息末尾），如之前 agent 的输出" })
        ),
        model: typebox.Type.Optional(
          typebox.Type.String({ description: "可选模型覆盖。仅首次创建进程时生效" })
        ),
        timeoutMs: typebox.Type.Optional(
          typebox.Type.Number({ description: "超时毫秒数。默认 600000（10 分钟）" })
        ),
        skipExts: typebox.Type.Optional(
          typebox.Type.Array(typebox.Type.String(), {
            description: '子 agent 中跳过拦截的扩展名列表，如 ["confirm-edit"]'
          })
        )
      }),
      renderCall(args2, theme) {
        const name2 = args2.agent || "...";
        const preview = args2.message ? args2.message.length > 60 ? args2.message.slice(0, 60) + "..." : args2.message : "...";
        const text = theme.fg("toolTitle", theme.bold("agent_chat ")) + theme.fg("accent", name2) + "\n  " + theme.fg("dim", preview);
        return new piTui.Text(text, 0, 0);
      },
      renderResult(result, { expanded }, theme) {
        return renderCommResult(result, expanded, theme);
      },
      execute: async (toolCallId, params, _signal, _onUpdate) => {
        var _a, _b;
        const sid = this.ensureSession(params.agent, toolCallId, params.message);
        try {
          const out2 = await this.requestUseCase.execute({
            agent: params.agent,
            task: params.message,
            context: params.context,
            model: params.model,
            timeoutMs: params.timeoutMs,
            skipExts: params.skipExts,
            onEvent: this.makeEventForwarder(sid)
          });
          return this.handleAwaitResult(sid, params.agent, out2.result);
        } catch (err2) {
          (_a = this.tracker) == null ? void 0 : _a.completeRun(sid, { status: "failed", error: err2.message || String(err2), turns: 0, cost: 0 });
          (_b = this.tracker) == null ? void 0 : _b.addLog(sid, { level: "error", text: `异常: ${err2.message || err2}` });
          return {
            content: [{ type: "text", text: `agent_chat 异常: ${err2.message || err2}` }],
            details: {}
          };
        }
      }
    });
  }
}
function renderCommResult(result, expanded, theme) {
  const details = result.details ?? {};
  if (details.question) {
    const q = details.question;
    const text2 = theme.fg("error", theme.bold("❓ ")) + theme.fg("toolTitle", theme.bold("提问")) + theme.fg("dim", ` (${q.askCount}/3)`) + "\n" + q.question + "\n" + theme.fg("dim", "→ 用 agent_reply 回答后继续 agent_await");
    return new piTui.Text(text2, 0, 0);
  }
  const r = details.result;
  if (!r) {
    const content = result.content[0];
    return new piTui.Text((content == null ? void 0 : content.type) === "text" ? content.text : "(no output)", 0, 0);
  }
  const mdTheme = piCodingAgent.getMarkdownTheme();
  const isError = r.exitCode !== 0;
  const icon = isError ? theme.fg("error", "✗") : theme.fg("success", "✓");
  const displayItems = r.messages ? getDisplayItems(r.messages) : [];
  const finalOutput = r.messages ? getFinalOutput(r.messages) : r.output;
  if (expanded) {
    const container = new piTui.Container();
    let header = `${icon} ${theme.fg("toolTitle", theme.bold(r.agent))}`;
    if (r.error) header += ` ${theme.fg("error", `[${r.error}]`)}`;
    container.addChild(new piTui.Text(header, 0, 0));
    if (r.errorMessage) container.addChild(new piTui.Text(theme.fg("error", `Error: ${r.errorMessage}`), 0, 0));
    container.addChild(new piTui.Spacer(1));
    container.addChild(new piTui.Text(theme.fg("muted", "─── Tool Calls ───"), 0, 0));
    for (const item of displayItems) {
      if (item.type === "toolCall") {
        container.addChild(
          new piTui.Text(theme.fg("muted", "→ ") + formatToolCall(item.name, item.args, theme.fg.bind(theme)), 0, 0)
        );
      }
    }
    if (finalOutput) {
      container.addChild(new piTui.Spacer(1));
      container.addChild(new piTui.Text(theme.fg("muted", "─── Output ───"), 0, 0));
      container.addChild(new piTui.Markdown(finalOutput.trim(), 0, 0, mdTheme));
    }
    const usageStr2 = formatUsage(r);
    if (usageStr2) {
      container.addChild(new piTui.Spacer(1));
      container.addChild(new piTui.Text(theme.fg("dim", usageStr2), 0, 0));
    }
    return container;
  }
  let text = `${icon} ${theme.fg("toolTitle", theme.bold(r.agent))}`;
  if (r.error) text += ` ${theme.fg("error", `[${r.error}]`)}`;
  if (displayItems.length === 0 && !finalOutput) {
    text += `
${theme.fg("muted", "(no output)")}`;
  } else {
    const lastItems = displayItems.slice(-5);
    for (const item of lastItems) {
      if (item.type === "toolCall") {
        text += `
  ${theme.fg("muted", "→ ") + formatToolCall(item.name, item.args, theme.fg.bind(theme))}`;
      }
    }
    if (displayItems.length > 5) text += `
${theme.fg("muted", `... ${displayItems.length - 5} more items (Ctrl+O)`)}`;
  }
  const usageStr = formatUsage(r);
  if (usageStr) text += `
${theme.fg("dim", usageStr)}`;
  return new piTui.Text(text, 0, 0);
}
class ToolAccessGuard {
  constructor(accessPolicy, guardToggle) {
    this.accessPolicy = accessPolicy;
    this.guardToggle = guardToggle;
  }
  /**
   * @contract
   * 注册 tool_call 事件监听器，在工具调用前进行安全拦截。
   * 输入：pi - ExtensionAPI 实例
   * 副作用：注册 pi.on("tool_call", handler) 监听
   */
  register(pi) {
    pi.on("tool_call", async (event, ctx) => {
      if (this.accessPolicy.shouldSkip("confirm-edit") || !this.guardToggle.isEnabled()) {
        return;
      }
      if (event.toolName === "edit" || event.toolName === "write") {
        const path2 = event.input.path ?? "未知文件";
        const ok = await ctx.ui.confirm(
          "⚠️ 确认修改",
          `要修改文件: ${String(path2)}

确定允许修改吗？`
        );
        if (!ok) {
          const reason = await ctx.ui.input(
            "驳回原因",
            "为什么取消这次修改？（可选）"
          );
          const reasonMsg = reason ? `: ${reason}` : "";
          return { block: true, reason: `用户拒绝了修改${reasonMsg}` };
        }
      }
      if (event.toolName === "bash") {
        const cmd = event.input.command ?? "";
        if (this.isDangerousBash(cmd)) {
          const ok = await ctx.ui.confirm(
            "⚠️ 危险 bash 命令",
            `命令: ${cmd.substring(0, 120)}

确定允许执行吗？`
          );
          if (!ok) {
            const reason = await ctx.ui.input(
              "驳回原因",
              "为什么取消这次操作？（可选）"
            );
            const reasonMsg = reason ? `: ${reason}` : "";
            return { block: true, reason: `用户拒绝了 bash 命令${reasonMsg}` };
          }
        }
      }
    });
  }
  /**
   * @contract
   * 检测 bash 命令是否涉及文件写入/删除等危险操作。
   * 输入：cmd - bash 命令字符串
   * 输出：boolean - true表示危险命令
   * 规则与原始 confirm-edit.ts 完全一致
   */
  isDangerousBash(cmd) {
    const stripped = cmd.replace(/['"][^'"]*['"]/g, "");
    const patterns = [
      /\brm\s+-r[f]?\b/,
      // rm -rf
      /\brm\s+-\w*r\w*/,
      // rm -r 递归删除
      /\brmdir\b/,
      // 删除目录
      /\bdel\s+/i,
      // del 删除文件
      /\bremove\s+/i,
      // remove
      /\bmv\s+/i,
      // mv 移动/重命名
      /\bcp\s+/i,
      // cp 复制
      /[>]/,
      // > 重定向写入
      /[|]\s*tee\b/,
      // | tee 写入
      /\bdd\s+if=/,
      // dd 磁盘操作
      /\bchmod\s+/i,
      // 改权限
      /\bchown\s+/i,
      // 改所有者
      /\bmkfs\b/i,
      // 格式化
      /\bformat\b/i,
      // 格式化
      /\bfdisk\b/i,
      // 分区
      /\bsudo\s+rm\b/i,
      // sudo rm
      /:\s*rm\b/i
      // :; rm 形式
    ];
    return patterns.some((p) => p.test(stripped));
  }
}
class ListAgentsTool {
  constructor(discoverAgents) {
    this.discoverAgents = discoverAgents;
  }
  register(pi) {
    pi.registerTool({
      name: "list_agents",
      label: "List Agents",
      description: "列出所有可用的 sub-agent。按 skill 分组，返回名称、描述和可用工具。",
      parameters: typebox.Type.Object({
        skill: typebox.Type.Optional(
          typebox.Type.String({ description: "可选，按 skill 名称过滤" })
        )
      }),
      execute: async (_toolCallId, params, _signal, _onUpdate, _ctx) => {
        const { agents } = await this.discoverAgents.execute({ scope: "sub_skill" });
        if (agents.length === 0) {
          return {
            content: [{ type: "text", text: "当前没有可用的 sub-agent。" }],
            details: {}
          };
        }
        const filter = (params.skill || "").trim().toLowerCase();
        let matched = agents;
        if (filter) {
          matched = agents.filter((a) => a.skillName === filter);
          if (matched.length === 0) {
            return {
              content: [{ type: "text", text: `skill "${filter}" 下没有 sub-agent。` }],
              details: {}
            };
          }
        }
        const groups = /* @__PURE__ */ new Map();
        for (const a of matched) {
          const skill = a.skillName || "(无分组)";
          if (!groups.has(skill)) groups.set(skill, []);
          groups.get(skill).push(a);
        }
        const parts2 = [];
        for (const [skill, list] of groups) {
          parts2.push(`[${skill}]`);
          for (const a of list) {
            const tools = a.tools && a.tools.length > 0 ? `工具: ${a.tools.join(", ")}` : "";
            parts2.push(`  ${a.name} — ${a.description}${tools ? ` (${tools})` : ""}`);
          }
        }
        return {
          content: [{ type: "text", text: parts2.join("\n") }],
          details: { count: matched.length, agents: matched.map((a) => a.name) }
        };
      }
    });
  }
}
class AgentRunTracker {
  constructor() {
    this.runs = /* @__PURE__ */ new Map();
    this.runOrder = [];
    this.listeners = /* @__PURE__ */ new Set();
    this.notifyTimer = null;
    this.NOTIFY_DEBOUNCE_MS = 50;
  }
  // ==================== 监听者管理 ====================
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  notify() {
    if (this.notifyTimer) return;
    this.notifyTimer = setTimeout(() => {
      this.notifyTimer = null;
      for (const listener of this.listeners) {
        try {
          listener();
        } catch {
        }
      }
    }, this.NOTIFY_DEBOUNCE_MS);
  }
  // ==================== 运行管理 ====================
  /** 开始一个新的子 agent 运行 */
  startRun(params) {
    const prev = this.runs.get(params.toolCallId);
    if (prev) return;
    for (const [id, run2] of this.runs) {
      if (run2.agent === params.agent && run2.status !== "running") {
        this.runs.delete(id);
        const idx = this.runOrder.indexOf(id);
        if (idx >= 0) this.runOrder.splice(idx, 1);
        break;
      }
    }
    const state = {
      toolCallId: params.toolCallId,
      toolName: params.toolName,
      agent: params.agent,
      task: params.task,
      mode: params.mode,
      status: "running",
      startedAt: Date.now(),
      logs: [],
      turns: 0,
      cost: 0
    };
    this.runs.set(params.toolCallId, state);
    this.runOrder.push(params.toolCallId);
    this.notify();
  }
  /** 追加日志 */
  addLog(toolCallId, entry) {
    const run2 = this.runs.get(toolCallId);
    if (!run2) return;
    run2.logs.push({ ...entry, timestamp: Date.now() });
    if (run2.logs.length > 500) {
      run2.logs.splice(0, run2.logs.length - 500);
    }
    this.notify();
  }
  /** 更新运行状态（中间进度） */
  updateRun(toolCallId, partial) {
    const run2 = this.runs.get(toolCallId);
    if (!run2) return;
    Object.assign(run2, partial);
    this.notify();
  }
  /** 完成一次运行 */
  completeRun(toolCallId, result) {
    const run2 = this.runs.get(toolCallId);
    if (!run2) return;
    run2.status = result.status;
    run2.output = result.output;
    run2.error = result.error;
    run2.turns = result.turns;
    run2.cost = result.cost;
    run2.model = result.model;
    run2.completedAt = Date.now();
    run2.durationMs = run2.completedAt - run2.startedAt;
    this.notify();
  }
  // ==================== Chain 模式支持 ====================
  /** Chain 模式下，开始一个步骤 */
  startChainStep(toolCallId, step) {
    const run2 = this.runs.get(toolCallId);
    if (!run2) return;
    if (!run2.steps) run2.steps = [];
    run2.steps.push({
      ...step,
      status: "running",
      logs: [],
      turns: 0
    });
    this.notify();
  }
  /** Chain 模式下，步骤追加日志 */
  addChainStepLog(toolCallId, stepIndex, entry) {
    const run2 = this.runs.get(toolCallId);
    if (!(run2 == null ? void 0 : run2.steps)) return;
    const step = run2.steps.find((s) => s.index === stepIndex);
    if (!step) return;
    step.logs.push({ ...entry, timestamp: Date.now() });
    if (step.logs.length > 200) step.logs.splice(0, step.logs.length - 200);
    this.notify();
  }
  /** Chain 模式下，完成一个步骤 */
  completeChainStep(toolCallId, stepIndex, result) {
    const run2 = this.runs.get(toolCallId);
    if (!(run2 == null ? void 0 : run2.steps)) return;
    const step = run2.steps.find((s) => s.index === stepIndex);
    if (!step) return;
    step.status = result.status;
    step.output = result.output;
    step.turns = result.turns;
    step.durationMs = result.durationMs;
    this.notify();
  }
  // ==================== 查询 ====================
  /** 获取所有运行记录（按启动顺序） */
  getAllRuns() {
    return this.runOrder.map((id) => this.runs.get(id)).filter((r) => r !== void 0);
  }
  /** 获取正在运行的记录 */
  getRunningRuns() {
    return this.getAllRuns().filter((r) => r.status === "running");
  }
  /** 获取单条运行记录 */
  getRun(toolCallId) {
    return this.runs.get(toolCallId);
  }
  /** 获取统计摘要 */
  getSummary() {
    const runs = this.getAllRuns();
    return {
      total: runs.length,
      running: runs.filter((r) => r.status === "running").length,
      completed: runs.filter((r) => r.status === "completed").length,
      failed: runs.filter((r) => r.status === "failed").length,
      aborted: runs.filter((r) => r.status === "aborted").length
    };
  }
  /** 清除所有已完成/失败的历史记录 */
  clearCompleted() {
    for (const [id, run2] of this.runs) {
      if (run2.status !== "running") {
        this.runs.delete(id);
        const idx = this.runOrder.indexOf(id);
        if (idx >= 0) this.runOrder.splice(idx, 1);
      }
    }
    this.notify();
  }
}
class ScopePolicy {
  constructor() {
  }
  /**
   * @contract
   * 委托 data/services/scope/policy.shouldSkip() 判断扩展是否应跳过拦截。
   * 输入：extensionName - 扩展注册名
   * 输出：boolean - true=放行（不拦截），false=正常拦截
   * 副作用：无
   */
  /**
   * @step
   * 1. 直接调用 data 层纯函数 shouldSkip(extensionName)
   * 2. 原样返回其结果
   */
  shouldSkip(extensionName) {
    return shouldSkip(extensionName);
  }
}
class FileSystemRepository {
  constructor() {
    this.watchers = /* @__PURE__ */ new Map();
  }
  // @contract: readFile(filePath: string) => Promise<string>
  // @step: [读取文件] 使用 fs.promises.readFile 读取文件内容
  // @step: [返回内容] 返回 UTF-8 编码的文件内容
  // @boundary: 文件不存在时抛出错误
  async readFile(filePath) {
    try {
      return await fs__namespace.promises.readFile(filePath, "utf-8");
    } catch (error) {
      throw new Error(`Failed to read file ${filePath}: ${error}`);
    }
  }
  // @contract: exists(filePath: string) => Promise<boolean>
  // @step: [检查文件] 使用 fs.promises.access 检查文件是否存在
  // @step: [返回结果] 存在返回 true，不存在返回 false
  async exists(filePath) {
    try {
      await fs__namespace.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
  // @contract: getModifiedTime(filePath: string) => Promise<number>
  // @step: [获取文件状态] 使用 fs.promises.stat 获取文件状态
  // @step: [返回修改时间] 返回修改时间的毫秒时间戳
  // @boundary: 文件不存在时抛出错误
  async getModifiedTime(filePath) {
    try {
      const stats = await fs__namespace.promises.stat(filePath);
      return stats.mtimeMs;
    } catch (error) {
      throw new Error(`Failed to get modified time for ${filePath}: ${error}`);
    }
  }
  // @contract: watchFile(filePath: string, callback: (filePath: string) => void) => void
  // @step: [创建监听器] 使用 fs.watch 创建文件监听器
  // @step: [注册回调] 文件变化时调用回调函数
  // @step: [存储监听器] 将监听器存储到 Map 中
  watchFile(filePath, callback) {
    if (this.watchers.has(filePath)) {
      return;
    }
    const watcher = fs__namespace.watch(filePath, (eventType) => {
      if (eventType === "change") {
        callback(filePath);
      }
    });
    this.watchers.set(filePath, watcher);
  }
  // @contract: unwatchFile(filePath: string) => void
  // @step: [获取监听器] 从 Map 中获取监听器
  // @step: [关闭监听器] 调用 watcher.close() 关闭监听
  // @step: [删除记录] 从 Map 中删除监听器
  unwatchFile(filePath) {
    const watcher = this.watchers.get(filePath);
    if (watcher) {
      watcher.close();
      this.watchers.delete(filePath);
    }
  }
  // @contract: writeFile(filePath: string, content: string) => Promise<void>
  // @step: [确保目录] 确保文件父目录存在
  // @step: [写入文件] 使用 fs.promises.writeFile 写入文件内容
  // @boundary: 写入失败时抛出错误
  async writeFile(filePath, content) {
    const dir = path__namespace.dirname(filePath);
    await this.ensureDir(dir);
    await fs__namespace.promises.writeFile(filePath, content, "utf-8");
  }
  // @contract: ensureDir(dirPath: string) => Promise<void>
  // @step: [创建目录] 使用 fs.promises.mkdir 递归创建目录
  // @boundary: 目录已存在时不报错
  async ensureDir(dirPath) {
    await fs__namespace.promises.mkdir(dirPath, { recursive: true });
  }
  // @contract: scanDirectory(dirPath: string, options?) => Promise<string[]>
  // @step: [读取目录] 使用 fs.promises.readdir 读取目录条目
  // @step: [递归扫描] 对目录条目递归扫描（如果 recursive 为 true）
  // @step: [过滤文件] 按扩展名过滤文件
  // @step: [返回结果] 返回匹配的文件路径数组
  // @boundary: 目录不存在时返回空数组而非抛出异常
  async scanDirectory(dirPath, options) {
    const { extensions, recursive = true } = options || {};
    const results = [];
    const scan2 = async (currentPath) => {
      let entries;
      try {
        entries = await fs__namespace.promises.readdir(currentPath, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        const fullPath = path__namespace.join(currentPath, entry.name);
        if (entry.isDirectory()) {
          if (recursive && !entry.name.startsWith(".") && entry.name !== "node_modules") {
            await scan2(fullPath);
          }
        } else if (entry.isFile()) {
          if (!extensions || extensions.includes(path__namespace.extname(entry.name))) {
            results.push(fullPath);
          }
        }
      }
    };
    await scan2(dirPath);
    return results;
  }
  // @contract: getLineCount(filePath: string) => Promise<number>
  // @step: [读取文件] 读取文件内容
  // @step: [分割行] 按换行符分割
  // @step: [返回行数] 返回行数
  // @boundary: 文件不存在时抛出错误
  async getLineCount(filePath) {
    const content = await this.readFile(filePath);
    return content.split("\n").length;
  }
  // @contract: deleteFile(filePath: string) => Promise<void>
  // @step: [删除文件] 使用 fs.promises.unlink 删除文件
  // @boundary: 文件不存在时静默成功（不抛错）
  async deleteFile(filePath) {
    try {
      await fs__namespace.promises.unlink(filePath);
    } catch (err2) {
      if ((err2 == null ? void 0 : err2.code) !== "ENOENT") throw err2;
    }
  }
  // @contract: renameFile(oldPath: string, newPath: string) => Promise<void>
  // @step: [重命名] 使用 fs.promises.rename 重命名/移动文件
  // @step: [父目录] 自动创建目标父目录
  // @boundary: 原文件不存在时抛错
  async renameFile(oldPath, newPath) {
    await fs__namespace.promises.mkdir(path__namespace.dirname(newPath), { recursive: true });
    await fs__namespace.promises.rename(oldPath, newPath);
  }
  // @contract: listSubdirectories(dirPath: string) => Promise<string[]>
  // @step: [读取目录] 使用 fs.promises.readdir 读取目录条目
  // @step: [过滤目录] 只保留 isDirectory() 为 true 的条目
  // @step: [排除隐藏] 排除以 . 开头的目录
  // @step: [排除 node_modules] 排除 node_modules
  // @step: [返回] 返回目录名数组
  // @boundary: 目录不存在时返回空数组
  async listSubdirectories(dirPath) {
    try {
      const entries = await fs__namespace.promises.readdir(dirPath, { withFileTypes: true });
      return entries.filter((e) => e.isDirectory() && !e.name.startsWith(".") && e.name !== "node_modules").map((e) => e.name);
    } catch {
      return [];
    }
  }
}
class FileContentCache {
  constructor(maxSizeMB = 50) {
    this.cache = /* @__PURE__ */ new Map();
    this.currentSize = 0;
    this.maxSize = maxSizeMB * 1024 * 1024;
  }
  // @contract: get(filePath: string) => Promise<string>
  // @step: [检查缓存] 检查缓存中是否存在该文件
  // @step: [验证时效] 检查文件是否被修改
  // @step: [返回缓存] 如果缓存有效，返回缓存内容
  // @step: [读取文件] 如果缓存无效，读取文件并更新缓存
  // @step: [返回内容] 返回文件内容
  async get(filePath) {
    const cached = this.cache.get(filePath);
    if (cached) {
      try {
        const stats2 = await fs__namespace.promises.stat(filePath);
        const fileModifiedTime = stats2.mtimeMs;
        if (fileModifiedTime <= cached.timestamp) {
          console.log(`[FileContentCache] 缓存命中: ${filePath}`);
          return cached.content;
        } else {
          console.log(`[FileContentCache] 文件已修改，更新缓存: ${filePath}`);
          this.delete(filePath);
        }
      } catch (error) {
        this.delete(filePath);
      }
    }
    console.log(`[FileContentCache] 缓存未命中，读取文件: ${filePath}`);
    const content = await fs__namespace.promises.readFile(filePath, "utf-8");
    const stats = await fs__namespace.promises.stat(filePath);
    this.set(filePath, content, stats.mtimeMs);
    return content;
  }
  // @end
  // @contract: set(filePath: string, content: string, timestamp: number) => void
  // @step: [检查容量] 检查是否超过最大缓存大小
  // @step: [清理缓存] 如果超过，使用 LRU 策略清理
  // @step: [存储缓存] 存储文件内容到缓存
  // @step: [更新大小] 更新当前缓存大小
  set(filePath, content, timestamp) {
    const size = Buffer.byteLength(content, "utf-8");
    while (this.currentSize + size > this.maxSize && this.cache.size > 0) {
      this.evictOldest();
    }
    this.cache.set(filePath, {
      content,
      timestamp,
      size
    });
    this.currentSize += size;
  }
  // @end
  // @contract: delete(filePath: string) => void
  // @step: [检查存在] 检查缓存中是否存在该文件
  // @step: [删除缓存] 删除缓存条目
  // @step: [更新大小] 更新当前缓存大小
  delete(filePath) {
    const cached = this.cache.get(filePath);
    if (cached) {
      this.cache.delete(filePath);
      this.currentSize -= cached.size;
      console.log(`[FileContentCache] 删除缓存: ${filePath}`);
    }
  }
  // @end
  // @contract: clear() => void
  // @step: [清空缓存] 清空所有缓存
  // @step: [重置大小] 重置当前缓存大小
  clear() {
    this.cache.clear();
    this.currentSize = 0;
    console.log(`[FileContentCache] 清空所有缓存`);
  }
  // @end
  // @contract: evictOldest() => void
  // @step: [找到最旧] 找到时间戳最旧的缓存条目
  // @step: [删除] 删除该条目
  evictOldest() {
    let oldestKey = null;
    let oldestTime = Infinity;
    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }
    if (oldestKey) {
      this.delete(oldestKey);
      console.log(`[FileContentCache] LRU 淘汰: ${oldestKey}`);
    }
  }
  // @end
  // @contract: getCurrentSize() => number
  // @step: [返回当前大小] 返回当前缓存大小（字节）
  getCurrentSize() {
    return this.currentSize;
  }
  // @end
  // @contract: getEntryCount() => number
  // @step: [返回条目数] 返回缓存条目数量
  getEntryCount() {
    return this.cache.size;
  }
  // @end
  // @contract: getMaxSize() => number
  // @step: [返回最大容量] 返回最大缓存大小（字节）
  getMaxSize() {
    return this.maxSize;
  }
  // @end
  // @contract: getStats() => { size: number, count: number, maxSize: number }
  // @step: [返回统计] 返回缓存统计信息
  getStats() {
    return {
      size: this.currentSize,
      count: this.cache.size,
      maxSize: this.maxSize
    };
  }
  // @end
}
var commonjsGlobal = typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : {};
function getDefaultExportFromCjs(x) {
  return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, "default") ? x["default"] : x;
}
var treeSitter = { exports: {} };
(function(module, exports) {
  (function(global2, factory) {
    module.exports = factory();
  })(commonjsGlobal, function() {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    function getCurrentScriptUrl() {
      if (typeof __filename !== "undefined") {
        return require$$0.pathToFileURL(__filename).href;
      }
      if (typeof document !== "undefined") {
        const script = document.currentScript;
        return script ? script.src : void 0;
      }
      throw new Error("Unable to determine script URL");
    }
    var __defProp = Object.defineProperty;
    var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
    var SIZE_OF_SHORT = 2;
    var SIZE_OF_INT = 4;
    var SIZE_OF_CURSOR = 4 * SIZE_OF_INT;
    var SIZE_OF_NODE = 5 * SIZE_OF_INT;
    var SIZE_OF_POINT = 2 * SIZE_OF_INT;
    var SIZE_OF_RANGE = 2 * SIZE_OF_INT + 2 * SIZE_OF_POINT;
    var ZERO_POINT = { row: 0, column: 0 };
    var INTERNAL = Symbol("INTERNAL");
    function assertInternal(x) {
      if (x !== INTERNAL) throw new Error("Illegal constructor");
    }
    __name(assertInternal, "assertInternal");
    function isPoint(point) {
      return !!point && typeof point.row === "number" && typeof point.column === "number";
    }
    __name(isPoint, "isPoint");
    function setModule(module2) {
      C = module2;
    }
    __name(setModule, "setModule");
    var C;
    var LookaheadIterator = (_a = class {
      /** @internal */
      constructor(internal, address, language) {
        /** @internal */
        __publicField(this, 0, 0);
        // Internal handle for WASM
        /** @internal */
        __publicField(this, "language");
        assertInternal(internal);
        this[0] = address;
        this.language = language;
      }
      /** Get the current symbol of the lookahead iterator. */
      get currentTypeId() {
        return C._ts_lookahead_iterator_current_symbol(this[0]);
      }
      /** Get the current symbol name of the lookahead iterator. */
      get currentType() {
        return this.language.types[this.currentTypeId] || "ERROR";
      }
      /** Delete the lookahead iterator, freeing its resources. */
      delete() {
        C._ts_lookahead_iterator_delete(this[0]);
        this[0] = 0;
      }
      /**
       * Reset the lookahead iterator.
       *
       * This returns `true` if the language was set successfully and `false`
       * otherwise.
       */
      reset(language, stateId) {
        if (C._ts_lookahead_iterator_reset(this[0], language[0], stateId)) {
          this.language = language;
          return true;
        }
        return false;
      }
      /**
       * Reset the lookahead iterator to another state.
       *
       * This returns `true` if the iterator was reset to the given state and
       * `false` otherwise.
       */
      resetState(stateId) {
        return Boolean(C._ts_lookahead_iterator_reset_state(this[0], stateId));
      }
      /**
       * Returns an iterator that iterates over the symbols of the lookahead iterator.
       *
       * The iterator will yield the current symbol name as a string for each step
       * until there are no more symbols to iterate over.
       */
      [Symbol.iterator]() {
        return {
          next: /* @__PURE__ */ __name(() => {
            if (C._ts_lookahead_iterator_next(this[0])) {
              return { done: false, value: this.currentType };
            }
            return { done: true, value: "" };
          }, "next")
        };
      }
    }, __name(_a, "LookaheadIterator"), _a);
    function getText(tree, startIndex, endIndex, startPosition) {
      const length = endIndex - startIndex;
      let result = tree.textCallback(startIndex, startPosition);
      if (result) {
        startIndex += result.length;
        while (startIndex < endIndex) {
          const string = tree.textCallback(startIndex, startPosition);
          if (string && string.length > 0) {
            startIndex += string.length;
            result += string;
          } else {
            break;
          }
        }
        if (startIndex > endIndex) {
          result = result.slice(0, length);
        }
      }
      return result ?? "";
    }
    __name(getText, "getText");
    var Tree = (_b = class {
      /** @internal */
      constructor(internal, address, language, textCallback) {
        /** @internal */
        __publicField(this, 0, 0);
        // Internal handle for WASM
        /** @internal */
        __publicField(this, "textCallback");
        /** The language that was used to parse the syntax tree. */
        __publicField(this, "language");
        assertInternal(internal);
        this[0] = address;
        this.language = language;
        this.textCallback = textCallback;
      }
      /** Create a shallow copy of the syntax tree. This is very fast. */
      copy() {
        const address = C._ts_tree_copy(this[0]);
        return new _b(INTERNAL, address, this.language, this.textCallback);
      }
      /** Delete the syntax tree, freeing its resources. */
      delete() {
        C._ts_tree_delete(this[0]);
        this[0] = 0;
      }
      /** Get the root node of the syntax tree. */
      get rootNode() {
        C._ts_tree_root_node_wasm(this[0]);
        return unmarshalNode(this);
      }
      /**
       * Get the root node of the syntax tree, but with its position shifted
       * forward by the given offset.
       */
      rootNodeWithOffset(offsetBytes, offsetExtent) {
        const address = TRANSFER_BUFFER + SIZE_OF_NODE;
        C.setValue(address, offsetBytes, "i32");
        marshalPoint(address + SIZE_OF_INT, offsetExtent);
        C._ts_tree_root_node_with_offset_wasm(this[0]);
        return unmarshalNode(this);
      }
      /**
       * Edit the syntax tree to keep it in sync with source code that has been
       * edited.
       *
       * You must describe the edit both in terms of byte offsets and in terms of
       * row/column coordinates.
       */
      edit(edit) {
        marshalEdit(edit);
        C._ts_tree_edit_wasm(this[0]);
      }
      /** Create a new {@link TreeCursor} starting from the root of the tree. */
      walk() {
        return this.rootNode.walk();
      }
      /**
       * Compare this old edited syntax tree to a new syntax tree representing
       * the same document, returning a sequence of ranges whose syntactic
       * structure has changed.
       *
       * For this to work correctly, this syntax tree must have been edited such
       * that its ranges match up to the new tree. Generally, you'll want to
       * call this method right after calling one of the [`Parser::parse`]
       * functions. Call it on the old tree that was passed to parse, and
       * pass the new tree that was returned from `parse`.
       */
      getChangedRanges(other) {
        if (!(other instanceof _b)) {
          throw new TypeError("Argument must be a Tree");
        }
        C._ts_tree_get_changed_ranges_wasm(this[0], other[0]);
        const count = C.getValue(TRANSFER_BUFFER, "i32");
        const buffer = C.getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32");
        const result = new Array(count);
        if (count > 0) {
          let address = buffer;
          for (let i2 = 0; i2 < count; i2++) {
            result[i2] = unmarshalRange(address);
            address += SIZE_OF_RANGE;
          }
          C._free(buffer);
        }
        return result;
      }
      /** Get the included ranges that were used to parse the syntax tree. */
      getIncludedRanges() {
        C._ts_tree_included_ranges_wasm(this[0]);
        const count = C.getValue(TRANSFER_BUFFER, "i32");
        const buffer = C.getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32");
        const result = new Array(count);
        if (count > 0) {
          let address = buffer;
          for (let i2 = 0; i2 < count; i2++) {
            result[i2] = unmarshalRange(address);
            address += SIZE_OF_RANGE;
          }
          C._free(buffer);
        }
        return result;
      }
    }, __name(_b, "Tree"), _b);
    var TreeCursor = (_c = class {
      /** @internal */
      constructor(internal, tree) {
        /** @internal */
        // @ts-expect-error: never read
        __publicField(this, 0, 0);
        // Internal handle for Wasm
        /** @internal */
        // @ts-expect-error: never read
        __publicField(this, 1, 0);
        // Internal handle for Wasm
        /** @internal */
        // @ts-expect-error: never read
        __publicField(this, 2, 0);
        // Internal handle for Wasm
        /** @internal */
        // @ts-expect-error: never read
        __publicField(this, 3, 0);
        // Internal handle for Wasm
        /** @internal */
        __publicField(this, "tree");
        assertInternal(internal);
        this.tree = tree;
        unmarshalTreeCursor(this);
      }
      /** Creates a deep copy of the tree cursor. This allocates new memory. */
      copy() {
        const copy = new _c(INTERNAL, this.tree);
        C._ts_tree_cursor_copy_wasm(this.tree[0]);
        unmarshalTreeCursor(copy);
        return copy;
      }
      /** Delete the tree cursor, freeing its resources. */
      delete() {
        marshalTreeCursor(this);
        C._ts_tree_cursor_delete_wasm(this.tree[0]);
        this[0] = this[1] = this[2] = 0;
      }
      /** Get the tree cursor's current {@link Node}. */
      get currentNode() {
        marshalTreeCursor(this);
        C._ts_tree_cursor_current_node_wasm(this.tree[0]);
        return unmarshalNode(this.tree);
      }
      /**
       * Get the numerical field id of this tree cursor's current node.
       *
       * See also {@link TreeCursor#currentFieldName}.
       */
      get currentFieldId() {
        marshalTreeCursor(this);
        return C._ts_tree_cursor_current_field_id_wasm(this.tree[0]);
      }
      /** Get the field name of this tree cursor's current node. */
      get currentFieldName() {
        return this.tree.language.fields[this.currentFieldId];
      }
      /**
       * Get the depth of the cursor's current node relative to the original
       * node that the cursor was constructed with.
       */
      get currentDepth() {
        marshalTreeCursor(this);
        return C._ts_tree_cursor_current_depth_wasm(this.tree[0]);
      }
      /**
       * Get the index of the cursor's current node out of all of the
       * descendants of the original node that the cursor was constructed with.
       */
      get currentDescendantIndex() {
        marshalTreeCursor(this);
        return C._ts_tree_cursor_current_descendant_index_wasm(this.tree[0]);
      }
      /** Get the type of the cursor's current node. */
      get nodeType() {
        return this.tree.language.types[this.nodeTypeId] || "ERROR";
      }
      /** Get the type id of the cursor's current node. */
      get nodeTypeId() {
        marshalTreeCursor(this);
        return C._ts_tree_cursor_current_node_type_id_wasm(this.tree[0]);
      }
      /** Get the state id of the cursor's current node. */
      get nodeStateId() {
        marshalTreeCursor(this);
        return C._ts_tree_cursor_current_node_state_id_wasm(this.tree[0]);
      }
      /** Get the id of the cursor's current node. */
      get nodeId() {
        marshalTreeCursor(this);
        return C._ts_tree_cursor_current_node_id_wasm(this.tree[0]);
      }
      /**
       * Check if the cursor's current node is *named*.
       *
       * Named nodes correspond to named rules in the grammar, whereas
       * *anonymous* nodes correspond to string literals in the grammar.
       */
      get nodeIsNamed() {
        marshalTreeCursor(this);
        return C._ts_tree_cursor_current_node_is_named_wasm(this.tree[0]) === 1;
      }
      /**
       * Check if the cursor's current node is *missing*.
       *
       * Missing nodes are inserted by the parser in order to recover from
       * certain kinds of syntax errors.
       */
      get nodeIsMissing() {
        marshalTreeCursor(this);
        return C._ts_tree_cursor_current_node_is_missing_wasm(this.tree[0]) === 1;
      }
      /** Get the string content of the cursor's current node. */
      get nodeText() {
        marshalTreeCursor(this);
        const startIndex = C._ts_tree_cursor_start_index_wasm(this.tree[0]);
        const endIndex = C._ts_tree_cursor_end_index_wasm(this.tree[0]);
        C._ts_tree_cursor_start_position_wasm(this.tree[0]);
        const startPosition = unmarshalPoint(TRANSFER_BUFFER);
        return getText(this.tree, startIndex, endIndex, startPosition);
      }
      /** Get the start position of the cursor's current node. */
      get startPosition() {
        marshalTreeCursor(this);
        C._ts_tree_cursor_start_position_wasm(this.tree[0]);
        return unmarshalPoint(TRANSFER_BUFFER);
      }
      /** Get the end position of the cursor's current node. */
      get endPosition() {
        marshalTreeCursor(this);
        C._ts_tree_cursor_end_position_wasm(this.tree[0]);
        return unmarshalPoint(TRANSFER_BUFFER);
      }
      /** Get the start index of the cursor's current node. */
      get startIndex() {
        marshalTreeCursor(this);
        return C._ts_tree_cursor_start_index_wasm(this.tree[0]);
      }
      /** Get the end index of the cursor's current node. */
      get endIndex() {
        marshalTreeCursor(this);
        return C._ts_tree_cursor_end_index_wasm(this.tree[0]);
      }
      /**
       * Move this cursor to the first child of its current node.
       *
       * This returns `true` if the cursor successfully moved, and returns
       * `false` if there were no children.
       */
      gotoFirstChild() {
        marshalTreeCursor(this);
        const result = C._ts_tree_cursor_goto_first_child_wasm(this.tree[0]);
        unmarshalTreeCursor(this);
        return result === 1;
      }
      /**
       * Move this cursor to the last child of its current node.
       *
       * This returns `true` if the cursor successfully moved, and returns
       * `false` if there were no children.
       *
       * Note that this function may be slower than
       * {@link TreeCursor#gotoFirstChild} because it needs to
       * iterate through all the children to compute the child's position.
       */
      gotoLastChild() {
        marshalTreeCursor(this);
        const result = C._ts_tree_cursor_goto_last_child_wasm(this.tree[0]);
        unmarshalTreeCursor(this);
        return result === 1;
      }
      /**
       * Move this cursor to the parent of its current node.
       *
       * This returns `true` if the cursor successfully moved, and returns
       * `false` if there was no parent node (the cursor was already on the
       * root node).
       *
       * Note that the node the cursor was constructed with is considered the root
       * of the cursor, and the cursor cannot walk outside this node.
       */
      gotoParent() {
        marshalTreeCursor(this);
        const result = C._ts_tree_cursor_goto_parent_wasm(this.tree[0]);
        unmarshalTreeCursor(this);
        return result === 1;
      }
      /**
       * Move this cursor to the next sibling of its current node.
       *
       * This returns `true` if the cursor successfully moved, and returns
       * `false` if there was no next sibling node.
       *
       * Note that the node the cursor was constructed with is considered the root
       * of the cursor, and the cursor cannot walk outside this node.
       */
      gotoNextSibling() {
        marshalTreeCursor(this);
        const result = C._ts_tree_cursor_goto_next_sibling_wasm(this.tree[0]);
        unmarshalTreeCursor(this);
        return result === 1;
      }
      /**
       * Move this cursor to the previous sibling of its current node.
       *
       * This returns `true` if the cursor successfully moved, and returns
       * `false` if there was no previous sibling node.
       *
       * Note that this function may be slower than
       * {@link TreeCursor#gotoNextSibling} due to how node
       * positions are stored. In the worst case, this will need to iterate
       * through all the children up to the previous sibling node to recalculate
       * its position. Also note that the node the cursor was constructed with is
       * considered the root of the cursor, and the cursor cannot walk outside this node.
       */
      gotoPreviousSibling() {
        marshalTreeCursor(this);
        const result = C._ts_tree_cursor_goto_previous_sibling_wasm(this.tree[0]);
        unmarshalTreeCursor(this);
        return result === 1;
      }
      /**
       * Move the cursor to the node that is the nth descendant of
       * the original node that the cursor was constructed with, where
       * zero represents the original node itself.
       */
      gotoDescendant(goalDescendantIndex) {
        marshalTreeCursor(this);
        C._ts_tree_cursor_goto_descendant_wasm(this.tree[0], goalDescendantIndex);
        unmarshalTreeCursor(this);
      }
      /**
       * Move this cursor to the first child of its current node that contains or
       * starts after the given byte offset.
       *
       * This returns `true` if the cursor successfully moved to a child node, and returns
       * `false` if no such child was found.
       */
      gotoFirstChildForIndex(goalIndex) {
        marshalTreeCursor(this);
        C.setValue(TRANSFER_BUFFER + SIZE_OF_CURSOR, goalIndex, "i32");
        const result = C._ts_tree_cursor_goto_first_child_for_index_wasm(this.tree[0]);
        unmarshalTreeCursor(this);
        return result === 1;
      }
      /**
       * Move this cursor to the first child of its current node that contains or
       * starts after the given byte offset.
       *
       * This returns the index of the child node if one was found, and returns
       * `null` if no such child was found.
       */
      gotoFirstChildForPosition(goalPosition) {
        marshalTreeCursor(this);
        marshalPoint(TRANSFER_BUFFER + SIZE_OF_CURSOR, goalPosition);
        const result = C._ts_tree_cursor_goto_first_child_for_position_wasm(this.tree[0]);
        unmarshalTreeCursor(this);
        return result === 1;
      }
      /**
       * Re-initialize this tree cursor to start at the original node that the
       * cursor was constructed with.
       */
      reset(node) {
        marshalNode(node);
        marshalTreeCursor(this, TRANSFER_BUFFER + SIZE_OF_NODE);
        C._ts_tree_cursor_reset_wasm(this.tree[0]);
        unmarshalTreeCursor(this);
      }
      /**
       * Re-initialize a tree cursor to the same position as another cursor.
       *
       * Unlike {@link TreeCursor#reset}, this will not lose parent
       * information and allows reusing already created cursors.
       */
      resetTo(cursor) {
        marshalTreeCursor(this, TRANSFER_BUFFER);
        marshalTreeCursor(cursor, TRANSFER_BUFFER + SIZE_OF_CURSOR);
        C._ts_tree_cursor_reset_to_wasm(this.tree[0], cursor.tree[0]);
        unmarshalTreeCursor(this);
      }
    }, __name(_c, "TreeCursor"), _c);
    var Node = (_d = class {
      /** @internal */
      constructor(internal, {
        id,
        tree,
        startIndex,
        startPosition,
        other
      }) {
        /** @internal */
        // @ts-expect-error: never read
        __publicField(this, 0, 0);
        // Internal handle for Wasm
        /** @internal */
        __publicField(this, "_children");
        /** @internal */
        __publicField(this, "_namedChildren");
        /**
         * The numeric id for this node that is unique.
         *
         * Within a given syntax tree, no two nodes have the same id. However:
         *
         * * If a new tree is created based on an older tree, and a node from the old tree is reused in
         *   the process, then that node will have the same id in both trees.
         *
         * * A node not marked as having changes does not guarantee it was reused.
         *
         * * If a node is marked as having changed in the old tree, it will not be reused.
         */
        __publicField(this, "id");
        /** The byte index where this node starts. */
        __publicField(this, "startIndex");
        /** The position where this node starts. */
        __publicField(this, "startPosition");
        /** The tree that this node belongs to. */
        __publicField(this, "tree");
        assertInternal(internal);
        this[0] = other;
        this.id = id;
        this.tree = tree;
        this.startIndex = startIndex;
        this.startPosition = startPosition;
      }
      /** Get this node's type as a numerical id. */
      get typeId() {
        marshalNode(this);
        return C._ts_node_symbol_wasm(this.tree[0]);
      }
      /**
       * Get the node's type as a numerical id as it appears in the grammar,
       * ignoring aliases.
       */
      get grammarId() {
        marshalNode(this);
        return C._ts_node_grammar_symbol_wasm(this.tree[0]);
      }
      /** Get this node's type as a string. */
      get type() {
        return this.tree.language.types[this.typeId] || "ERROR";
      }
      /**
       * Get this node's symbol name as it appears in the grammar, ignoring
       * aliases as a string.
       */
      get grammarType() {
        return this.tree.language.types[this.grammarId] || "ERROR";
      }
      /**
       * Check if this node is *named*.
       *
       * Named nodes correspond to named rules in the grammar, whereas
       * *anonymous* nodes correspond to string literals in the grammar.
       */
      get isNamed() {
        marshalNode(this);
        return C._ts_node_is_named_wasm(this.tree[0]) === 1;
      }
      /**
       * Check if this node is *extra*.
       *
       * Extra nodes represent things like comments, which are not required
       * by the grammar, but can appear anywhere.
       */
      get isExtra() {
        marshalNode(this);
        return C._ts_node_is_extra_wasm(this.tree[0]) === 1;
      }
      /**
       * Check if this node represents a syntax error.
       *
       * Syntax errors represent parts of the code that could not be incorporated
       * into a valid syntax tree.
       */
      get isError() {
        marshalNode(this);
        return C._ts_node_is_error_wasm(this.tree[0]) === 1;
      }
      /**
       * Check if this node is *missing*.
       *
       * Missing nodes are inserted by the parser in order to recover from
       * certain kinds of syntax errors.
       */
      get isMissing() {
        marshalNode(this);
        return C._ts_node_is_missing_wasm(this.tree[0]) === 1;
      }
      /** Check if this node has been edited. */
      get hasChanges() {
        marshalNode(this);
        return C._ts_node_has_changes_wasm(this.tree[0]) === 1;
      }
      /**
       * Check if this node represents a syntax error or contains any syntax
       * errors anywhere within it.
       */
      get hasError() {
        marshalNode(this);
        return C._ts_node_has_error_wasm(this.tree[0]) === 1;
      }
      /** Get the byte index where this node ends. */
      get endIndex() {
        marshalNode(this);
        return C._ts_node_end_index_wasm(this.tree[0]);
      }
      /** Get the position where this node ends. */
      get endPosition() {
        marshalNode(this);
        C._ts_node_end_point_wasm(this.tree[0]);
        return unmarshalPoint(TRANSFER_BUFFER);
      }
      /** Get the string content of this node. */
      get text() {
        return getText(this.tree, this.startIndex, this.endIndex, this.startPosition);
      }
      /** Get this node's parse state. */
      get parseState() {
        marshalNode(this);
        return C._ts_node_parse_state_wasm(this.tree[0]);
      }
      /** Get the parse state after this node. */
      get nextParseState() {
        marshalNode(this);
        return C._ts_node_next_parse_state_wasm(this.tree[0]);
      }
      /** Check if this node is equal to another node. */
      equals(other) {
        return this.tree === other.tree && this.id === other.id;
      }
      /**
       * Get the node's child at the given index, where zero represents the first child.
       *
       * This method is fairly fast, but its cost is technically log(n), so if
       * you might be iterating over a long list of children, you should use
       * {@link Node#children} instead.
       */
      child(index) {
        marshalNode(this);
        C._ts_node_child_wasm(this.tree[0], index);
        return unmarshalNode(this.tree);
      }
      /**
       * Get this node's *named* child at the given index.
       *
       * See also {@link Node#isNamed}.
       * This method is fairly fast, but its cost is technically log(n), so if
       * you might be iterating over a long list of children, you should use
       * {@link Node#namedChildren} instead.
       */
      namedChild(index) {
        marshalNode(this);
        C._ts_node_named_child_wasm(this.tree[0], index);
        return unmarshalNode(this.tree);
      }
      /**
       * Get this node's child with the given numerical field id.
       *
       * See also {@link Node#childForFieldName}. You can
       * convert a field name to an id using {@link Language#fieldIdForName}.
       */
      childForFieldId(fieldId) {
        marshalNode(this);
        C._ts_node_child_by_field_id_wasm(this.tree[0], fieldId);
        return unmarshalNode(this.tree);
      }
      /**
       * Get the first child with the given field name.
       *
       * If multiple children may have the same field name, access them using
       * {@link Node#childrenForFieldName}.
       */
      childForFieldName(fieldName) {
        const fieldId = this.tree.language.fields.indexOf(fieldName);
        if (fieldId !== -1) return this.childForFieldId(fieldId);
        return null;
      }
      /** Get the field name of this node's child at the given index. */
      fieldNameForChild(index) {
        marshalNode(this);
        const address = C._ts_node_field_name_for_child_wasm(this.tree[0], index);
        if (!address) return null;
        return C.AsciiToString(address);
      }
      /** Get the field name of this node's named child at the given index. */
      fieldNameForNamedChild(index) {
        marshalNode(this);
        const address = C._ts_node_field_name_for_named_child_wasm(this.tree[0], index);
        if (!address) return null;
        return C.AsciiToString(address);
      }
      /**
       * Get an array of this node's children with a given field name.
       *
       * See also {@link Node#children}.
       */
      childrenForFieldName(fieldName) {
        const fieldId = this.tree.language.fields.indexOf(fieldName);
        if (fieldId !== -1 && fieldId !== 0) return this.childrenForFieldId(fieldId);
        return [];
      }
      /**
        * Get an array of this node's children with a given field id.
        *
        * See also {@link Node#childrenForFieldName}.
        */
      childrenForFieldId(fieldId) {
        marshalNode(this);
        C._ts_node_children_by_field_id_wasm(this.tree[0], fieldId);
        const count = C.getValue(TRANSFER_BUFFER, "i32");
        const buffer = C.getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32");
        const result = new Array(count);
        if (count > 0) {
          let address = buffer;
          for (let i2 = 0; i2 < count; i2++) {
            result[i2] = unmarshalNode(this.tree, address);
            address += SIZE_OF_NODE;
          }
          C._free(buffer);
        }
        return result;
      }
      /** Get the node's first child that contains or starts after the given byte offset. */
      firstChildForIndex(index) {
        marshalNode(this);
        const address = TRANSFER_BUFFER + SIZE_OF_NODE;
        C.setValue(address, index, "i32");
        C._ts_node_first_child_for_byte_wasm(this.tree[0]);
        return unmarshalNode(this.tree);
      }
      /** Get the node's first named child that contains or starts after the given byte offset. */
      firstNamedChildForIndex(index) {
        marshalNode(this);
        const address = TRANSFER_BUFFER + SIZE_OF_NODE;
        C.setValue(address, index, "i32");
        C._ts_node_first_named_child_for_byte_wasm(this.tree[0]);
        return unmarshalNode(this.tree);
      }
      /** Get this node's number of children. */
      get childCount() {
        marshalNode(this);
        return C._ts_node_child_count_wasm(this.tree[0]);
      }
      /**
       * Get this node's number of *named* children.
       *
       * See also {@link Node#isNamed}.
       */
      get namedChildCount() {
        marshalNode(this);
        return C._ts_node_named_child_count_wasm(this.tree[0]);
      }
      /** Get this node's first child. */
      get firstChild() {
        return this.child(0);
      }
      /**
       * Get this node's first named child.
       *
       * See also {@link Node#isNamed}.
       */
      get firstNamedChild() {
        return this.namedChild(0);
      }
      /** Get this node's last child. */
      get lastChild() {
        return this.child(this.childCount - 1);
      }
      /**
       * Get this node's last named child.
       *
       * See also {@link Node#isNamed}.
       */
      get lastNamedChild() {
        return this.namedChild(this.namedChildCount - 1);
      }
      /**
       * Iterate over this node's children.
       *
       * If you're walking the tree recursively, you may want to use the
       * {@link TreeCursor} APIs directly instead.
       */
      get children() {
        if (!this._children) {
          marshalNode(this);
          C._ts_node_children_wasm(this.tree[0]);
          const count = C.getValue(TRANSFER_BUFFER, "i32");
          const buffer = C.getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32");
          this._children = new Array(count);
          if (count > 0) {
            let address = buffer;
            for (let i2 = 0; i2 < count; i2++) {
              this._children[i2] = unmarshalNode(this.tree, address);
              address += SIZE_OF_NODE;
            }
            C._free(buffer);
          }
        }
        return this._children;
      }
      /**
       * Iterate over this node's named children.
       *
       * See also {@link Node#children}.
       */
      get namedChildren() {
        if (!this._namedChildren) {
          marshalNode(this);
          C._ts_node_named_children_wasm(this.tree[0]);
          const count = C.getValue(TRANSFER_BUFFER, "i32");
          const buffer = C.getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32");
          this._namedChildren = new Array(count);
          if (count > 0) {
            let address = buffer;
            for (let i2 = 0; i2 < count; i2++) {
              this._namedChildren[i2] = unmarshalNode(this.tree, address);
              address += SIZE_OF_NODE;
            }
            C._free(buffer);
          }
        }
        return this._namedChildren;
      }
      /**
       * Get the descendants of this node that are the given type, or in the given types array.
       *
       * The types array should contain node type strings, which can be retrieved from {@link Language#types}.
       *
       * Additionally, a `startPosition` and `endPosition` can be passed in to restrict the search to a byte range.
       */
      descendantsOfType(types, startPosition = ZERO_POINT, endPosition = ZERO_POINT) {
        if (!Array.isArray(types)) types = [types];
        const symbols = [];
        const typesBySymbol = this.tree.language.types;
        for (const node_type of types) {
          if (node_type == "ERROR") {
            symbols.push(65535);
          }
        }
        for (let i2 = 0, n = typesBySymbol.length; i2 < n; i2++) {
          if (types.includes(typesBySymbol[i2])) {
            symbols.push(i2);
          }
        }
        const symbolsAddress = C._malloc(SIZE_OF_INT * symbols.length);
        for (let i2 = 0, n = symbols.length; i2 < n; i2++) {
          C.setValue(symbolsAddress + i2 * SIZE_OF_INT, symbols[i2], "i32");
        }
        marshalNode(this);
        C._ts_node_descendants_of_type_wasm(
          this.tree[0],
          symbolsAddress,
          symbols.length,
          startPosition.row,
          startPosition.column,
          endPosition.row,
          endPosition.column
        );
        const descendantCount = C.getValue(TRANSFER_BUFFER, "i32");
        const descendantAddress = C.getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32");
        const result = new Array(descendantCount);
        if (descendantCount > 0) {
          let address = descendantAddress;
          for (let i2 = 0; i2 < descendantCount; i2++) {
            result[i2] = unmarshalNode(this.tree, address);
            address += SIZE_OF_NODE;
          }
        }
        C._free(descendantAddress);
        C._free(symbolsAddress);
        return result;
      }
      /** Get this node's next sibling. */
      get nextSibling() {
        marshalNode(this);
        C._ts_node_next_sibling_wasm(this.tree[0]);
        return unmarshalNode(this.tree);
      }
      /** Get this node's previous sibling. */
      get previousSibling() {
        marshalNode(this);
        C._ts_node_prev_sibling_wasm(this.tree[0]);
        return unmarshalNode(this.tree);
      }
      /**
       * Get this node's next *named* sibling.
       *
       * See also {@link Node#isNamed}.
       */
      get nextNamedSibling() {
        marshalNode(this);
        C._ts_node_next_named_sibling_wasm(this.tree[0]);
        return unmarshalNode(this.tree);
      }
      /**
       * Get this node's previous *named* sibling.
       *
       * See also {@link Node#isNamed}.
       */
      get previousNamedSibling() {
        marshalNode(this);
        C._ts_node_prev_named_sibling_wasm(this.tree[0]);
        return unmarshalNode(this.tree);
      }
      /** Get the node's number of descendants, including one for the node itself. */
      get descendantCount() {
        marshalNode(this);
        return C._ts_node_descendant_count_wasm(this.tree[0]);
      }
      /**
       * Get this node's immediate parent.
       * Prefer {@link Node#childWithDescendant} for iterating over this node's ancestors.
       */
      get parent() {
        marshalNode(this);
        C._ts_node_parent_wasm(this.tree[0]);
        return unmarshalNode(this.tree);
      }
      /**
       * Get the node that contains `descendant`.
       *
       * Note that this can return `descendant` itself.
       */
      childWithDescendant(descendant) {
        marshalNode(this);
        marshalNode(descendant, 1);
        C._ts_node_child_with_descendant_wasm(this.tree[0]);
        return unmarshalNode(this.tree);
      }
      /** Get the smallest node within this node that spans the given byte range. */
      descendantForIndex(start2, end = start2) {
        if (typeof start2 !== "number" || typeof end !== "number") {
          throw new Error("Arguments must be numbers");
        }
        marshalNode(this);
        const address = TRANSFER_BUFFER + SIZE_OF_NODE;
        C.setValue(address, start2, "i32");
        C.setValue(address + SIZE_OF_INT, end, "i32");
        C._ts_node_descendant_for_index_wasm(this.tree[0]);
        return unmarshalNode(this.tree);
      }
      /** Get the smallest named node within this node that spans the given byte range. */
      namedDescendantForIndex(start2, end = start2) {
        if (typeof start2 !== "number" || typeof end !== "number") {
          throw new Error("Arguments must be numbers");
        }
        marshalNode(this);
        const address = TRANSFER_BUFFER + SIZE_OF_NODE;
        C.setValue(address, start2, "i32");
        C.setValue(address + SIZE_OF_INT, end, "i32");
        C._ts_node_named_descendant_for_index_wasm(this.tree[0]);
        return unmarshalNode(this.tree);
      }
      /** Get the smallest node within this node that spans the given point range. */
      descendantForPosition(start2, end = start2) {
        if (!isPoint(start2) || !isPoint(end)) {
          throw new Error("Arguments must be {row, column} objects");
        }
        marshalNode(this);
        const address = TRANSFER_BUFFER + SIZE_OF_NODE;
        marshalPoint(address, start2);
        marshalPoint(address + SIZE_OF_POINT, end);
        C._ts_node_descendant_for_position_wasm(this.tree[0]);
        return unmarshalNode(this.tree);
      }
      /** Get the smallest named node within this node that spans the given point range. */
      namedDescendantForPosition(start2, end = start2) {
        if (!isPoint(start2) || !isPoint(end)) {
          throw new Error("Arguments must be {row, column} objects");
        }
        marshalNode(this);
        const address = TRANSFER_BUFFER + SIZE_OF_NODE;
        marshalPoint(address, start2);
        marshalPoint(address + SIZE_OF_POINT, end);
        C._ts_node_named_descendant_for_position_wasm(this.tree[0]);
        return unmarshalNode(this.tree);
      }
      /**
       * Create a new {@link TreeCursor} starting from this node.
       *
       * Note that the given node is considered the root of the cursor,
       * and the cursor cannot walk outside this node.
       */
      walk() {
        marshalNode(this);
        C._ts_tree_cursor_new_wasm(this.tree[0]);
        return new TreeCursor(INTERNAL, this.tree);
      }
      /**
       * Edit this node to keep it in-sync with source code that has been edited.
       *
       * This function is only rarely needed. When you edit a syntax tree with
       * the {@link Tree#edit} method, all of the nodes that you retrieve from
       * the tree afterward will already reflect the edit. You only need to
       * use {@link Node#edit} when you have a specific {@link Node} instance that
       * you want to keep and continue to use after an edit.
       */
      edit(edit) {
        if (this.startIndex >= edit.oldEndIndex) {
          this.startIndex = edit.newEndIndex + (this.startIndex - edit.oldEndIndex);
          let subbedPointRow;
          let subbedPointColumn;
          if (this.startPosition.row > edit.oldEndPosition.row) {
            subbedPointRow = this.startPosition.row - edit.oldEndPosition.row;
            subbedPointColumn = this.startPosition.column;
          } else {
            subbedPointRow = 0;
            subbedPointColumn = this.startPosition.column;
            if (this.startPosition.column >= edit.oldEndPosition.column) {
              subbedPointColumn = this.startPosition.column - edit.oldEndPosition.column;
            }
          }
          if (subbedPointRow > 0) {
            this.startPosition.row += subbedPointRow;
            this.startPosition.column = subbedPointColumn;
          } else {
            this.startPosition.column += subbedPointColumn;
          }
        } else if (this.startIndex > edit.startIndex) {
          this.startIndex = edit.newEndIndex;
          this.startPosition.row = edit.newEndPosition.row;
          this.startPosition.column = edit.newEndPosition.column;
        }
      }
      /** Get the S-expression representation of this node. */
      toString() {
        marshalNode(this);
        const address = C._ts_node_to_string_wasm(this.tree[0]);
        const result = C.AsciiToString(address);
        C._free(address);
        return result;
      }
    }, __name(_d, "Node"), _d);
    function unmarshalCaptures(query, tree, address, patternIndex, result) {
      for (let i2 = 0, n = result.length; i2 < n; i2++) {
        const captureIndex = C.getValue(address, "i32");
        address += SIZE_OF_INT;
        const node = unmarshalNode(tree, address);
        address += SIZE_OF_NODE;
        result[i2] = { patternIndex, name: query.captureNames[captureIndex], node };
      }
      return address;
    }
    __name(unmarshalCaptures, "unmarshalCaptures");
    function marshalNode(node, index = 0) {
      let address = TRANSFER_BUFFER + index * SIZE_OF_NODE;
      C.setValue(address, node.id, "i32");
      address += SIZE_OF_INT;
      C.setValue(address, node.startIndex, "i32");
      address += SIZE_OF_INT;
      C.setValue(address, node.startPosition.row, "i32");
      address += SIZE_OF_INT;
      C.setValue(address, node.startPosition.column, "i32");
      address += SIZE_OF_INT;
      C.setValue(address, node[0], "i32");
    }
    __name(marshalNode, "marshalNode");
    function unmarshalNode(tree, address = TRANSFER_BUFFER) {
      const id = C.getValue(address, "i32");
      address += SIZE_OF_INT;
      if (id === 0) return null;
      const index = C.getValue(address, "i32");
      address += SIZE_OF_INT;
      const row = C.getValue(address, "i32");
      address += SIZE_OF_INT;
      const column = C.getValue(address, "i32");
      address += SIZE_OF_INT;
      const other = C.getValue(address, "i32");
      const result = new Node(INTERNAL, {
        id,
        tree,
        startIndex: index,
        startPosition: { row, column },
        other
      });
      return result;
    }
    __name(unmarshalNode, "unmarshalNode");
    function marshalTreeCursor(cursor, address = TRANSFER_BUFFER) {
      C.setValue(address + 0 * SIZE_OF_INT, cursor[0], "i32");
      C.setValue(address + 1 * SIZE_OF_INT, cursor[1], "i32");
      C.setValue(address + 2 * SIZE_OF_INT, cursor[2], "i32");
      C.setValue(address + 3 * SIZE_OF_INT, cursor[3], "i32");
    }
    __name(marshalTreeCursor, "marshalTreeCursor");
    function unmarshalTreeCursor(cursor) {
      cursor[0] = C.getValue(TRANSFER_BUFFER + 0 * SIZE_OF_INT, "i32");
      cursor[1] = C.getValue(TRANSFER_BUFFER + 1 * SIZE_OF_INT, "i32");
      cursor[2] = C.getValue(TRANSFER_BUFFER + 2 * SIZE_OF_INT, "i32");
      cursor[3] = C.getValue(TRANSFER_BUFFER + 3 * SIZE_OF_INT, "i32");
    }
    __name(unmarshalTreeCursor, "unmarshalTreeCursor");
    function marshalPoint(address, point) {
      C.setValue(address, point.row, "i32");
      C.setValue(address + SIZE_OF_INT, point.column, "i32");
    }
    __name(marshalPoint, "marshalPoint");
    function unmarshalPoint(address) {
      const result = {
        row: C.getValue(address, "i32") >>> 0,
        column: C.getValue(address + SIZE_OF_INT, "i32") >>> 0
      };
      return result;
    }
    __name(unmarshalPoint, "unmarshalPoint");
    function marshalRange(address, range) {
      marshalPoint(address, range.startPosition);
      address += SIZE_OF_POINT;
      marshalPoint(address, range.endPosition);
      address += SIZE_OF_POINT;
      C.setValue(address, range.startIndex, "i32");
      address += SIZE_OF_INT;
      C.setValue(address, range.endIndex, "i32");
      address += SIZE_OF_INT;
    }
    __name(marshalRange, "marshalRange");
    function unmarshalRange(address) {
      const result = {};
      result.startPosition = unmarshalPoint(address);
      address += SIZE_OF_POINT;
      result.endPosition = unmarshalPoint(address);
      address += SIZE_OF_POINT;
      result.startIndex = C.getValue(address, "i32") >>> 0;
      address += SIZE_OF_INT;
      result.endIndex = C.getValue(address, "i32") >>> 0;
      return result;
    }
    __name(unmarshalRange, "unmarshalRange");
    function marshalEdit(edit, address = TRANSFER_BUFFER) {
      marshalPoint(address, edit.startPosition);
      address += SIZE_OF_POINT;
      marshalPoint(address, edit.oldEndPosition);
      address += SIZE_OF_POINT;
      marshalPoint(address, edit.newEndPosition);
      address += SIZE_OF_POINT;
      C.setValue(address, edit.startIndex, "i32");
      address += SIZE_OF_INT;
      C.setValue(address, edit.oldEndIndex, "i32");
      address += SIZE_OF_INT;
      C.setValue(address, edit.newEndIndex, "i32");
      address += SIZE_OF_INT;
    }
    __name(marshalEdit, "marshalEdit");
    function unmarshalLanguageMetadata(address) {
      const major_version = C.getValue(address, "i32");
      const minor_version = C.getValue(address += SIZE_OF_INT, "i32");
      const patch_version = C.getValue(address += SIZE_OF_INT, "i32");
      return { major_version, minor_version, patch_version };
    }
    __name(unmarshalLanguageMetadata, "unmarshalLanguageMetadata");
    var PREDICATE_STEP_TYPE_CAPTURE = 1;
    var PREDICATE_STEP_TYPE_STRING = 2;
    var QUERY_WORD_REGEX = /[\w-]+/g;
    var CaptureQuantifier = {
      Zero: 0,
      ZeroOrOne: 1,
      ZeroOrMore: 2,
      One: 3,
      OneOrMore: 4
    };
    var isCaptureStep = /* @__PURE__ */ __name((step) => step.type === "capture", "isCaptureStep");
    var isStringStep = /* @__PURE__ */ __name((step) => step.type === "string", "isStringStep");
    var QueryErrorKind = {
      Syntax: 1,
      NodeName: 2,
      FieldName: 3,
      CaptureName: 4,
      PatternStructure: 5
    };
    var QueryError = (_e = class extends Error {
      constructor(kind, info2, index, length) {
        super(_e.formatMessage(kind, info2));
        this.kind = kind;
        this.info = info2;
        this.index = index;
        this.length = length;
        this.name = "QueryError";
      }
      /** Formats an error message based on the error kind and info */
      static formatMessage(kind, info2) {
        switch (kind) {
          case QueryErrorKind.NodeName:
            return `Bad node name '${info2.word}'`;
          case QueryErrorKind.FieldName:
            return `Bad field name '${info2.word}'`;
          case QueryErrorKind.CaptureName:
            return `Bad capture name @${info2.word}`;
          case QueryErrorKind.PatternStructure:
            return `Bad pattern structure at offset ${info2.suffix}`;
          case QueryErrorKind.Syntax:
            return `Bad syntax at offset ${info2.suffix}`;
        }
      }
    }, __name(_e, "QueryError"), _e);
    function parseAnyPredicate(steps, index, operator, textPredicates) {
      if (steps.length !== 3) {
        throw new Error(
          `Wrong number of arguments to \`#${operator}\` predicate. Expected 2, got ${steps.length - 1}`
        );
      }
      if (!isCaptureStep(steps[1])) {
        throw new Error(
          `First argument of \`#${operator}\` predicate must be a capture. Got "${steps[1].value}"`
        );
      }
      const isPositive = operator === "eq?" || operator === "any-eq?";
      const matchAll = !operator.startsWith("any-");
      if (isCaptureStep(steps[2])) {
        const captureName1 = steps[1].name;
        const captureName2 = steps[2].name;
        textPredicates[index].push((captures) => {
          const nodes1 = [];
          const nodes2 = [];
          for (const c of captures) {
            if (c.name === captureName1) nodes1.push(c.node);
            if (c.name === captureName2) nodes2.push(c.node);
          }
          const compare = /* @__PURE__ */ __name((n1, n2, positive) => {
            return positive ? n1.text === n2.text : n1.text !== n2.text;
          }, "compare");
          return matchAll ? nodes1.every((n1) => nodes2.some((n2) => compare(n1, n2, isPositive))) : nodes1.some((n1) => nodes2.some((n2) => compare(n1, n2, isPositive)));
        });
      } else {
        const captureName = steps[1].name;
        const stringValue = steps[2].value;
        const matches = /* @__PURE__ */ __name((n) => n.text === stringValue, "matches");
        const doesNotMatch = /* @__PURE__ */ __name((n) => n.text !== stringValue, "doesNotMatch");
        textPredicates[index].push((captures) => {
          const nodes = [];
          for (const c of captures) {
            if (c.name === captureName) nodes.push(c.node);
          }
          const test = isPositive ? matches : doesNotMatch;
          return matchAll ? nodes.every(test) : nodes.some(test);
        });
      }
    }
    __name(parseAnyPredicate, "parseAnyPredicate");
    function parseMatchPredicate(steps, index, operator, textPredicates) {
      if (steps.length !== 3) {
        throw new Error(
          `Wrong number of arguments to \`#${operator}\` predicate. Expected 2, got ${steps.length - 1}.`
        );
      }
      if (steps[1].type !== "capture") {
        throw new Error(
          `First argument of \`#${operator}\` predicate must be a capture. Got "${steps[1].value}".`
        );
      }
      if (steps[2].type !== "string") {
        throw new Error(
          `Second argument of \`#${operator}\` predicate must be a string. Got @${steps[2].name}.`
        );
      }
      const isPositive = operator === "match?" || operator === "any-match?";
      const matchAll = !operator.startsWith("any-");
      const captureName = steps[1].name;
      const regex = new RegExp(steps[2].value);
      textPredicates[index].push((captures) => {
        const nodes = [];
        for (const c of captures) {
          if (c.name === captureName) nodes.push(c.node.text);
        }
        const test = /* @__PURE__ */ __name((text, positive) => {
          return positive ? regex.test(text) : !regex.test(text);
        }, "test");
        if (nodes.length === 0) return !isPositive;
        return matchAll ? nodes.every((text) => test(text, isPositive)) : nodes.some((text) => test(text, isPositive));
      });
    }
    __name(parseMatchPredicate, "parseMatchPredicate");
    function parseAnyOfPredicate(steps, index, operator, textPredicates) {
      if (steps.length < 2) {
        throw new Error(
          `Wrong number of arguments to \`#${operator}\` predicate. Expected at least 1. Got ${steps.length - 1}.`
        );
      }
      if (steps[1].type !== "capture") {
        throw new Error(
          `First argument of \`#${operator}\` predicate must be a capture. Got "${steps[1].value}".`
        );
      }
      const isPositive = operator === "any-of?";
      const captureName = steps[1].name;
      const stringSteps = steps.slice(2);
      if (!stringSteps.every(isStringStep)) {
        throw new Error(
          `Arguments to \`#${operator}\` predicate must be strings.".`
        );
      }
      const values = stringSteps.map((s) => s.value);
      textPredicates[index].push((captures) => {
        const nodes = [];
        for (const c of captures) {
          if (c.name === captureName) nodes.push(c.node.text);
        }
        if (nodes.length === 0) return !isPositive;
        return nodes.every((text) => values.includes(text)) === isPositive;
      });
    }
    __name(parseAnyOfPredicate, "parseAnyOfPredicate");
    function parseIsPredicate(steps, index, operator, assertedProperties, refutedProperties) {
      var _a2;
      if (steps.length < 2 || steps.length > 3) {
        throw new Error(
          `Wrong number of arguments to \`#${operator}\` predicate. Expected 1 or 2. Got ${steps.length - 1}.`
        );
      }
      if (!steps.every(isStringStep)) {
        throw new Error(
          `Arguments to \`#${operator}\` predicate must be strings.".`
        );
      }
      const properties = operator === "is?" ? assertedProperties : refutedProperties;
      if (!properties[index]) properties[index] = {};
      properties[index][steps[1].value] = ((_a2 = steps[2]) == null ? void 0 : _a2.value) ?? null;
    }
    __name(parseIsPredicate, "parseIsPredicate");
    function parseSetDirective(steps, index, setProperties) {
      var _a2;
      if (steps.length < 2 || steps.length > 3) {
        throw new Error(`Wrong number of arguments to \`#set!\` predicate. Expected 1 or 2. Got ${steps.length - 1}.`);
      }
      if (!steps.every(isStringStep)) {
        throw new Error(`Arguments to \`#set!\` predicate must be strings.".`);
      }
      if (!setProperties[index]) setProperties[index] = {};
      setProperties[index][steps[1].value] = ((_a2 = steps[2]) == null ? void 0 : _a2.value) ?? null;
    }
    __name(parseSetDirective, "parseSetDirective");
    function parsePattern(index, stepType, stepValueId, captureNames, stringValues, steps, textPredicates, predicates, setProperties, assertedProperties, refutedProperties) {
      if (stepType === PREDICATE_STEP_TYPE_CAPTURE) {
        const name2 = captureNames[stepValueId];
        steps.push({ type: "capture", name: name2 });
      } else if (stepType === PREDICATE_STEP_TYPE_STRING) {
        steps.push({ type: "string", value: stringValues[stepValueId] });
      } else if (steps.length > 0) {
        if (steps[0].type !== "string") {
          throw new Error("Predicates must begin with a literal value");
        }
        const operator = steps[0].value;
        switch (operator) {
          case "any-not-eq?":
          case "not-eq?":
          case "any-eq?":
          case "eq?":
            parseAnyPredicate(steps, index, operator, textPredicates);
            break;
          case "any-not-match?":
          case "not-match?":
          case "any-match?":
          case "match?":
            parseMatchPredicate(steps, index, operator, textPredicates);
            break;
          case "not-any-of?":
          case "any-of?":
            parseAnyOfPredicate(steps, index, operator, textPredicates);
            break;
          case "is?":
          case "is-not?":
            parseIsPredicate(steps, index, operator, assertedProperties, refutedProperties);
            break;
          case "set!":
            parseSetDirective(steps, index, setProperties);
            break;
          default:
            predicates[index].push({ operator, operands: steps.slice(1) });
        }
        steps.length = 0;
      }
    }
    __name(parsePattern, "parsePattern");
    var Query = (_f = class {
      /**
       * Create a new query from a string containing one or more S-expression
       * patterns.
       *
       * The query is associated with a particular language, and can only be run
       * on syntax nodes parsed with that language. References to Queries can be
       * shared between multiple threads.
       *
       * @link {@see https://tree-sitter.github.io/tree-sitter/using-parsers/queries}
       */
      constructor(language, source) {
        /** @internal */
        __publicField(this, 0, 0);
        // Internal handle for WASM
        /** @internal */
        __publicField(this, "exceededMatchLimit");
        /** @internal */
        __publicField(this, "textPredicates");
        /** The names of the captures used in the query. */
        __publicField(this, "captureNames");
        /** The quantifiers of the captures used in the query. */
        __publicField(this, "captureQuantifiers");
        /**
         * The other user-defined predicates associated with the given index.
         *
         * This includes predicates with operators other than:
         * - `match?`
         * - `eq?` and `not-eq?`
         * - `any-of?` and `not-any-of?`
         * - `is?` and `is-not?`
         * - `set!`
         */
        __publicField(this, "predicates");
        /** The properties for predicates with the operator `set!`. */
        __publicField(this, "setProperties");
        /** The properties for predicates with the operator `is?`. */
        __publicField(this, "assertedProperties");
        /** The properties for predicates with the operator `is-not?`. */
        __publicField(this, "refutedProperties");
        /** The maximum number of in-progress matches for this cursor. */
        __publicField(this, "matchLimit");
        var _a2;
        const sourceLength = C.lengthBytesUTF8(source);
        const sourceAddress = C._malloc(sourceLength + 1);
        C.stringToUTF8(source, sourceAddress, sourceLength + 1);
        const address = C._ts_query_new(
          language[0],
          sourceAddress,
          sourceLength,
          TRANSFER_BUFFER,
          TRANSFER_BUFFER + SIZE_OF_INT
        );
        if (!address) {
          const errorId = C.getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32");
          const errorByte = C.getValue(TRANSFER_BUFFER, "i32");
          const errorIndex = C.UTF8ToString(sourceAddress, errorByte).length;
          const suffix = source.slice(errorIndex, errorIndex + 100).split("\n")[0];
          const word = ((_a2 = suffix.match(QUERY_WORD_REGEX)) == null ? void 0 : _a2[0]) ?? "";
          C._free(sourceAddress);
          switch (errorId) {
            case QueryErrorKind.Syntax:
              throw new QueryError(QueryErrorKind.Syntax, { suffix: `${errorIndex}: '${suffix}'...` }, errorIndex, 0);
            case QueryErrorKind.NodeName:
              throw new QueryError(errorId, { word }, errorIndex, word.length);
            case QueryErrorKind.FieldName:
              throw new QueryError(errorId, { word }, errorIndex, word.length);
            case QueryErrorKind.CaptureName:
              throw new QueryError(errorId, { word }, errorIndex, word.length);
            case QueryErrorKind.PatternStructure:
              throw new QueryError(errorId, { suffix: `${errorIndex}: '${suffix}'...` }, errorIndex, 0);
          }
        }
        const stringCount = C._ts_query_string_count(address);
        const captureCount = C._ts_query_capture_count(address);
        const patternCount = C._ts_query_pattern_count(address);
        const captureNames = new Array(captureCount);
        const captureQuantifiers = new Array(patternCount);
        const stringValues = new Array(stringCount);
        for (let i2 = 0; i2 < captureCount; i2++) {
          const nameAddress = C._ts_query_capture_name_for_id(
            address,
            i2,
            TRANSFER_BUFFER
          );
          const nameLength = C.getValue(TRANSFER_BUFFER, "i32");
          captureNames[i2] = C.UTF8ToString(nameAddress, nameLength);
        }
        for (let i2 = 0; i2 < patternCount; i2++) {
          const captureQuantifiersArray = new Array(captureCount);
          for (let j = 0; j < captureCount; j++) {
            const quantifier = C._ts_query_capture_quantifier_for_id(address, i2, j);
            captureQuantifiersArray[j] = quantifier;
          }
          captureQuantifiers[i2] = captureQuantifiersArray;
        }
        for (let i2 = 0; i2 < stringCount; i2++) {
          const valueAddress = C._ts_query_string_value_for_id(
            address,
            i2,
            TRANSFER_BUFFER
          );
          const nameLength = C.getValue(TRANSFER_BUFFER, "i32");
          stringValues[i2] = C.UTF8ToString(valueAddress, nameLength);
        }
        const setProperties = new Array(patternCount);
        const assertedProperties = new Array(patternCount);
        const refutedProperties = new Array(patternCount);
        const predicates = new Array(patternCount);
        const textPredicates = new Array(patternCount);
        for (let i2 = 0; i2 < patternCount; i2++) {
          const predicatesAddress = C._ts_query_predicates_for_pattern(address, i2, TRANSFER_BUFFER);
          const stepCount = C.getValue(TRANSFER_BUFFER, "i32");
          predicates[i2] = [];
          textPredicates[i2] = [];
          const steps = new Array();
          let stepAddress = predicatesAddress;
          for (let j = 0; j < stepCount; j++) {
            const stepType = C.getValue(stepAddress, "i32");
            stepAddress += SIZE_OF_INT;
            const stepValueId = C.getValue(stepAddress, "i32");
            stepAddress += SIZE_OF_INT;
            parsePattern(
              i2,
              stepType,
              stepValueId,
              captureNames,
              stringValues,
              steps,
              textPredicates,
              predicates,
              setProperties,
              assertedProperties,
              refutedProperties
            );
          }
          Object.freeze(textPredicates[i2]);
          Object.freeze(predicates[i2]);
          Object.freeze(setProperties[i2]);
          Object.freeze(assertedProperties[i2]);
          Object.freeze(refutedProperties[i2]);
        }
        C._free(sourceAddress);
        this[0] = address;
        this.captureNames = captureNames;
        this.captureQuantifiers = captureQuantifiers;
        this.textPredicates = textPredicates;
        this.predicates = predicates;
        this.setProperties = setProperties;
        this.assertedProperties = assertedProperties;
        this.refutedProperties = refutedProperties;
        this.exceededMatchLimit = false;
      }
      /** Delete the query, freeing its resources. */
      delete() {
        C._ts_query_delete(this[0]);
        this[0] = 0;
      }
      /**
       * Iterate over all of the matches in the order that they were found.
       *
       * Each match contains the index of the pattern that matched, and a list of
       * captures. Because multiple patterns can match the same set of nodes,
       * one match may contain captures that appear *before* some of the
       * captures from a previous match.
       *
       * @param {Node} node - The node to execute the query on.
       *
       * @param {QueryOptions} options - Options for query execution.
       */
      matches(node, options = {}) {
        const startPosition = options.startPosition ?? ZERO_POINT;
        const endPosition = options.endPosition ?? ZERO_POINT;
        const startIndex = options.startIndex ?? 0;
        const endIndex = options.endIndex ?? 0;
        const matchLimit = options.matchLimit ?? 4294967295;
        const maxStartDepth = options.maxStartDepth ?? 4294967295;
        const timeoutMicros = options.timeoutMicros ?? 0;
        const progressCallback = options.progressCallback;
        if (typeof matchLimit !== "number") {
          throw new Error("Arguments must be numbers");
        }
        this.matchLimit = matchLimit;
        if (endIndex !== 0 && startIndex > endIndex) {
          throw new Error("`startIndex` cannot be greater than `endIndex`");
        }
        if (endPosition !== ZERO_POINT && (startPosition.row > endPosition.row || startPosition.row === endPosition.row && startPosition.column > endPosition.column)) {
          throw new Error("`startPosition` cannot be greater than `endPosition`");
        }
        if (progressCallback) {
          C.currentQueryProgressCallback = progressCallback;
        }
        marshalNode(node);
        C._ts_query_matches_wasm(
          this[0],
          node.tree[0],
          startPosition.row,
          startPosition.column,
          endPosition.row,
          endPosition.column,
          startIndex,
          endIndex,
          matchLimit,
          maxStartDepth,
          timeoutMicros
        );
        const rawCount = C.getValue(TRANSFER_BUFFER, "i32");
        const startAddress = C.getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32");
        const didExceedMatchLimit = C.getValue(TRANSFER_BUFFER + 2 * SIZE_OF_INT, "i32");
        const result = new Array(rawCount);
        this.exceededMatchLimit = Boolean(didExceedMatchLimit);
        let filteredCount = 0;
        let address = startAddress;
        for (let i2 = 0; i2 < rawCount; i2++) {
          const patternIndex = C.getValue(address, "i32");
          address += SIZE_OF_INT;
          const captureCount = C.getValue(address, "i32");
          address += SIZE_OF_INT;
          const captures = new Array(captureCount);
          address = unmarshalCaptures(this, node.tree, address, patternIndex, captures);
          if (this.textPredicates[patternIndex].every((p) => p(captures))) {
            result[filteredCount] = { pattern: patternIndex, patternIndex, captures };
            const setProperties = this.setProperties[patternIndex];
            result[filteredCount].setProperties = setProperties;
            const assertedProperties = this.assertedProperties[patternIndex];
            result[filteredCount].assertedProperties = assertedProperties;
            const refutedProperties = this.refutedProperties[patternIndex];
            result[filteredCount].refutedProperties = refutedProperties;
            filteredCount++;
          }
        }
        result.length = filteredCount;
        C._free(startAddress);
        C.currentQueryProgressCallback = null;
        return result;
      }
      /**
       * Iterate over all of the individual captures in the order that they
       * appear.
       *
       * This is useful if you don't care about which pattern matched, and just
       * want a single, ordered sequence of captures.
       *
       * @param {Node} node - The node to execute the query on.
       *
       * @param {QueryOptions} options - Options for query execution.
       */
      captures(node, options = {}) {
        const startPosition = options.startPosition ?? ZERO_POINT;
        const endPosition = options.endPosition ?? ZERO_POINT;
        const startIndex = options.startIndex ?? 0;
        const endIndex = options.endIndex ?? 0;
        const matchLimit = options.matchLimit ?? 4294967295;
        const maxStartDepth = options.maxStartDepth ?? 4294967295;
        const timeoutMicros = options.timeoutMicros ?? 0;
        const progressCallback = options.progressCallback;
        if (typeof matchLimit !== "number") {
          throw new Error("Arguments must be numbers");
        }
        this.matchLimit = matchLimit;
        if (endIndex !== 0 && startIndex > endIndex) {
          throw new Error("`startIndex` cannot be greater than `endIndex`");
        }
        if (endPosition !== ZERO_POINT && (startPosition.row > endPosition.row || startPosition.row === endPosition.row && startPosition.column > endPosition.column)) {
          throw new Error("`startPosition` cannot be greater than `endPosition`");
        }
        if (progressCallback) {
          C.currentQueryProgressCallback = progressCallback;
        }
        marshalNode(node);
        C._ts_query_captures_wasm(
          this[0],
          node.tree[0],
          startPosition.row,
          startPosition.column,
          endPosition.row,
          endPosition.column,
          startIndex,
          endIndex,
          matchLimit,
          maxStartDepth,
          timeoutMicros
        );
        const count = C.getValue(TRANSFER_BUFFER, "i32");
        const startAddress = C.getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32");
        const didExceedMatchLimit = C.getValue(TRANSFER_BUFFER + 2 * SIZE_OF_INT, "i32");
        const result = new Array();
        this.exceededMatchLimit = Boolean(didExceedMatchLimit);
        const captures = new Array();
        let address = startAddress;
        for (let i2 = 0; i2 < count; i2++) {
          const patternIndex = C.getValue(address, "i32");
          address += SIZE_OF_INT;
          const captureCount = C.getValue(address, "i32");
          address += SIZE_OF_INT;
          const captureIndex = C.getValue(address, "i32");
          address += SIZE_OF_INT;
          captures.length = captureCount;
          address = unmarshalCaptures(this, node.tree, address, patternIndex, captures);
          if (this.textPredicates[patternIndex].every((p) => p(captures))) {
            const capture = captures[captureIndex];
            const setProperties = this.setProperties[patternIndex];
            capture.setProperties = setProperties;
            const assertedProperties = this.assertedProperties[patternIndex];
            capture.assertedProperties = assertedProperties;
            const refutedProperties = this.refutedProperties[patternIndex];
            capture.refutedProperties = refutedProperties;
            result.push(capture);
          }
        }
        C._free(startAddress);
        C.currentQueryProgressCallback = null;
        return result;
      }
      /** Get the predicates for a given pattern. */
      predicatesForPattern(patternIndex) {
        return this.predicates[patternIndex];
      }
      /**
       * Disable a certain capture within a query.
       *
       * This prevents the capture from being returned in matches, and also
       * avoids any resource usage associated with recording the capture.
       */
      disableCapture(captureName) {
        const captureNameLength = C.lengthBytesUTF8(captureName);
        const captureNameAddress = C._malloc(captureNameLength + 1);
        C.stringToUTF8(captureName, captureNameAddress, captureNameLength + 1);
        C._ts_query_disable_capture(this[0], captureNameAddress, captureNameLength);
        C._free(captureNameAddress);
      }
      /**
       * Disable a certain pattern within a query.
       *
       * This prevents the pattern from matching, and also avoids any resource
       * usage associated with the pattern. This throws an error if the pattern
       * index is out of bounds.
       */
      disablePattern(patternIndex) {
        if (patternIndex >= this.predicates.length) {
          throw new Error(
            `Pattern index is ${patternIndex} but the pattern count is ${this.predicates.length}`
          );
        }
        C._ts_query_disable_pattern(this[0], patternIndex);
      }
      /**
       * Check if, on its last execution, this cursor exceeded its maximum number
       * of in-progress matches.
       */
      didExceedMatchLimit() {
        return this.exceededMatchLimit;
      }
      /** Get the byte offset where the given pattern starts in the query's source. */
      startIndexForPattern(patternIndex) {
        if (patternIndex >= this.predicates.length) {
          throw new Error(
            `Pattern index is ${patternIndex} but the pattern count is ${this.predicates.length}`
          );
        }
        return C._ts_query_start_byte_for_pattern(this[0], patternIndex);
      }
      /** Get the byte offset where the given pattern ends in the query's source. */
      endIndexForPattern(patternIndex) {
        if (patternIndex >= this.predicates.length) {
          throw new Error(
            `Pattern index is ${patternIndex} but the pattern count is ${this.predicates.length}`
          );
        }
        return C._ts_query_end_byte_for_pattern(this[0], patternIndex);
      }
      /** Get the number of patterns in the query. */
      patternCount() {
        return C._ts_query_pattern_count(this[0]);
      }
      /** Get the index for a given capture name. */
      captureIndexForName(captureName) {
        return this.captureNames.indexOf(captureName);
      }
      /** Check if a given pattern within a query has a single root node. */
      isPatternRooted(patternIndex) {
        return C._ts_query_is_pattern_rooted(this[0], patternIndex) === 1;
      }
      /** Check if a given pattern within a query has a single root node. */
      isPatternNonLocal(patternIndex) {
        return C._ts_query_is_pattern_non_local(this[0], patternIndex) === 1;
      }
      /**
       * Check if a given step in a query is 'definite'.
       *
       * A query step is 'definite' if its parent pattern will be guaranteed to
       * match successfully once it reaches the step.
       */
      isPatternGuaranteedAtStep(byteIndex) {
        return C._ts_query_is_pattern_guaranteed_at_step(this[0], byteIndex) === 1;
      }
    }, __name(_f, "Query"), _f);
    var LANGUAGE_FUNCTION_REGEX = /^tree_sitter_\w+$/;
    var Language = (_g = class {
      /** @internal */
      constructor(internal, address) {
        /** @internal */
        __publicField(this, 0, 0);
        // Internal handle for WASM
        /**
         * A list of all node types in the language. The index of each type in this
         * array is its node type id.
         */
        __publicField(this, "types");
        /**
         * A list of all field names in the language. The index of each field name in
         * this array is its field id.
         */
        __publicField(this, "fields");
        assertInternal(internal);
        this[0] = address;
        this.types = new Array(C._ts_language_symbol_count(this[0]));
        for (let i2 = 0, n = this.types.length; i2 < n; i2++) {
          if (C._ts_language_symbol_type(this[0], i2) < 2) {
            this.types[i2] = C.UTF8ToString(C._ts_language_symbol_name(this[0], i2));
          }
        }
        this.fields = new Array(C._ts_language_field_count(this[0]) + 1);
        for (let i2 = 0, n = this.fields.length; i2 < n; i2++) {
          const fieldName = C._ts_language_field_name_for_id(this[0], i2);
          if (fieldName !== 0) {
            this.fields[i2] = C.UTF8ToString(fieldName);
          } else {
            this.fields[i2] = null;
          }
        }
      }
      /**
       * Gets the name of the language.
       */
      get name() {
        const ptr = C._ts_language_name(this[0]);
        if (ptr === 0) return null;
        return C.UTF8ToString(ptr);
      }
      /**
       * @deprecated since version 0.25.0, use {@link Language#abiVersion} instead
       * Gets the version of the language.
       */
      get version() {
        return C._ts_language_version(this[0]);
      }
      /**
       * Gets the ABI version of the language.
       */
      get abiVersion() {
        return C._ts_language_abi_version(this[0]);
      }
      /**
      * Get the metadata for this language. This information is generated by the
      * CLI, and relies on the language author providing the correct metadata in
      * the language's `tree-sitter.json` file.
      */
      get metadata() {
        C._ts_language_metadata(this[0]);
        const length = C.getValue(TRANSFER_BUFFER, "i32");
        const address = C.getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32");
        if (length === 0) return null;
        return unmarshalLanguageMetadata(address);
      }
      /**
       * Gets the number of fields in the language.
       */
      get fieldCount() {
        return this.fields.length - 1;
      }
      /**
       * Gets the number of states in the language.
       */
      get stateCount() {
        return C._ts_language_state_count(this[0]);
      }
      /**
       * Get the field id for a field name.
       */
      fieldIdForName(fieldName) {
        const result = this.fields.indexOf(fieldName);
        return result !== -1 ? result : null;
      }
      /**
       * Get the field name for a field id.
       */
      fieldNameForId(fieldId) {
        return this.fields[fieldId] ?? null;
      }
      /**
       * Get the node type id for a node type name.
       */
      idForNodeType(type, named) {
        const typeLength = C.lengthBytesUTF8(type);
        const typeAddress = C._malloc(typeLength + 1);
        C.stringToUTF8(type, typeAddress, typeLength + 1);
        const result = C._ts_language_symbol_for_name(this[0], typeAddress, typeLength, named ? 1 : 0);
        C._free(typeAddress);
        return result || null;
      }
      /**
       * Gets the number of node types in the language.
       */
      get nodeTypeCount() {
        return C._ts_language_symbol_count(this[0]);
      }
      /**
       * Get the node type name for a node type id.
       */
      nodeTypeForId(typeId) {
        const name2 = C._ts_language_symbol_name(this[0], typeId);
        return name2 ? C.UTF8ToString(name2) : null;
      }
      /**
       * Check if a node type is named.
       *
       * @see {@link https://tree-sitter.github.io/tree-sitter/using-parsers/2-basic-parsing.html#named-vs-anonymous-nodes}
       */
      nodeTypeIsNamed(typeId) {
        return C._ts_language_type_is_named_wasm(this[0], typeId) ? true : false;
      }
      /**
       * Check if a node type is visible.
       */
      nodeTypeIsVisible(typeId) {
        return C._ts_language_type_is_visible_wasm(this[0], typeId) ? true : false;
      }
      /**
       * Get the supertypes ids of this language.
       *
       * @see {@link https://tree-sitter.github.io/tree-sitter/using-parsers/6-static-node-types.html?highlight=supertype#supertype-nodes}
       */
      get supertypes() {
        C._ts_language_supertypes_wasm(this[0]);
        const count = C.getValue(TRANSFER_BUFFER, "i32");
        const buffer = C.getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32");
        const result = new Array(count);
        if (count > 0) {
          let address = buffer;
          for (let i2 = 0; i2 < count; i2++) {
            result[i2] = C.getValue(address, "i16");
            address += SIZE_OF_SHORT;
          }
        }
        return result;
      }
      /**
       * Get the subtype ids for a given supertype node id.
       */
      subtypes(supertype) {
        C._ts_language_subtypes_wasm(this[0], supertype);
        const count = C.getValue(TRANSFER_BUFFER, "i32");
        const buffer = C.getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32");
        const result = new Array(count);
        if (count > 0) {
          let address = buffer;
          for (let i2 = 0; i2 < count; i2++) {
            result[i2] = C.getValue(address, "i16");
            address += SIZE_OF_SHORT;
          }
        }
        return result;
      }
      /**
       * Get the next state id for a given state id and node type id.
       */
      nextState(stateId, typeId) {
        return C._ts_language_next_state(this[0], stateId, typeId);
      }
      /**
       * Create a new lookahead iterator for this language and parse state.
       *
       * This returns `null` if state is invalid for this language.
       *
       * Iterating {@link LookaheadIterator} will yield valid symbols in the given
       * parse state. Newly created lookahead iterators will return the `ERROR`
       * symbol from {@link LookaheadIterator#currentType}.
       *
       * Lookahead iterators can be useful for generating suggestions and improving
       * syntax error diagnostics. To get symbols valid in an `ERROR` node, use the
       * lookahead iterator on its first leaf node state. For `MISSING` nodes, a
       * lookahead iterator created on the previous non-extra leaf node may be
       * appropriate.
       */
      lookaheadIterator(stateId) {
        const address = C._ts_lookahead_iterator_new(this[0], stateId);
        if (address) return new LookaheadIterator(INTERNAL, address, this);
        return null;
      }
      /**
       * @deprecated since version 0.25.0, call `new` on a {@link Query} instead
       *
       * Create a new query from a string containing one or more S-expression
       * patterns.
       *
       * The query is associated with a particular language, and can only be run
       * on syntax nodes parsed with that language. References to Queries can be
       * shared between multiple threads.
       *
       * @link {@see https://tree-sitter.github.io/tree-sitter/using-parsers/queries}
       */
      query(source) {
        console.warn("Language.query is deprecated. Use new Query(language, source) instead.");
        return new Query(this, source);
      }
      /**
       * Load a language from a WebAssembly module.
       * The module can be provided as a path to a file or as a buffer.
       */
      static async load(input) {
        var _a2;
        let bytes;
        if (input instanceof Uint8Array) {
          bytes = Promise.resolve(input);
        } else {
          if ((_a2 = globalThis.process) == null ? void 0 : _a2.versions.node) {
            const fs2 = await import("fs/promises");
            bytes = fs2.readFile(input);
          } else {
            bytes = fetch(input).then((response) => response.arrayBuffer().then((buffer) => {
              if (response.ok) {
                return new Uint8Array(buffer);
              } else {
                const body2 = new TextDecoder("utf-8").decode(buffer);
                throw new Error(`Language.load failed with status ${response.status}.

${body2}`);
              }
            }));
          }
        }
        const mod = await C.loadWebAssemblyModule(await bytes, { loadAsync: true });
        const symbolNames = Object.keys(mod);
        const functionName = symbolNames.find((key) => LANGUAGE_FUNCTION_REGEX.test(key) && !key.includes("external_scanner_"));
        if (!functionName) {
          console.log(`Couldn't find language function in WASM file. Symbols:
${JSON.stringify(symbolNames, null, 2)}`);
          throw new Error("Language.load failed: no language function found in WASM file");
        }
        const languageAddress = mod[functionName]();
        return new _g(INTERNAL, languageAddress);
      }
    }, __name(_g, "Language"), _g);
    var Module2 = (() => {
      var _scriptName = getCurrentScriptUrl();
      return async function(moduleArg = {}) {
        var moduleRtn;
        var Module = moduleArg;
        var readyPromiseResolve, readyPromiseReject;
        var readyPromise = new Promise((resolve, reject) => {
          readyPromiseResolve = resolve;
          readyPromiseReject = reject;
        });
        var ENVIRONMENT_IS_WEB = typeof window == "object";
        var ENVIRONMENT_IS_WORKER = typeof importScripts == "function";
        var ENVIRONMENT_IS_NODE = typeof process == "object" && typeof process.versions == "object" && typeof process.versions.node == "string";
        if (ENVIRONMENT_IS_NODE) {
          const { createRequire } = await import("module");
          var require$1 = createRequire(getCurrentScriptUrl());
        }
        Module.currentQueryProgressCallback = null;
        Module.currentProgressCallback = null;
        Module.currentLogCallback = null;
        Module.currentParseCallback = null;
        var moduleOverrides = Object.assign({}, Module);
        var arguments_ = [];
        var thisProgram = "./this.program";
        var quit_ = /* @__PURE__ */ __name((status, toThrow) => {
          throw toThrow;
        }, "quit_");
        var scriptDirectory = "";
        function locateFile(path2) {
          if (Module["locateFile"]) {
            return Module["locateFile"](path2, scriptDirectory);
          }
          return scriptDirectory + path2;
        }
        __name(locateFile, "locateFile");
        var readAsync, readBinary;
        if (ENVIRONMENT_IS_NODE) {
          var fs = require$1("fs");
          var nodePath = require$1("path");
          scriptDirectory = require$1("url").fileURLToPath(new URL("./", getCurrentScriptUrl()));
          readBinary = /* @__PURE__ */ __name((filename) => {
            filename = isFileURI(filename) ? new URL(filename) : nodePath.normalize(filename);
            var ret = fs.readFileSync(filename);
            return ret;
          }, "readBinary");
          readAsync = /* @__PURE__ */ __name((filename, binary2 = true) => {
            filename = isFileURI(filename) ? new URL(filename) : nodePath.normalize(filename);
            return new Promise((resolve, reject) => {
              fs.readFile(filename, binary2 ? void 0 : "utf8", (err2, data) => {
                if (err2) reject(err2);
                else resolve(binary2 ? data.buffer : data);
              });
            });
          }, "readAsync");
          if (!Module["thisProgram"] && process.argv.length > 1) {
            thisProgram = process.argv[1].replace(/\\/g, "/");
          }
          arguments_ = process.argv.slice(2);
          quit_ = /* @__PURE__ */ __name((status, toThrow) => {
            process.exitCode = status;
            throw toThrow;
          }, "quit_");
        } else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
          if (ENVIRONMENT_IS_WORKER) {
            scriptDirectory = self.location.href;
          } else if (typeof document != "undefined" && document.currentScript) {
            scriptDirectory = document.currentScript.src;
          }
          if (_scriptName) {
            scriptDirectory = _scriptName;
          }
          if (scriptDirectory.startsWith("blob:")) {
            scriptDirectory = "";
          } else {
            scriptDirectory = scriptDirectory.substr(0, scriptDirectory.replace(/[?#].*/, "").lastIndexOf("/") + 1);
          }
          {
            if (ENVIRONMENT_IS_WORKER) {
              readBinary = /* @__PURE__ */ __name((url) => {
                var xhr = new XMLHttpRequest();
                xhr.open("GET", url, false);
                xhr.responseType = "arraybuffer";
                xhr.send(null);
                return new Uint8Array(
                  /** @type{!ArrayBuffer} */
                  xhr.response
                );
              }, "readBinary");
            }
            readAsync = /* @__PURE__ */ __name((url) => {
              if (isFileURI(url)) {
                return new Promise((reject, resolve) => {
                  var xhr = new XMLHttpRequest();
                  xhr.open("GET", url, true);
                  xhr.responseType = "arraybuffer";
                  xhr.onload = () => {
                    if (xhr.status == 200 || xhr.status == 0 && xhr.response) {
                      resolve(xhr.response);
                    }
                    reject(xhr.status);
                  };
                  xhr.onerror = reject;
                  xhr.send(null);
                });
              }
              return fetch(url, {
                credentials: "same-origin"
              }).then((response) => {
                if (response.ok) {
                  return response.arrayBuffer();
                }
                return Promise.reject(new Error(response.status + " : " + response.url));
              });
            }, "readAsync");
          }
        } else ;
        var out = Module["print"] || console.log.bind(console);
        var err = Module["printErr"] || console.error.bind(console);
        Object.assign(Module, moduleOverrides);
        moduleOverrides = null;
        if (Module["arguments"]) arguments_ = Module["arguments"];
        if (Module["thisProgram"]) thisProgram = Module["thisProgram"];
        if (Module["quit"]) quit_ = Module["quit"];
        var dynamicLibraries = Module["dynamicLibraries"] || [];
        var wasmBinary;
        if (Module["wasmBinary"]) wasmBinary = Module["wasmBinary"];
        var wasmMemory;
        var ABORT = false;
        var EXITSTATUS;
        function assert(condition, text) {
          if (!condition) {
            abort(text);
          }
        }
        __name(assert, "assert");
        var HEAP8, HEAPU8;
        var HEAP_DATA_VIEW;
        function updateMemoryViews() {
          var b = wasmMemory.buffer;
          Module["HEAP_DATA_VIEW"] = HEAP_DATA_VIEW = new DataView(b);
          Module["HEAP8"] = HEAP8 = new Int8Array(b);
          Module["HEAP16"] = new Int16Array(b);
          Module["HEAPU8"] = HEAPU8 = new Uint8Array(b);
          Module["HEAPU16"] = new Uint16Array(b);
          Module["HEAP32"] = new Int32Array(b);
          Module["HEAPU32"] = new Uint32Array(b);
          Module["HEAPF32"] = new Float32Array(b);
          Module["HEAPF64"] = new Float64Array(b);
        }
        __name(updateMemoryViews, "updateMemoryViews");
        if (Module["wasmMemory"]) {
          wasmMemory = Module["wasmMemory"];
        } else {
          var INITIAL_MEMORY = Module["INITIAL_MEMORY"] || 33554432;
          wasmMemory = new WebAssembly.Memory({
            "initial": INITIAL_MEMORY / 65536,
            // In theory we should not need to emit the maximum if we want "unlimited"
            // or 4GB of memory, but VMs error on that atm, see
            // https://github.com/emscripten-core/emscripten/issues/14130
            // And in the pthreads case we definitely need to emit a maximum. So
            // always emit one.
            "maximum": 2147483648 / 65536
          });
        }
        updateMemoryViews();
        var __ATPRERUN__ = [];
        var __ATINIT__ = [];
        var __ATMAIN__ = [];
        var __ATPOSTRUN__ = [];
        var __RELOC_FUNCS__ = [];
        var runtimeInitialized = false;
        function preRun() {
          if (Module["preRun"]) {
            if (typeof Module["preRun"] == "function") Module["preRun"] = [Module["preRun"]];
            while (Module["preRun"].length) {
              addOnPreRun(Module["preRun"].shift());
            }
          }
          callRuntimeCallbacks(__ATPRERUN__);
        }
        __name(preRun, "preRun");
        function initRuntime() {
          runtimeInitialized = true;
          callRuntimeCallbacks(__RELOC_FUNCS__);
          callRuntimeCallbacks(__ATINIT__);
        }
        __name(initRuntime, "initRuntime");
        function preMain() {
          callRuntimeCallbacks(__ATMAIN__);
        }
        __name(preMain, "preMain");
        function postRun() {
          if (Module["postRun"]) {
            if (typeof Module["postRun"] == "function") Module["postRun"] = [Module["postRun"]];
            while (Module["postRun"].length) {
              addOnPostRun(Module["postRun"].shift());
            }
          }
          callRuntimeCallbacks(__ATPOSTRUN__);
        }
        __name(postRun, "postRun");
        function addOnPreRun(cb) {
          __ATPRERUN__.unshift(cb);
        }
        __name(addOnPreRun, "addOnPreRun");
        function addOnInit(cb) {
          __ATINIT__.unshift(cb);
        }
        __name(addOnInit, "addOnInit");
        function addOnPreMain(cb) {
          __ATMAIN__.unshift(cb);
        }
        __name(addOnPreMain, "addOnPreMain");
        function addOnExit(cb) {
        }
        __name(addOnExit, "addOnExit");
        function addOnPostRun(cb) {
          __ATPOSTRUN__.unshift(cb);
        }
        __name(addOnPostRun, "addOnPostRun");
        var runDependencies = 0;
        var dependenciesFulfilled = null;
        function getUniqueRunDependency(id) {
          return id;
        }
        __name(getUniqueRunDependency, "getUniqueRunDependency");
        function addRunDependency(id) {
          var _a2;
          runDependencies++;
          (_a2 = Module["monitorRunDependencies"]) == null ? void 0 : _a2.call(Module, runDependencies);
        }
        __name(addRunDependency, "addRunDependency");
        function removeRunDependency(id) {
          var _a2;
          runDependencies--;
          (_a2 = Module["monitorRunDependencies"]) == null ? void 0 : _a2.call(Module, runDependencies);
          if (runDependencies == 0) {
            if (dependenciesFulfilled) {
              var callback = dependenciesFulfilled;
              dependenciesFulfilled = null;
              callback();
            }
          }
        }
        __name(removeRunDependency, "removeRunDependency");
        function abort(what) {
          var _a2;
          (_a2 = Module["onAbort"]) == null ? void 0 : _a2.call(Module, what);
          what = "Aborted(" + what + ")";
          err(what);
          ABORT = true;
          EXITSTATUS = 1;
          what += ". Build with -sASSERTIONS for more info.";
          var e = new WebAssembly.RuntimeError(what);
          readyPromiseReject(e);
          throw e;
        }
        __name(abort, "abort");
        var dataURIPrefix = "data:application/octet-stream;base64,";
        var isDataURI = /* @__PURE__ */ __name((filename) => filename.startsWith(dataURIPrefix), "isDataURI");
        var isFileURI = /* @__PURE__ */ __name((filename) => filename.startsWith("file://"), "isFileURI");
        function findWasmBinary() {
          if (Module["locateFile"]) {
            var f = "tree-sitter.wasm";
            if (!isDataURI(f)) {
              return locateFile(f);
            }
            return f;
          }
          return new URL("tree-sitter.wasm", getCurrentScriptUrl()).href;
        }
        __name(findWasmBinary, "findWasmBinary");
        var wasmBinaryFile;
        function getBinarySync(file) {
          if (file == wasmBinaryFile && wasmBinary) {
            return new Uint8Array(wasmBinary);
          }
          if (readBinary) {
            return readBinary(file);
          }
          throw "both async and sync fetching of the wasm failed";
        }
        __name(getBinarySync, "getBinarySync");
        function getBinaryPromise(binaryFile) {
          if (!wasmBinary) {
            return readAsync(binaryFile).then(
              (response) => new Uint8Array(
                /** @type{!ArrayBuffer} */
                response
              ),
              // Fall back to getBinarySync if readAsync fails
              () => getBinarySync(binaryFile)
            );
          }
          return Promise.resolve().then(() => getBinarySync(binaryFile));
        }
        __name(getBinaryPromise, "getBinaryPromise");
        function instantiateArrayBuffer(binaryFile, imports, receiver) {
          return getBinaryPromise(binaryFile).then((binary2) => WebAssembly.instantiate(binary2, imports)).then(receiver, (reason) => {
            err(`failed to asynchronously prepare wasm: ${reason}`);
            abort(reason);
          });
        }
        __name(instantiateArrayBuffer, "instantiateArrayBuffer");
        function instantiateAsync(binary2, binaryFile, imports, callback) {
          if (!binary2 && typeof WebAssembly.instantiateStreaming == "function" && !isDataURI(binaryFile) && // Don't use streaming for file:// delivered objects in a webview, fetch them synchronously.
          !isFileURI(binaryFile) && // Avoid instantiateStreaming() on Node.js environment for now, as while
          // Node.js v18.1.0 implements it, it does not have a full fetch()
          // implementation yet.
          // Reference:
          //   https://github.com/emscripten-core/emscripten/pull/16917
          !ENVIRONMENT_IS_NODE && typeof fetch == "function") {
            return fetch(binaryFile, {
              credentials: "same-origin"
            }).then((response) => {
              var result = WebAssembly.instantiateStreaming(response, imports);
              return result.then(callback, function(reason) {
                err(`wasm streaming compile failed: ${reason}`);
                err("falling back to ArrayBuffer instantiation");
                return instantiateArrayBuffer(binaryFile, imports, callback);
              });
            });
          }
          return instantiateArrayBuffer(binaryFile, imports, callback);
        }
        __name(instantiateAsync, "instantiateAsync");
        function getWasmImports() {
          return {
            "env": wasmImports,
            "wasi_snapshot_preview1": wasmImports,
            "GOT.mem": new Proxy(wasmImports, GOTHandler),
            "GOT.func": new Proxy(wasmImports, GOTHandler)
          };
        }
        __name(getWasmImports, "getWasmImports");
        function createWasm() {
          var info2 = getWasmImports();
          function receiveInstance(instance2, module2) {
            wasmExports = instance2.exports;
            wasmExports = relocateExports(wasmExports, 1024);
            var metadata2 = getDylinkMetadata(module2);
            if (metadata2.neededDynlibs) {
              dynamicLibraries = metadata2.neededDynlibs.concat(dynamicLibraries);
            }
            mergeLibSymbols(wasmExports, "main");
            LDSO.init();
            loadDylibs();
            addOnInit(wasmExports["__wasm_call_ctors"]);
            __RELOC_FUNCS__.push(wasmExports["__wasm_apply_data_relocs"]);
            removeRunDependency();
            return wasmExports;
          }
          __name(receiveInstance, "receiveInstance");
          addRunDependency();
          function receiveInstantiationResult(result) {
            receiveInstance(result["instance"], result["module"]);
          }
          __name(receiveInstantiationResult, "receiveInstantiationResult");
          if (Module["instantiateWasm"]) {
            try {
              return Module["instantiateWasm"](info2, receiveInstance);
            } catch (e) {
              err(`Module.instantiateWasm callback failed with error: ${e}`);
              readyPromiseReject(e);
            }
          }
          if (!wasmBinaryFile) wasmBinaryFile = findWasmBinary();
          instantiateAsync(wasmBinary, wasmBinaryFile, info2, receiveInstantiationResult).catch(readyPromiseReject);
          return {};
        }
        __name(createWasm, "createWasm");
        function ExitStatus(status) {
          this.name = "ExitStatus";
          this.message = `Program terminated with exit(${status})`;
          this.status = status;
        }
        __name(ExitStatus, "ExitStatus");
        var GOT = {};
        var currentModuleWeakSymbols = /* @__PURE__ */ new Set([]);
        var GOTHandler = {
          get(obj, symName) {
            var rtn = GOT[symName];
            if (!rtn) {
              rtn = GOT[symName] = new WebAssembly.Global({
                "value": "i32",
                "mutable": true
              });
            }
            if (!currentModuleWeakSymbols.has(symName)) {
              rtn.required = true;
            }
            return rtn;
          }
        };
        var LE_HEAP_LOAD_F32 = /* @__PURE__ */ __name((byteOffset) => HEAP_DATA_VIEW.getFloat32(byteOffset, true), "LE_HEAP_LOAD_F32");
        var LE_HEAP_LOAD_F64 = /* @__PURE__ */ __name((byteOffset) => HEAP_DATA_VIEW.getFloat64(byteOffset, true), "LE_HEAP_LOAD_F64");
        var LE_HEAP_LOAD_I16 = /* @__PURE__ */ __name((byteOffset) => HEAP_DATA_VIEW.getInt16(byteOffset, true), "LE_HEAP_LOAD_I16");
        var LE_HEAP_LOAD_I32 = /* @__PURE__ */ __name((byteOffset) => HEAP_DATA_VIEW.getInt32(byteOffset, true), "LE_HEAP_LOAD_I32");
        var LE_HEAP_LOAD_U32 = /* @__PURE__ */ __name((byteOffset) => HEAP_DATA_VIEW.getUint32(byteOffset, true), "LE_HEAP_LOAD_U32");
        var LE_HEAP_STORE_F32 = /* @__PURE__ */ __name((byteOffset, value) => HEAP_DATA_VIEW.setFloat32(byteOffset, value, true), "LE_HEAP_STORE_F32");
        var LE_HEAP_STORE_F64 = /* @__PURE__ */ __name((byteOffset, value) => HEAP_DATA_VIEW.setFloat64(byteOffset, value, true), "LE_HEAP_STORE_F64");
        var LE_HEAP_STORE_I16 = /* @__PURE__ */ __name((byteOffset, value) => HEAP_DATA_VIEW.setInt16(byteOffset, value, true), "LE_HEAP_STORE_I16");
        var LE_HEAP_STORE_I32 = /* @__PURE__ */ __name((byteOffset, value) => HEAP_DATA_VIEW.setInt32(byteOffset, value, true), "LE_HEAP_STORE_I32");
        var LE_HEAP_STORE_U32 = /* @__PURE__ */ __name((byteOffset, value) => HEAP_DATA_VIEW.setUint32(byteOffset, value, true), "LE_HEAP_STORE_U32");
        var callRuntimeCallbacks = /* @__PURE__ */ __name((callbacks) => {
          while (callbacks.length > 0) {
            callbacks.shift()(Module);
          }
        }, "callRuntimeCallbacks");
        var UTF8Decoder = typeof TextDecoder != "undefined" ? new TextDecoder() : void 0;
        var UTF8ArrayToString = /* @__PURE__ */ __name((heapOrArray, idx, maxBytesToRead) => {
          var endIdx = idx + maxBytesToRead;
          var endPtr = idx;
          while (heapOrArray[endPtr] && !(endPtr >= endIdx)) ++endPtr;
          if (endPtr - idx > 16 && heapOrArray.buffer && UTF8Decoder) {
            return UTF8Decoder.decode(heapOrArray.subarray(idx, endPtr));
          }
          var str = "";
          while (idx < endPtr) {
            var u0 = heapOrArray[idx++];
            if (!(u0 & 128)) {
              str += String.fromCharCode(u0);
              continue;
            }
            var u1 = heapOrArray[idx++] & 63;
            if ((u0 & 224) == 192) {
              str += String.fromCharCode((u0 & 31) << 6 | u1);
              continue;
            }
            var u2 = heapOrArray[idx++] & 63;
            if ((u0 & 240) == 224) {
              u0 = (u0 & 15) << 12 | u1 << 6 | u2;
            } else {
              u0 = (u0 & 7) << 18 | u1 << 12 | u2 << 6 | heapOrArray[idx++] & 63;
            }
            if (u0 < 65536) {
              str += String.fromCharCode(u0);
            } else {
              var ch = u0 - 65536;
              str += String.fromCharCode(55296 | ch >> 10, 56320 | ch & 1023);
            }
          }
          return str;
        }, "UTF8ArrayToString");
        var getDylinkMetadata = /* @__PURE__ */ __name((binary2) => {
          var offset = 0;
          var end = 0;
          function getU8() {
            return binary2[offset++];
          }
          __name(getU8, "getU8");
          function getLEB() {
            var ret = 0;
            var mul = 1;
            while (1) {
              var byte = binary2[offset++];
              ret += (byte & 127) * mul;
              mul *= 128;
              if (!(byte & 128)) break;
            }
            return ret;
          }
          __name(getLEB, "getLEB");
          function getString() {
            var len = getLEB();
            offset += len;
            return UTF8ArrayToString(binary2, offset - len, len);
          }
          __name(getString, "getString");
          function failIf(condition, message) {
            if (condition) throw new Error(message);
          }
          __name(failIf, "failIf");
          var name2 = "dylink.0";
          if (binary2 instanceof WebAssembly.Module) {
            var dylinkSection = WebAssembly.Module.customSections(binary2, name2);
            if (dylinkSection.length === 0) {
              name2 = "dylink";
              dylinkSection = WebAssembly.Module.customSections(binary2, name2);
            }
            failIf(dylinkSection.length === 0, "need dylink section");
            binary2 = new Uint8Array(dylinkSection[0]);
            end = binary2.length;
          } else {
            var int32View = new Uint32Array(new Uint8Array(binary2.subarray(0, 24)).buffer);
            var magicNumberFound = int32View[0] == 1836278016 || int32View[0] == 6386541;
            failIf(!magicNumberFound, "need to see wasm magic number");
            failIf(binary2[8] !== 0, "need the dylink section to be first");
            offset = 9;
            var section_size = getLEB();
            end = offset + section_size;
            name2 = getString();
          }
          var customSection = {
            neededDynlibs: [],
            tlsExports: /* @__PURE__ */ new Set(),
            weakImports: /* @__PURE__ */ new Set()
          };
          if (name2 == "dylink") {
            customSection.memorySize = getLEB();
            customSection.memoryAlign = getLEB();
            customSection.tableSize = getLEB();
            customSection.tableAlign = getLEB();
            var neededDynlibsCount = getLEB();
            for (var i2 = 0; i2 < neededDynlibsCount; ++i2) {
              var libname = getString();
              customSection.neededDynlibs.push(libname);
            }
          } else {
            failIf(name2 !== "dylink.0");
            var WASM_DYLINK_MEM_INFO = 1;
            var WASM_DYLINK_NEEDED = 2;
            var WASM_DYLINK_EXPORT_INFO = 3;
            var WASM_DYLINK_IMPORT_INFO = 4;
            var WASM_SYMBOL_TLS = 256;
            var WASM_SYMBOL_BINDING_MASK = 3;
            var WASM_SYMBOL_BINDING_WEAK = 1;
            while (offset < end) {
              var subsectionType = getU8();
              var subsectionSize = getLEB();
              if (subsectionType === WASM_DYLINK_MEM_INFO) {
                customSection.memorySize = getLEB();
                customSection.memoryAlign = getLEB();
                customSection.tableSize = getLEB();
                customSection.tableAlign = getLEB();
              } else if (subsectionType === WASM_DYLINK_NEEDED) {
                var neededDynlibsCount = getLEB();
                for (var i2 = 0; i2 < neededDynlibsCount; ++i2) {
                  libname = getString();
                  customSection.neededDynlibs.push(libname);
                }
              } else if (subsectionType === WASM_DYLINK_EXPORT_INFO) {
                var count = getLEB();
                while (count--) {
                  var symname = getString();
                  var flags2 = getLEB();
                  if (flags2 & WASM_SYMBOL_TLS) {
                    customSection.tlsExports.add(symname);
                  }
                }
              } else if (subsectionType === WASM_DYLINK_IMPORT_INFO) {
                var count = getLEB();
                while (count--) {
                  getString();
                  var symname = getString();
                  var flags2 = getLEB();
                  if ((flags2 & WASM_SYMBOL_BINDING_MASK) == WASM_SYMBOL_BINDING_WEAK) {
                    customSection.weakImports.add(symname);
                  }
                }
              } else {
                offset += subsectionSize;
              }
            }
          }
          return customSection;
        }, "getDylinkMetadata");
        function getValue(ptr, type = "i8") {
          if (type.endsWith("*")) type = "*";
          switch (type) {
            case "i1":
              return HEAP8[ptr];
            case "i8":
              return HEAP8[ptr];
            case "i16":
              return LE_HEAP_LOAD_I16((ptr >> 1) * 2);
            case "i32":
              return LE_HEAP_LOAD_I32((ptr >> 2) * 4);
            case "i64":
              abort("to do getValue(i64) use WASM_BIGINT");
            case "float":
              return LE_HEAP_LOAD_F32((ptr >> 2) * 4);
            case "double":
              return LE_HEAP_LOAD_F64((ptr >> 3) * 8);
            case "*":
              return LE_HEAP_LOAD_U32((ptr >> 2) * 4);
            default:
              abort(`invalid type for getValue: ${type}`);
          }
        }
        __name(getValue, "getValue");
        var newDSO = /* @__PURE__ */ __name((name2, handle2, syms) => {
          var dso = {
            refcount: Infinity,
            name: name2,
            exports: syms,
            global: true
          };
          LDSO.loadedLibsByName[name2] = dso;
          if (handle2 != void 0) {
            LDSO.loadedLibsByHandle[handle2] = dso;
          }
          return dso;
        }, "newDSO");
        var LDSO = {
          loadedLibsByName: {},
          loadedLibsByHandle: {},
          init() {
            newDSO("__main__", 0, wasmImports);
          }
        };
        var ___heap_base = 78240;
        var zeroMemory = /* @__PURE__ */ __name((address, size) => {
          HEAPU8.fill(0, address, address + size);
          return address;
        }, "zeroMemory");
        var alignMemory = /* @__PURE__ */ __name((size, alignment) => Math.ceil(size / alignment) * alignment, "alignMemory");
        var getMemory = /* @__PURE__ */ __name((size) => {
          if (runtimeInitialized) {
            return zeroMemory(_malloc(size), size);
          }
          var ret = ___heap_base;
          var end = ret + alignMemory(size, 16);
          ___heap_base = end;
          GOT["__heap_base"].value = end;
          return ret;
        }, "getMemory");
        var isInternalSym = /* @__PURE__ */ __name((symName) => ["__cpp_exception", "__c_longjmp", "__wasm_apply_data_relocs", "__dso_handle", "__tls_size", "__tls_align", "__set_stack_limits", "_emscripten_tls_init", "__wasm_init_tls", "__wasm_call_ctors", "__start_em_asm", "__stop_em_asm", "__start_em_js", "__stop_em_js"].includes(symName) || symName.startsWith("__em_js__"), "isInternalSym");
        var uleb128Encode = /* @__PURE__ */ __name((n, target) => {
          if (n < 128) {
            target.push(n);
          } else {
            target.push(n % 128 | 128, n >> 7);
          }
        }, "uleb128Encode");
        var sigToWasmTypes = /* @__PURE__ */ __name((sig) => {
          var typeNames = {
            "i": "i32",
            "j": "i64",
            "f": "f32",
            "d": "f64",
            "e": "externref",
            "p": "i32"
          };
          var type = {
            parameters: [],
            results: sig[0] == "v" ? [] : [typeNames[sig[0]]]
          };
          for (var i2 = 1; i2 < sig.length; ++i2) {
            type.parameters.push(typeNames[sig[i2]]);
          }
          return type;
        }, "sigToWasmTypes");
        var generateFuncType = /* @__PURE__ */ __name((sig, target) => {
          var sigRet = sig.slice(0, 1);
          var sigParam = sig.slice(1);
          var typeCodes = {
            "i": 127,
            // i32
            "p": 127,
            // i32
            "j": 126,
            // i64
            "f": 125,
            // f32
            "d": 124,
            // f64
            "e": 111
          };
          target.push(96);
          uleb128Encode(sigParam.length, target);
          for (var i2 = 0; i2 < sigParam.length; ++i2) {
            target.push(typeCodes[sigParam[i2]]);
          }
          if (sigRet == "v") {
            target.push(0);
          } else {
            target.push(1, typeCodes[sigRet]);
          }
        }, "generateFuncType");
        var convertJsFunctionToWasm = /* @__PURE__ */ __name((func2, sig) => {
          if (typeof WebAssembly.Function == "function") {
            return new WebAssembly.Function(sigToWasmTypes(sig), func2);
          }
          var typeSectionBody = [1];
          generateFuncType(sig, typeSectionBody);
          var bytes = [
            0,
            97,
            115,
            109,
            // magic ("\0asm")
            1,
            0,
            0,
            0,
            // version: 1
            1
          ];
          uleb128Encode(typeSectionBody.length, bytes);
          bytes.push(...typeSectionBody);
          bytes.push(
            2,
            7,
            // import section
            // (import "e" "f" (func 0 (type 0)))
            1,
            1,
            101,
            1,
            102,
            0,
            0,
            7,
            5,
            // export section
            // (export "f" (func 0 (type 0)))
            1,
            1,
            102,
            0,
            0
          );
          var module2 = new WebAssembly.Module(new Uint8Array(bytes));
          var instance2 = new WebAssembly.Instance(module2, {
            "e": {
              "f": func2
            }
          });
          var wrappedFunc = instance2.exports["f"];
          return wrappedFunc;
        }, "convertJsFunctionToWasm");
        var wasmTableMirror = [];
        var wasmTable = new WebAssembly.Table({
          "initial": 31,
          "element": "anyfunc"
        });
        var getWasmTableEntry = /* @__PURE__ */ __name((funcPtr) => {
          var func2 = wasmTableMirror[funcPtr];
          if (!func2) {
            if (funcPtr >= wasmTableMirror.length) wasmTableMirror.length = funcPtr + 1;
            wasmTableMirror[funcPtr] = func2 = wasmTable.get(funcPtr);
          }
          return func2;
        }, "getWasmTableEntry");
        var updateTableMap = /* @__PURE__ */ __name((offset, count) => {
          if (functionsInTableMap) {
            for (var i2 = offset; i2 < offset + count; i2++) {
              var item = getWasmTableEntry(i2);
              if (item) {
                functionsInTableMap.set(item, i2);
              }
            }
          }
        }, "updateTableMap");
        var functionsInTableMap;
        var getFunctionAddress = /* @__PURE__ */ __name((func2) => {
          if (!functionsInTableMap) {
            functionsInTableMap = /* @__PURE__ */ new WeakMap();
            updateTableMap(0, wasmTable.length);
          }
          return functionsInTableMap.get(func2) || 0;
        }, "getFunctionAddress");
        var freeTableIndexes = [];
        var getEmptyTableSlot = /* @__PURE__ */ __name(() => {
          if (freeTableIndexes.length) {
            return freeTableIndexes.pop();
          }
          try {
            wasmTable.grow(1);
          } catch (err2) {
            if (!(err2 instanceof RangeError)) {
              throw err2;
            }
            throw "Unable to grow wasm table. Set ALLOW_TABLE_GROWTH.";
          }
          return wasmTable.length - 1;
        }, "getEmptyTableSlot");
        var setWasmTableEntry = /* @__PURE__ */ __name((idx, func2) => {
          wasmTable.set(idx, func2);
          wasmTableMirror[idx] = wasmTable.get(idx);
        }, "setWasmTableEntry");
        var addFunction = /* @__PURE__ */ __name((func2, sig) => {
          var rtn = getFunctionAddress(func2);
          if (rtn) {
            return rtn;
          }
          var ret = getEmptyTableSlot();
          try {
            setWasmTableEntry(ret, func2);
          } catch (err2) {
            if (!(err2 instanceof TypeError)) {
              throw err2;
            }
            var wrapped = convertJsFunctionToWasm(func2, sig);
            setWasmTableEntry(ret, wrapped);
          }
          functionsInTableMap.set(func2, ret);
          return ret;
        }, "addFunction");
        var updateGOT = /* @__PURE__ */ __name((exports2, replace) => {
          for (var symName in exports2) {
            if (isInternalSym(symName)) {
              continue;
            }
            var value = exports2[symName];
            if (symName.startsWith("orig$")) {
              symName = symName.split("$")[1];
              replace = true;
            }
            GOT[symName] || (GOT[symName] = new WebAssembly.Global({
              "value": "i32",
              "mutable": true
            }));
            if (replace || GOT[symName].value == 0) {
              if (typeof value == "function") {
                GOT[symName].value = addFunction(value);
              } else if (typeof value == "number") {
                GOT[symName].value = value;
              } else {
                err(`unhandled export type for '${symName}': ${typeof value}`);
              }
            }
          }
        }, "updateGOT");
        var relocateExports = /* @__PURE__ */ __name((exports2, memoryBase2, replace) => {
          var relocated = {};
          for (var e in exports2) {
            var value = exports2[e];
            if (typeof value == "object") {
              value = value.value;
            }
            if (typeof value == "number") {
              value += memoryBase2;
            }
            relocated[e] = value;
          }
          updateGOT(relocated, replace);
          return relocated;
        }, "relocateExports");
        var isSymbolDefined = /* @__PURE__ */ __name((symName) => {
          var existing = wasmImports[symName];
          if (!existing || existing.stub) {
            return false;
          }
          return true;
        }, "isSymbolDefined");
        var dynCallLegacy = /* @__PURE__ */ __name((sig, ptr, args2) => {
          sig = sig.replace(/p/g, "i");
          var f = Module["dynCall_" + sig];
          return f(ptr, ...args2);
        }, "dynCallLegacy");
        var dynCall = /* @__PURE__ */ __name((sig, ptr, args2 = []) => {
          if (sig.includes("j")) {
            return dynCallLegacy(sig, ptr, args2);
          }
          var rtn = getWasmTableEntry(ptr)(...args2);
          return rtn;
        }, "dynCall");
        var stackSave = /* @__PURE__ */ __name(() => _emscripten_stack_get_current(), "stackSave");
        var stackRestore = /* @__PURE__ */ __name((val) => __emscripten_stack_restore(val), "stackRestore");
        var createInvokeFunction = /* @__PURE__ */ __name((sig) => (ptr, ...args2) => {
          var sp = stackSave();
          try {
            return dynCall(sig, ptr, args2);
          } catch (e) {
            stackRestore(sp);
            if (e !== e + 0) throw e;
            _setThrew(1, 0);
          }
        }, "createInvokeFunction");
        var resolveGlobalSymbol = /* @__PURE__ */ __name((symName, direct = false) => {
          var sym;
          if (direct && "orig$" + symName in wasmImports) {
            symName = "orig$" + symName;
          }
          if (isSymbolDefined(symName)) {
            sym = wasmImports[symName];
          } else if (symName.startsWith("invoke_")) {
            sym = wasmImports[symName] = createInvokeFunction(symName.split("_")[1]);
          }
          return {
            sym,
            name: symName
          };
        }, "resolveGlobalSymbol");
        var UTF8ToString = /* @__PURE__ */ __name((ptr, maxBytesToRead) => ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : "", "UTF8ToString");
        var loadWebAssemblyModule = /* @__PURE__ */ __name((binary, flags, libName, localScope, handle) => {
          var metadata = getDylinkMetadata(binary);
          currentModuleWeakSymbols = metadata.weakImports;
          function loadModule() {
            var firstLoad = !handle || !HEAP8[handle + 8];
            if (firstLoad) {
              var memAlign = Math.pow(2, metadata.memoryAlign);
              var memoryBase = metadata.memorySize ? alignMemory(getMemory(metadata.memorySize + memAlign), memAlign) : 0;
              var tableBase = metadata.tableSize ? wasmTable.length : 0;
              if (handle) {
                HEAP8[handle + 8] = 1;
                LE_HEAP_STORE_U32((handle + 12 >> 2) * 4, memoryBase);
                LE_HEAP_STORE_I32((handle + 16 >> 2) * 4, metadata.memorySize);
                LE_HEAP_STORE_U32((handle + 20 >> 2) * 4, tableBase);
                LE_HEAP_STORE_I32((handle + 24 >> 2) * 4, metadata.tableSize);
              }
            } else {
              memoryBase = LE_HEAP_LOAD_U32((handle + 12 >> 2) * 4);
              tableBase = LE_HEAP_LOAD_U32((handle + 20 >> 2) * 4);
            }
            var tableGrowthNeeded = tableBase + metadata.tableSize - wasmTable.length;
            if (tableGrowthNeeded > 0) {
              wasmTable.grow(tableGrowthNeeded);
            }
            var moduleExports;
            function resolveSymbol(sym) {
              var resolved = resolveGlobalSymbol(sym).sym;
              if (!resolved && localScope) {
                resolved = localScope[sym];
              }
              if (!resolved) {
                resolved = moduleExports[sym];
              }
              return resolved;
            }
            __name(resolveSymbol, "resolveSymbol");
            var proxyHandler = {
              get(stubs, prop) {
                switch (prop) {
                  case "__memory_base":
                    return memoryBase;
                  case "__table_base":
                    return tableBase;
                }
                if (prop in wasmImports && !wasmImports[prop].stub) {
                  return wasmImports[prop];
                }
                if (!(prop in stubs)) {
                  var resolved;
                  stubs[prop] = (...args2) => {
                    resolved || (resolved = resolveSymbol(prop));
                    return resolved(...args2);
                  };
                }
                return stubs[prop];
              }
            };
            var proxy = new Proxy({}, proxyHandler);
            var info = {
              "GOT.mem": new Proxy({}, GOTHandler),
              "GOT.func": new Proxy({}, GOTHandler),
              "env": proxy,
              "wasi_snapshot_preview1": proxy
            };
            function postInstantiation(module, instance) {
              updateTableMap(tableBase, metadata.tableSize);
              moduleExports = relocateExports(instance.exports, memoryBase);
              if (!flags.allowUndefined) {
                reportUndefinedSymbols();
              }
              function addEmAsm(addr, body) {
                var args = [];
                var arity = 0;
                for (; arity < 16; arity++) {
                  if (body.indexOf("$" + arity) != -1) {
                    args.push("$" + arity);
                  } else {
                    break;
                  }
                }
                args = args.join(",");
                var func = `(${args}) => { ${body} };`;
                eval(func);
              }
              __name(addEmAsm, "addEmAsm");
              if ("__start_em_asm" in moduleExports) {
                var start = moduleExports["__start_em_asm"];
                var stop = moduleExports["__stop_em_asm"];
                while (start < stop) {
                  var jsString = UTF8ToString(start);
                  addEmAsm(start, jsString);
                  start = HEAPU8.indexOf(0, start) + 1;
                }
              }
              function addEmJs(name, cSig, body) {
                var jsArgs = [];
                cSig = cSig.slice(1, -1);
                if (cSig != "void") {
                  cSig = cSig.split(",");
                  for (var i in cSig) {
                    var jsArg = cSig[i].split(" ").pop();
                    jsArgs.push(jsArg.replace("*", ""));
                  }
                }
                var func = `(${jsArgs}) => ${body};`;
                moduleExports[name] = eval(func);
              }
              __name(addEmJs, "addEmJs");
              for (var name in moduleExports) {
                if (name.startsWith("__em_js__")) {
                  var start = moduleExports[name];
                  var jsString = UTF8ToString(start);
                  var parts = jsString.split("<::>");
                  addEmJs(name.replace("__em_js__", ""), parts[0], parts[1]);
                  delete moduleExports[name];
                }
              }
              var applyRelocs = moduleExports["__wasm_apply_data_relocs"];
              if (applyRelocs) {
                if (runtimeInitialized) {
                  applyRelocs();
                } else {
                  __RELOC_FUNCS__.push(applyRelocs);
                }
              }
              var init = moduleExports["__wasm_call_ctors"];
              if (init) {
                if (runtimeInitialized) {
                  init();
                } else {
                  __ATINIT__.push(init);
                }
              }
              return moduleExports;
            }
            __name(postInstantiation, "postInstantiation");
            if (flags.loadAsync) {
              if (binary instanceof WebAssembly.Module) {
                var instance = new WebAssembly.Instance(binary, info);
                return Promise.resolve(postInstantiation(binary, instance));
              }
              return WebAssembly.instantiate(binary, info).then((result) => postInstantiation(result.module, result.instance));
            }
            var module = binary instanceof WebAssembly.Module ? binary : new WebAssembly.Module(binary);
            var instance = new WebAssembly.Instance(module, info);
            return postInstantiation(module, instance);
          }
          __name(loadModule, "loadModule");
          if (flags.loadAsync) {
            return metadata.neededDynlibs.reduce((chain, dynNeeded) => chain.then(() => loadDynamicLibrary(dynNeeded, flags, localScope)), Promise.resolve()).then(loadModule);
          }
          metadata.neededDynlibs.forEach((needed) => loadDynamicLibrary(needed, flags, localScope));
          return loadModule();
        }, "loadWebAssemblyModule");
        var mergeLibSymbols = /* @__PURE__ */ __name((exports2, libName2) => {
          for (var [sym, exp] of Object.entries(exports2)) {
            const setImport = /* @__PURE__ */ __name((target) => {
              if (!isSymbolDefined(target)) {
                wasmImports[target] = exp;
              }
            }, "setImport");
            setImport(sym);
            const main_alias = "__main_argc_argv";
            if (sym == "main") {
              setImport(main_alias);
            }
            if (sym == main_alias) {
              setImport("main");
            }
            if (sym.startsWith("dynCall_") && !Module.hasOwnProperty(sym)) {
              Module[sym] = exp;
            }
          }
        }, "mergeLibSymbols");
        var asyncLoad = /* @__PURE__ */ __name((url, onload, onerror, noRunDep) => {
          var dep = !noRunDep ? getUniqueRunDependency(`al ${url}`) : "";
          readAsync(url).then((arrayBuffer) => {
            onload(new Uint8Array(arrayBuffer));
            if (dep) removeRunDependency();
          }, (err2) => {
            if (onerror) {
              onerror();
            } else {
              throw `Loading data file "${url}" failed.`;
            }
          });
          if (dep) addRunDependency();
        }, "asyncLoad");
        function loadDynamicLibrary(libName2, flags2 = {
          global: true,
          nodelete: true
        }, localScope2, handle2) {
          var dso = LDSO.loadedLibsByName[libName2];
          if (dso) {
            if (!flags2.global) {
              if (localScope2) {
                Object.assign(localScope2, dso.exports);
              }
            } else if (!dso.global) {
              dso.global = true;
              mergeLibSymbols(dso.exports, libName2);
            }
            if (flags2.nodelete && dso.refcount !== Infinity) {
              dso.refcount = Infinity;
            }
            dso.refcount++;
            if (handle2) {
              LDSO.loadedLibsByHandle[handle2] = dso;
            }
            return flags2.loadAsync ? Promise.resolve(true) : true;
          }
          dso = newDSO(libName2, handle2, "loading");
          dso.refcount = flags2.nodelete ? Infinity : 1;
          dso.global = flags2.global;
          function loadLibData() {
            if (handle2) {
              var data = LE_HEAP_LOAD_U32((handle2 + 28 >> 2) * 4);
              var dataSize = LE_HEAP_LOAD_U32((handle2 + 32 >> 2) * 4);
              if (data && dataSize) {
                var libData = HEAP8.slice(data, data + dataSize);
                return flags2.loadAsync ? Promise.resolve(libData) : libData;
              }
            }
            var libFile = locateFile(libName2);
            if (flags2.loadAsync) {
              return new Promise(function(resolve, reject) {
                asyncLoad(libFile, resolve, reject);
              });
            }
            if (!readBinary) {
              throw new Error(`${libFile}: file not found, and synchronous loading of external files is not available`);
            }
            return readBinary(libFile);
          }
          __name(loadLibData, "loadLibData");
          function getExports() {
            if (flags2.loadAsync) {
              return loadLibData().then((libData) => loadWebAssemblyModule(libData, flags2, libName2, localScope2, handle2));
            }
            return loadWebAssemblyModule(loadLibData(), flags2, libName2, localScope2, handle2);
          }
          __name(getExports, "getExports");
          function moduleLoaded(exports2) {
            if (dso.global) {
              mergeLibSymbols(exports2, libName2);
            } else if (localScope2) {
              Object.assign(localScope2, exports2);
            }
            dso.exports = exports2;
          }
          __name(moduleLoaded, "moduleLoaded");
          if (flags2.loadAsync) {
            return getExports().then((exports2) => {
              moduleLoaded(exports2);
              return true;
            });
          }
          moduleLoaded(getExports());
          return true;
        }
        __name(loadDynamicLibrary, "loadDynamicLibrary");
        var reportUndefinedSymbols = /* @__PURE__ */ __name(() => {
          for (var [symName, entry] of Object.entries(GOT)) {
            if (entry.value == 0) {
              var value = resolveGlobalSymbol(symName, true).sym;
              if (!value && !entry.required) {
                continue;
              }
              if (typeof value == "function") {
                entry.value = addFunction(value, value.sig);
              } else if (typeof value == "number") {
                entry.value = value;
              } else {
                throw new Error(`bad export type for '${symName}': ${typeof value}`);
              }
            }
          }
        }, "reportUndefinedSymbols");
        var loadDylibs = /* @__PURE__ */ __name(() => {
          if (!dynamicLibraries.length) {
            reportUndefinedSymbols();
            return;
          }
          addRunDependency();
          dynamicLibraries.reduce((chain, lib) => chain.then(() => loadDynamicLibrary(lib, {
            loadAsync: true,
            global: true,
            nodelete: true,
            allowUndefined: true
          })), Promise.resolve()).then(() => {
            reportUndefinedSymbols();
            removeRunDependency();
          });
        }, "loadDylibs");
        var noExitRuntime = Module["noExitRuntime"] || true;
        function setValue(ptr, value, type = "i8") {
          if (type.endsWith("*")) type = "*";
          switch (type) {
            case "i1":
              HEAP8[ptr] = value;
              break;
            case "i8":
              HEAP8[ptr] = value;
              break;
            case "i16":
              LE_HEAP_STORE_I16((ptr >> 1) * 2, value);
              break;
            case "i32":
              LE_HEAP_STORE_I32((ptr >> 2) * 4, value);
              break;
            case "i64":
              abort("to do setValue(i64) use WASM_BIGINT");
            case "float":
              LE_HEAP_STORE_F32((ptr >> 2) * 4, value);
              break;
            case "double":
              LE_HEAP_STORE_F64((ptr >> 3) * 8, value);
              break;
            case "*":
              LE_HEAP_STORE_U32((ptr >> 2) * 4, value);
              break;
            default:
              abort(`invalid type for setValue: ${type}`);
          }
        }
        __name(setValue, "setValue");
        var ___memory_base = new WebAssembly.Global({
          "value": "i32",
          "mutable": false
        }, 1024);
        var ___stack_pointer = new WebAssembly.Global({
          "value": "i32",
          "mutable": true
        }, 78240);
        var ___table_base = new WebAssembly.Global({
          "value": "i32",
          "mutable": false
        }, 1);
        var __abort_js = /* @__PURE__ */ __name(() => {
          abort("");
        }, "__abort_js");
        __abort_js.sig = "v";
        var nowIsMonotonic = 1;
        var __emscripten_get_now_is_monotonic = /* @__PURE__ */ __name(() => nowIsMonotonic, "__emscripten_get_now_is_monotonic");
        __emscripten_get_now_is_monotonic.sig = "i";
        var __emscripten_memcpy_js = /* @__PURE__ */ __name((dest, src, num) => HEAPU8.copyWithin(dest, src, src + num), "__emscripten_memcpy_js");
        __emscripten_memcpy_js.sig = "vppp";
        var _emscripten_date_now = /* @__PURE__ */ __name(() => Date.now(), "_emscripten_date_now");
        _emscripten_date_now.sig = "d";
        var _emscripten_get_now;
        _emscripten_get_now = /* @__PURE__ */ __name(() => performance.now(), "_emscripten_get_now");
        _emscripten_get_now.sig = "d";
        var getHeapMax = /* @__PURE__ */ __name(() => (
          // Stay one Wasm page short of 4GB: while e.g. Chrome is able to allocate
          // full 4GB Wasm memories, the size will wrap back to 0 bytes in Wasm side
          // for any code that deals with heap sizes, which would require special
          // casing all heap size related code to treat 0 specially.
          2147483648
        ), "getHeapMax");
        var growMemory = /* @__PURE__ */ __name((size) => {
          var b = wasmMemory.buffer;
          var pages = (size - b.byteLength + 65535) / 65536;
          try {
            wasmMemory.grow(pages);
            updateMemoryViews();
            return 1;
          } catch (e) {
          }
        }, "growMemory");
        var _emscripten_resize_heap = /* @__PURE__ */ __name((requestedSize) => {
          var oldSize = HEAPU8.length;
          requestedSize >>>= 0;
          var maxHeapSize = getHeapMax();
          if (requestedSize > maxHeapSize) {
            return false;
          }
          var alignUp = /* @__PURE__ */ __name((x, multiple) => x + (multiple - x % multiple) % multiple, "alignUp");
          for (var cutDown = 1; cutDown <= 4; cutDown *= 2) {
            var overGrownHeapSize = oldSize * (1 + 0.2 / cutDown);
            overGrownHeapSize = Math.min(overGrownHeapSize, requestedSize + 100663296);
            var newSize = Math.min(maxHeapSize, alignUp(Math.max(requestedSize, overGrownHeapSize), 65536));
            var replacement = growMemory(newSize);
            if (replacement) {
              return true;
            }
          }
          return false;
        }, "_emscripten_resize_heap");
        _emscripten_resize_heap.sig = "ip";
        var _fd_close = /* @__PURE__ */ __name((fd) => 52, "_fd_close");
        _fd_close.sig = "ii";
        var convertI32PairToI53Checked = /* @__PURE__ */ __name((lo, hi) => hi + 2097152 >>> 0 < 4194305 - !!lo ? (lo >>> 0) + hi * 4294967296 : NaN, "convertI32PairToI53Checked");
        function _fd_seek(fd, offset_low, offset_high, whence, newOffset) {
          convertI32PairToI53Checked(offset_low, offset_high);
          return 70;
        }
        __name(_fd_seek, "_fd_seek");
        _fd_seek.sig = "iiiiip";
        var printCharBuffers = [null, [], []];
        var printChar = /* @__PURE__ */ __name((stream, curr) => {
          var buffer = printCharBuffers[stream];
          if (curr === 0 || curr === 10) {
            (stream === 1 ? out : err)(UTF8ArrayToString(buffer, 0));
            buffer.length = 0;
          } else {
            buffer.push(curr);
          }
        }, "printChar");
        var _fd_write = /* @__PURE__ */ __name((fd, iov, iovcnt, pnum) => {
          var num = 0;
          for (var i2 = 0; i2 < iovcnt; i2++) {
            var ptr = LE_HEAP_LOAD_U32((iov >> 2) * 4);
            var len = LE_HEAP_LOAD_U32((iov + 4 >> 2) * 4);
            iov += 8;
            for (var j = 0; j < len; j++) {
              printChar(fd, HEAPU8[ptr + j]);
            }
            num += len;
          }
          LE_HEAP_STORE_U32((pnum >> 2) * 4, num);
          return 0;
        }, "_fd_write");
        _fd_write.sig = "iippp";
        function _tree_sitter_log_callback(isLexMessage, messageAddress) {
          if (Module.currentLogCallback) {
            const message = UTF8ToString(messageAddress);
            Module.currentLogCallback(message, isLexMessage !== 0);
          }
        }
        __name(_tree_sitter_log_callback, "_tree_sitter_log_callback");
        function _tree_sitter_parse_callback(inputBufferAddress, index, row, column, lengthAddress) {
          const INPUT_BUFFER_SIZE = 10 * 1024;
          const string = Module.currentParseCallback(index, {
            row,
            column
          });
          if (typeof string === "string") {
            setValue(lengthAddress, string.length, "i32");
            stringToUTF16(string, inputBufferAddress, INPUT_BUFFER_SIZE);
          } else {
            setValue(lengthAddress, 0, "i32");
          }
        }
        __name(_tree_sitter_parse_callback, "_tree_sitter_parse_callback");
        function _tree_sitter_progress_callback(currentOffset, hasError) {
          if (Module.currentProgressCallback) {
            return Module.currentProgressCallback({
              currentOffset,
              hasError
            });
          }
          return false;
        }
        __name(_tree_sitter_progress_callback, "_tree_sitter_progress_callback");
        function _tree_sitter_query_progress_callback(currentOffset) {
          if (Module.currentQueryProgressCallback) {
            return Module.currentQueryProgressCallback({
              currentOffset
            });
          }
          return false;
        }
        __name(_tree_sitter_query_progress_callback, "_tree_sitter_query_progress_callback");
        var keepRuntimeAlive = /* @__PURE__ */ __name(() => noExitRuntime, "keepRuntimeAlive");
        var _proc_exit = /* @__PURE__ */ __name((code) => {
          var _a2;
          EXITSTATUS = code;
          if (!keepRuntimeAlive()) {
            (_a2 = Module["onExit"]) == null ? void 0 : _a2.call(Module, code);
            ABORT = true;
          }
          quit_(code, new ExitStatus(code));
        }, "_proc_exit");
        _proc_exit.sig = "vi";
        var exitJS = /* @__PURE__ */ __name((status, implicit) => {
          EXITSTATUS = status;
          _proc_exit(status);
        }, "exitJS");
        var handleException = /* @__PURE__ */ __name((e) => {
          if (e instanceof ExitStatus || e == "unwind") {
            return EXITSTATUS;
          }
          quit_(1, e);
        }, "handleException");
        var lengthBytesUTF8 = /* @__PURE__ */ __name((str) => {
          var len = 0;
          for (var i2 = 0; i2 < str.length; ++i2) {
            var c = str.charCodeAt(i2);
            if (c <= 127) {
              len++;
            } else if (c <= 2047) {
              len += 2;
            } else if (c >= 55296 && c <= 57343) {
              len += 4;
              ++i2;
            } else {
              len += 3;
            }
          }
          return len;
        }, "lengthBytesUTF8");
        var stringToUTF8Array = /* @__PURE__ */ __name((str, heap, outIdx, maxBytesToWrite) => {
          if (!(maxBytesToWrite > 0)) return 0;
          var startIdx = outIdx;
          var endIdx = outIdx + maxBytesToWrite - 1;
          for (var i2 = 0; i2 < str.length; ++i2) {
            var u = str.charCodeAt(i2);
            if (u >= 55296 && u <= 57343) {
              var u1 = str.charCodeAt(++i2);
              u = 65536 + ((u & 1023) << 10) | u1 & 1023;
            }
            if (u <= 127) {
              if (outIdx >= endIdx) break;
              heap[outIdx++] = u;
            } else if (u <= 2047) {
              if (outIdx + 1 >= endIdx) break;
              heap[outIdx++] = 192 | u >> 6;
              heap[outIdx++] = 128 | u & 63;
            } else if (u <= 65535) {
              if (outIdx + 2 >= endIdx) break;
              heap[outIdx++] = 224 | u >> 12;
              heap[outIdx++] = 128 | u >> 6 & 63;
              heap[outIdx++] = 128 | u & 63;
            } else {
              if (outIdx + 3 >= endIdx) break;
              heap[outIdx++] = 240 | u >> 18;
              heap[outIdx++] = 128 | u >> 12 & 63;
              heap[outIdx++] = 128 | u >> 6 & 63;
              heap[outIdx++] = 128 | u & 63;
            }
          }
          heap[outIdx] = 0;
          return outIdx - startIdx;
        }, "stringToUTF8Array");
        var stringToUTF8 = /* @__PURE__ */ __name((str, outPtr, maxBytesToWrite) => stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite), "stringToUTF8");
        var stackAlloc = /* @__PURE__ */ __name((sz) => __emscripten_stack_alloc(sz), "stackAlloc");
        var stringToUTF8OnStack = /* @__PURE__ */ __name((str) => {
          var size = lengthBytesUTF8(str) + 1;
          var ret = stackAlloc(size);
          stringToUTF8(str, ret, size);
          return ret;
        }, "stringToUTF8OnStack");
        var AsciiToString = /* @__PURE__ */ __name((ptr) => {
          var str = "";
          while (1) {
            var ch = HEAPU8[ptr++];
            if (!ch) return str;
            str += String.fromCharCode(ch);
          }
        }, "AsciiToString");
        var stringToUTF16 = /* @__PURE__ */ __name((str, outPtr, maxBytesToWrite) => {
          maxBytesToWrite ?? (maxBytesToWrite = 2147483647);
          if (maxBytesToWrite < 2) return 0;
          maxBytesToWrite -= 2;
          var startPtr = outPtr;
          var numCharsToWrite = maxBytesToWrite < str.length * 2 ? maxBytesToWrite / 2 : str.length;
          for (var i2 = 0; i2 < numCharsToWrite; ++i2) {
            var codeUnit = str.charCodeAt(i2);
            LE_HEAP_STORE_I16((outPtr >> 1) * 2, codeUnit);
            outPtr += 2;
          }
          LE_HEAP_STORE_I16((outPtr >> 1) * 2, 0);
          return outPtr - startPtr;
        }, "stringToUTF16");
        var wasmImports = {
          /** @export */
          __heap_base: ___heap_base,
          /** @export */
          __indirect_function_table: wasmTable,
          /** @export */
          __memory_base: ___memory_base,
          /** @export */
          __stack_pointer: ___stack_pointer,
          /** @export */
          __table_base: ___table_base,
          /** @export */
          _abort_js: __abort_js,
          /** @export */
          _emscripten_get_now_is_monotonic: __emscripten_get_now_is_monotonic,
          /** @export */
          _emscripten_memcpy_js: __emscripten_memcpy_js,
          /** @export */
          emscripten_date_now: _emscripten_date_now,
          /** @export */
          emscripten_get_now: _emscripten_get_now,
          /** @export */
          emscripten_resize_heap: _emscripten_resize_heap,
          /** @export */
          fd_close: _fd_close,
          /** @export */
          fd_seek: _fd_seek,
          /** @export */
          fd_write: _fd_write,
          /** @export */
          memory: wasmMemory,
          /** @export */
          tree_sitter_log_callback: _tree_sitter_log_callback,
          /** @export */
          tree_sitter_parse_callback: _tree_sitter_parse_callback,
          /** @export */
          tree_sitter_progress_callback: _tree_sitter_progress_callback,
          /** @export */
          tree_sitter_query_progress_callback: _tree_sitter_query_progress_callback
        };
        var wasmExports = createWasm();
        var _malloc = Module["_malloc"] = (a0) => (_malloc = Module["_malloc"] = wasmExports["malloc"])(a0);
        Module["_calloc"] = (a0, a1) => (Module["_calloc"] = wasmExports["calloc"])(a0, a1);
        Module["_realloc"] = (a0, a1) => (Module["_realloc"] = wasmExports["realloc"])(a0, a1);
        Module["_free"] = (a0) => (Module["_free"] = wasmExports["free"])(a0);
        Module["_memcmp"] = (a0, a1, a2) => (Module["_memcmp"] = wasmExports["memcmp"])(a0, a1, a2);
        Module["_ts_language_symbol_count"] = (a0) => (Module["_ts_language_symbol_count"] = wasmExports["ts_language_symbol_count"])(a0);
        Module["_ts_language_state_count"] = (a0) => (Module["_ts_language_state_count"] = wasmExports["ts_language_state_count"])(a0);
        Module["_ts_language_version"] = (a0) => (Module["_ts_language_version"] = wasmExports["ts_language_version"])(a0);
        Module["_ts_language_abi_version"] = (a0) => (Module["_ts_language_abi_version"] = wasmExports["ts_language_abi_version"])(a0);
        Module["_ts_language_metadata"] = (a0) => (Module["_ts_language_metadata"] = wasmExports["ts_language_metadata"])(a0);
        Module["_ts_language_name"] = (a0) => (Module["_ts_language_name"] = wasmExports["ts_language_name"])(a0);
        Module["_ts_language_field_count"] = (a0) => (Module["_ts_language_field_count"] = wasmExports["ts_language_field_count"])(a0);
        Module["_ts_language_next_state"] = (a0, a1, a2) => (Module["_ts_language_next_state"] = wasmExports["ts_language_next_state"])(a0, a1, a2);
        Module["_ts_language_symbol_name"] = (a0, a1) => (Module["_ts_language_symbol_name"] = wasmExports["ts_language_symbol_name"])(a0, a1);
        Module["_ts_language_symbol_for_name"] = (a0, a1, a2, a3) => (Module["_ts_language_symbol_for_name"] = wasmExports["ts_language_symbol_for_name"])(a0, a1, a2, a3);
        Module["_strncmp"] = (a0, a1, a2) => (Module["_strncmp"] = wasmExports["strncmp"])(a0, a1, a2);
        Module["_ts_language_symbol_type"] = (a0, a1) => (Module["_ts_language_symbol_type"] = wasmExports["ts_language_symbol_type"])(a0, a1);
        Module["_ts_language_field_name_for_id"] = (a0, a1) => (Module["_ts_language_field_name_for_id"] = wasmExports["ts_language_field_name_for_id"])(a0, a1);
        Module["_ts_lookahead_iterator_new"] = (a0, a1) => (Module["_ts_lookahead_iterator_new"] = wasmExports["ts_lookahead_iterator_new"])(a0, a1);
        Module["_ts_lookahead_iterator_delete"] = (a0) => (Module["_ts_lookahead_iterator_delete"] = wasmExports["ts_lookahead_iterator_delete"])(a0);
        Module["_ts_lookahead_iterator_reset_state"] = (a0, a1) => (Module["_ts_lookahead_iterator_reset_state"] = wasmExports["ts_lookahead_iterator_reset_state"])(a0, a1);
        Module["_ts_lookahead_iterator_reset"] = (a0, a1, a2) => (Module["_ts_lookahead_iterator_reset"] = wasmExports["ts_lookahead_iterator_reset"])(a0, a1, a2);
        Module["_ts_lookahead_iterator_next"] = (a0) => (Module["_ts_lookahead_iterator_next"] = wasmExports["ts_lookahead_iterator_next"])(a0);
        Module["_ts_lookahead_iterator_current_symbol"] = (a0) => (Module["_ts_lookahead_iterator_current_symbol"] = wasmExports["ts_lookahead_iterator_current_symbol"])(a0);
        Module["_memset"] = (a0, a1, a2) => (Module["_memset"] = wasmExports["memset"])(a0, a1, a2);
        Module["_memcpy"] = (a0, a1, a2) => (Module["_memcpy"] = wasmExports["memcpy"])(a0, a1, a2);
        Module["_ts_parser_delete"] = (a0) => (Module["_ts_parser_delete"] = wasmExports["ts_parser_delete"])(a0);
        Module["_ts_parser_reset"] = (a0) => (Module["_ts_parser_reset"] = wasmExports["ts_parser_reset"])(a0);
        Module["_ts_parser_set_language"] = (a0, a1) => (Module["_ts_parser_set_language"] = wasmExports["ts_parser_set_language"])(a0, a1);
        Module["_ts_parser_timeout_micros"] = (a0) => (Module["_ts_parser_timeout_micros"] = wasmExports["ts_parser_timeout_micros"])(a0);
        Module["_ts_parser_set_timeout_micros"] = (a0, a1, a2) => (Module["_ts_parser_set_timeout_micros"] = wasmExports["ts_parser_set_timeout_micros"])(a0, a1, a2);
        Module["_ts_parser_set_included_ranges"] = (a0, a1, a2) => (Module["_ts_parser_set_included_ranges"] = wasmExports["ts_parser_set_included_ranges"])(a0, a1, a2);
        Module["_memmove"] = (a0, a1, a2) => (Module["_memmove"] = wasmExports["memmove"])(a0, a1, a2);
        Module["_ts_query_new"] = (a0, a1, a2, a3, a4) => (Module["_ts_query_new"] = wasmExports["ts_query_new"])(a0, a1, a2, a3, a4);
        Module["_ts_query_delete"] = (a0) => (Module["_ts_query_delete"] = wasmExports["ts_query_delete"])(a0);
        Module["_iswspace"] = (a0) => (Module["_iswspace"] = wasmExports["iswspace"])(a0);
        Module["_iswalnum"] = (a0) => (Module["_iswalnum"] = wasmExports["iswalnum"])(a0);
        Module["_ts_query_pattern_count"] = (a0) => (Module["_ts_query_pattern_count"] = wasmExports["ts_query_pattern_count"])(a0);
        Module["_ts_query_capture_count"] = (a0) => (Module["_ts_query_capture_count"] = wasmExports["ts_query_capture_count"])(a0);
        Module["_ts_query_string_count"] = (a0) => (Module["_ts_query_string_count"] = wasmExports["ts_query_string_count"])(a0);
        Module["_ts_query_capture_name_for_id"] = (a0, a1, a2) => (Module["_ts_query_capture_name_for_id"] = wasmExports["ts_query_capture_name_for_id"])(a0, a1, a2);
        Module["_ts_query_capture_quantifier_for_id"] = (a0, a1, a2) => (Module["_ts_query_capture_quantifier_for_id"] = wasmExports["ts_query_capture_quantifier_for_id"])(a0, a1, a2);
        Module["_ts_query_string_value_for_id"] = (a0, a1, a2) => (Module["_ts_query_string_value_for_id"] = wasmExports["ts_query_string_value_for_id"])(a0, a1, a2);
        Module["_ts_query_predicates_for_pattern"] = (a0, a1, a2) => (Module["_ts_query_predicates_for_pattern"] = wasmExports["ts_query_predicates_for_pattern"])(a0, a1, a2);
        Module["_ts_query_start_byte_for_pattern"] = (a0, a1) => (Module["_ts_query_start_byte_for_pattern"] = wasmExports["ts_query_start_byte_for_pattern"])(a0, a1);
        Module["_ts_query_end_byte_for_pattern"] = (a0, a1) => (Module["_ts_query_end_byte_for_pattern"] = wasmExports["ts_query_end_byte_for_pattern"])(a0, a1);
        Module["_ts_query_is_pattern_rooted"] = (a0, a1) => (Module["_ts_query_is_pattern_rooted"] = wasmExports["ts_query_is_pattern_rooted"])(a0, a1);
        Module["_ts_query_is_pattern_non_local"] = (a0, a1) => (Module["_ts_query_is_pattern_non_local"] = wasmExports["ts_query_is_pattern_non_local"])(a0, a1);
        Module["_ts_query_is_pattern_guaranteed_at_step"] = (a0, a1) => (Module["_ts_query_is_pattern_guaranteed_at_step"] = wasmExports["ts_query_is_pattern_guaranteed_at_step"])(a0, a1);
        Module["_ts_query_disable_capture"] = (a0, a1, a2) => (Module["_ts_query_disable_capture"] = wasmExports["ts_query_disable_capture"])(a0, a1, a2);
        Module["_ts_query_disable_pattern"] = (a0, a1) => (Module["_ts_query_disable_pattern"] = wasmExports["ts_query_disable_pattern"])(a0, a1);
        Module["_ts_tree_copy"] = (a0) => (Module["_ts_tree_copy"] = wasmExports["ts_tree_copy"])(a0);
        Module["_ts_tree_delete"] = (a0) => (Module["_ts_tree_delete"] = wasmExports["ts_tree_delete"])(a0);
        Module["_ts_init"] = () => (Module["_ts_init"] = wasmExports["ts_init"])();
        Module["_ts_parser_new_wasm"] = () => (Module["_ts_parser_new_wasm"] = wasmExports["ts_parser_new_wasm"])();
        Module["_ts_parser_enable_logger_wasm"] = (a0, a1) => (Module["_ts_parser_enable_logger_wasm"] = wasmExports["ts_parser_enable_logger_wasm"])(a0, a1);
        Module["_ts_parser_parse_wasm"] = (a0, a1, a2, a3, a4) => (Module["_ts_parser_parse_wasm"] = wasmExports["ts_parser_parse_wasm"])(a0, a1, a2, a3, a4);
        Module["_ts_parser_included_ranges_wasm"] = (a0) => (Module["_ts_parser_included_ranges_wasm"] = wasmExports["ts_parser_included_ranges_wasm"])(a0);
        Module["_ts_language_type_is_named_wasm"] = (a0, a1) => (Module["_ts_language_type_is_named_wasm"] = wasmExports["ts_language_type_is_named_wasm"])(a0, a1);
        Module["_ts_language_type_is_visible_wasm"] = (a0, a1) => (Module["_ts_language_type_is_visible_wasm"] = wasmExports["ts_language_type_is_visible_wasm"])(a0, a1);
        Module["_ts_language_supertypes_wasm"] = (a0) => (Module["_ts_language_supertypes_wasm"] = wasmExports["ts_language_supertypes_wasm"])(a0);
        Module["_ts_language_subtypes_wasm"] = (a0, a1) => (Module["_ts_language_subtypes_wasm"] = wasmExports["ts_language_subtypes_wasm"])(a0, a1);
        Module["_ts_tree_root_node_wasm"] = (a0) => (Module["_ts_tree_root_node_wasm"] = wasmExports["ts_tree_root_node_wasm"])(a0);
        Module["_ts_tree_root_node_with_offset_wasm"] = (a0) => (Module["_ts_tree_root_node_with_offset_wasm"] = wasmExports["ts_tree_root_node_with_offset_wasm"])(a0);
        Module["_ts_tree_edit_wasm"] = (a0) => (Module["_ts_tree_edit_wasm"] = wasmExports["ts_tree_edit_wasm"])(a0);
        Module["_ts_tree_included_ranges_wasm"] = (a0) => (Module["_ts_tree_included_ranges_wasm"] = wasmExports["ts_tree_included_ranges_wasm"])(a0);
        Module["_ts_tree_get_changed_ranges_wasm"] = (a0, a1) => (Module["_ts_tree_get_changed_ranges_wasm"] = wasmExports["ts_tree_get_changed_ranges_wasm"])(a0, a1);
        Module["_ts_tree_cursor_new_wasm"] = (a0) => (Module["_ts_tree_cursor_new_wasm"] = wasmExports["ts_tree_cursor_new_wasm"])(a0);
        Module["_ts_tree_cursor_copy_wasm"] = (a0) => (Module["_ts_tree_cursor_copy_wasm"] = wasmExports["ts_tree_cursor_copy_wasm"])(a0);
        Module["_ts_tree_cursor_delete_wasm"] = (a0) => (Module["_ts_tree_cursor_delete_wasm"] = wasmExports["ts_tree_cursor_delete_wasm"])(a0);
        Module["_ts_tree_cursor_reset_wasm"] = (a0) => (Module["_ts_tree_cursor_reset_wasm"] = wasmExports["ts_tree_cursor_reset_wasm"])(a0);
        Module["_ts_tree_cursor_reset_to_wasm"] = (a0, a1) => (Module["_ts_tree_cursor_reset_to_wasm"] = wasmExports["ts_tree_cursor_reset_to_wasm"])(a0, a1);
        Module["_ts_tree_cursor_goto_first_child_wasm"] = (a0) => (Module["_ts_tree_cursor_goto_first_child_wasm"] = wasmExports["ts_tree_cursor_goto_first_child_wasm"])(a0);
        Module["_ts_tree_cursor_goto_last_child_wasm"] = (a0) => (Module["_ts_tree_cursor_goto_last_child_wasm"] = wasmExports["ts_tree_cursor_goto_last_child_wasm"])(a0);
        Module["_ts_tree_cursor_goto_first_child_for_index_wasm"] = (a0) => (Module["_ts_tree_cursor_goto_first_child_for_index_wasm"] = wasmExports["ts_tree_cursor_goto_first_child_for_index_wasm"])(a0);
        Module["_ts_tree_cursor_goto_first_child_for_position_wasm"] = (a0) => (Module["_ts_tree_cursor_goto_first_child_for_position_wasm"] = wasmExports["ts_tree_cursor_goto_first_child_for_position_wasm"])(a0);
        Module["_ts_tree_cursor_goto_next_sibling_wasm"] = (a0) => (Module["_ts_tree_cursor_goto_next_sibling_wasm"] = wasmExports["ts_tree_cursor_goto_next_sibling_wasm"])(a0);
        Module["_ts_tree_cursor_goto_previous_sibling_wasm"] = (a0) => (Module["_ts_tree_cursor_goto_previous_sibling_wasm"] = wasmExports["ts_tree_cursor_goto_previous_sibling_wasm"])(a0);
        Module["_ts_tree_cursor_goto_descendant_wasm"] = (a0, a1) => (Module["_ts_tree_cursor_goto_descendant_wasm"] = wasmExports["ts_tree_cursor_goto_descendant_wasm"])(a0, a1);
        Module["_ts_tree_cursor_goto_parent_wasm"] = (a0) => (Module["_ts_tree_cursor_goto_parent_wasm"] = wasmExports["ts_tree_cursor_goto_parent_wasm"])(a0);
        Module["_ts_tree_cursor_current_node_type_id_wasm"] = (a0) => (Module["_ts_tree_cursor_current_node_type_id_wasm"] = wasmExports["ts_tree_cursor_current_node_type_id_wasm"])(a0);
        Module["_ts_tree_cursor_current_node_state_id_wasm"] = (a0) => (Module["_ts_tree_cursor_current_node_state_id_wasm"] = wasmExports["ts_tree_cursor_current_node_state_id_wasm"])(a0);
        Module["_ts_tree_cursor_current_node_is_named_wasm"] = (a0) => (Module["_ts_tree_cursor_current_node_is_named_wasm"] = wasmExports["ts_tree_cursor_current_node_is_named_wasm"])(a0);
        Module["_ts_tree_cursor_current_node_is_missing_wasm"] = (a0) => (Module["_ts_tree_cursor_current_node_is_missing_wasm"] = wasmExports["ts_tree_cursor_current_node_is_missing_wasm"])(a0);
        Module["_ts_tree_cursor_current_node_id_wasm"] = (a0) => (Module["_ts_tree_cursor_current_node_id_wasm"] = wasmExports["ts_tree_cursor_current_node_id_wasm"])(a0);
        Module["_ts_tree_cursor_start_position_wasm"] = (a0) => (Module["_ts_tree_cursor_start_position_wasm"] = wasmExports["ts_tree_cursor_start_position_wasm"])(a0);
        Module["_ts_tree_cursor_end_position_wasm"] = (a0) => (Module["_ts_tree_cursor_end_position_wasm"] = wasmExports["ts_tree_cursor_end_position_wasm"])(a0);
        Module["_ts_tree_cursor_start_index_wasm"] = (a0) => (Module["_ts_tree_cursor_start_index_wasm"] = wasmExports["ts_tree_cursor_start_index_wasm"])(a0);
        Module["_ts_tree_cursor_end_index_wasm"] = (a0) => (Module["_ts_tree_cursor_end_index_wasm"] = wasmExports["ts_tree_cursor_end_index_wasm"])(a0);
        Module["_ts_tree_cursor_current_field_id_wasm"] = (a0) => (Module["_ts_tree_cursor_current_field_id_wasm"] = wasmExports["ts_tree_cursor_current_field_id_wasm"])(a0);
        Module["_ts_tree_cursor_current_depth_wasm"] = (a0) => (Module["_ts_tree_cursor_current_depth_wasm"] = wasmExports["ts_tree_cursor_current_depth_wasm"])(a0);
        Module["_ts_tree_cursor_current_descendant_index_wasm"] = (a0) => (Module["_ts_tree_cursor_current_descendant_index_wasm"] = wasmExports["ts_tree_cursor_current_descendant_index_wasm"])(a0);
        Module["_ts_tree_cursor_current_node_wasm"] = (a0) => (Module["_ts_tree_cursor_current_node_wasm"] = wasmExports["ts_tree_cursor_current_node_wasm"])(a0);
        Module["_ts_node_symbol_wasm"] = (a0) => (Module["_ts_node_symbol_wasm"] = wasmExports["ts_node_symbol_wasm"])(a0);
        Module["_ts_node_field_name_for_child_wasm"] = (a0, a1) => (Module["_ts_node_field_name_for_child_wasm"] = wasmExports["ts_node_field_name_for_child_wasm"])(a0, a1);
        Module["_ts_node_field_name_for_named_child_wasm"] = (a0, a1) => (Module["_ts_node_field_name_for_named_child_wasm"] = wasmExports["ts_node_field_name_for_named_child_wasm"])(a0, a1);
        Module["_ts_node_children_by_field_id_wasm"] = (a0, a1) => (Module["_ts_node_children_by_field_id_wasm"] = wasmExports["ts_node_children_by_field_id_wasm"])(a0, a1);
        Module["_ts_node_first_child_for_byte_wasm"] = (a0) => (Module["_ts_node_first_child_for_byte_wasm"] = wasmExports["ts_node_first_child_for_byte_wasm"])(a0);
        Module["_ts_node_first_named_child_for_byte_wasm"] = (a0) => (Module["_ts_node_first_named_child_for_byte_wasm"] = wasmExports["ts_node_first_named_child_for_byte_wasm"])(a0);
        Module["_ts_node_grammar_symbol_wasm"] = (a0) => (Module["_ts_node_grammar_symbol_wasm"] = wasmExports["ts_node_grammar_symbol_wasm"])(a0);
        Module["_ts_node_child_count_wasm"] = (a0) => (Module["_ts_node_child_count_wasm"] = wasmExports["ts_node_child_count_wasm"])(a0);
        Module["_ts_node_named_child_count_wasm"] = (a0) => (Module["_ts_node_named_child_count_wasm"] = wasmExports["ts_node_named_child_count_wasm"])(a0);
        Module["_ts_node_child_wasm"] = (a0, a1) => (Module["_ts_node_child_wasm"] = wasmExports["ts_node_child_wasm"])(a0, a1);
        Module["_ts_node_named_child_wasm"] = (a0, a1) => (Module["_ts_node_named_child_wasm"] = wasmExports["ts_node_named_child_wasm"])(a0, a1);
        Module["_ts_node_child_by_field_id_wasm"] = (a0, a1) => (Module["_ts_node_child_by_field_id_wasm"] = wasmExports["ts_node_child_by_field_id_wasm"])(a0, a1);
        Module["_ts_node_next_sibling_wasm"] = (a0) => (Module["_ts_node_next_sibling_wasm"] = wasmExports["ts_node_next_sibling_wasm"])(a0);
        Module["_ts_node_prev_sibling_wasm"] = (a0) => (Module["_ts_node_prev_sibling_wasm"] = wasmExports["ts_node_prev_sibling_wasm"])(a0);
        Module["_ts_node_next_named_sibling_wasm"] = (a0) => (Module["_ts_node_next_named_sibling_wasm"] = wasmExports["ts_node_next_named_sibling_wasm"])(a0);
        Module["_ts_node_prev_named_sibling_wasm"] = (a0) => (Module["_ts_node_prev_named_sibling_wasm"] = wasmExports["ts_node_prev_named_sibling_wasm"])(a0);
        Module["_ts_node_descendant_count_wasm"] = (a0) => (Module["_ts_node_descendant_count_wasm"] = wasmExports["ts_node_descendant_count_wasm"])(a0);
        Module["_ts_node_parent_wasm"] = (a0) => (Module["_ts_node_parent_wasm"] = wasmExports["ts_node_parent_wasm"])(a0);
        Module["_ts_node_child_with_descendant_wasm"] = (a0) => (Module["_ts_node_child_with_descendant_wasm"] = wasmExports["ts_node_child_with_descendant_wasm"])(a0);
        Module["_ts_node_descendant_for_index_wasm"] = (a0) => (Module["_ts_node_descendant_for_index_wasm"] = wasmExports["ts_node_descendant_for_index_wasm"])(a0);
        Module["_ts_node_named_descendant_for_index_wasm"] = (a0) => (Module["_ts_node_named_descendant_for_index_wasm"] = wasmExports["ts_node_named_descendant_for_index_wasm"])(a0);
        Module["_ts_node_descendant_for_position_wasm"] = (a0) => (Module["_ts_node_descendant_for_position_wasm"] = wasmExports["ts_node_descendant_for_position_wasm"])(a0);
        Module["_ts_node_named_descendant_for_position_wasm"] = (a0) => (Module["_ts_node_named_descendant_for_position_wasm"] = wasmExports["ts_node_named_descendant_for_position_wasm"])(a0);
        Module["_ts_node_start_point_wasm"] = (a0) => (Module["_ts_node_start_point_wasm"] = wasmExports["ts_node_start_point_wasm"])(a0);
        Module["_ts_node_end_point_wasm"] = (a0) => (Module["_ts_node_end_point_wasm"] = wasmExports["ts_node_end_point_wasm"])(a0);
        Module["_ts_node_start_index_wasm"] = (a0) => (Module["_ts_node_start_index_wasm"] = wasmExports["ts_node_start_index_wasm"])(a0);
        Module["_ts_node_end_index_wasm"] = (a0) => (Module["_ts_node_end_index_wasm"] = wasmExports["ts_node_end_index_wasm"])(a0);
        Module["_ts_node_to_string_wasm"] = (a0) => (Module["_ts_node_to_string_wasm"] = wasmExports["ts_node_to_string_wasm"])(a0);
        Module["_ts_node_children_wasm"] = (a0) => (Module["_ts_node_children_wasm"] = wasmExports["ts_node_children_wasm"])(a0);
        Module["_ts_node_named_children_wasm"] = (a0) => (Module["_ts_node_named_children_wasm"] = wasmExports["ts_node_named_children_wasm"])(a0);
        Module["_ts_node_descendants_of_type_wasm"] = (a0, a1, a2, a3, a4, a5, a6) => (Module["_ts_node_descendants_of_type_wasm"] = wasmExports["ts_node_descendants_of_type_wasm"])(a0, a1, a2, a3, a4, a5, a6);
        Module["_ts_node_is_named_wasm"] = (a0) => (Module["_ts_node_is_named_wasm"] = wasmExports["ts_node_is_named_wasm"])(a0);
        Module["_ts_node_has_changes_wasm"] = (a0) => (Module["_ts_node_has_changes_wasm"] = wasmExports["ts_node_has_changes_wasm"])(a0);
        Module["_ts_node_has_error_wasm"] = (a0) => (Module["_ts_node_has_error_wasm"] = wasmExports["ts_node_has_error_wasm"])(a0);
        Module["_ts_node_is_error_wasm"] = (a0) => (Module["_ts_node_is_error_wasm"] = wasmExports["ts_node_is_error_wasm"])(a0);
        Module["_ts_node_is_missing_wasm"] = (a0) => (Module["_ts_node_is_missing_wasm"] = wasmExports["ts_node_is_missing_wasm"])(a0);
        Module["_ts_node_is_extra_wasm"] = (a0) => (Module["_ts_node_is_extra_wasm"] = wasmExports["ts_node_is_extra_wasm"])(a0);
        Module["_ts_node_parse_state_wasm"] = (a0) => (Module["_ts_node_parse_state_wasm"] = wasmExports["ts_node_parse_state_wasm"])(a0);
        Module["_ts_node_next_parse_state_wasm"] = (a0) => (Module["_ts_node_next_parse_state_wasm"] = wasmExports["ts_node_next_parse_state_wasm"])(a0);
        Module["_ts_query_matches_wasm"] = (a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10) => (Module["_ts_query_matches_wasm"] = wasmExports["ts_query_matches_wasm"])(a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10);
        Module["_ts_query_captures_wasm"] = (a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10) => (Module["_ts_query_captures_wasm"] = wasmExports["ts_query_captures_wasm"])(a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10);
        Module["_iswalpha"] = (a0) => (Module["_iswalpha"] = wasmExports["iswalpha"])(a0);
        Module["_iswblank"] = (a0) => (Module["_iswblank"] = wasmExports["iswblank"])(a0);
        Module["_iswdigit"] = (a0) => (Module["_iswdigit"] = wasmExports["iswdigit"])(a0);
        Module["_iswlower"] = (a0) => (Module["_iswlower"] = wasmExports["iswlower"])(a0);
        Module["_iswupper"] = (a0) => (Module["_iswupper"] = wasmExports["iswupper"])(a0);
        Module["_iswxdigit"] = (a0) => (Module["_iswxdigit"] = wasmExports["iswxdigit"])(a0);
        Module["_memchr"] = (a0, a1, a2) => (Module["_memchr"] = wasmExports["memchr"])(a0, a1, a2);
        Module["_strlen"] = (a0) => (Module["_strlen"] = wasmExports["strlen"])(a0);
        Module["_strcmp"] = (a0, a1) => (Module["_strcmp"] = wasmExports["strcmp"])(a0, a1);
        Module["_strncat"] = (a0, a1, a2) => (Module["_strncat"] = wasmExports["strncat"])(a0, a1, a2);
        Module["_strncpy"] = (a0, a1, a2) => (Module["_strncpy"] = wasmExports["strncpy"])(a0, a1, a2);
        Module["_towlower"] = (a0) => (Module["_towlower"] = wasmExports["towlower"])(a0);
        Module["_towupper"] = (a0) => (Module["_towupper"] = wasmExports["towupper"])(a0);
        var _setThrew = /* @__PURE__ */ __name((a0, a1) => (_setThrew = wasmExports["setThrew"])(a0, a1), "_setThrew");
        var __emscripten_stack_restore = /* @__PURE__ */ __name((a0) => (__emscripten_stack_restore = wasmExports["_emscripten_stack_restore"])(a0), "__emscripten_stack_restore");
        var __emscripten_stack_alloc = /* @__PURE__ */ __name((a0) => (__emscripten_stack_alloc = wasmExports["_emscripten_stack_alloc"])(a0), "__emscripten_stack_alloc");
        var _emscripten_stack_get_current = /* @__PURE__ */ __name(() => (_emscripten_stack_get_current = wasmExports["emscripten_stack_get_current"])(), "_emscripten_stack_get_current");
        Module["dynCall_jiji"] = (a0, a1, a2, a3, a4) => (Module["dynCall_jiji"] = wasmExports["dynCall_jiji"])(a0, a1, a2, a3, a4);
        Module["_orig$ts_parser_timeout_micros"] = (a0) => (Module["_orig$ts_parser_timeout_micros"] = wasmExports["orig$ts_parser_timeout_micros"])(a0);
        Module["_orig$ts_parser_set_timeout_micros"] = (a0, a1) => (Module["_orig$ts_parser_set_timeout_micros"] = wasmExports["orig$ts_parser_set_timeout_micros"])(a0, a1);
        Module["setValue"] = setValue;
        Module["getValue"] = getValue;
        Module["UTF8ToString"] = UTF8ToString;
        Module["stringToUTF8"] = stringToUTF8;
        Module["lengthBytesUTF8"] = lengthBytesUTF8;
        Module["AsciiToString"] = AsciiToString;
        Module["stringToUTF16"] = stringToUTF16;
        Module["loadWebAssemblyModule"] = loadWebAssemblyModule;
        var calledRun;
        dependenciesFulfilled = /* @__PURE__ */ __name(function runCaller() {
          if (!calledRun) run();
          if (!calledRun) dependenciesFulfilled = runCaller;
        }, "runCaller");
        function callMain(args2 = []) {
          var entryFunction = resolveGlobalSymbol("main").sym;
          if (!entryFunction) return;
          args2.unshift(thisProgram);
          var argc = args2.length;
          var argv = stackAlloc((argc + 1) * 4);
          var argv_ptr = argv;
          args2.forEach((arg) => {
            LE_HEAP_STORE_U32((argv_ptr >> 2) * 4, stringToUTF8OnStack(arg));
            argv_ptr += 4;
          });
          LE_HEAP_STORE_U32((argv_ptr >> 2) * 4, 0);
          try {
            var ret = entryFunction(argc, argv);
            exitJS(
              ret,
              /* implicit = */
              true
            );
            return ret;
          } catch (e) {
            return handleException(e);
          }
        }
        __name(callMain, "callMain");
        function run(args2 = arguments_) {
          if (runDependencies > 0) {
            return;
          }
          preRun();
          if (runDependencies > 0) {
            return;
          }
          function doRun() {
            var _a2;
            if (calledRun) return;
            calledRun = true;
            Module["calledRun"] = true;
            if (ABORT) return;
            initRuntime();
            preMain();
            readyPromiseResolve(Module);
            (_a2 = Module["onRuntimeInitialized"]) == null ? void 0 : _a2.call(Module);
            if (shouldRunNow) callMain(args2);
            postRun();
          }
          __name(doRun, "doRun");
          if (Module["setStatus"]) {
            Module["setStatus"]("Running...");
            setTimeout(function() {
              setTimeout(function() {
                Module["setStatus"]("");
              }, 1);
              doRun();
            }, 1);
          } else {
            doRun();
          }
        }
        __name(run, "run");
        if (Module["preInit"]) {
          if (typeof Module["preInit"] == "function") Module["preInit"] = [Module["preInit"]];
          while (Module["preInit"].length > 0) {
            Module["preInit"].pop()();
          }
        }
        var shouldRunNow = true;
        if (Module["noInitialRun"]) shouldRunNow = false;
        run();
        moduleRtn = readyPromise;
        return moduleRtn;
      };
    })();
    var tree_sitter_default = Module2;
    var Module3 = null;
    async function initializeBinding(moduleOptions) {
      if (!Module3) {
        Module3 = await tree_sitter_default(moduleOptions);
      }
      return Module3;
    }
    __name(initializeBinding, "initializeBinding");
    function checkModule() {
      return !!Module3;
    }
    __name(checkModule, "checkModule");
    var TRANSFER_BUFFER;
    var LANGUAGE_VERSION;
    var MIN_COMPATIBLE_VERSION;
    var Parser = (_h = class {
      /**
       * Create a new parser.
       */
      constructor() {
        /** @internal */
        __publicField(this, 0, 0);
        // Internal handle for WASM
        /** @internal */
        __publicField(this, 1, 0);
        // Internal handle for WASM
        /** @internal */
        __publicField(this, "logCallback", null);
        /** The parser's current language. */
        __publicField(this, "language", null);
        this.initialize();
      }
      /**
       * This must always be called before creating a Parser.
       *
       * You can optionally pass in options to configure the WASM module, the most common
       * one being `locateFile` to help the module find the `.wasm` file.
       */
      static async init(moduleOptions) {
        setModule(await initializeBinding(moduleOptions));
        TRANSFER_BUFFER = C._ts_init();
        LANGUAGE_VERSION = C.getValue(TRANSFER_BUFFER, "i32");
        MIN_COMPATIBLE_VERSION = C.getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32");
      }
      /** @internal */
      initialize() {
        if (!checkModule()) {
          throw new Error("cannot construct a Parser before calling `init()`");
        }
        C._ts_parser_new_wasm();
        this[0] = C.getValue(TRANSFER_BUFFER, "i32");
        this[1] = C.getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32");
      }
      /** Delete the parser, freeing its resources. */
      delete() {
        C._ts_parser_delete(this[0]);
        C._free(this[1]);
        this[0] = 0;
        this[1] = 0;
      }
      /**
       * Set the language that the parser should use for parsing.
       *
       * If the language was not successfully assigned, an error will be thrown.
       * This happens if the language was generated with an incompatible
       * version of the Tree-sitter CLI. Check the language's version using
       * {@link Language#version} and compare it to this library's
       * {@link LANGUAGE_VERSION} and {@link MIN_COMPATIBLE_VERSION} constants.
       */
      setLanguage(language) {
        let address;
        if (!language) {
          address = 0;
          this.language = null;
        } else if (language.constructor === Language) {
          address = language[0];
          const version = C._ts_language_version(address);
          if (version < MIN_COMPATIBLE_VERSION || LANGUAGE_VERSION < version) {
            throw new Error(
              `Incompatible language version ${version}. Compatibility range ${MIN_COMPATIBLE_VERSION} through ${LANGUAGE_VERSION}.`
            );
          }
          this.language = language;
        } else {
          throw new Error("Argument must be a Language");
        }
        C._ts_parser_set_language(this[0], address);
        return this;
      }
      /**
       * Parse a slice of UTF8 text.
       *
       * @param {string | ParseCallback} callback - The UTF8-encoded text to parse or a callback function.
       *
       * @param {Tree | null} [oldTree] - A previous syntax tree parsed from the same document. If the text of the
       *   document has changed since `oldTree` was created, then you must edit `oldTree` to match
       *   the new text using {@link Tree#edit}.
       *
       * @param {ParseOptions} [options] - Options for parsing the text.
       *  This can be used to set the included ranges, or a progress callback.
       *
       * @returns {Tree | null} A {@link Tree} if parsing succeeded, or `null` if:
       *  - The parser has not yet had a language assigned with {@link Parser#setLanguage}.
       *  - The progress callback returned true.
       */
      parse(callback, oldTree, options) {
        if (typeof callback === "string") {
          C.currentParseCallback = (index) => callback.slice(index);
        } else if (typeof callback === "function") {
          C.currentParseCallback = callback;
        } else {
          throw new Error("Argument must be a string or a function");
        }
        if (options == null ? void 0 : options.progressCallback) {
          C.currentProgressCallback = options.progressCallback;
        } else {
          C.currentProgressCallback = null;
        }
        if (this.logCallback) {
          C.currentLogCallback = this.logCallback;
          C._ts_parser_enable_logger_wasm(this[0], 1);
        } else {
          C.currentLogCallback = null;
          C._ts_parser_enable_logger_wasm(this[0], 0);
        }
        let rangeCount = 0;
        let rangeAddress = 0;
        if (options == null ? void 0 : options.includedRanges) {
          rangeCount = options.includedRanges.length;
          rangeAddress = C._calloc(rangeCount, SIZE_OF_RANGE);
          let address = rangeAddress;
          for (let i2 = 0; i2 < rangeCount; i2++) {
            marshalRange(address, options.includedRanges[i2]);
            address += SIZE_OF_RANGE;
          }
        }
        const treeAddress = C._ts_parser_parse_wasm(
          this[0],
          this[1],
          oldTree ? oldTree[0] : 0,
          rangeAddress,
          rangeCount
        );
        if (!treeAddress) {
          C.currentParseCallback = null;
          C.currentLogCallback = null;
          C.currentProgressCallback = null;
          return null;
        }
        if (!this.language) {
          throw new Error("Parser must have a language to parse");
        }
        const result = new Tree(INTERNAL, treeAddress, this.language, C.currentParseCallback);
        C.currentParseCallback = null;
        C.currentLogCallback = null;
        C.currentProgressCallback = null;
        return result;
      }
      /**
       * Instruct the parser to start the next parse from the beginning.
       *
       * If the parser previously failed because of a timeout, cancellation,
       * or callback, then by default, it will resume where it left off on the
       * next call to {@link Parser#parse} or other parsing functions.
       * If you don't want to resume, and instead intend to use this parser to
       * parse some other document, you must call `reset` first.
       */
      reset() {
        C._ts_parser_reset(this[0]);
      }
      /** Get the ranges of text that the parser will include when parsing. */
      getIncludedRanges() {
        C._ts_parser_included_ranges_wasm(this[0]);
        const count = C.getValue(TRANSFER_BUFFER, "i32");
        const buffer = C.getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32");
        const result = new Array(count);
        if (count > 0) {
          let address = buffer;
          for (let i2 = 0; i2 < count; i2++) {
            result[i2] = unmarshalRange(address);
            address += SIZE_OF_RANGE;
          }
          C._free(buffer);
        }
        return result;
      }
      /**
       * @deprecated since version 0.25.0, prefer passing a progress callback to {@link Parser#parse}
       *
       * Get the duration in microseconds that parsing is allowed to take.
       *
       * This is set via {@link Parser#setTimeoutMicros}.
       */
      getTimeoutMicros() {
        return C._ts_parser_timeout_micros(this[0]);
      }
      /**
       * @deprecated since version 0.25.0, prefer passing a progress callback to {@link Parser#parse}
       *
       * Set the maximum duration in microseconds that parsing should be allowed
       * to take before halting.
       *
       * If parsing takes longer than this, it will halt early, returning `null`.
       * See {@link Parser#parse} for more information.
       */
      setTimeoutMicros(timeout) {
        C._ts_parser_set_timeout_micros(this[0], 0, timeout);
      }
      /** Set the logging callback that a parser should use during parsing. */
      setLogger(callback) {
        if (!callback) {
          this.logCallback = null;
        } else if (typeof callback !== "function") {
          throw new Error("Logger callback must be a function");
        } else {
          this.logCallback = callback;
        }
        return this;
      }
      /** Get the parser's current logger. */
      getLogger() {
        return this.logCallback;
      }
    }, __name(_h, "Parser"), _h);
    return {
      CaptureQuantifier,
      LANGUAGE_VERSION,
      Language,
      LookaheadIterator,
      MIN_COMPATIBLE_VERSION,
      Node,
      Parser,
      Query,
      Tree,
      TreeCursor
    };
  });
})(treeSitter);
var treeSitterExports = treeSitter.exports;
const _TreeSitterManager = class _TreeSitterManager {
  /**
   * 获取 WASM 文件所在目录。
   * 在 webpack 构建中，WASM 文件（parser wasm + tree-sitter.wasm）被复制到
   * 输出目录的 parsers/ 子目录下，与 js 文件同级。
   * 通过 __dirname 定位可以同时覆盖 CLI / MCP / VSCode 三种构建。
   */
  static getWasmDir() {
    return path__namespace.join(__dirname, "parsers");
  }
  static async init() {
    if (this.initialized) {
      return;
    }
    await treeSitterExports.Parser.init({
      locateFile: (file) => {
        return path__namespace.join(this.getWasmDir(), file);
      }
    });
    this.parser = new treeSitterExports.Parser();
    this.initialized = true;
  }
  static async getParser() {
    if (!this.initialized) {
      await this.init();
    }
    if (!this.parser) {
      throw new Error("TreeSitterManager: parser is null after initialization");
    }
    return this.parser;
  }
  static async getLanguage(language) {
    if (this.languages.has(language)) {
      return this.languages.get(language);
    }
    const wasmFile = this.getWasmFileName(language);
    if (!wasmFile) {
      return null;
    }
    try {
      const wasmPath = path__namespace.join(this.getWasmDir(), wasmFile);
      const lang = await treeSitterExports.Language.load(wasmPath);
      this.languages.set(language, lang);
      return lang;
    } catch (error) {
      console.error(`TreeSitterManager: Failed to load language ${language}:`, error);
      return null;
    }
  }
  static getWasmFileName(language) {
    const map = {
      "typescript": "tree-sitter-typescript.wasm",
      "tsx": "tree-sitter-tsx.wasm",
      "javascript": "tree-sitter-javascript.wasm",
      "python": "tree-sitter-python.wasm",
      "cpp": "tree-sitter-cpp.wasm",
      "cxx": "tree-sitter-cpp.wasm",
      "c": "tree-sitter-c.wasm",
      "java": "tree-sitter-java.wasm",
      "go": "tree-sitter-go.wasm",
      "rust": "tree-sitter-rust.wasm",
      "kotlin": "tree-sitter-kotlin.wasm",
      "swift": "tree-sitter-swift.wasm",
      "csharp": "tree-sitter-c-sharp.wasm",
      "c_sharp": "tree-sitter-c-sharp.wasm",
      "ruby": "tree-sitter-ruby.wasm",
      "php": "tree-sitter-php.wasm",
      "css": "tree-sitter-css.wasm"
    };
    const key = language.toLowerCase();
    return map[key] !== void 0 ? map[key] : null;
  }
  static clearCache() {
    this.languages.clear();
    this.initialized = false;
    this.parser = null;
  }
};
_TreeSitterManager.parser = null;
_TreeSitterManager.languages = /* @__PURE__ */ new Map();
_TreeSitterManager.initialized = false;
let TreeSitterManager = _TreeSitterManager;
class ASTCache {
  constructor(maxEntries = 100) {
    this.cache = /* @__PURE__ */ new Map();
    this.maxEntries = maxEntries;
  }
  // @contract: get(filePath: string, content: string, language: string) => Promise<any>
  // @step: [生成缓存键] 使用文件路径和语言生成缓存键
  // @step: [检查缓存] 检查缓存中是否存在该 AST
  // @step: [返回缓存] 如果缓存有效，返回缓存的 AST
  // @step: [解析 AST] 如果缓存无效，使用 Tree-sitter 解析并缓存
  // @step: [返回 AST] 返回 AST
  async get(filePath, content, language) {
    const cacheKey = this.getCacheKey(filePath, language);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      console.log(`[ASTCache] 缓存命中: ${cacheKey}`);
      return cached.ast;
    }
    console.log(`[ASTCache] 缓存未命中，解析 AST: ${cacheKey}`);
    const ast = await this.parseAST(content, language);
    if (ast) {
      this.set(cacheKey, ast);
    }
    return ast;
  }
  // @end
  // @contract: parseAST(content: string, language: string) => Promise<any>
  // @step: [初始化] 初始化 Tree-sitter
  // @step: [获取语言] 获取对应语言的 Language
  // @step: [解析] 使用 Tree-sitter 解析代码
  // @step: [返回] 返回 AST 或 null
  async parseAST(content, language) {
    try {
      await TreeSitterManager.init();
      const lang = await TreeSitterManager.getLanguage(language);
      if (!lang) {
        console.warn(`[ASTCache] Tree-sitter 不支持该语言: ${language}`);
        return null;
      }
      const parser = await TreeSitterManager.getParser();
      parser.setLanguage(lang);
      const tree = parser.parse(content);
      return tree;
    } catch (error) {
      console.warn(`[ASTCache] 解析 AST 失败:`, error);
      return null;
    }
  }
  // @end
  // @contract: set(cacheKey: string, ast: any) => void
  // @step: [检查容量] 检查是否超过最大条目数
  // @step: [清理缓存] 如果超过，删除最旧的条目
  // @step: [存储缓存] 存储 AST 到缓存
  set(cacheKey, ast) {
    if (this.cache.size >= this.maxEntries) {
      this.evictOldest();
    }
    this.cache.set(cacheKey, {
      ast,
      timestamp: Date.now()
    });
  }
  // @end
  // @contract: delete(filePath: string) => void
  // @step: [遍历缓存] 遍历所有缓存条目
  // @step: [匹配文件] 找到所有与该文件相关的缓存
  // @step: [删除] 删除这些缓存条目
  delete(filePath) {
    const keysToDelete = [];
    for (const key of this.cache.keys()) {
      if (key.startsWith(filePath + ":")) {
        keysToDelete.push(key);
      }
    }
    for (const key of keysToDelete) {
      this.cache.delete(key);
      console.log(`[ASTCache] 删除缓存: ${key}`);
    }
  }
  // @end
  // @contract: clear() => void
  // @step: [清空缓存] 清空所有缓存
  clear() {
    this.cache.clear();
    console.log(`[ASTCache] 清空所有缓存`);
  }
  // @end
  // @contract: getCacheKey(filePath: string, language: string) => string
  // @step: [生成键] 使用文件路径和语言生成唯一键
  getCacheKey(filePath, language) {
    return `${filePath}:${language}`;
  }
  // @end
  // @contract: evictOldest() => void
  // @step: [找到最旧] 找到时间戳最旧的缓存条目
  // @step: [删除] 删除该条目
  evictOldest() {
    let oldestKey = null;
    let oldestTime = Infinity;
    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }
    if (oldestKey) {
      this.cache.delete(oldestKey);
      console.log(`[ASTCache] LRU 淘汰: ${oldestKey}`);
    }
  }
  // @end
  // @contract: getFromCache(filePath: string) => any | null
  // @step: [遍历缓存] 遍历所有缓存条目
  // @step: [匹配文件] 找到与该文件相关的缓存
  // @step: [返回] 返回 AST 或 null
  getFromCache(filePath) {
    for (const [key, entry] of this.cache.entries()) {
      if (key.startsWith(filePath + ":")) {
        return entry.ast;
      }
    }
    return null;
  }
  // @end
  // @contract: getSize() => number
  // @step: [返回大小] 返回缓存条目数量
  getSize() {
    return this.cache.size;
  }
  // @end
  // @contract: getMaxSize() => number
  // @step: [返回最大容量] 返回最大条目数
  getMaxSize() {
    return this.maxEntries;
  }
  // @end
  // @contract: getStats() => { count: number, maxEntries: number }
  // @step: [返回统计] 返回缓存统计信息
  getStats() {
    return {
      count: this.cache.size,
      maxEntries: this.maxEntries
    };
  }
  // @end
}
class DefinitionCache {
  constructor(maxEntries = 500) {
    this.functionCache = /* @__PURE__ */ new Map();
    this.typeCache = /* @__PURE__ */ new Map();
    this.maxEntries = maxEntries;
  }
  // @contract: getFunction(functionName: string, filePath: string) => any | null
  // @step: [生成缓存键] 使用函数名和文件路径生成缓存键
  // @step: [检查缓存] 检查缓存中是否存在该函数定义
  // @step: [返回缓存] 如果缓存有效，返回缓存的定义
  getFunction(functionName, filePath) {
    const cacheKey = this.getCacheKey(functionName, filePath);
    const cached = this.functionCache.get(cacheKey);
    if (cached) {
      console.log(`[DefinitionCache] 函数缓存命中: ${cacheKey}`);
      return cached.definition;
    }
    return null;
  }
  // @end
  // @contract: setFunction(functionName: string, filePath: string, definition: any) => void
  // @step: [检查容量] 检查是否超过最大条目数
  // @step: [清理缓存] 如果超过，删除最旧的条目
  // @step: [存储缓存] 存储函数定义到缓存
  setFunction(functionName, filePath, definition) {
    if (this.functionCache.size >= this.maxEntries) {
      this.evictOldestFunction();
    }
    const cacheKey = this.getCacheKey(functionName, filePath);
    this.functionCache.set(cacheKey, {
      definition,
      timestamp: Date.now(),
      filePath
    });
    console.log(`[DefinitionCache] 缓存函数定义: ${cacheKey}`);
  }
  // @end
  // @contract: getType(typeName: string, filePath: string) => any | null
  // @step: [生成缓存键] 使用类型名和文件路径生成缓存键
  // @step: [检查缓存] 检查缓存中是否存在该类型定义
  // @step: [返回缓存] 如果缓存有效，返回缓存的定义
  getType(typeName, filePath) {
    const cacheKey = this.getCacheKey(typeName, filePath);
    const cached = this.typeCache.get(cacheKey);
    if (cached) {
      console.log(`[DefinitionCache] 类型缓存命中: ${cacheKey}`);
      return cached.definition;
    }
    return null;
  }
  // @end
  // @contract: setType(typeName: string, filePath: string, definition: any) => void
  // @step: [检查容量] 检查是否超过最大条目数
  // @step: [清理缓存] 如果超过，删除最旧的条目
  // @step: [存储缓存] 存储类型定义到缓存
  setType(typeName, filePath, definition) {
    if (this.typeCache.size >= this.maxEntries) {
      this.evictOldestType();
    }
    const cacheKey = this.getCacheKey(typeName, filePath);
    this.typeCache.set(cacheKey, {
      definition,
      timestamp: Date.now(),
      filePath
    });
    console.log(`[DefinitionCache] 缓存类型定义: ${cacheKey}`);
  }
  // @end
  // @contract: deleteByFile(filePath: string) => void
  // @step: [遍历函数缓存] 遍历所有函数缓存条目
  // @step: [匹配文件] 找到所有与该文件相关的缓存
  // @step: [删除] 删除这些缓存条目
  // @step: [遍历类型缓存] 遍历所有类型缓存条目
  // @step: [匹配文件] 找到所有与该文件相关的缓存
  // @step: [删除] 删除这些缓存条目
  deleteByFile(filePath) {
    const functionKeysToDelete = [];
    const typeKeysToDelete = [];
    for (const [key, entry] of this.functionCache.entries()) {
      if (entry.filePath === filePath) {
        functionKeysToDelete.push(key);
      }
    }
    for (const [key, entry] of this.typeCache.entries()) {
      if (entry.filePath === filePath) {
        typeKeysToDelete.push(key);
      }
    }
    for (const key of functionKeysToDelete) {
      this.functionCache.delete(key);
      console.log(`[DefinitionCache] 删除函数缓存: ${key}`);
    }
    for (const key of typeKeysToDelete) {
      this.typeCache.delete(key);
      console.log(`[DefinitionCache] 删除类型缓存: ${key}`);
    }
  }
  // @end
  // @contract: clear() => void
  // @step: [清空函数缓存] 清空所有函数缓存
  // @step: [清空类型缓存] 清空所有类型缓存
  clear() {
    this.functionCache.clear();
    this.typeCache.clear();
    console.log(`[DefinitionCache] 清空所有缓存`);
  }
  // @end
  // @contract: getCacheKey(name: string, filePath: string) => string
  // @step: [生成键] 使用名称和文件路径生成唯一键
  getCacheKey(name2, filePath) {
    return `${filePath}:${name2}`;
  }
  // @end
  // @contract: evictOldestFunction() => void
  // @step: [找到最旧] 找到时间戳最旧的函数缓存条目
  // @step: [删除] 删除该条目
  evictOldestFunction() {
    let oldestKey = null;
    let oldestTime = Infinity;
    for (const [key, entry] of this.functionCache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }
    if (oldestKey) {
      this.functionCache.delete(oldestKey);
      console.log(`[DefinitionCache] LRU 淘汰函数: ${oldestKey}`);
    }
  }
  // @end
  // @contract: evictOldestType() => void
  // @step: [找到最旧] 找到时间戳最旧的类型缓存条目
  // @step: [删除] 删除该条目
  evictOldestType() {
    let oldestKey = null;
    let oldestTime = Infinity;
    for (const [key, entry] of this.typeCache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }
    if (oldestKey) {
      this.typeCache.delete(oldestKey);
      console.log(`[DefinitionCache] LRU 淘汰类型: ${oldestKey}`);
    }
  }
  // @end
  // @contract: deleteFunction(functionName: string, filePath: string) => void
  // @step: [生成缓存键] 使用函数名和文件路径生成缓存键
  // @step: [删除缓存] 从缓存中删除该函数定义
  deleteFunction(functionName, filePath) {
    const cacheKey = this.getCacheKey(functionName, filePath);
    this.functionCache.delete(cacheKey);
  }
  // @end
  // @contract: deleteType(typeName: string, filePath: string) => void
  // @step: [生成缓存键] 使用类型名和文件路径生成缓存键
  // @step: [删除缓存] 从缓存中删除该类型定义
  deleteType(typeName, filePath) {
    const cacheKey = this.getCacheKey(typeName, filePath);
    this.typeCache.delete(cacheKey);
  }
  // @end
  // @contract: getFunctionCount() => number
  // @step: [返回数量] 返回函数缓存数量
  getFunctionCount() {
    return this.functionCache.size;
  }
  // @end
  // @contract: getTypeCount() => number
  // @step: [返回数量] 返回类型缓存数量
  getTypeCount() {
    return this.typeCache.size;
  }
  // @end
  // @contract: getMaxSize() => number
  // @step: [返回最大容量] 返回最大条目数
  getMaxSize() {
    return this.maxEntries;
  }
  // @end
  // @contract: getStats() => { functionCount: number, typeCount: number, maxEntries: number }
  // @step: [返回统计] 返回缓存统计信息
  getStats() {
    return {
      functionCount: this.functionCache.size,
      typeCount: this.typeCache.size,
      maxEntries: this.maxEntries
    };
  }
  // @end
}
class CacheRepositoryImpl {
  constructor(fileContentCacheMaxSizeMB = 50, astCacheMaxEntries = 100, definitionCacheMaxEntries = 500) {
    this.fileContentCache = new FileContentCache(fileContentCacheMaxSizeMB);
    this.astCache = new ASTCache(astCacheMaxEntries);
    this.definitionCache = new DefinitionCache(definitionCacheMaxEntries);
  }
  /** 获取全局单例。第一次调用时按默认参数初始化。 */
  static getInstance() {
    if (!CacheRepositoryImpl.instance) {
      CacheRepositoryImpl.instance = new CacheRepositoryImpl();
    }
    return CacheRepositoryImpl.instance;
  }
  // ==================== ICacheRepository 接口实现 ====================
  // @contract: get<T>(key: string) => Promise<T | null>
  async get(key) {
    const [type, ...rest] = key.split(":");
    const identifier = rest.join(":");
    switch (type) {
      case "file":
        try {
          const content = await this.fileContentCache.get(identifier);
          return content;
        } catch {
          return null;
        }
      case "ast":
        return this.astCache.getFromCache(identifier);
      case "func":
        const [funcName, filePath] = identifier.split(":");
        return this.definitionCache.getFunction(funcName, filePath);
      case "type":
        const [typeName, typeFilePath] = identifier.split(":");
        return this.definitionCache.getType(typeName, typeFilePath);
      default:
        return null;
    }
  }
  async set(key, value, _ttl) {
    const [type, ...rest] = key.split(":");
    const identifier = rest.join(":");
    switch (type) {
      case "file":
        break;
      case "ast":
        break;
      case "func":
        const [funcName, filePath] = identifier.split(":");
        this.definitionCache.setFunction(funcName, filePath, value);
        break;
      case "type":
        const [typeName, typeFilePath] = identifier.split(":");
        this.definitionCache.setType(typeName, typeFilePath, value);
        break;
    }
  }
  async delete(key) {
    const [type, ...rest] = key.split(":");
    const identifier = rest.join(":");
    switch (type) {
      case "file":
        this.fileContentCache.delete(identifier);
        break;
      case "ast":
        this.astCache.delete(identifier);
        break;
      case "func":
        const [funcName, filePath] = identifier.split(":");
        this.definitionCache.deleteFunction(funcName, filePath);
        break;
      case "type":
        const [typeName, typeFilePath] = identifier.split(":");
        this.definitionCache.deleteType(typeName, typeFilePath);
        break;
    }
  }
  async has(key) {
    const value = await this.get(key);
    return value !== null;
  }
  async clear() {
    this.fileContentCache.clear();
    this.astCache.clear();
    this.definitionCache.clear();
  }
  async getStats() {
    const fileContentStats = {
      size: this.fileContentCache.getCurrentSize(),
      count: this.fileContentCache.getEntryCount(),
      maxCapacity: this.fileContentCache.getMaxSize()
    };
    const astStats = {
      size: 0,
      count: this.astCache.getSize(),
      maxCapacity: this.astCache.getMaxSize()
    };
    const definitionStats = {
      functionCount: this.definitionCache.getFunctionCount(),
      typeCount: this.definitionCache.getTypeCount(),
      maxCapacity: this.definitionCache.getMaxSize()
    };
    return {
      fileContent: fileContentStats,
      ast: astStats,
      definition: definitionStats
    };
  }
  async invalidateFile(filePath) {
    this.fileContentCache.delete(filePath);
  }
  async invalidateAST(filePath) {
    this.astCache.delete(filePath);
  }
  async invalidateDefinitions(filePath) {
    this.definitionCache.deleteByFile(filePath);
  }
  // ==================== 便捷方法（供 searchers 静态调用） ====================
  /** 读取文件内容（缓存自动管理：命中返回，未命中读取+缓存） */
  async getFileContent(filePath) {
    return this.fileContentCache.get(filePath);
  }
  /** 查询缓存的函数定义 */
  getFunction(functionName, filePath) {
    return this.definitionCache.getFunction(functionName, filePath);
  }
  /** 缓存函数定义 */
  setFunction(functionName, filePath, definition) {
    this.definitionCache.setFunction(functionName, filePath, definition);
  }
  /** 查询缓存的类型定义 */
  getType(typeName, filePath) {
    return this.definitionCache.getType(typeName, filePath);
  }
  /** 缓存类型定义 */
  setType(typeName, filePath, definition) {
    this.definitionCache.setType(typeName, filePath, definition);
  }
}
class FunctionDefinitionSearcher {
  // @contract: searchInFile(functionName: string, filePath: string, language?: string) => Promise<FunctionDefinitionResult | null>
  // @step: [读取文件] 读取指定文件内容
  // @step: [检测语言] 如果提供了 language，使用 Tree-sitter 方案
  // @step: [调用方法] 调用 searchWithTreeSitter 或 searchWithRegex
  // @step: [返回] 返回函数定义结果或 null
  // @boundary: 当文件不存在时，返回 null
  // @boundary: 当函数未找到时，返回 null
  static async searchInFile(functionName, filePath, language) {
    const cache = CacheRepositoryImpl.getInstance();
    try {
      const cached = cache.getFunction(functionName, filePath);
      if (cached) {
        return cached;
      }
      console.log(`[FunctionDefinitionSearcher] 搜索函数定义: ${functionName} 在文件: ${filePath}`);
      const content = await cache.getFileContent(filePath);
      let result = null;
      if (language) {
        result = await this.searchWithTreeSitter(functionName, content, language);
      } else {
        result = this.searchWithRegex(functionName, content);
      }
      if (result) {
        cache.setFunction(functionName, filePath, result);
      }
      return result;
    } catch (error) {
      console.warn(`[FunctionDefinitionSearcher] 搜索失败:`, error);
      return null;
    }
  }
  // @end
  // @contract: searchWithTreeSitter(functionName: string, content: string, language: string) => Promise<FunctionDefinitionResult | null>
  // @step: [初始化] 初始化 Tree-sitter parser
  // @step: [解析代码] 使用 Tree-sitter 解析代码生成 AST
  // @step: [遍历 AST] 递归遍历 AST 查找函数定义节点
  // @step: [匹配名称] 检查函数名称是否匹配
  // @step: [提取代码] 提取完整的函数定义代码（包含前面的注释）
  // @step: [返回] 返回函数定义结果或 null
  // @boundary: 当 Tree-sitter 初始化失败时，回退到正则方案
  // @boundary: 当语言不支持时，回退到正则方案
  static async searchWithTreeSitter(functionName, content, language) {
    try {
      await TreeSitterManager.init();
      const lang = await TreeSitterManager.getLanguage(language);
      if (!lang) {
        console.warn("[FunctionDefinitionSearcher] Tree-sitter 不支持该语言，回退到正则方案");
        return this.searchWithRegex(functionName, content);
      }
      const parser = await TreeSitterManager.getParser();
      parser.setLanguage(lang);
      const tree = parser.parse(content);
      if (!tree) {
        console.warn("[FunctionDefinitionSearcher] Tree-sitter 解析失败，回退到正则方案");
        return this.searchWithRegex(functionName, content);
      }
      const result = this.findFunctionNode(tree.rootNode, functionName, language, content);
      if (result) {
        console.log(`[FunctionDefinitionSearcher] 找到函数定义: ${functionName}`);
        return result;
      }
      console.log(`[FunctionDefinitionSearcher] 未找到函数定义: ${functionName}`);
      return null;
    } catch (error) {
      console.warn("[FunctionDefinitionSearcher] Tree-sitter 提取失败，回退到正则方案:", error);
      return this.searchWithRegex(functionName, content);
    }
  }
  // @end
  // @contract: findFunctionNode(node: any, functionName: string, language: string, content: string) => FunctionDefinitionResult | null
  // @step: [检查节点类型] 检查当前节点是否是函数定义节点
  // @step: [提取名称] 从节点中提取函数名称
  // @step: [匹配名称] 比较名称是否匹配
  // @step: [提取代码] 提取完整的函数代码（包含前面的注释）
  // @step: [递归查找] 如果不匹配，递归查找子节点
  // @step: [返回] 返回匹配的结果或 null
  static findFunctionNode(node, functionName, language, content) {
    const lang = language.toLowerCase();
    if (lang === "typescript" || lang === "javascript" || lang === "tsx") {
      const functionNodeTypes = [
        "function_declaration",
        "method_definition",
        "lexical_declaration",
        "variable_declarator"
      ];
      if (functionNodeTypes.includes(node.type)) {
        const nameNode = node.children.find(
          (c) => c.type === "identifier" || c.type === "property_identifier"
        );
        if (nameNode && nameNode.text === functionName) {
          return this.extractFunctionCode(node, content);
        }
      }
    } else if (lang === "python") {
      if (node.type === "function_definition") {
        const nameNode = node.children.find((c) => c.type === "identifier");
        if (nameNode && nameNode.text === functionName) {
          return this.extractFunctionCode(node, content);
        }
      }
    } else if (lang === "go") {
      if (node.type === "function_declaration" || node.type === "method_declaration") {
        const nameNode = node.children.find((c) => c.type === "identifier");
        if (nameNode && nameNode.text === functionName) {
          return this.extractFunctionCode(node, content);
        }
      }
    }
    for (const child of node.children) {
      const result = this.findFunctionNode(child, functionName, language, content);
      if (result) {
        return result;
      }
    }
    return null;
  }
  // @end
  static extractFunctionCode(node, content) {
    const lines = content.split("\n");
    const startLine = node.startPosition.row;
    const endLine = node.endPosition.row;
    let commentStartLine = startLine;
    for (let i2 = startLine - 1; i2 >= 0; i2--) {
      const line = lines[i2].trim();
      if (line.startsWith("//") || line.startsWith("#") || line.startsWith("/*") || line.startsWith("*")) {
        commentStartLine = i2;
      } else if (line === "") {
        continue;
      } else {
        break;
      }
    }
    const codeLines = lines.slice(commentStartLine, endLine + 1);
    const code = codeLines.join("\n");
    let contract;
    for (const line of codeLines) {
      if (line.includes("@contract:")) {
        contract = line.trim();
        break;
      }
    }
    return {
      functionName: node.text.split("(")[0].trim().split(" ").pop() || "",
      code,
      startLine: commentStartLine,
      endLine,
      contract
    };
  }
  static searchWithRegex(functionName, content) {
    const patterns = [
      new RegExp(`^\\s*(export\\s+)?(async\\s+)?function\\s+${functionName}\\s*\\(`, "m"),
      new RegExp(`^\\s*(export\\s+)?const\\s+${functionName}\\s*=\\s*(async\\s*)?\\(`, "m"),
      new RegExp(`^\\s*(async\\s+)?${functionName}\\s*\\(`, "m"),
      new RegExp(`^\\s*def\\s+${functionName}\\s*\\(`, "m"),
      new RegExp(`^\\s*func\\s+${functionName}\\s*\\(`, "m")
    ];
    for (const pattern of patterns) {
      const match = pattern.exec(content);
      if (match) {
        return this.extractFunctionCodeWithRegex(match.index, content, functionName);
      }
    }
    return null;
  }
  static extractFunctionCodeWithRegex(startIndex, content, functionName) {
    const lines = content.split("\n");
    let currentIndex = 0;
    let startLine = 0;
    for (let i2 = 0; i2 < lines.length; i2++) {
      if (currentIndex + lines[i2].length >= startIndex) {
        startLine = i2;
        break;
      }
      currentIndex += lines[i2].length + 1;
    }
    let commentStartLine = startLine;
    for (let i2 = startLine - 1; i2 >= 0; i2--) {
      const line = lines[i2].trim();
      if (line.startsWith("//") || line.startsWith("#") || line.startsWith("/*") || line.startsWith("*")) {
        commentStartLine = i2;
      } else if (line === "") {
        continue;
      } else {
        break;
      }
    }
    let braceCount = 0;
    let inFunction = false;
    let endLine = startLine;
    for (let i2 = startLine; i2 < lines.length; i2++) {
      const line = lines[i2];
      for (const char of line) {
        if (char === "{") {
          braceCount++;
          inFunction = true;
        } else if (char === "}") {
          braceCount--;
        }
      }
      if (inFunction && braceCount === 0) {
        endLine = i2;
        break;
      }
    }
    const codeLines = lines.slice(commentStartLine, endLine + 1);
    const code = codeLines.join("\n");
    let contract;
    for (const line of codeLines) {
      if (line.includes("@contract:")) {
        contract = line.trim();
        break;
      }
    }
    return {
      functionName,
      code,
      startLine: commentStartLine,
      endLine,
      contract
    };
  }
}
class TypeDefinitionSearcher {
  // @contract: searchInFile(typeName: string, filePath: string, language?: string) => Promise<string | null>
  // @step: [读取文件] 读取指定文件内容
  // @step: [检测语言] 如果提供了 language，使用 Tree-sitter 方案
  // @step: [调用方法] 调用 searchWithTreeSitter 或 searchWithRegex
  // @step: [返回] 返回类型定义文本或 null
  // @boundary: 当文件不存在时，返回 null
  // @boundary: 当类型未找到时，返回 null
  static async searchInFile(typeName, filePath, language) {
    const cache = CacheRepositoryImpl.getInstance();
    try {
      const cached = cache.getType(typeName, filePath);
      if (cached) {
        return cached;
      }
      console.log(`[TypeDefinitionSearcher] 搜索类型定义: ${typeName} 在文件: ${filePath}`);
      const content = await cache.getFileContent(filePath);
      console.log(`[TypeDefinitionSearcher] 文件内容长度: ${content.length}`);
      let result = null;
      if (language) {
        result = await this.searchWithTreeSitter(typeName, content, language);
      } else {
        result = this.searchWithRegex(typeName, content);
      }
      if (result) {
        cache.setType(typeName, filePath, result);
      }
      return result;
    } catch (error) {
      return null;
    }
  }
  // @end
  // @contract: searchWithTreeSitter(typeName: string, content: string, language: string) => Promise<string | null>
  // @step: [初始化] 初始化 Tree-sitter parser
  // @step: [解析代码] 使用 Tree-sitter 解析代码生成 AST
  // @step: [遍历 AST] 递归遍历 AST 查找类型定义节点
  // @step: [匹配名称] 检查类型名称是否匹配
  // @step: [提取文本] 提取完整的类型定义文本
  // @step: [返回] 返回类型定义文本或 null
  // @boundary: 当 Tree-sitter 初始化失败时，回退到正则方案
  // @boundary: 当语言不支持时，回退到正则方案
  static async searchWithTreeSitter(typeName, content, language) {
    try {
      await TreeSitterManager.init();
      const lang = await TreeSitterManager.getLanguage(language);
      if (!lang) {
        console.warn("[TypeDefinitionSearcher] Tree-sitter 不支持该语言，回退到正则方案");
        return this.searchWithRegex(typeName, content);
      }
      const parser = await TreeSitterManager.getParser();
      parser.setLanguage(lang);
      const tree = parser.parse(content);
      if (!tree) {
        console.warn("[TypeDefinitionSearcher] Tree-sitter 解析失败，回退到正则方案");
        return this.searchWithRegex(typeName, content);
      }
      const result = this.findTypeDefinitionNode(tree.rootNode, typeName, language);
      if (result) {
        console.log(`[TypeDefinitionSearcher] 找到类型定义: ${typeName}`);
        return result.text;
      }
      console.log(`[TypeDefinitionSearcher] 未找到类型定义: ${typeName}`);
      return null;
    } catch (error) {
      console.warn("[TypeDefinitionSearcher] Tree-sitter 提取失败，回退到正则方案:", error);
      return this.searchWithRegex(typeName, content);
    }
  }
  // @end
  // @contract: findTypeDefinitionNode(node: any, typeName: string, language: string) => any | null
  // @step: [检查节点类型] 检查当前节点是否是类型定义节点
  // @step: [提取名称] 从节点中提取类型名称
  // @step: [匹配名称] 比较名称是否匹配
  // @step: [递归查找] 如果不匹配，递归查找子节点
  // @step: [返回] 返回匹配的节点或 null
  static findTypeDefinitionNode(node, typeName, language) {
    const lang = language.toLowerCase();
    if (lang === "typescript" || lang === "javascript" || lang === "tsx") {
      const typeNodeTypes = [
        "interface_declaration",
        "type_alias_declaration",
        "class_declaration",
        "enum_declaration"
      ];
      if (typeNodeTypes.includes(node.type)) {
        const nameNode = node.children.find((c) => c.type === "type_identifier" || c.type === "identifier");
        if (nameNode && nameNode.text === typeName) {
          return node;
        }
      }
    } else if (lang === "python") {
      if (node.type === "class_definition") {
        const nameNode = node.children.find((c) => c.type === "identifier");
        if (nameNode && nameNode.text === typeName) {
          return node;
        }
      }
    } else if (lang === "go") {
      if (node.type === "type_declaration" || node.type === "type_spec") {
        const nameNode = node.children.find((c) => c.type === "type_identifier");
        if (nameNode && nameNode.text === typeName) {
          return node;
        }
      }
    } else if (lang === "cpp" || lang === "c") {
      const typeNodeTypes = ["struct_specifier", "class_specifier", "enum_specifier"];
      if (typeNodeTypes.includes(node.type)) {
        const nameNode = node.children.find((c) => c.type === "type_identifier");
        if (nameNode && nameNode.text === typeName) {
          return node;
        }
      }
    }
    for (const child of node.children) {
      const result = this.findTypeDefinitionNode(child, typeName, language);
      if (result) {
        return result;
      }
    }
    return null;
  }
  // @end
  // @contract: searchWithRegex(typeName: string, content: string) => string | null
  // @step: [搜索类型定义] 使用正则搜索 interface/type/class/enum TypeName
  // @step: [提取定义块] 提取完整的类型定义代码
  // @step: [返回] 返回类型定义文本或 null
  static searchWithRegex(typeName, content) {
    const typeDefRegex = new RegExp(`^\\s*(export\\s+)?(interface|type|class|enum)\\s+${typeName}\\b`, "m");
    const match = typeDefRegex.exec(content);
    if (!match) {
      console.log(`[TypeDefinitionSearcher] 未找到类型定义: ${typeName}`);
      return null;
    }
    console.log(`[TypeDefinitionSearcher] 找到类型定义: ${typeName} at index ${match.index}`);
    const startIndex = match.index;
    const lines = content.split("\n");
    let currentIndex = 0;
    let startLine = 0;
    for (let i2 = 0; i2 < lines.length; i2++) {
      if (currentIndex + lines[i2].length >= startIndex) {
        startLine = i2;
        break;
      }
      currentIndex += lines[i2].length + 1;
    }
    let definition = "";
    let braceCount = 0;
    let inDefinition = false;
    for (let i2 = startLine; i2 < lines.length; i2++) {
      const line = lines[i2];
      definition += line + "\n";
      for (const char of line) {
        if (char === "{") {
          braceCount++;
          inDefinition = true;
        } else if (char === "}") {
          braceCount--;
        }
      }
      if (!inDefinition && line.includes("=") && (line.trim().endsWith(";") || line.trim().endsWith(","))) {
        break;
      }
      if (inDefinition && braceCount === 0) {
        break;
      }
    }
    return definition.trim();
  }
  // @end
}
const _LanguageConfig = class _LanguageConfig {
  static getLanguageName(languageId) {
    return this.LANGUAGE_MAP[languageId] || "typescript";
  }
  static getFileExtensions(language) {
    return this.EXTENSION_MAP[language.toLowerCase()] || [];
  }
  static getCommentPrefixes(language) {
    return this.COMMENT_PREFIXES[language.toLowerCase()] || ["//"];
  }
  static getCommentBlockDelimiters(language) {
    return this.COMMENT_BLOCK_DELIMITERS[language.toLowerCase()] || null;
  }
  static getBuiltinFunctions(language) {
    return this.BUILTIN_FUNCTIONS[language.toLowerCase()] || /* @__PURE__ */ new Set();
  }
  static getBuiltinTypes(_language) {
    return this.BUILTIN_TYPES;
  }
  static getLanguageFromExtension(extension2) {
    const ext = extension2.toLowerCase();
    for (const [language, extensions] of Object.entries(this.EXTENSION_MAP)) {
      if (extensions.includes(ext)) {
        return language;
      }
    }
    return null;
  }
};
_LanguageConfig.LANGUAGE_MAP = {
  "typescript": "typescript",
  "typescriptreact": "tsx",
  "javascript": "javascript",
  "javascriptreact": "javascript",
  "python": "python",
  "cpp": "cpp",
  "c": "c",
  "java": "java",
  "go": "go",
  "rust": "rust",
  "kotlin": "kotlin",
  "swift": "swift",
  "csharp": "csharp",
  "ruby": "ruby",
  "php": "php",
  "css": "css",
  "scss": "scss",
  "sass": "sass",
  "less": "less"
};
_LanguageConfig.EXTENSION_MAP = {
  "typescript": [".ts"],
  "tsx": [".tsx"],
  "javascript": [".js", ".jsx", ".mjs", ".cjs"],
  "python": [".py"],
  "cpp": [".cpp", ".cc", ".cxx", ".hpp"],
  "c": [".c", ".h"],
  "java": [".java"],
  "go": [".go"],
  "rust": [".rs"],
  "kotlin": [".kt"],
  "swift": [".swift"],
  "csharp": [".cs"],
  "ruby": [".rb"],
  "php": [".php"],
  "css": [".css"],
  "scss": [".scss"],
  "sass": [".sass"],
  "less": [".less"]
};
_LanguageConfig.COMMENT_PREFIXES = {
  "typescript": ["//"],
  "tsx": ["//"],
  "javascript": ["//"],
  "python": ["#"],
  "cpp": ["//"],
  "c": ["//"],
  "java": ["//"],
  "go": ["//"],
  "rust": ["//"],
  "kotlin": ["//"],
  "swift": ["//"],
  "csharp": ["//"],
  "ruby": ["#"],
  "php": ["//"],
  "css": ["/*"],
  "scss": ["//", "/*"],
  "sass": ["//", "/*"],
  "less": ["//", "/*"]
};
_LanguageConfig.COMMENT_BLOCK_DELIMITERS = {
  "typescript": { start: "/**", end: " */", linePrefix: " *" },
  "tsx": { start: "/**", end: " */", linePrefix: " *" },
  "javascript": { start: "/**", end: " */", linePrefix: " *" },
  "java": { start: "/**", end: " */", linePrefix: " *" },
  "kotlin": { start: "/**", end: " */", linePrefix: " *" },
  "swift": { start: "/**", end: " */", linePrefix: " *" },
  "c": { start: "/**", end: " */", linePrefix: " *" },
  "cpp": { start: "/**", end: " */", linePrefix: " *" },
  "go": { start: "/**", end: " */", linePrefix: " *" },
  "rust": { start: "/**", end: " */", linePrefix: " *" },
  "css": { start: "/**", end: " */", linePrefix: " *" },
  "scss": { start: "/**", end: " */", linePrefix: " *" },
  "sass": { start: "/**", end: " */", linePrefix: " *" },
  "less": { start: "/**", end: " */", linePrefix: " *" }
};
_LanguageConfig.BUILTIN_FUNCTIONS = {
  "typescript": /* @__PURE__ */ new Set([
    "console",
    "log",
    "error",
    "warn",
    "info",
    "debug",
    "setTimeout",
    "setInterval",
    "clearTimeout",
    "clearInterval",
    "parseInt",
    "parseFloat",
    "isNaN",
    "isFinite",
    "Array",
    "Object",
    "String",
    "Number",
    "Boolean",
    "Date",
    "Math",
    "JSON",
    "Promise",
    "Map",
    "Set",
    "WeakMap",
    "WeakSet",
    "require",
    "import",
    "export",
    "typeof",
    "instanceof"
  ]),
  "javascript": /* @__PURE__ */ new Set([
    "console",
    "log",
    "error",
    "warn",
    "info",
    "debug",
    "setTimeout",
    "setInterval",
    "clearTimeout",
    "clearInterval",
    "parseInt",
    "parseFloat",
    "isNaN",
    "isFinite",
    "Array",
    "Object",
    "String",
    "Number",
    "Boolean",
    "Date",
    "Math",
    "JSON",
    "Promise",
    "Map",
    "Set",
    "WeakMap",
    "WeakSet",
    "require",
    "import",
    "export",
    "typeof",
    "instanceof"
  ]),
  "python": /* @__PURE__ */ new Set([
    "print",
    "len",
    "range",
    "enumerate",
    "zip",
    "map",
    "filter",
    "reduce",
    "sorted",
    "reversed",
    "sum",
    "min",
    "max",
    "abs",
    "round",
    "pow",
    "open",
    "input",
    "type",
    "isinstance",
    "hasattr",
    "getattr",
    "setattr",
    "dir",
    "help",
    "id",
    "hash",
    "hex",
    "oct",
    "bin",
    "chr",
    "ord",
    "str",
    "int",
    "float",
    "bool",
    "list",
    "dict",
    "tuple",
    "set"
  ]),
  "go": /* @__PURE__ */ new Set([
    "make",
    "len",
    "cap",
    "append",
    "copy",
    "delete",
    "panic",
    "recover",
    "close",
    "new",
    "println",
    "printf",
    "print"
  ]),
  "cpp": /* @__PURE__ */ new Set([
    "printf",
    "scanf",
    "malloc",
    "free",
    "sizeof",
    "strlen",
    "strcpy",
    "strcmp",
    "memcpy",
    "memset",
    "fopen",
    "fclose",
    "fread",
    "fwrite",
    "fprintf",
    "fscanf"
  ]),
  "c": /* @__PURE__ */ new Set([
    "printf",
    "scanf",
    "malloc",
    "free",
    "sizeof",
    "strlen",
    "strcpy",
    "strcmp",
    "memcpy",
    "memset",
    "fopen",
    "fclose",
    "fread",
    "fwrite",
    "fprintf",
    "fscanf"
  ])
};
_LanguageConfig.BUILTIN_TYPES = /* @__PURE__ */ new Set([
  "string",
  "number",
  "boolean",
  "null",
  "undefined",
  "void",
  "any",
  "unknown",
  "never",
  "symbol",
  "bigint",
  "Promise",
  "Array",
  "Map",
  "Set",
  "WeakMap",
  "WeakSet",
  "Date",
  "Error",
  "RegExp",
  "Partial",
  "Required",
  "Readonly",
  "Record",
  "Pick",
  "Omit",
  "Exclude",
  "Extract",
  "JSX",
  "React",
  "ReactNode",
  "ReactElement",
  "FC",
  "Component"
]);
let LanguageConfig = _LanguageConfig;
class FunctionCallExtractor {
  // @contract: extractFromText(text: string, language?: string) => Promise<string[]>
  // @step: [检测语言] 如果提供了 language，使用 Tree-sitter 方案
  // @step: [调用方法] 调用 extractWithTreeSitter 或 extractWithRegex
  // @step: [返回] 返回函数名数组
  static async extractFromText(text, language) {
    if (language) {
      return await this.extractWithTreeSitter(text, language);
    }
    return this.extractWithRegex(text);
  }
  // @contract: extractWithRegex(code: string) => string[]
  // @step: [正则匹配] 使用正则提取所有函数调用（函数名后跟括号）
  // @step: [去重] 使用 Set 去除重复的函数名
  // @step: [过滤] 过滤掉常见的内置函数和方法
  // @step: [返回] 返回函数名数组
  static extractWithRegex(code) {
    const functionCallRegex = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;
    const calls = /* @__PURE__ */ new Set();
    let match;
    while ((match = functionCallRegex.exec(code)) !== null) {
      const funcName = match[1];
      const builtins = [
        "if",
        "for",
        "while",
        "switch",
        "catch",
        "function",
        "return",
        "console",
        "log",
        "error",
        "warn",
        "info",
        "debug",
        "setTimeout",
        "setInterval",
        "clearTimeout",
        "clearInterval",
        "parseInt",
        "parseFloat",
        "isNaN",
        "isFinite",
        "Array",
        "Object",
        "String",
        "Number",
        "Boolean",
        "Date",
        "Math",
        "JSON",
        "Promise",
        "Map",
        "Set",
        "WeakMap",
        "WeakSet"
      ];
      if (!builtins.includes(funcName)) {
        calls.add(funcName);
      }
    }
    return Array.from(calls);
  }
  // @end
  // @contract: extractWithTreeSitter(code: string, language: string) => Promise<string[]>
  // @step: [初始化] 初始化 Tree-sitter parser
  // @step: [解析代码] 使用 Tree-sitter 解析代码生成 AST
  // @step: [遍历 AST] 递归遍历 AST 查找函数调用节点
  // @step: [提取函数名] 从调用节点中提取函数名
  // @step: [过滤内置] 过滤掉标准库函数
  // @step: [去重] 使用 Set 去除重复
  // @step: [返回] 返回函数名数组
  // @boundary: 当 Tree-sitter 初始化失败时，回退到正则方案
  // @boundary: 当语言不支持时，回退到正则方案
  static async extractWithTreeSitter(code, language) {
    try {
      await TreeSitterManager.init();
      const parser = await TreeSitterManager.getParser();
      const lang = await TreeSitterManager.getLanguage(language);
      if (!lang) {
        console.warn("[FunctionCallExtractor] Tree-sitter 不支持该语言，回退到正则方案");
        return this.extractWithRegex(code);
      }
      parser.setLanguage(lang);
      const tree = parser.parse(code);
      if (!tree) {
        console.warn("[FunctionCallExtractor] Tree-sitter 解析失败，回退到正则方案");
        return this.extractWithRegex(code);
      }
      const calls = /* @__PURE__ */ new Set();
      const builtins = this.getBuiltinFunctions(language);
      const traverse = (node) => {
        const callNodeTypes = [
          "call_expression",
          "call",
          "call_expr",
          "method_invocation"
        ];
        if (callNodeTypes.includes(node.type)) {
          const funcName = this.extractFunctionNameFromCallNode(node, language);
          if (funcName && !builtins.has(funcName)) {
            calls.add(funcName);
          }
        }
        for (const child of node.children) {
          traverse(child);
        }
      };
      traverse(tree.rootNode);
      return Array.from(calls);
    } catch (error) {
      console.warn("[FunctionCallExtractor] Tree-sitter 提取失败，回退到正则方案:", error);
      return this.extractWithRegex(code);
    }
  }
  // @end
  static extractFunctionNameFromCallNode(node, language) {
    const lang = language.toLowerCase();
    if (lang === "typescript" || lang === "javascript" || lang === "tsx") {
      for (const child of node.children) {
        if (child.type === "identifier") {
          return child.text;
        }
        if (child.type === "member_expression") {
          const property = child.children.find((c) => c.type === "property_identifier");
          if (property) {
            return property.text;
          }
        }
      }
    } else if (lang === "python") {
      for (const child of node.children) {
        if (child.type === "identifier") {
          return child.text;
        }
        if (child.type === "attribute") {
          const attr = child.children.find((c) => c.type === "identifier");
          if (attr) {
            return attr.text;
          }
        }
      }
    } else if (lang === "go") {
      for (const child of node.children) {
        if (child.type === "identifier") {
          return child.text;
        }
        if (child.type === "selector_expression") {
          const field = child.children.find((c) => c.type === "field_identifier");
          if (field) {
            return field.text;
          }
        }
      }
    } else if (lang === "cpp" || lang === "c") {
      for (const child of node.children) {
        if (child.type === "identifier") {
          return child.text;
        }
        if (child.type === "field_expression") {
          const field = child.children.find((c) => c.type === "field_identifier");
          if (field) {
            return field.text;
          }
        }
      }
    }
    return null;
  }
  static getBuiltinFunctions(language) {
    return LanguageConfig.getBuiltinFunctions(language);
  }
}
class TypeReferenceExtractor {
  // @contract: extractFromContractLine(contractLine: string, language?: string) => Promise<string[]>
  // @step: [检测语言] 如果提供了 language，使用 Tree-sitter 方案
  // @step: [调用方法] 调用 extractWithTreeSitter 或 extractWithRegex
  // @step: [返回] 返回类型名数组
  static async extractFromContractLine(contractLine, language) {
    if (language) {
      return await this.extractWithTreeSitter(contractLine, language);
    }
    return this.extractWithRegex(contractLine);
  }
  // @contract: extractWithRegex(contractLine: string) => string[]
  // @step: [提取参数类型] 从参数列表中提取类型（param: Type）
  // @step: [提取返回类型] 从返回值中提取类型（=> Type）
  // @step: [展开泛型] 从泛型中提取内部类型（Promise<User> => User）
  // @step: [过滤内置类型] 过滤掉基础类型和标准库类型
  // @step: [去重] 使用 Set 去除重复的类型名
  // @step: [返回] 返回类型名数组
  // @boundary: 当 contractLine 格式不正确时，返回空数组
  static extractWithRegex(contractLine) {
    const types = /* @__PURE__ */ new Set();
    const builtinTypes = /* @__PURE__ */ new Set([
      "string",
      "number",
      "boolean",
      "null",
      "undefined",
      "void",
      "any",
      "unknown",
      "never",
      "symbol",
      "bigint",
      "Promise",
      "Array",
      "Map",
      "Set",
      "WeakMap",
      "WeakSet",
      "Date",
      "Error",
      "RegExp",
      "Partial",
      "Required",
      "Readonly",
      "Record",
      "Pick",
      "Omit",
      "Exclude",
      "Extract",
      "JSX",
      "React",
      "ReactNode",
      "ReactElement",
      "FC",
      "Component"
    ]);
    const typeRegex = /:\s*([A-Z][a-zA-Z0-9_<>,\s\[\]|&]*)|=>\s*([A-Z][a-zA-Z0-9_<>,\s\[\]|&]*)/g;
    let match;
    while ((match = typeRegex.exec(contractLine)) !== null) {
      const typeStr = match[1] || match[2];
      if (typeStr) {
        const typeNames = this.extractTypeNamesFromTypeString(typeStr.trim());
        typeNames.forEach((typeName) => {
          if (!builtinTypes.has(typeName)) {
            types.add(typeName);
          }
        });
      }
    }
    return Array.from(types);
  }
  // @end
  // @contract: extractWithTreeSitter(contractLine: string, language: string) => Promise<string[]>
  // @step: [解析契约] 使用 Tree-sitter 解析契约行
  // @step: [遍历 AST] 递归遍历 AST 查找类型注解节点
  // @step: [提取类型] 从类型注解中提取类型名
  // @step: [过滤内置] 过滤掉基础类型和标准库类型
  // @step: [去重] 使用 Set 去除重复
  // @step: [返回] 返回类型名数组
  // @boundary: 当 Tree-sitter 初始化失败时，回退到正则方案
  // @boundary: 当语言不支持时，回退到正则方案
  static async extractWithTreeSitter(contractLine, language) {
    try {
      await TreeSitterManager.init();
      const lang = await TreeSitterManager.getLanguage(language);
      if (!lang) {
        console.warn("[TypeReferenceExtractor] Tree-sitter 不支持该语言，回退到正则方案");
        return this.extractWithRegex(contractLine);
      }
      const parser = await TreeSitterManager.getParser();
      parser.setLanguage(lang);
      const wrappedCode = this.wrapContractLine(contractLine, language);
      const tree = parser.parse(wrappedCode);
      if (!tree) {
        console.warn("[TypeReferenceExtractor] Tree-sitter 解析失败，回退到正则方案");
        return this.extractWithRegex(contractLine);
      }
      const types = /* @__PURE__ */ new Set();
      const builtinTypes = this.getBuiltinTypes();
      const traverse = (node) => {
        const typeNames = this.extractTypeFromNode(node, language);
        typeNames.forEach((typeName) => {
          if (!builtinTypes.has(typeName)) {
            types.add(typeName);
          }
        });
        for (const child of node.children) {
          traverse(child);
        }
      };
      traverse(tree.rootNode);
      return Array.from(types);
    } catch (error) {
      console.warn("[TypeReferenceExtractor] Tree-sitter 提取失败，回退到正则方案:", error);
      return this.extractWithRegex(contractLine);
    }
  }
  // @end
  // @contract: wrapContractLine(contractLine: string, language: string) => string
  // @step: [提取函数签名] 从契约行中提取函数签名部分
  // @step: [包装代码] 根据语言包装成可解析的函数声明
  // @step: [返回] 返回包装后的代码
  static wrapContractLine(contractLine, language) {
    const lang = language.toLowerCase();
    const match = contractLine.match(/@contract:\s*(.+)/);
    if (!match) {
      return contractLine;
    }
    const signature = match[1].trim();
    if (lang === "typescript" || lang === "tsx") {
      return `function ${signature} {}`;
    } else if (lang === "javascript") {
      return `function ${signature.replace(/:\s*[^,)]+/g, "")} {}`;
    } else if (lang === "python") {
      return `def ${signature}:
    pass`;
    } else if (lang === "go") {
      return `func ${signature} {}`;
    }
    return signature;
  }
  // @end
  // @contract: extractTypeFromNode(node: any, language: string) => string[]
  // @step: [检查节点类型] 检查当前节点是否是类型注解节点
  // @step: [提取类型名] 从节点中提取类型名
  // @step: [返回] 返回类型名数组
  static extractTypeFromNode(node, language) {
    const lang = language.toLowerCase();
    const types = [];
    if (lang === "typescript" || lang === "tsx") {
      const typeNodeTypes = [
        "type_annotation",
        "type_identifier",
        "generic_type",
        "predefined_type"
      ];
      if (typeNodeTypes.includes(node.type)) {
        if (node.type === "type_identifier") {
          types.push(node.text);
        } else if (node.text) {
          const extracted = this.extractTypeNamesFromTypeString(node.text);
          types.push(...extracted);
        }
      }
    } else if (lang === "python") {
      if (node.type === "type") {
        const typeNames = this.extractTypeNamesFromTypeString(node.text);
        types.push(...typeNames);
      }
    } else if (lang === "go") {
      if (node.type === "type_identifier") {
        types.push(node.text);
      }
    }
    return types;
  }
  // @end
  // @contract: extractTypeNamesFromTypeString(typeStr: string) => string[]
  // @step: [移除空格] 移除所有空格
  // @step: [提取类型名] 使用正则提取所有大写开头的类型名
  // @step: [返回] 返回类型名数组
  static extractTypeNamesFromTypeString(typeStr) {
    const types = [];
    const cleaned = typeStr.replace(/\s+/g, "");
    const typeNameRegex = /[A-Z][a-zA-Z0-9_]*/g;
    let match;
    while ((match = typeNameRegex.exec(cleaned)) !== null) {
      types.push(match[0]);
    }
    return types;
  }
  // @end
  // @contract: getBuiltinTypes() => Set<string>
  // @step: [委托] 委托给 LanguageConfig.getBuiltinTypes
  // @step: [返回] 返回内置类型集合
  static getBuiltinTypes() {
    return LanguageConfig.getBuiltinTypes("typescript");
  }
  // @end
}
const _ResolverRegistry = class _ResolverRegistry {
  /** 注册一个 resolver 及其别名。后注册覆盖前注册。 */
  static register(resolver, ...aliases) {
    const languages = [resolver.language, ...aliases];
    for (const lang of languages) {
      if (this.resolvers.has(lang)) {
        console.warn(`[ResolverRegistry] 覆盖已注册的语言: ${lang}`);
      }
      this.resolvers.set(lang, resolver);
    }
  }
  /** 按语言名查找 resolver，未注册返回 null */
  static get(language) {
    return this.resolvers.get(language.toLowerCase()) ?? null;
  }
  /** 该语言是否已注册 */
  static has(language) {
    return this.resolvers.has(language.toLowerCase());
  }
  /** 列出所有已注册的语言名 */
  static registeredLanguages() {
    return Array.from(this.resolvers.keys());
  }
};
_ResolverRegistry.resolvers = /* @__PURE__ */ new Map();
let ResolverRegistry = _ResolverRegistry;
function cleanStringLiteral(str) {
  return str.replace(/^['"`<]|['"`>]$/g, "");
}
class TypeScriptResolver {
  constructor() {
    this.language = "typescript";
  }
  // @contract: AST 节点 → TS/JS import 路径
  // @step: import_statement → 提取 string 子节点
  // @step: call_expression (require) → 提取 arguments 中的 string
  // @boundary: 动态 import() 与 import_statement 同为 AST 节点，自动覆盖
  extractImportPath(node) {
    if (node.type === "import_statement") {
      const source = node.children.find((c) => c.type === "string");
      if (source) return cleanStringLiteral(source.text);
    }
    if (node.type === "call_expression") {
      const func2 = node.children.find((c) => c.type === "identifier" && c.text === "require");
      if (func2) {
        const args2 = node.children.find((c) => c.type === "arguments");
        if (args2) {
          const str = args2.children.find((c) => c.type === "string");
          if (str) return cleanStringLiteral(str.text);
        }
      }
    }
    return null;
  }
  // @contract: TS/JS 只解析相对路径（./ ../），外部包/三方库跳过
  shouldResolve(importPath) {
    return importPath.startsWith("./") || importPath.startsWith("../");
  }
  // @contract: 使用 resolve 包处理 Node.js 模块解析规则
  // @step: 调用 resolve.sync() 按 Node.js 模块解析算法处理
  // @step: 支持 .ts/.tsx/.js/.jsx 扩展名
  // @step: 支持 TypeScript types/typings main 字段
  // @boundary: 解析失败时返回空数组（非 npm 私有模块或不存在路径）
  resolve(importPath, workspaceRoot) {
    try {
      const resolve = require("resolve");
      const resolved = resolve.sync(importPath, {
        basedir: workspaceRoot,
        extensions: [".ts", ".tsx", ".js", ".jsx"],
        packageFilter: (pkg) => {
          if (pkg.types || pkg.typings) {
            pkg.main = pkg.types || pkg.typings;
          }
          return pkg;
        }
      });
      return [resolved];
    } catch (e) {
      console.warn(
        `[TypeScriptResolver] 无法解析路径: ${importPath} (basedir: ${workspaceRoot})`,
        e instanceof Error ? e.message : String(e)
      );
      return [];
    }
  }
  // @contract: TypeScript/JavaScript 是文件相对导入，基目录为入口文件所在目录
  getImportBaseDir(entryFile, _projectRoot) {
    return Promise.resolve(path__namespace.dirname(entryFile));
  }
  // @contract: 正则降级方案
  // @step: 匹配 import ... from '...' 语句
  // @step: 匹配 require('...') 语句
  // @step: 只处理相对路径
  // @boundary: 与 AST 路径的 shouldResolve 一致
  extractRegex(code, workspaceRoot) {
    const files = [];
    const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(code)) !== null) {
      const importPath = match[1];
      if (importPath.startsWith("./") || importPath.startsWith("../")) {
        try {
          const resolve = require("resolve");
          const resolved = resolve.sync(importPath, {
            basedir: workspaceRoot,
            extensions: [".ts", ".tsx", ".js", ".jsx"]
          });
          files.push(resolved);
        } catch (e) {
        }
      }
    }
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = requireRegex.exec(code)) !== null) {
      const requirePath = match[1];
      if (requirePath.startsWith("./") || requirePath.startsWith("../")) {
        try {
          const resolve = require("resolve");
          const resolved = resolve.sync(requirePath, {
            basedir: workspaceRoot,
            extensions: [".ts", ".tsx", ".js", ".jsx"]
          });
          files.push(resolved);
        } catch (e) {
        }
      }
    }
    return files;
  }
}
class PythonResolver {
  constructor() {
    this.language = "python";
  }
  // @contract: AST 节点 → Python import 路径
  // @step: import_from_statement 提取 dotted_name 或 relative_import
  // @step: import_statement 提取 dotted_name
  extractImportPath(node) {
    if (node.type === "import_statement" || node.type === "import_from_statement") {
      if (node.type === "import_from_statement") {
        const moduleName = node.children.find(
          (c) => c.type === "dotted_name" || c.type === "relative_import"
        );
        if (moduleName) return moduleName.text;
      }
      if (node.type === "import_statement") {
        const moduleName = node.children.find((c) => c.type === "dotted_name");
        if (moduleName) return moduleName.text;
      }
    }
    return null;
  }
  // @contract: Python 只解析 . 开头的相对导入
  shouldResolve(importPath) {
    return importPath.startsWith(".");
  }
  // @contract: .module.sub → module/sub.py（相对当前文件目录）
  // @step: 前导点计算目录层级（. → ./，.. → ../，... → ../../）
  // @step: 剩余部分点号转路径分隔符 + .py 后缀
  // @boundary: 前导点和剩余部分分步处理，避免全部替换导致绝对路径
  resolve(importPath, workspaceRoot) {
    let dotCount = 0;
    while (dotCount < importPath.length && importPath[dotCount] === ".") {
      dotCount++;
    }
    const rest = importPath.slice(dotCount);
    if (!rest) {
      let prefix2 = "";
      for (let i2 = 1; i2 < dotCount; i2++) {
        prefix2 += "../";
      }
      return [path__namespace.resolve(workspaceRoot, prefix2 + "__init__.py")];
    }
    const parts2 = rest.split(".");
    const fileName = parts2.join("/") + ".py";
    let prefix = "";
    for (let i2 = 1; i2 < dotCount; i2++) {
      prefix += "../";
    }
    return [path__namespace.resolve(workspaceRoot, prefix + fileName)];
  }
  // @contract: Python 是文件相对导入，基目录为入口文件所在目录
  getImportBaseDir(entryFile, _projectRoot) {
    return Promise.resolve(path__namespace.dirname(entryFile));
  }
  // @contract: 正则降级方案
  // @step: 匹配 from ... import ... 和 import ... 两种形式
  // @step: 只保留 . 开头的相对导入，复用 resolve 路径逻辑
  extractRegex(code, workspaceRoot) {
    const files = [];
    const regex = /(?:from\s+([.\w]+)\s+import|import\s+([.\w]+))/g;
    let match;
    while ((match = regex.exec(code)) !== null) {
      const moduleName = match[1] || match[2];
      if (moduleName && moduleName.startsWith(".")) {
        files.push(...this.resolve(moduleName, workspaceRoot));
      }
    }
    return files;
  }
}
class GoResolver {
  constructor() {
    this.language = "go";
  }
  // @contract: AST 节点 → Go import 路径
  // @step: 匹配 import_spec 节点
  // @step: 提取 interpreted_string_literal 或 raw_string_literal
  // @boundary: 多行 import 块中每个 import_spec 独立匹配
  extractImportPath(node) {
    if (node.type === "import_spec") {
      const p = node.children.find(
        (c) => c.type === "interpreted_string_literal" || c.type === "raw_string_literal"
      );
      if (p) return cleanStringLiteral(p.text);
    }
    return null;
  }
  // @contract: Go 只解析相对路径（./ ../），外部模块/标准库跳过
  shouldResolve(importPath) {
    return importPath.startsWith("./") || importPath.startsWith("../");
  }
  // @contract: "./path/to/mod" → path/to/mod.go
  resolve(importPath, workspaceRoot) {
    return [path__namespace.resolve(workspaceRoot, importPath + ".go")];
  }
  // @contract: Go 是文件相对导入，基目录为入口文件所在目录
  getImportBaseDir(entryFile, _projectRoot) {
    return Promise.resolve(path__namespace.dirname(entryFile));
  }
  // @contract: 正则降级方案（处理分组和单行两类 import）
  // @step: 匹配 import "..." 单行导入
  // @step: 匹配 import ( ... ) 分组导入，提取内部所有字符串
  // @step: 只保留相对路径（./ ../），标准库和三方模块跳过
  extractRegex(code, workspaceRoot) {
    const files = [];
    const addIfRelative = (importPath) => {
      if (importPath.startsWith("./") || importPath.startsWith("../")) {
        files.push(path__namespace.resolve(workspaceRoot, importPath + ".go"));
      }
    };
    const simpleRegex = /^import\s+["']([^"']+)["']\s*$/gm;
    let match;
    while ((match = simpleRegex.exec(code)) !== null) {
      addIfRelative(match[1]);
    }
    const groupRegex = /import\s*\(([\s\S]*?)\)/g;
    while ((match = groupRegex.exec(code)) !== null) {
      const inner = match[1];
      const strRegex = /["']([^"']+)["']/g;
      let sm;
      while ((sm = strRegex.exec(inner)) !== null) {
        addIfRelative(sm[1]);
      }
    }
    return files;
  }
}
class CResolver {
  constructor() {
    this.language = "c";
  }
  // @contract: AST 节点 → C #include 路径
  // @step: 匹配 preproc_include 节点
  // @step: 提取 string_literal 或 system_lib_string 并清洗
  extractImportPath(node) {
    if (node.type === "preproc_include") {
      const p = node.children.find(
        (c) => c.type === "string_literal" || c.type === "system_lib_string"
      );
      if (p) return cleanStringLiteral(p.text);
    }
    return null;
  }
  // @contract: C 语言 #include 全部尝试解析
  // @step: 相对路径（./ ../）和裸文件名都尝试
  shouldResolve(importPath) {
    return importPath.startsWith("./") || importPath.startsWith("../") || !importPath.includes("/");
  }
  // @contract: #include "path" → path（原样）
  resolve(importPath, workspaceRoot) {
    return [path__namespace.resolve(workspaceRoot, importPath)];
  }
  // @contract: C 是文件相对导入，基目录为入口文件所在目录
  getImportBaseDir(entryFile, _projectRoot) {
    return Promise.resolve(path__namespace.dirname(entryFile));
  }
  // @contract: 正则降级方案
  // @step: 匹配 #include "..." 和 #include <...>
  extractRegex(code, workspaceRoot) {
    const files = [];
    const regex = /#include\s+["<]([^">]+)[">]/g;
    let match;
    while ((match = regex.exec(code)) !== null) {
      files.push(path__namespace.resolve(workspaceRoot, match[1]));
    }
    return files;
  }
}
class CppResolver {
  constructor() {
    this.language = "cpp";
  }
  // @contract: AST 节点 → C++ import 路径
  // @step: preproc_include 提取 string_literal / system_lib_string
  // @step: 注意 C++26 的 import 模块声明未来扩展
  // @boundary: C++26 import 模块名不映射到文件路径，在 shouldResolve 中过滤
  extractImportPath(node) {
    if (node.type === "preproc_include") {
      const p = node.children.find(
        (c) => c.type === "string_literal" || c.type === "system_lib_string"
      );
      if (p) return cleanStringLiteral(p.text);
    }
    if (node.type === "import_declaration" || node.type === "cpp_modules_import") {
      const name2 = node.children.find(
        (c) => c.type === "identifier" || c.type === "scoped_identifier" || c.type === "string_literal"
      );
      if (name2) return name2.text;
    }
    return null;
  }
  // @contract: C++ 相对路径和裸文件名尝试解析
  // @step: import 模块名（如 import std;）是非文件路径，在 shouldResolve 中过滤
  // @boundary: 不包含 '/' 的裸文件名不一定是文件（可能是系统库），但全部尝试让调用方 fileRepo.exists 过滤
  shouldResolve(importPath) {
    return importPath.startsWith("./") || importPath.startsWith("../") || !importPath.includes("/");
  }
  // @contract: #include "path" → path（原样）
  resolve(importPath, workspaceRoot) {
    return [path__namespace.resolve(workspaceRoot, importPath)];
  }
  // @contract: C++ 是文件相对导入，基目录为入口文件所在目录
  getImportBaseDir(entryFile, _projectRoot) {
    return Promise.resolve(path__namespace.dirname(entryFile));
  }
  // @contract: 正则降级方案
  // @step: 匹配 #include "..." 和 #include <...>
  // @step: 同时匹配 C++26 import 语句（模块名暂不映射文件路径）
  extractRegex(code, workspaceRoot) {
    const files = [];
    const includeRegex = /#include\s+["<]([^">]+)[">]/g;
    let match;
    while ((match = includeRegex.exec(code)) !== null) {
      files.push(path__namespace.resolve(workspaceRoot, match[1]));
    }
    return files;
  }
}
class JavaResolver {
  constructor() {
    this.language = "java";
  }
  // @contract: AST 节点 → Java import 路径
  // @step: 匹配 import_declaration 节点
  // @step: 提取 scoped_identifier 或 identifier 子节点的文本
  extractImportPath(node) {
    if (node.type === "import_declaration") {
      const name2 = node.children.find(
        (c) => c.type === "scoped_identifier" || c.type === "identifier"
      );
      if (name2) return name2.text;
    }
    return null;
  }
  // @contract: Java 跳过 java.* 标准库（JVM 自动导入），其他全量解析
  shouldResolve(importPath) {
    return !importPath.startsWith("java.");
  }
  // @contract: com.example.Module → com/example/Module.java
  // @step: 点号转路径分隔符 + .java 后缀
  // @boundary: 通配符和 java.* 已在 shouldResolve 过滤
  resolve(importPath, workspaceRoot) {
    const filePath = importPath.replace(/\./g, "/") + ".java";
    return [path__namespace.resolve(workspaceRoot, filePath)];
  }
  // @contract: Java 是包路径导入（com.example.Module → com/example/Module.java），基目录为 projectRoot
  getImportBaseDir(_entryFile, projectRoot) {
    return Promise.resolve(projectRoot);
  }
  // @contract: 正则降级方案
  // @step: 匹配 import 语句（含 static 导入）
  // @step: 过滤通配符 .* 和 java.* 标准库
  // @boundary: 降级路径与 resolve 的候选集一致（单候选）
  extractRegex(code, workspaceRoot) {
    const files = [];
    const regex = /^import\s+(?:static\s+)?([\w.*]+)\s*;/gm;
    let match;
    while ((match = regex.exec(code)) !== null) {
      const importPath = match[1];
      if (!importPath.endsWith(".*") && !importPath.startsWith("java.")) {
        files.push(path__namespace.resolve(workspaceRoot, importPath.replace(/\./g, "/") + ".java"));
      }
    }
    return files;
  }
}
class RustResolver {
  constructor() {
    this.language = "rust";
  }
  // @contract: AST 节点 → Rust import 路径
  // @step: use_declaration → 提取 scoped_identifier 或 use_as_clause 文本
  // @step: mod_item → 提取 identifier + prepend "crate::"（通过 shouldResolve 的 crate:: 过滤）
  // @boundary: mod_item 无 crate:: 前缀，手工补上以便 shouldResolve 通过
  extractImportPath(node) {
    if (node.type === "use_declaration") {
      const name2 = node.children.find(
        (c) => c.type === "scoped_identifier" || c.type === "use_as_clause"
      );
      if (name2) return name2.text;
    }
    if (node.type === "mod_item") {
      const name2 = node.children.find((c) => c.type === "identifier");
      if (name2) return `crate::${name2.text}`;
    }
    return null;
  }
  // @contract: Rust 只解析 crate::/self::/super:: 开头的路径
  shouldResolve(importPath) {
    return importPath.startsWith("crate::") || importPath.startsWith("self::") || importPath.startsWith("super::");
  }
  // @contract: 多候选路径解析策略
  // @step: crate::module::Item → 去掉前缀 + :: 转 /
  // @step: 原样候选：{relPath}.rs / {relPath}/mod.rs
  // @step: 去尾候选：去掉最后一段（Item 名）再试 {parent}.rs / {parent}/mod.rs
  // @boundary: 返回 2~4 个候选，由调用方 fileRepo.exists 过滤
  resolve(importPath, workspaceRoot) {
    const files = [];
    const relPath = importPath.replace(/^crate::/, "").replace(/::/g, "/");
    files.push(path__namespace.resolve(workspaceRoot, relPath + ".rs"));
    files.push(path__namespace.resolve(workspaceRoot, relPath + "/mod.rs"));
    const lastSlash = relPath.lastIndexOf("/");
    if (lastSlash !== -1) {
      const parentPath = relPath.slice(0, lastSlash);
      files.push(path__namespace.resolve(workspaceRoot, parentPath + ".rs"));
      files.push(path__namespace.resolve(workspaceRoot, parentPath + "/mod.rs"));
    }
    return files;
  }
  // @contract: Rust 以 crate root（Cargo.toml 所在目录的 src/）为 import 基目录
  // @step: 路线一：从 entryFile 向上找 Cargo.toml + src/
  // @step: 路线二：找不到 Cargo.toml 时向上找含 main.rs/lib.rs 的目录
  // @boundary: 都找不到时回退到 entryFile 所在目录
  async getImportBaseDir(entryFile, _projectRoot) {
    const entryDir = path__namespace.dirname(entryFile);
    let searchDir = entryDir;
    while (true) {
      try {
        await fs.promises.access(path__namespace.join(searchDir, "Cargo.toml"));
        const candidate = path__namespace.join(searchDir, "src");
        try {
          await fs.promises.access(candidate);
          return candidate;
        } catch {
          return searchDir;
        }
      } catch {
      }
      const parent = path__namespace.dirname(searchDir);
      if (parent === searchDir) break;
      searchDir = parent;
    }
    searchDir = entryDir;
    while (true) {
      try {
        await fs.promises.access(path__namespace.join(searchDir, "main.rs"));
        return searchDir;
      } catch {
      }
      try {
        await fs.promises.access(path__namespace.join(searchDir, "lib.rs"));
        return searchDir;
      } catch {
      }
      const parent = path__namespace.dirname(searchDir);
      if (parent === searchDir) break;
      searchDir = parent;
    }
    return entryDir;
  }
  // @contract: 正则降级方案
  // @step: 匹配 use crate::/self::/super:: 路径，多候选策略
  // @step: 匹配 mod xxx; 声明，双候选（.rs / mod.rs）
  // @boundary: 降级候选集与 AST 路径一致
  extractRegex(code, workspaceRoot) {
    const files = [];
    const useRegex = /^use\s+([\w:]+)(?:\s+as\s+\w+)?\s*;/gm;
    let match;
    while ((match = useRegex.exec(code)) !== null) {
      const importPath = match[1];
      if (importPath.startsWith("crate::") || importPath.startsWith("self::") || importPath.startsWith("super::")) {
        const relPath = importPath.replace(/^(?:crate|self|super)::/, "").replace(/::/g, "/");
        files.push(path__namespace.resolve(workspaceRoot, relPath + ".rs"));
        files.push(path__namespace.resolve(workspaceRoot, relPath + "/mod.rs"));
        const lastSlash = relPath.lastIndexOf("/");
        if (lastSlash !== -1) {
          const parentPath = relPath.slice(0, lastSlash);
          files.push(path__namespace.resolve(workspaceRoot, parentPath + ".rs"));
          files.push(path__namespace.resolve(workspaceRoot, parentPath + "/mod.rs"));
        }
      }
    }
    const modRegex = /^mod\s+(\w+)\s*;/gm;
    while ((match = modRegex.exec(code)) !== null) {
      const modName = match[1];
      files.push(path__namespace.resolve(workspaceRoot, modName + ".rs"));
      files.push(path__namespace.resolve(workspaceRoot, modName + "/mod.rs"));
    }
    return files;
  }
}
class RubyResolver {
  constructor() {
    this.language = "ruby";
  }
  // @contract: AST 节点 → Ruby require/load 路径
  // @step: 匹配 call 表达式节点
  // @step: 验证方法是 require / require_relative / load
  // @step: 提取字符串参数并清洗引号
  extractImportPath(node) {
    if (node.type === "call") {
      const method = node.children.find((c) => c.type === "identifier");
      if (method && (method.text === "require" || method.text === "require_relative" || method.text === "load")) {
        const str = node.children.find((c) => c.type === "string");
        if (str) return cleanStringLiteral(str.text);
      }
    }
    return null;
  }
  // @contract: Ruby require 可能是本地文件，全量尝试
  shouldResolve(_importPath) {
    return true;
  }
  // @contract: require 'path/to/file' → path/to/file.rb
  resolve(importPath, workspaceRoot) {
    return [path__namespace.resolve(workspaceRoot, importPath + ".rb")];
  }
  // @contract: Ruby 是文件相对导入，基目录为入口文件所在目录
  getImportBaseDir(entryFile, _projectRoot) {
    return Promise.resolve(path__namespace.dirname(entryFile));
  }
  // @contract: 正则降级方案
  // @step: 只匹配 require_relative 和 load（bare require 是 gem，不映射文件路径）
  // @boundary: gem require 路径不会出现在正则结果中
  extractRegex(code, workspaceRoot) {
    const files = [];
    const regex = /^(?:require_relative|load)\s+['"]([^'"]+)['"]/gm;
    let match;
    while ((match = regex.exec(code)) !== null) {
      files.push(path__namespace.resolve(workspaceRoot, match[1] + ".rb"));
    }
    return files;
  }
}
class KotlinResolver {
  constructor() {
    this.language = "kotlin";
  }
  // @contract: AST 节点 → Kotlin import 路径
  // @step: 匹配 import_declaration 节点
  // @step: 提取 scoped_identifier 或 identifier 子节点的文本
  extractImportPath(node) {
    if (node.type === "import_declaration") {
      const name2 = node.children.find(
        (c) => c.type === "scoped_identifier" || c.type === "identifier"
      );
      if (name2) return name2.text;
    }
    return null;
  }
  // @contract: Kotlin 跳过 kotlin.* 标准库，其他全量解析
  shouldResolve(importPath) {
    return !importPath.startsWith("kotlin.");
  }
  // @contract: com.example.Module → com/example/Module.kt
  resolve(importPath, workspaceRoot) {
    const filePath = importPath.replace(/\./g, "/") + ".kt";
    return [path__namespace.resolve(workspaceRoot, filePath)];
  }
  // @contract: Kotlin 是包路径导入基目录为 projectRoot
  getImportBaseDir(_entryFile, projectRoot) {
    return Promise.resolve(projectRoot);
  }
  // @contract: 正则降级方案
  // @step: 匹配 import 语句
  // @step: 过滤通配符 .* 和 kotlin.* 标准库
  extractRegex(code, workspaceRoot) {
    const files = [];
    const regex = /^import\s+([\w.*]+)\s*$/gm;
    let match;
    while ((match = regex.exec(code)) !== null) {
      const importPath = match[1];
      if (!importPath.endsWith(".*") && !importPath.startsWith("kotlin.")) {
        files.push(path__namespace.resolve(workspaceRoot, importPath.replace(/\./g, "/") + ".kt"));
      }
    }
    return files;
  }
}
class SwiftResolver {
  constructor() {
    this.language = "swift";
  }
  // @contract: AST 节点 → Swift import 路径
  // @step: 匹配 import_declaration 节点
  // @step: 提取模块名（identifier 或 scoped_identifier）
  extractImportPath(node) {
    if (node.type === "import_declaration") {
      const name2 = node.children.find(
        (c) => c.type === "scoped_identifier" || c.type === "identifier"
      );
      if (name2) return name2.text;
    }
    return null;
  }
  // @contract: 所有 import 尝试解析（标准库模块会被 fileRepo.exists 过滤）
  shouldResolve(_importPath) {
    return true;
  }
  // @contract: import ModuleName → ModuleName.swift
  // @step: scoped_identifier（import Foo.Bar）也展平为路径
  resolve(importPath, workspaceRoot) {
    const filePath = importPath.replace(/\./g, "/") + ".swift";
    return [path__namespace.resolve(workspaceRoot, filePath)];
  }
  // @contract: Swift 是模块名导入（import AppModule → AppModule.swift），基目录为 projectRoot
  getImportBaseDir(_entryFile, projectRoot) {
    return Promise.resolve(projectRoot);
  }
  // @contract: 正则降级方案
  // @step: 匹配 import 语句（含 import struct/class/func 修饰）
  extractRegex(code, workspaceRoot) {
    const files = [];
    const regex = /^import\s+(?:\w+\s+)?([\w.]+)\s*$/gm;
    let match;
    while ((match = regex.exec(code)) !== null) {
      const importPath = match[1];
      files.push(path__namespace.resolve(workspaceRoot, importPath.replace(/\./g, "/") + ".swift"));
    }
    return files;
  }
}
class CSharpResolver {
  constructor() {
    this.language = "csharp";
  }
  // @contract: AST 节点 → C# using 路径
  // @step: 匹配 using_directive 节点
  // @step: 提取 qualified_name 或 identifier 子节点的文本
  extractImportPath(node) {
    if (node.type === "using_directive") {
      const name2 = node.children.find(
        (c) => c.type === "qualified_name" || c.type === "identifier"
      );
      if (name2) return name2.text;
    }
    return null;
  }
  // @contract: 所有 using 尝试解析（标准库命名空间会被 fileRepo.exists 过滤）
  shouldResolve(_importPath) {
    return true;
  }
  // @contract: System.Collections.Generic → System/Collections/Generic.cs
  resolve(importPath, workspaceRoot) {
    const filePath = importPath.replace(/\./g, "/") + ".cs";
    return [path__namespace.resolve(workspaceRoot, filePath)];
  }
  // @contract: C# 是命名空间导入（System.Collections → System/Collections.cs），基目录为 projectRoot
  getImportBaseDir(_entryFile, projectRoot) {
    return Promise.resolve(projectRoot);
  }
  // @contract: 正则降级方案
  // @step: 匹配 using 语句（含 using static / using alias）
  // @step: 跳过别名（using X = Y;）和 using static
  extractRegex(code, workspaceRoot) {
    const files = [];
    const regex = /^using\s+(?:static\s+)?([\w.]+)\s*;/gm;
    let match;
    while ((match = regex.exec(code)) !== null) {
      const importPath = match[1];
      files.push(path__namespace.resolve(workspaceRoot, importPath.replace(/\./g, "/") + ".cs"));
    }
    return files;
  }
}
const _PhpResolver = class _PhpResolver {
  constructor() {
    this.language = "php";
  }
  /** 将 PSR-4 导入路径转为候选文件路径列表（含原始路径和映射路径） */
  toCandidatePaths(importPath) {
    const candidates = [];
    const raw = importPath.replace(/[\\\/]/g, "/") + ".php";
    candidates.push(raw);
    for (const [prefix, dir] of Object.entries(_PhpResolver.NAMESPACE_PREFIX_MAP)) {
      if (importPath.startsWith(prefix)) {
        const mapped = importPath.slice(prefix.length).replace(/[\\\/]/g, "/") + ".php";
        candidates.push(dir + mapped);
        break;
      }
    }
    return candidates;
  }
  // @contract: AST 节点 → PHP use 路径
  // @step: 匹配 namespace_use_statement 节点
  // @step: 提取 name 子节点的文本（命名空间全名）
  extractImportPath(node) {
    if (node.type === "namespace_use_statement") {
      const name2 = node.children.find(
        (c) => c.type === "name" || c.type === "namespace_name"
      );
      if (name2) return name2.text;
    }
    return null;
  }
  // @contract: PHP use 语句全部尝试解析（外部包会被 fileRepo.exists 过滤）
  shouldResolve(_importPath) {
    return true;
  }
  // @contract: App\Models\User → App/Models/User.php 及 PSR-4 映射候选项
  // @step: 反斜杠命名空间分隔符转路径分隔符 + .php
  // @step: 额外生成 PSR-4 前缀映射路径（如 App\ → src/）
  resolve(importPath, workspaceRoot) {
    return this.toCandidatePaths(importPath).map((p) => path__namespace.resolve(workspaceRoot, p));
  }
  // @contract: PHP 是 PSR-4 命名空间映射，基目录为 projectRoot
  getImportBaseDir(_entryFile, projectRoot) {
    return Promise.resolve(projectRoot);
  }
  // @contract: 正则降级方案
  // @step: 匹配 use 语句，排除 use function / use const
  // @boundary: 先用行级否定前瞻跳过 function/const 开头
  extractRegex(code, workspaceRoot) {
    const files = [];
    const regex = /^use\s+(?!function\s|const\s)([\w\\]+)\s*;/gm;
    let match;
    while ((match = regex.exec(code)) !== null) {
      const importPath = match[1];
      for (const candidate of this.toCandidatePaths(importPath)) {
        files.push(path__namespace.resolve(workspaceRoot, candidate));
      }
    }
    return files;
  }
};
_PhpResolver.NAMESPACE_PREFIX_MAP = {
  "App\\": "src/",
  "App/": "src/"
};
let PhpResolver = _PhpResolver;
class CssResolver {
  constructor() {
    this.language = "css";
  }
  // @contract: AST 节点 → CSS @import 路径
  // @step: 匹配 import_statement 或 preproc_include 节点
  // @step: 提取字符串子节点并清洗引号
  // @boundary: CSS 的 @import 必须出现在样式表顶部，但 AST 节点不受位置限制
  extractImportPath(node) {
    if (node.type === "import_statement" || node.type === "import_rule") {
      const str = node.children.find(
        (c) => c.type === "string" || c.type === "string_value" || c.type === "uri_value"
      );
      if (str) return cleanStringLiteral(str.text);
      const url = node.children.find((c) => c.type === "call_expression" || c.type === "function_call");
      if (url) {
        const inner = url.children.find(
          (c) => c.type === "string" || c.type === "string_value" || c.type === "identifier"
        );
        if (inner) return cleanStringLiteral(inner.text);
      }
    }
    return null;
  }
  // @contract: CSS 只解析相对路径（./ ../），CDN 和绝对 URL 跳过
  shouldResolve(importPath) {
    return importPath.startsWith("./") || importPath.startsWith("../") || importPath.startsWith("/");
  }
  // @contract: "./path/to/file.css" → path/to/file.css（原样解析）
  resolve(importPath, workspaceRoot) {
    return [path__namespace.resolve(workspaceRoot, importPath)];
  }
  // @contract: CSS 文件相对导入，基目录为入口文件所在目录
  getImportBaseDir(entryFile, _projectRoot) {
    return Promise.resolve(path__namespace.dirname(entryFile));
  }
  // @contract: 正则降级方案
  // @step: 匹配 @import url("...") 和 @import "..." 两种形式
  extractRegex(code, workspaceRoot) {
    const files = [];
    const addIfRelative = (importPath) => {
      if (importPath.startsWith("./") || importPath.startsWith("../") || importPath.startsWith("/")) {
        files.push(path__namespace.resolve(workspaceRoot, importPath));
      }
    };
    const simpleRegex = /@import\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = simpleRegex.exec(code)) !== null) {
      addIfRelative(match[1]);
    }
    const urlRegex = /@import\s+url\s*\(\s*['"]?([^'")\s]+)['"]?\s*\)/g;
    while ((match = urlRegex.exec(code)) !== null) {
      addIfRelative(match[1]);
    }
    return files;
  }
}
const _ImportExtractor = class _ImportExtractor {
  /** 确保注册表已初始化，返回初始状态 */
  static ensureInitialized() {
    if (this.initialized) return true;
    this.initialized = true;
    ResolverRegistry.register(new TypeScriptResolver(), "javascript", "tsx");
    ResolverRegistry.register(new PythonResolver());
    ResolverRegistry.register(new GoResolver());
    ResolverRegistry.register(new CResolver());
    ResolverRegistry.register(new CppResolver(), "cxx");
    ResolverRegistry.register(new JavaResolver());
    ResolverRegistry.register(new RustResolver());
    ResolverRegistry.register(new RubyResolver());
    ResolverRegistry.register(new KotlinResolver());
    ResolverRegistry.register(new SwiftResolver());
    ResolverRegistry.register(new CSharpResolver());
    ResolverRegistry.register(new PhpResolver());
    ResolverRegistry.register(new CssResolver());
    return true;
  }
  /** 获取指定语言的 ImportResolver。未注册的语言返回 null。 */
  static getResolver(language) {
    this.ensureInitialized();
    return ResolverRegistry.get(language);
  }
  // @contract: extractImportedFiles(code, workspaceRoot, language?) => Promise<string[]>
  // @step: [懒初始化] 首次调用时注册所有 resolver
  // @step: [查注册表] 有 language 时查 ResolverRegistry 获取策略
  // @step: [Tree-sitter 解析] 优先用 AST 解析，失败降级到该策略的正则
  // @step: [全局正则] 无 language 或未注册时走旧全局正则
  // @step: [去重] 使用 Set 去重
  // @boundary: resolver 未注册时走全局正则（向后兼容）
  // @boundary: Tree-sitter 解析失败时按语言降级正则
  // @boundary: 所有异常被 catch 不中断整体流程
  static async extractImportedFiles(code, workspaceRoot, language) {
    this.ensureInitialized();
    if (!language) {
      return this.extractWithRegex(code, workspaceRoot);
    }
    const resolver = ResolverRegistry.get(language);
    if (!resolver) {
      console.warn(`[ImportExtractor] 无 resolver 注册: ${language}，走全局正则`);
      return this.extractWithRegex(code, workspaceRoot);
    }
    try {
      return await this.extractWithTreeSitter(code, workspaceRoot, language, resolver);
    } catch (error) {
      console.warn(`[ImportExtractor] Tree-sitter 解析失败 (${language})，降级到该语言的正则:`, error);
      return resolver.extractRegex(code, workspaceRoot);
    }
  }
  // @contract: extractWithTreeSitter(code, workspaceRoot, language, resolver) => Promise<string[]>
  // @step: [初始化] 获取 Tree-sitter parser 和 Language
  // @step: [解析] parser.parse(code) 生成 AST
  // @step: [遍历] 递归遍历 AST，调用 resolver.extractImportPath
  // @step: [过滤] 调用 resolver.shouldResolve 过滤外部包
  // @step: [解析路径] 调用 resolver.resolve 生成候选文件路径
  // @step: [去重] 使用 Set 去重
  // @boundary: WASM 加载失败或解析失败时抛出，由调用方降级
  static async extractWithTreeSitter(code, workspaceRoot, language, resolver) {
    const parser = await TreeSitterManager.getParser();
    const lang = await TreeSitterManager.getLanguage(language);
    if (!lang) {
      throw new Error(`Tree-sitter 不支持 ${language}`);
    }
    parser.setLanguage(lang);
    const tree = parser.parse(code);
    if (!tree) {
      throw new Error(`Tree-sitter 解析 ${language} 失败`);
    }
    const files = /* @__PURE__ */ new Set();
    const traverse = (node) => {
      const importPath = resolver.extractImportPath(node);
      if (importPath && resolver.shouldResolve(importPath)) {
        const resolvedPaths = resolver.resolve(importPath, workspaceRoot);
        resolvedPaths.forEach((p) => files.add(p));
      }
      for (const child of node.children) {
        traverse(child);
      }
    };
    traverse(tree.rootNode);
    return Array.from(files);
  }
  // ==================== 全局正则降级（无 language 参数时使用） ====================
  static extractWithRegex(code, workspaceRoot) {
    const path2 = require("path");
    const files = [];
    const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(code)) !== null) {
      const importPath = match[1];
      if (importPath.startsWith("./") || importPath.startsWith("../")) {
        try {
          const resolve = require("resolve");
          const resolved = resolve.sync(importPath, {
            basedir: workspaceRoot,
            extensions: [".ts", ".tsx", ".js", ".jsx"]
          });
          files.push(resolved);
        } catch (e) {
        }
      }
    }
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = requireRegex.exec(code)) !== null) {
      const requirePath = match[1];
      if (requirePath.startsWith("./") || requirePath.startsWith("../")) {
        try {
          const resolve = require("resolve");
          const resolved = resolve.sync(requirePath, {
            basedir: workspaceRoot,
            extensions: [".ts", ".tsx", ".js", ".jsx"]
          });
          files.push(resolved);
        } catch (e) {
        }
      }
    }
    const pythonImportRegex = /(?:from\s+([.\w]+)\s+import|import\s+([.\w]+))/g;
    while ((match = pythonImportRegex.exec(code)) !== null) {
      const moduleName = match[1] || match[2];
      if (moduleName.startsWith(".")) {
        files.push(path2.resolve(workspaceRoot, moduleName.replace(/\./g, "/") + ".py"));
      }
    }
    const includeRegex = /#include\s+["<]([^">]+)[">]/g;
    while ((match = includeRegex.exec(code)) !== null) {
      files.push(path2.resolve(workspaceRoot, match[1]));
    }
    const goImportRegex = /import\s+(?:\(\s*)?["']([^"']+)["']/g;
    while ((match = goImportRegex.exec(code)) !== null) {
      const importPath = match[1];
      if (importPath.startsWith("./") || importPath.startsWith("../")) {
        files.push(path2.resolve(workspaceRoot, importPath + ".go"));
      }
    }
    const javaImportRegex = /^import\s+(?:static\s+)?([\w.*]+)\s*;/gm;
    while ((match = javaImportRegex.exec(code)) !== null) {
      const importPath = match[1];
      if (!importPath.endsWith(".*") && !importPath.startsWith("java.lang")) {
        files.push(path2.resolve(workspaceRoot, importPath.replace(/\./g, "/") + ".java"));
      }
    }
    const rustUseRegex = /^use\s+([\w:]+)(?:\s+as\s+\w+)?\s*;/gm;
    while ((match = rustUseRegex.exec(code)) !== null) {
      const importPath = match[1];
      if (importPath.startsWith("crate::") || importPath.startsWith("self::") || importPath.startsWith("super::")) {
        let relPath = importPath.replace(/^(?:crate|self|super)::/, "").replace(/::/g, "/");
        files.push(path2.resolve(workspaceRoot, relPath + ".rs"));
        files.push(path2.resolve(workspaceRoot, relPath + "/mod.rs"));
        const lastSlash = relPath.lastIndexOf("/");
        if (lastSlash !== -1) {
          const parentPath = relPath.slice(0, lastSlash);
          files.push(path2.resolve(workspaceRoot, parentPath + ".rs"));
          files.push(path2.resolve(workspaceRoot, parentPath + "/mod.rs"));
        }
      }
    }
    const rustModRegex = /^mod\s+(\w+)\s*;/gm;
    while ((match = rustModRegex.exec(code)) !== null) {
      const modName = match[1];
      files.push(path2.resolve(workspaceRoot, modName + ".rs"));
      files.push(path2.resolve(workspaceRoot, modName + "/mod.rs"));
    }
    const rubyRequireRegex = /^(?:require|require_relative|load)\s+['"]([^'"]+)['"]/gm;
    while ((match = rubyRequireRegex.exec(code)) !== null) {
      files.push(path2.resolve(workspaceRoot, match[1] + ".rb"));
    }
    return files;
  }
};
_ImportExtractor.initialized = false;
let ImportExtractor = _ImportExtractor;
class CodeParserRepositoryImpl {
  async parse(content, language) {
    try {
      await TreeSitterManager.init();
      const lang = await TreeSitterManager.getLanguage(language);
      if (!lang) {
        console.warn(`[CodeParserRepository] Tree-sitter 不支持该语言: ${language}`);
        return null;
      }
      const parser = await TreeSitterManager.getParser();
      parser.setLanguage(lang);
      const tree = parser.parse(content);
      return tree;
    } catch (error) {
      console.warn(`[CodeParserRepository] 解析 AST 失败:`, error);
      return null;
    }
  }
  async searchFunctionDefinition(functionName, filePath, language) {
    const result = await FunctionDefinitionSearcher.searchInFile(functionName, filePath, language);
    if (result) {
      return {
        functionName: result.functionName,
        code: result.code,
        startLine: result.startLine,
        endLine: result.endLine,
        contract: result.contract,
        filePath
      };
    }
    return null;
  }
  async searchTypeDefinition(typeName, filePath, language) {
    return await TypeDefinitionSearcher.searchInFile(typeName, filePath, language);
  }
  async extractFunctionCalls(code, language) {
    return await FunctionCallExtractor.extractFromText(code, language);
  }
  async extractTypeReferences(code, language) {
    return await TypeReferenceExtractor.extractFromContractLine(code, language);
  }
  async extractImports(content, currentDir, language) {
    return await ImportExtractor.extractImportedFiles(content, currentDir, language);
  }
  async searchContract(_functionName, _workspaceRoot) {
    throw new Error("searchContract is a VSCode-specific method and is not supported in the data layer.");
  }
  // ──────────────────────────────────────────────
  // countNonCommentLines
  // ──────────────────────────────────────────────
  /**
   * @contract
   * 统计排除注释后的纯代码行数（空行保留）。
   * 输入：content - 文件内容；filePath - 文件路径（用于推断编程语言）
   * 输出：排除注释后的纯代码行数
   * 副作用：无
   */
  async countNonCommentLines(content, filePath) {
    if (content.length === 0) return 0;
    const language = LanguageConfig.getLanguageFromExtension(path__namespace.extname(filePath));
    if (!language) {
      return this.countTotalLines(content);
    }
    const tree = await this.parse(content, language);
    if (!tree || !tree.rootNode) {
      return this.countTotalLines(content);
    }
    const commentRows = /* @__PURE__ */ new Set();
    const nonCommentRows = /* @__PURE__ */ new Set();
    this.collectNodeRows(tree.rootNode, commentRows, nonCommentRows);
    let maxRow = -1;
    for (const row of commentRows) maxRow = Math.max(maxRow, row);
    for (const row of nonCommentRows) maxRow = Math.max(maxRow, row);
    const totalLines = maxRow + 1;
    let codeLines = 0;
    for (let row = 0; row < totalLines; row++) {
      if (nonCommentRows.has(row)) {
        codeLines++;
      } else if (!commentRows.has(row)) {
        codeLines++;
      }
    }
    return codeLines;
  }
  // ──────────────────────────────────────────────
  // Private Helpers
  // ──────────────────────────────────────────────
  /**
   * @contract
   * 统计内容总行数（处理末尾换行和空文件）。
   * 输入：content - 文件内容
   * 输出：行数
   * 副作用：无
   */
  countTotalLines(content) {
    if (content.length === 0) return 0;
    const lines = content.split("\n");
    if (lines[lines.length - 1] === "" && content.endsWith("\n")) {
      return lines.length - 1;
    }
    return lines.length;
  }
  /**
   * @contract
   * 递归遍历 AST 节点，收集注释行和非注释行的范围。
   * 输入：node - AST 节点；commentRows - 注释行集合；nonCommentRows - 非注释行集合
   * 副作用：修改 commentRows / nonCommentRows
   */
  collectNodeRows(node, commentRows, nonCommentRows) {
    if (!node || !node.type || !node.startPosition || !node.endPosition) return;
    const { type, startPosition, endPosition, children } = node;
    if (type === "comment") {
      for (let row = startPosition.row; row <= endPosition.row; row++) {
        commentRows.add(row);
      }
    } else if (type !== "program") {
      for (let row = startPosition.row; row <= endPosition.row; row++) {
        nonCommentRows.add(row);
      }
    }
    if (children && Array.isArray(children)) {
      for (const child of children) {
        this.collectNodeRows(child, commentRows, nonCommentRows);
      }
    }
  }
}
const DEFAULT_SKILLS_DIR = node_path.join(node_os.homedir(), ".pi", "agent", "skills");
const DEFAULT_USER_AGENTS_DIR = node_path.join(node_os.homedir(), ".pi", "agent", "agents");
function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return null;
  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    fields[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return { fields, body: match[2].trim() };
}
async function parseAgentFile(filePath, skillName, source) {
  let content;
  try {
    content = await promises.readFile(filePath, "utf-8");
  } catch {
    return null;
  }
  const parsed = parseFrontmatter(content);
  if (!parsed) return null;
  const name2 = parsed.fields["name"];
  if (!name2) return null;
  const agent = {
    name: name2,
    description: parsed.fields["description"] ?? "",
    tools: parsed.fields["tools"] ? parsed.fields["tools"].split(",").map((t) => t.trim()).filter(Boolean) : void 0,
    model: parsed.fields["model"] || void 0,
    systemPrompt: parsed.body,
    source,
    skillName,
    filePath
  };
  return agent;
}
async function scanSubSkillDir(dir, skillName) {
  const agents = [];
  let entries;
  try {
    entries = await promises.readdir(dir);
  } catch {
    return agents;
  }
  for (const entry of entries) {
    const fullPath = node_path.join(dir, entry);
    let entryStat;
    try {
      entryStat = await promises.stat(fullPath);
    } catch {
      continue;
    }
    if (entryStat.isFile() && entry.toLowerCase() === "sub-skill.md") {
      const agent = await parseAgentFile(fullPath, skillName, "sub_skill");
      if (agent) agents.push(agent);
    } else if (entryStat.isDirectory()) {
      const subAgents = await scanSubSkillDir(fullPath, skillName);
      agents.push(...subAgents);
    }
  }
  return agents;
}
async function scanUserAgentDir(agentsDir) {
  const agents = [];
  let entries;
  try {
    entries = await promises.readdir(agentsDir);
  } catch {
    return agents;
  }
  for (const name2 of entries) {
    if (!name2.endsWith(".md")) continue;
    const filePath = node_path.join(agentsDir, name2);
    const agent = await parseAgentFile(filePath, void 0, "user_agent");
    if (agent) agents.push(agent);
  }
  return agents;
}
async function scanAllSubSkills(skillsDir) {
  const agents = [];
  const errors = [];
  let skillDirs;
  try {
    skillDirs = await promises.readdir(skillsDir);
  } catch (err2) {
    if (err2.code === "ENOENT") return { agents, errors };
    errors.push(`${skillsDir}: ${err2.message}`);
    return { agents, errors };
  }
  for (const skillName of skillDirs) {
    const subDir = node_path.join(skillsDir, skillName, "sub-skill");
    const discovered = await scanSubSkillDir(subDir, skillName);
    agents.push(...discovered);
  }
  return { agents, errors };
}
function deduplicate(agents) {
  const seen = /* @__PURE__ */ new Map();
  for (const agent of agents) {
    seen.set(agent.name, agent);
  }
  return Array.from(seen.values());
}
class AgentRepositoryImpl {
  constructor(options) {
    this.skillsDir = (options == null ? void 0 : options.skillsDir) ?? DEFAULT_SKILLS_DIR;
    this.agentsDir = (options == null ? void 0 : options.agentsDir) ?? DEFAULT_USER_AGENTS_DIR;
  }
  async discoverAll(scope) {
    const allErrors = [];
    let agents = [];
    if (scope === "sub_skill" || scope === "both") {
      const { agents: subSkillAgents, errors } = await scanAllSubSkills(this.skillsDir);
      agents.push(...subSkillAgents);
      allErrors.push(...errors);
    }
    if (scope === "user") {
      const userAgents = await scanUserAgentDir(this.agentsDir);
      agents.push(...userAgents);
    } else if (scope === "both") {
      const userAgents = await scanUserAgentDir(this.agentsDir);
      agents.unshift(...userAgents);
    }
    return { agents: deduplicate(agents), errors: allErrors };
  }
  async findByName(name2, scope) {
    const { agents } = await this.discoverAll(scope);
    return agents.find((a) => a.name === name2) ?? null;
  }
}
class GuardToggleStore {
  get configPath() {
    return node_path.join(process.cwd(), ".intentflow", "guard-state.json");
  }
  /** 同步读取当前开关状态，任何异常回退安全态 true */
  read() {
    try {
      const raw = node_fs.readFileSync(this.configPath, "utf-8");
      const parsed = JSON.parse(raw);
      if (typeof parsed !== "object" || parsed === null) {
        return true;
      }
      const enabled = parsed.enabled;
      return typeof enabled === "boolean" ? enabled : true;
    } catch {
      return true;
    }
  }
  /** 异步写入开关状态，失败抛错 */
  async write(enabled) {
    await promises.mkdir(node_path.join(process.cwd(), ".intentflow"), { recursive: true });
    await promises.writeFile(this.configPath, JSON.stringify({ enabled }), "utf-8");
  }
}
class GuardToggleService {
  constructor(store) {
    this.store = store;
    this.enabled = this.store.read();
  }
  isEnabled() {
    return this.enabled;
  }
  async toggle() {
    this.enabled = !this.enabled;
    await this.store.write(this.enabled);
    return this.enabled;
  }
}
class CheckFileSizeUseCase {
  constructor(fileRepo, parserRepo) {
    this.fileRepo = fileRepo;
    this.parserRepo = parserRepo;
  }
  // @contract: execute(input: FileSizeCheckInput) => Promise<FileSizeCheckResult[]>
  // @step: [验证文件] 验证文件是否存在
  // @step: [读取内容] 读取文件内容
  // @step: [统计纯代码行数] 用 parserRepo 排除注释统计行数
  // @step: [检查阈值] 检查是否超过阈值
  // @step: [返回结果] 返回检查结果列表
  // @boundary: 文件不存在时抛出错误
  // @boundary: 阈值默认为 400 行
  async execute(input) {
    const { filePath, threshold = 400 } = input;
    const exists = await this.fileRepo.exists(filePath);
    if (!exists) {
      throw new Error(`File not found: ${filePath}`);
    }
    const content = await this.fileRepo.readFile(filePath);
    const codeLineCount = await this.parserRepo.countNonCommentLines(content, filePath);
    const exceedLines = codeLineCount > threshold ? codeLineCount - threshold : 0;
    const result = {
      filePath,
      exceedLines,
      ...codeLineCount > threshold ? { needsRefactor: true } : {}
    };
    return [result];
  }
}
const DEFAULT_LAYER_RULES = [
  { name: "adapter", pattern: "/(adapter)(/|$)", subModule: true },
  { name: "application", pattern: "/(application)(/|$)" },
  { name: "data", pattern: "/(data)(/|$)" }
];
function extractLayer(filePath, rules) {
  const normalized = filePath.replace(/\\/g, "/");
  const activeRules = rules || DEFAULT_LAYER_RULES;
  for (const rule of activeRules) {
    const match = normalized.match(new RegExp(rule.pattern));
    if (match) {
      if (rule.subModule) {
        const afterIndex = (match.index || 0) + match[0].length;
        const subDir = normalized.slice(afterIndex).split("/")[0];
        return subDir ? `${match[1]}/${subDir}` : match[1];
      }
      return match[1];
    }
  }
  return "unknown";
}
function extractLayerRoot(filePath, rules) {
  const normalized = filePath.replace(/\\/g, "/");
  const activeRules = rules || DEFAULT_LAYER_RULES;
  for (const rule of activeRules) {
    const match = normalized.match(new RegExp(rule.pattern));
    if (match) return match[1];
  }
  return "unknown";
}
function relativeToLayer(filePath, rules) {
  const normalized = filePath.replace(/\\/g, "/");
  const activeRules = rules || DEFAULT_LAYER_RULES;
  for (const rule of activeRules) {
    const match = normalized.match(new RegExp(rule.pattern));
    if (match) {
      const afterIndex = (match.index || 0) + match[0].length;
      return normalized.slice(afterIndex);
    }
  }
  return normalized;
}
function extractIntentFromContent(content, language) {
  const lines = content.split("\n").slice(0, 50);
  const prefixes = language ? LanguageConfig.getCommentPrefixes(language) : ["//", "#"];
  const stripPrefixes = [.../* @__PURE__ */ new Set([...prefixes, "*"])];
  let inIntent = false;
  let parts2 = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "*/" || trimmed === "") {
      if (inIntent) break;
      continue;
    }
    if (!inIntent) {
      for (const prefix of stripPrefixes) {
        if (trimmed.startsWith(prefix)) {
          const after = trimmed.slice(prefix.length).trimStart();
          const tagMatch = after.match(/^@intent[:\s]*(.*)/);
          if (tagMatch) {
            inIntent = true;
            if (tagMatch[1]) parts2.push(tagMatch[1].trim());
            break;
          }
        }
      }
      continue;
    }
    let foundOtherTag = false;
    for (const prefix of stripPrefixes) {
      if (trimmed.startsWith(prefix)) {
        const after = trimmed.slice(prefix.length).trimStart();
        if (/^@(?!intent\b)/.test(after)) {
          foundOtherTag = true;
          break;
        }
      }
    }
    if (foundOtherTag) break;
    let text = trimmed;
    for (const prefix of stripPrefixes) {
      if (text.startsWith(prefix)) {
        text = text.slice(prefix.length).trim();
        break;
      }
    }
    if (text) parts2.push(text);
  }
  return parts2.length > 0 ? parts2.join(" ") : null;
}
function getLanguage(filePath) {
  return LanguageConfig.getLanguageFromExtension(path__namespace.extname(filePath)) || "typescript";
}
class TraceDependencyChainUseCase {
  constructor(codeParserRepo, fileRepo) {
    this.codeParserRepo = codeParserRepo;
    this.fileRepo = fileRepo;
  }
  // @contract: execute(input: TraceDependencyChainInput) => Promise<TraceDependencyChainOutput>
  // @step: [解析路径] 将入口文件路径解析为绝对路径
  // @step: [读取入口] 读取入口文件内容
  // @step: [解析导入] 使用 codeParserRepo 提取 import 语句
  // @step: [获取语义] 对每个依赖文件，读取并提取 @intent
  // @step: [层级分组] 按同层/跨层分组依赖
  // @step: [组装结果] 构建扁平化输出
  // @boundary: 文件不存在时抛出错误；无 @intent 时使用文件名作为 fallback
  async execute(input) {
    var _a;
    const entryPath = path__namespace.resolve(input.entryFile);
    const layerRules = (_a = input.layerConfig) == null ? void 0 : _a.rules;
    const entryExists = await this.fileRepo.exists(entryPath);
    if (!entryExists) {
      throw new Error(`入口文件不存在: ${entryPath}`);
    }
    const entryContent = await this.fileRepo.readFile(entryPath);
    const entryLayer = extractLayer(entryPath, layerRules);
    const entryLanguage = getLanguage(entryPath);
    const entryIntent = extractIntentFromContent(entryContent, entryLanguage) || path__namespace.basename(entryPath);
    const entryDir = path__namespace.dirname(entryPath);
    const language = entryLanguage;
    const resolver = ImportExtractor.getResolver(language);
    const importBaseDir = resolver ? await resolver.getImportBaseDir(entryPath, entryDir) : entryDir;
    const importedPaths = await this.codeParserRepo.extractImports(
      entryContent,
      importBaseDir,
      language
    );
    const depResults = [];
    for (const depPath of importedPaths) {
      try {
        const depExists = await this.fileRepo.exists(depPath);
        if (!depExists) {
          const ext = path__namespace.extname(depPath);
          const dirPath = ext ? depPath.slice(0, -ext.length) : depPath;
          try {
            const dirFiles = await this.fileRepo.scanDirectory(dirPath);
            for (const f of dirFiles) {
              depResults.push({
                layer: extractLayer(f, layerRules),
                layerRoot: extractLayerRoot(f, layerRules),
                filePath: relativeToLayer(f, layerRules),
                intent: extractIntentFromContent(
                  await this.fileRepo.readFile(f),
                  getLanguage(f)
                ) || path__namespace.basename(f)
              });
            }
          } catch {
          }
          continue;
        }
        const depContent = await this.fileRepo.readFile(depPath);
        const depLayer = extractLayer(depPath, layerRules);
        const depLanguage = getLanguage(depPath);
        const depIntent = extractIntentFromContent(depContent, depLanguage) || path__namespace.basename(depPath);
        depResults.push({
          layer: depLayer,
          layerRoot: extractLayerRoot(depPath, layerRules),
          filePath: relativeToLayer(depPath, layerRules),
          intent: depIntent
        });
      } catch {
        continue;
      }
    }
    const entryLayerRoot = extractLayerRoot(entryPath, layerRules);
    const sameLayer = [];
    const crossLayer = [];
    for (const dep of depResults) {
      const info2 = {
        layer: dep.layer,
        filePath: dep.filePath,
        intent: dep.intent
      };
      if (dep.layerRoot !== entryLayerRoot) {
        crossLayer.push(info2);
      } else if (dep.layer !== extractLayer(entryPath, layerRules)) {
        crossLayer.push(info2);
      } else {
        sameLayer.push(info2);
      }
    }
    return {
      entry: {
        filePath: relativeToLayer(entryPath, layerRules),
        intent: entryIntent,
        layer: entryLayer
      },
      dependencies: {
        same_layer: sameLayer,
        ...crossLayer.length > 0 ? { cross_layer: crossLayer } : {}
      }
    };
  }
}
function escapeBlockCommentText(text) {
  const noTerminator = text.replace(/\*\//g, "*\\/");
  return noTerminator.replace(/^@/gm, "\\@");
}
function escapeLineCommentText(text) {
  return text.replace(/^@/gm, "\\@");
}
function unescapeIntentText(text) {
  const restoredTerminator = text.replace(/\*\\\//g, "*/");
  return restoredTerminator.replace(/\\@/g, "@");
}
function generateIntentBlock(pathname, intent) {
  const ext = path__namespace.extname(pathname).toLowerCase();
  const language = LanguageConfig.getLanguageFromExtension(ext);
  if (language) {
    const blockDelim = LanguageConfig.getCommentBlockDelimiters(language);
    if (blockDelim) {
      const escapedIntent = escapeBlockCommentText(intent);
      const lines = escapedIntent.split("\n");
      const body2 = lines.map((l) => `${blockDelim.linePrefix} ${l}`).join("\n");
      return `${blockDelim.start}
${blockDelim.linePrefix} @intent
${body2}
${blockDelim.end}
`;
    }
    const prefixes = LanguageConfig.getCommentPrefixes(language);
    if (prefixes.length > 0) {
      const prefix = prefixes[0];
      const escapedIntent = escapeLineCommentText(intent);
      const lines = escapedIntent.split("\n");
      const body2 = lines.map((l) => `${prefix} ${l}`).join("\n");
      return `${prefix} @intent
${body2}
`;
    }
  }
  return `@intent
${intent}
`;
}
async function replaceIntentInContent(content, newBlock, pathname) {
  const tsResult = await replaceWithTreeSitter(content, newBlock, pathname);
  if (tsResult !== null) {
    return tsResult;
  }
  return replaceWithRegex(content, newBlock);
}
async function replaceWithTreeSitter(content, newBlock, pathname) {
  try {
    const ext = path__namespace.extname(pathname).toLowerCase();
    const language = LanguageConfig.getLanguageFromExtension(ext);
    if (!language) return null;
    const parser = await TreeSitterManager.getParser();
    const lang = await TreeSitterManager.getLanguage(language);
    if (!lang) return null;
    parser.setLanguage(lang);
    const tree = parser.parse(content);
    if (!tree || !tree.rootNode) return null;
    const node = findIntentCommentNode(tree.rootNode);
    if (!node) return null;
    let startNode = node;
    let endNode = node;
    let prev = node.previousSibling;
    while (prev && isCommentNode(prev)) {
      startNode = prev;
      prev = prev.previousSibling;
    }
    let next = node.nextSibling;
    while (next && isCommentNode(next)) {
      endNode = next;
      next = next.nextSibling;
    }
    const startIdx = startNode.startIndex;
    const endIdx = endNode.endIndex;
    return content.slice(0, startIdx) + newBlock.trimEnd() + "\n" + content.slice(endIdx);
  } catch {
    return null;
  }
}
function isCommentNode(node) {
  const type = node.type;
  return type === "comment" || type === "line_comment" || type === "block_comment" || type === "documentation_comment";
}
function findIntentCommentNode(node) {
  if (isCommentNode(node) && node.text && typeof node.text === "string" && node.text.includes("@intent")) {
    return node;
  }
  if (node.children && Array.isArray(node.children) && node.children.length > 0) {
    for (const child of node.children) {
      const result = findIntentCommentNode(child);
      if (result) return result;
    }
  }
  if (node.namedChildren && Array.isArray(node.namedChildren) && node.namedChildren.length > 0) {
    for (const child of node.namedChildren) {
      const result = findIntentCommentNode(child);
      if (result) return result;
    }
  }
  return null;
}
function replaceWithRegex(content, newBlock) {
  const patterns = [
    // // @intent 及后续 // 行
    /\/\/[ \t]*@intent[^\n]*(?:\n[ \t]*\/\/[^\n]*)*\n?/,
    // # @intent 及后续 # 行（Python、Ruby、R 等）
    /#[ \t]*@intent[^\n]*(?:\n[ \t]*#[^\n]*)*\n?/,
    // -- @intent 及后续 -- 行（SQL、Lua 等）
    /--[ \t]*@intent[^\n]*(?:\n[ \t]*--[^\n]*)*\n?/,
    // /** @intent */ 块注释（JSDoc、C 风格）
    /\/\*\*[\s\S]*?@intent[\s\S]*?\*\/\n?/
  ];
  for (const pattern of patterns) {
    if (pattern.test(content)) {
      return content.replace(pattern, newBlock.trimEnd() + "\n");
    }
  }
  const shebangMatch = content.match(/^#!.*\n/);
  if (shebangMatch) {
    const pos = shebangMatch[0].length;
    return content.slice(0, pos) + newBlock.trimEnd() + "\n\n" + content.slice(pos);
  }
  return newBlock.trimEnd() + "\n\n" + content;
}
class ProjectIntentUseCase {
  constructor(fileRepo) {
    this.fileRepo = fileRepo;
  }
  async execute(input) {
    const { path: filePath, intent, force } = input;
    const exists = await this.fileRepo.exists(filePath);
    if (exists && !force) {
      return {
        path: filePath,
        created: false,
        updated: false
      };
    }
    const intentBlock = generateIntentBlock(filePath, intent);
    if (!exists) {
      await this.fileRepo.writeFile(filePath, intentBlock);
      return { path: filePath, created: true, updated: false };
    }
    const existingContent = await this.fileRepo.readFile(filePath);
    const updatedContent = await replaceIntentInContent(existingContent, intentBlock, filePath);
    await this.fileRepo.writeFile(filePath, updatedContent);
    return { path: filePath, created: false, updated: true };
  }
}
function defaultExtractIntent(content) {
  var _a;
  const match = content.match(/@intent[:\s]+(.+)/);
  return ((_a = match == null ? void 0 : match[1]) == null ? void 0 : _a.trim()) ?? null;
}
class ListFolderIntentsUseCase {
  constructor(fileRepo, extractIntent = defaultExtractIntent) {
    this.fileRepo = fileRepo;
    this.extractIntent = extractIntent;
  }
  /**
   * @contract
   * 扫描文件夹，提取所有文件的 @intent。
   * 输入：folder - 目标文件夹路径（绝对路径）
   * 输出：ListFolderIntentsResult - 包含文件夹路径、子目录名、文件意图列表
   * 副作用：读文件系统
   */
  async execute(folder) {
    const filePaths = await this.fileRepo.scanDirectory(folder, { recursive: false });
    const subdirectories = await this.fileRepo.listSubdirectories(folder);
    const files = [];
    for (const filePath of filePaths) {
      try {
        const content = await this.fileRepo.readFile(filePath);
        const intent = this.extractIntent(content);
        const fileName = filePath.split(/[\/\\]/).pop() || filePath;
        files.push({ file: fileName, intent });
      } catch {
      }
    }
    return { folder, subdirectories, files };
  }
}
function extractIntentFromLines(lines) {
  let inIntent = false;
  let parts2 = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!inIntent) {
      const tagMatch = trimmed.match(/^(\*|\/\/|#|\/\*)?\s*@intent\b/);
      if (tagMatch) {
        inIntent = true;
        const inline = trimmed.replace(/^(\*|\/\/|#|\/\*)?\s*@intent[:\s]*/, "").trim();
        if (inline) parts2.push(inline);
        continue;
      }
      continue;
    }
    if (trimmed === "*/" || trimmed === "") break;
    if (/^\*?\s*@\w/.test(trimmed) && !/^\*?\s*@intent\b/.test(trimmed)) break;
    if (/^\/\/\s*@\w/.test(trimmed)) break;
    if (/^#\s*@\w/.test(trimmed)) break;
    const text = trimmed.replace(/^\*\s?/, "").replace(/^\/\/\s?/, "").replace(/^#\s?/, "").trim();
    if (text) parts2.push(text);
  }
  return parts2.length > 0 ? unescapeIntentText(parts2.join(" ")) : null;
}
var utils$4 = {};
const WIN_SLASH = "\\\\/";
const WIN_NO_SLASH = `[^${WIN_SLASH}]`;
const DEFAULT_MAX_EXTGLOB_RECURSION = 0;
const DOT_LITERAL = "\\.";
const PLUS_LITERAL = "\\+";
const QMARK_LITERAL = "\\?";
const SLASH_LITERAL = "\\/";
const ONE_CHAR = "(?=.)";
const QMARK = "[^/]";
const END_ANCHOR = `(?:${SLASH_LITERAL}|$)`;
const START_ANCHOR = `(?:^|${SLASH_LITERAL})`;
const DOTS_SLASH = `${DOT_LITERAL}{1,2}${END_ANCHOR}`;
const NO_DOT = `(?!${DOT_LITERAL})`;
const NO_DOTS = `(?!${START_ANCHOR}${DOTS_SLASH})`;
const NO_DOT_SLASH = `(?!${DOT_LITERAL}{0,1}${END_ANCHOR})`;
const NO_DOTS_SLASH = `(?!${DOTS_SLASH})`;
const QMARK_NO_DOT = `[^.${SLASH_LITERAL}]`;
const STAR = `${QMARK}*?`;
const SEP = "/";
const POSIX_CHARS = {
  DOT_LITERAL,
  PLUS_LITERAL,
  QMARK_LITERAL,
  SLASH_LITERAL,
  ONE_CHAR,
  QMARK,
  END_ANCHOR,
  DOTS_SLASH,
  NO_DOT,
  NO_DOTS,
  NO_DOT_SLASH,
  NO_DOTS_SLASH,
  QMARK_NO_DOT,
  STAR,
  START_ANCHOR,
  SEP
};
const WINDOWS_CHARS = {
  ...POSIX_CHARS,
  SLASH_LITERAL: `[${WIN_SLASH}]`,
  QMARK: WIN_NO_SLASH,
  STAR: `${WIN_NO_SLASH}*?`,
  DOTS_SLASH: `${DOT_LITERAL}{1,2}(?:[${WIN_SLASH}]|$)`,
  NO_DOT: `(?!${DOT_LITERAL})`,
  NO_DOTS: `(?!(?:^|[${WIN_SLASH}])${DOT_LITERAL}{1,2}(?:[${WIN_SLASH}]|$))`,
  NO_DOT_SLASH: `(?!${DOT_LITERAL}{0,1}(?:[${WIN_SLASH}]|$))`,
  NO_DOTS_SLASH: `(?!${DOT_LITERAL}{1,2}(?:[${WIN_SLASH}]|$))`,
  QMARK_NO_DOT: `[^.${WIN_SLASH}]`,
  START_ANCHOR: `(?:^|[${WIN_SLASH}])`,
  END_ANCHOR: `(?:[${WIN_SLASH}]|$)`,
  SEP: "\\"
};
const POSIX_REGEX_SOURCE$1 = {
  __proto__: null,
  alnum: "a-zA-Z0-9",
  alpha: "a-zA-Z",
  ascii: "\\x00-\\x7F",
  blank: " \\t",
  cntrl: "\\x00-\\x1F\\x7F",
  digit: "0-9",
  graph: "\\x21-\\x7E",
  lower: "a-z",
  print: "\\x20-\\x7E ",
  punct: "\\-!\"#$%&'()\\*+,./:;<=>?@[\\]^_`{|}~",
  space: " \\t\\r\\n\\v\\f",
  upper: "A-Z",
  word: "A-Za-z0-9_",
  xdigit: "A-Fa-f0-9"
};
var constants$2 = {
  DEFAULT_MAX_EXTGLOB_RECURSION,
  MAX_LENGTH: 1024 * 64,
  POSIX_REGEX_SOURCE: POSIX_REGEX_SOURCE$1,
  // regular expressions
  REGEX_BACKSLASH: /\\(?![*+?^${}(|)[\]])/g,
  REGEX_NON_SPECIAL_CHARS: /^[^@![\].,$*+?^{}()|\\/]+/,
  REGEX_SPECIAL_CHARS: /[-*+?.^${}(|)[\]]/,
  REGEX_SPECIAL_CHARS_BACKREF: /(\\?)((\W)(\3*))/g,
  REGEX_SPECIAL_CHARS_GLOBAL: /([-*+?.^${}(|)[\]])/g,
  REGEX_REMOVE_BACKSLASH: /(?:\[.*?[^\\]\]|\\(?=.))/g,
  // Replace globs with equivalent patterns to reduce parsing time.
  REPLACEMENTS: {
    __proto__: null,
    "***": "*",
    "**/**": "**",
    "**/**/**": "**"
  },
  // Digits
  CHAR_0: 48,
  /* 0 */
  CHAR_9: 57,
  /* 9 */
  // Alphabet chars.
  CHAR_UPPERCASE_A: 65,
  /* A */
  CHAR_LOWERCASE_A: 97,
  /* a */
  CHAR_UPPERCASE_Z: 90,
  /* Z */
  CHAR_LOWERCASE_Z: 122,
  /* z */
  CHAR_LEFT_PARENTHESES: 40,
  /* ( */
  CHAR_RIGHT_PARENTHESES: 41,
  /* ) */
  CHAR_ASTERISK: 42,
  /* * */
  // Non-alphabetic chars.
  CHAR_AMPERSAND: 38,
  /* & */
  CHAR_AT: 64,
  /* @ */
  CHAR_BACKWARD_SLASH: 92,
  /* \ */
  CHAR_CARRIAGE_RETURN: 13,
  /* \r */
  CHAR_CIRCUMFLEX_ACCENT: 94,
  /* ^ */
  CHAR_COLON: 58,
  /* : */
  CHAR_COMMA: 44,
  /* , */
  CHAR_DOT: 46,
  /* . */
  CHAR_DOUBLE_QUOTE: 34,
  /* " */
  CHAR_EQUAL: 61,
  /* = */
  CHAR_EXCLAMATION_MARK: 33,
  /* ! */
  CHAR_FORM_FEED: 12,
  /* \f */
  CHAR_FORWARD_SLASH: 47,
  /* / */
  CHAR_GRAVE_ACCENT: 96,
  /* ` */
  CHAR_HASH: 35,
  /* # */
  CHAR_HYPHEN_MINUS: 45,
  /* - */
  CHAR_LEFT_ANGLE_BRACKET: 60,
  /* < */
  CHAR_LEFT_CURLY_BRACE: 123,
  /* { */
  CHAR_LEFT_SQUARE_BRACKET: 91,
  /* [ */
  CHAR_LINE_FEED: 10,
  /* \n */
  CHAR_NO_BREAK_SPACE: 160,
  /* \u00A0 */
  CHAR_PERCENT: 37,
  /* % */
  CHAR_PLUS: 43,
  /* + */
  CHAR_QUESTION_MARK: 63,
  /* ? */
  CHAR_RIGHT_ANGLE_BRACKET: 62,
  /* > */
  CHAR_RIGHT_CURLY_BRACE: 125,
  /* } */
  CHAR_RIGHT_SQUARE_BRACKET: 93,
  /* ] */
  CHAR_SEMICOLON: 59,
  /* ; */
  CHAR_SINGLE_QUOTE: 39,
  /* ' */
  CHAR_SPACE: 32,
  /*   */
  CHAR_TAB: 9,
  /* \t */
  CHAR_UNDERSCORE: 95,
  /* _ */
  CHAR_VERTICAL_LINE: 124,
  /* | */
  CHAR_ZERO_WIDTH_NOBREAK_SPACE: 65279,
  /* \uFEFF */
  /**
   * Create EXTGLOB_CHARS
   */
  extglobChars(chars) {
    return {
      "!": { type: "negate", open: "(?:(?!(?:", close: `))${chars.STAR})` },
      "?": { type: "qmark", open: "(?:", close: ")?" },
      "+": { type: "plus", open: "(?:", close: ")+" },
      "*": { type: "star", open: "(?:", close: ")*" },
      "@": { type: "at", open: "(?:", close: ")" }
    };
  },
  /**
   * Create GLOB_CHARS
   */
  globChars(win32) {
    return win32 === true ? WINDOWS_CHARS : POSIX_CHARS;
  }
};
(function(exports2) {
  const {
    REGEX_BACKSLASH,
    REGEX_REMOVE_BACKSLASH,
    REGEX_SPECIAL_CHARS,
    REGEX_SPECIAL_CHARS_GLOBAL
  } = constants$2;
  exports2.isObject = (val) => val !== null && typeof val === "object" && !Array.isArray(val);
  exports2.hasRegexChars = (str) => REGEX_SPECIAL_CHARS.test(str);
  exports2.isRegexChar = (str) => str.length === 1 && exports2.hasRegexChars(str);
  exports2.escapeRegex = (str) => str.replace(REGEX_SPECIAL_CHARS_GLOBAL, "\\$1");
  exports2.toPosixSlashes = (str) => str.replace(REGEX_BACKSLASH, "/");
  exports2.isWindows = () => {
    if (typeof navigator !== "undefined" && navigator.platform) {
      const platform = navigator.platform.toLowerCase();
      return platform === "win32" || platform === "windows";
    }
    if (typeof process !== "undefined" && process.platform) {
      return process.platform === "win32";
    }
    return false;
  };
  exports2.removeBackslashes = (str) => {
    return str.replace(REGEX_REMOVE_BACKSLASH, (match) => {
      return match === "\\" ? "" : match;
    });
  };
  exports2.escapeLast = (input, char, lastIdx) => {
    const idx = input.lastIndexOf(char, lastIdx);
    if (idx === -1) return input;
    if (input[idx - 1] === "\\") return exports2.escapeLast(input, char, idx - 1);
    return `${input.slice(0, idx)}\\${input.slice(idx)}`;
  };
  exports2.removePrefix = (input, state = {}) => {
    let output = input;
    if (output.startsWith("./")) {
      output = output.slice(2);
      state.prefix = "./";
    }
    return output;
  };
  exports2.wrapOutput = (input, state = {}, options = {}) => {
    const prepend = options.contains ? "" : "^";
    const append = options.contains ? "" : "$";
    let output = `${prepend}(?:${input})${append}`;
    if (state.negated === true) {
      output = `(?:^(?!${output}).*$)`;
    }
    return output;
  };
  exports2.basename = (path2, { windows } = {}) => {
    const segs = path2.split(windows ? /[\\/]/ : "/");
    const last = segs[segs.length - 1];
    if (last === "") {
      return segs[segs.length - 2];
    }
    return last;
  };
})(utils$4);
const utils$3 = utils$4;
const {
  CHAR_ASTERISK,
  /* * */
  CHAR_AT,
  /* @ */
  CHAR_BACKWARD_SLASH,
  /* \ */
  CHAR_COMMA,
  /* , */
  CHAR_DOT,
  /* . */
  CHAR_EXCLAMATION_MARK,
  /* ! */
  CHAR_FORWARD_SLASH,
  /* / */
  CHAR_LEFT_CURLY_BRACE,
  /* { */
  CHAR_LEFT_PARENTHESES,
  /* ( */
  CHAR_LEFT_SQUARE_BRACKET,
  /* [ */
  CHAR_PLUS,
  /* + */
  CHAR_QUESTION_MARK,
  /* ? */
  CHAR_RIGHT_CURLY_BRACE,
  /* } */
  CHAR_RIGHT_PARENTHESES,
  /* ) */
  CHAR_RIGHT_SQUARE_BRACKET
  /* ] */
} = constants$2;
const isPathSeparator = (code) => {
  return code === CHAR_FORWARD_SLASH || code === CHAR_BACKWARD_SLASH;
};
const depth = (token) => {
  if (token.isPrefix !== true) {
    token.depth = token.isGlobstar ? Infinity : 1;
  }
};
const scan$1 = (input, options) => {
  const opts = options || {};
  const length = input.length - 1;
  const scanToEnd = opts.parts === true || opts.scanToEnd === true;
  const slashes = [];
  const tokens = [];
  const parts2 = [];
  let str = input;
  let index = -1;
  let start2 = 0;
  let lastIndex = 0;
  let isBrace = false;
  let isBracket = false;
  let isGlob = false;
  let isExtglob = false;
  let isGlobstar = false;
  let braceEscaped = false;
  let backslashes = false;
  let negated = false;
  let negatedExtglob = false;
  let finished = false;
  let braces = 0;
  let prev;
  let code;
  let token = { value: "", depth: 0, isGlob: false };
  const eos = () => index >= length;
  const peek = () => str.charCodeAt(index + 1);
  const advance = () => {
    prev = code;
    return str.charCodeAt(++index);
  };
  while (index < length) {
    code = advance();
    let next;
    if (code === CHAR_BACKWARD_SLASH) {
      backslashes = token.backslashes = true;
      code = advance();
      if (code === CHAR_LEFT_CURLY_BRACE) {
        braceEscaped = true;
      }
      continue;
    }
    if (braceEscaped === true || code === CHAR_LEFT_CURLY_BRACE) {
      braces++;
      while (eos() !== true && (code = advance())) {
        if (code === CHAR_BACKWARD_SLASH) {
          backslashes = token.backslashes = true;
          advance();
          continue;
        }
        if (code === CHAR_LEFT_CURLY_BRACE) {
          braces++;
          continue;
        }
        if (braceEscaped !== true && code === CHAR_DOT && (code = advance()) === CHAR_DOT) {
          isBrace = token.isBrace = true;
          isGlob = token.isGlob = true;
          finished = true;
          if (scanToEnd === true) {
            continue;
          }
          break;
        }
        if (braceEscaped !== true && code === CHAR_COMMA) {
          isBrace = token.isBrace = true;
          isGlob = token.isGlob = true;
          finished = true;
          if (scanToEnd === true) {
            continue;
          }
          break;
        }
        if (code === CHAR_RIGHT_CURLY_BRACE) {
          braces--;
          if (braces === 0) {
            braceEscaped = false;
            isBrace = token.isBrace = true;
            finished = true;
            break;
          }
        }
      }
      if (scanToEnd === true) {
        continue;
      }
      break;
    }
    if (code === CHAR_FORWARD_SLASH) {
      slashes.push(index);
      tokens.push(token);
      token = { value: "", depth: 0, isGlob: false };
      if (finished === true) continue;
      if (prev === CHAR_DOT && index === start2 + 1) {
        start2 += 2;
        continue;
      }
      lastIndex = index + 1;
      continue;
    }
    if (opts.noext !== true) {
      const isExtglobChar = code === CHAR_PLUS || code === CHAR_AT || code === CHAR_ASTERISK || code === CHAR_QUESTION_MARK || code === CHAR_EXCLAMATION_MARK;
      if (isExtglobChar === true && peek() === CHAR_LEFT_PARENTHESES) {
        isGlob = token.isGlob = true;
        isExtglob = token.isExtglob = true;
        finished = true;
        if (code === CHAR_EXCLAMATION_MARK && index === start2) {
          negatedExtglob = true;
        }
        if (scanToEnd === true) {
          while (eos() !== true && (code = advance())) {
            if (code === CHAR_BACKWARD_SLASH) {
              backslashes = token.backslashes = true;
              code = advance();
              continue;
            }
            if (code === CHAR_RIGHT_PARENTHESES) {
              isGlob = token.isGlob = true;
              finished = true;
              break;
            }
          }
          continue;
        }
        break;
      }
    }
    if (code === CHAR_ASTERISK) {
      if (prev === CHAR_ASTERISK) isGlobstar = token.isGlobstar = true;
      isGlob = token.isGlob = true;
      finished = true;
      if (scanToEnd === true) {
        continue;
      }
      break;
    }
    if (code === CHAR_QUESTION_MARK) {
      isGlob = token.isGlob = true;
      finished = true;
      if (scanToEnd === true) {
        continue;
      }
      break;
    }
    if (code === CHAR_LEFT_SQUARE_BRACKET) {
      while (eos() !== true && (next = advance())) {
        if (next === CHAR_BACKWARD_SLASH) {
          backslashes = token.backslashes = true;
          advance();
          continue;
        }
        if (next === CHAR_RIGHT_SQUARE_BRACKET) {
          isBracket = token.isBracket = true;
          isGlob = token.isGlob = true;
          finished = true;
          break;
        }
      }
      if (scanToEnd === true) {
        continue;
      }
      break;
    }
    if (opts.nonegate !== true && code === CHAR_EXCLAMATION_MARK && index === start2) {
      negated = token.negated = true;
      start2++;
      continue;
    }
    if (opts.noparen !== true && code === CHAR_LEFT_PARENTHESES) {
      isGlob = token.isGlob = true;
      if (scanToEnd === true) {
        while (eos() !== true && (code = advance())) {
          if (code === CHAR_LEFT_PARENTHESES) {
            backslashes = token.backslashes = true;
            code = advance();
            continue;
          }
          if (code === CHAR_RIGHT_PARENTHESES) {
            finished = true;
            break;
          }
        }
        continue;
      }
      break;
    }
    if (isGlob === true) {
      finished = true;
      if (scanToEnd === true) {
        continue;
      }
      break;
    }
  }
  if (opts.noext === true) {
    isExtglob = false;
    isGlob = false;
  }
  let base = str;
  let prefix = "";
  let glob = "";
  if (start2 > 0) {
    prefix = str.slice(0, start2);
    str = str.slice(start2);
    lastIndex -= start2;
  }
  if (base && isGlob === true && lastIndex > 0) {
    base = str.slice(0, lastIndex);
    glob = str.slice(lastIndex);
  } else if (isGlob === true) {
    base = "";
    glob = str;
  } else {
    base = str;
  }
  if (base && base !== "" && base !== "/" && base !== str) {
    if (isPathSeparator(base.charCodeAt(base.length - 1))) {
      base = base.slice(0, -1);
    }
  }
  if (opts.unescape === true) {
    if (glob) glob = utils$3.removeBackslashes(glob);
    if (base && backslashes === true) {
      base = utils$3.removeBackslashes(base);
    }
  }
  const state = {
    prefix,
    input,
    start: start2,
    base,
    glob,
    isBrace,
    isBracket,
    isGlob,
    isExtglob,
    isGlobstar,
    negated,
    negatedExtglob
  };
  if (opts.tokens === true) {
    state.maxDepth = 0;
    if (!isPathSeparator(code)) {
      tokens.push(token);
    }
    state.tokens = tokens;
  }
  if (opts.parts === true || opts.tokens === true) {
    let prevIndex;
    for (let idx = 0; idx < slashes.length; idx++) {
      const n = prevIndex ? prevIndex + 1 : start2;
      const i2 = slashes[idx];
      const value = input.slice(n, i2);
      if (opts.tokens) {
        if (idx === 0 && start2 !== 0) {
          tokens[idx].isPrefix = true;
          tokens[idx].value = prefix;
        } else {
          tokens[idx].value = value;
        }
        depth(tokens[idx]);
        state.maxDepth += tokens[idx].depth;
      }
      if (idx !== 0 || value !== "") {
        parts2.push(value);
      }
      prevIndex = i2;
    }
    if (prevIndex && prevIndex + 1 < input.length) {
      const value = input.slice(prevIndex + 1);
      parts2.push(value);
      if (opts.tokens) {
        tokens[tokens.length - 1].value = value;
        depth(tokens[tokens.length - 1]);
        state.maxDepth += tokens[tokens.length - 1].depth;
      }
    }
    state.slashes = slashes;
    state.parts = parts2;
  }
  return state;
};
var scan_1 = scan$1;
const constants$1 = constants$2;
const utils$2 = utils$4;
const {
  MAX_LENGTH,
  POSIX_REGEX_SOURCE,
  REGEX_NON_SPECIAL_CHARS,
  REGEX_SPECIAL_CHARS_BACKREF,
  REPLACEMENTS
} = constants$1;
const expandRange = (args2, options) => {
  if (typeof options.expandRange === "function") {
    return options.expandRange(...args2, options);
  }
  args2.sort();
  const value = `[${args2.join("-")}]`;
  try {
    new RegExp(value);
  } catch (ex) {
    return args2.map((v) => utils$2.escapeRegex(v)).join("..");
  }
  return value;
};
const syntaxError = (type, char) => {
  return `Missing ${type}: "${char}" - use "\\\\${char}" to match literal characters`;
};
const splitTopLevel = (input) => {
  const parts2 = [];
  let bracket = 0;
  let paren = 0;
  let quote = 0;
  let value = "";
  let escaped = false;
  for (const ch of input) {
    if (escaped === true) {
      value += ch;
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      value += ch;
      escaped = true;
      continue;
    }
    if (ch === '"') {
      quote = quote === 1 ? 0 : 1;
      value += ch;
      continue;
    }
    if (quote === 0) {
      if (ch === "[") {
        bracket++;
      } else if (ch === "]" && bracket > 0) {
        bracket--;
      } else if (bracket === 0) {
        if (ch === "(") {
          paren++;
        } else if (ch === ")" && paren > 0) {
          paren--;
        } else if (ch === "|" && paren === 0) {
          parts2.push(value);
          value = "";
          continue;
        }
      }
    }
    value += ch;
  }
  parts2.push(value);
  return parts2;
};
const isPlainBranch = (branch) => {
  let escaped = false;
  for (const ch of branch) {
    if (escaped === true) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (/[?*+@!()[\]{}]/.test(ch)) {
      return false;
    }
  }
  return true;
};
const normalizeSimpleBranch = (branch) => {
  let value = branch.trim();
  let changed = true;
  while (changed === true) {
    changed = false;
    if (/^@\([^\\()[\]{}|]+\)$/.test(value)) {
      value = value.slice(2, -1);
      changed = true;
    }
  }
  if (!isPlainBranch(value)) {
    return;
  }
  return value.replace(/\\(.)/g, "$1");
};
const hasRepeatedCharPrefixOverlap = (branches) => {
  const values = branches.map(normalizeSimpleBranch).filter(Boolean);
  for (let i2 = 0; i2 < values.length; i2++) {
    for (let j = i2 + 1; j < values.length; j++) {
      const a = values[i2];
      const b = values[j];
      const char = a[0];
      if (!char || a !== char.repeat(a.length) || b !== char.repeat(b.length)) {
        continue;
      }
      if (a === b || a.startsWith(b) || b.startsWith(a)) {
        return true;
      }
    }
  }
  return false;
};
const parseRepeatedExtglob = (pattern, requireEnd = true) => {
  if (pattern[0] !== "+" && pattern[0] !== "*" || pattern[1] !== "(") {
    return;
  }
  let bracket = 0;
  let paren = 0;
  let quote = 0;
  let escaped = false;
  for (let i2 = 1; i2 < pattern.length; i2++) {
    const ch = pattern[i2];
    if (escaped === true) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      quote = quote === 1 ? 0 : 1;
      continue;
    }
    if (quote === 1) {
      continue;
    }
    if (ch === "[") {
      bracket++;
      continue;
    }
    if (ch === "]" && bracket > 0) {
      bracket--;
      continue;
    }
    if (bracket > 0) {
      continue;
    }
    if (ch === "(") {
      paren++;
      continue;
    }
    if (ch === ")") {
      paren--;
      if (paren === 0) {
        if (requireEnd === true && i2 !== pattern.length - 1) {
          return;
        }
        return {
          type: pattern[0],
          body: pattern.slice(2, i2),
          end: i2
        };
      }
    }
  }
};
const buildCharClassStar = (chars) => {
  const source = chars.length === 1 ? utils$2.escapeRegex(chars[0]) : `[${chars.map((ch) => utils$2.escapeRegex(ch)).join("")}]`;
  return `${source}*`;
};
const getStarExtglobSequenceChars = (pattern) => {
  let index = 0;
  const chars = [];
  while (index < pattern.length) {
    const match = parseRepeatedExtglob(pattern.slice(index), false);
    if (!match || match.type !== "*") {
      return;
    }
    const branches = splitTopLevel(match.body).map((branch2) => branch2.trim());
    if (branches.length !== 1) {
      return;
    }
    const branch = normalizeSimpleBranch(branches[0]);
    if (!branch || branch.length !== 1) {
      return;
    }
    chars.push(branch);
    index += match.end + 1;
  }
  if (chars.length < 1) {
    return;
  }
  return chars;
};
const repeatedExtglobRecursion = (pattern) => {
  let depth2 = 0;
  let value = pattern.trim();
  let match = parseRepeatedExtglob(value);
  while (match) {
    depth2++;
    value = match.body.trim();
    match = parseRepeatedExtglob(value);
  }
  return depth2;
};
const analyzeRepeatedExtglob = (body2, options) => {
  if (options.maxExtglobRecursion === false) {
    return { risky: false };
  }
  const max = typeof options.maxExtglobRecursion === "number" ? options.maxExtglobRecursion : constants$1.DEFAULT_MAX_EXTGLOB_RECURSION;
  const branches = splitTopLevel(body2).map((branch) => branch.trim());
  if (branches.length > 1) {
    if (branches.some((branch) => branch === "") || branches.some((branch) => /^[*?]+$/.test(branch)) || hasRepeatedCharPrefixOverlap(branches)) {
      return { risky: true };
    }
  }
  const safeChars = [];
  let sawStarSequence = false;
  let combinable = true;
  for (const branch of branches) {
    const chars = getStarExtglobSequenceChars(branch);
    if (chars) {
      sawStarSequence = true;
      safeChars.push(...chars);
      continue;
    }
    const literal = normalizeSimpleBranch(branch);
    if (literal && literal.length === 1) {
      safeChars.push(literal);
      continue;
    }
    combinable = false;
    if (repeatedExtglobRecursion(branch) > max) {
      return { risky: true };
    }
  }
  if (sawStarSequence) {
    return combinable ? { risky: true, safeOutput: buildCharClassStar([...new Set(safeChars)]) } : { risky: true };
  }
  return { risky: false };
};
const parse$1 = (input, options) => {
  if (typeof input !== "string") {
    throw new TypeError("Expected a string");
  }
  input = REPLACEMENTS[input] || input;
  const opts = { ...options };
  const max = typeof opts.maxLength === "number" ? Math.min(MAX_LENGTH, opts.maxLength) : MAX_LENGTH;
  let len = input.length;
  if (len > max) {
    throw new SyntaxError(`Input length: ${len}, exceeds maximum allowed length: ${max}`);
  }
  const bos = { type: "bos", value: "", output: opts.prepend || "" };
  const tokens = [bos];
  const capture = opts.capture ? "" : "?:";
  const PLATFORM_CHARS = constants$1.globChars(opts.windows);
  const EXTGLOB_CHARS = constants$1.extglobChars(PLATFORM_CHARS);
  const {
    DOT_LITERAL: DOT_LITERAL2,
    PLUS_LITERAL: PLUS_LITERAL2,
    SLASH_LITERAL: SLASH_LITERAL2,
    ONE_CHAR: ONE_CHAR2,
    DOTS_SLASH: DOTS_SLASH2,
    NO_DOT: NO_DOT2,
    NO_DOT_SLASH: NO_DOT_SLASH2,
    NO_DOTS_SLASH: NO_DOTS_SLASH2,
    QMARK: QMARK2,
    QMARK_NO_DOT: QMARK_NO_DOT2,
    STAR: STAR2,
    START_ANCHOR: START_ANCHOR2
  } = PLATFORM_CHARS;
  const globstar = (opts2) => {
    return `(${capture}(?:(?!${START_ANCHOR2}${opts2.dot ? DOTS_SLASH2 : DOT_LITERAL2}).)*?)`;
  };
  const nodot = opts.dot ? "" : NO_DOT2;
  const qmarkNoDot = opts.dot ? QMARK2 : QMARK_NO_DOT2;
  let star = opts.bash === true ? globstar(opts) : STAR2;
  if (opts.capture) {
    star = `(${star})`;
  }
  if (typeof opts.noext === "boolean") {
    opts.noextglob = opts.noext;
  }
  const state = {
    input,
    index: -1,
    start: 0,
    dot: opts.dot === true,
    consumed: "",
    output: "",
    prefix: "",
    backtrack: false,
    negated: false,
    brackets: 0,
    braces: 0,
    parens: 0,
    quotes: 0,
    globstar: false,
    tokens
  };
  input = utils$2.removePrefix(input, state);
  len = input.length;
  const extglobs = [];
  const braces = [];
  const stack = [];
  let prev = bos;
  let value;
  const eos = () => state.index === len - 1;
  const peek = state.peek = (n = 1) => input[state.index + n];
  const advance = state.advance = () => input[++state.index] || "";
  const remaining = () => input.slice(state.index + 1);
  const consume = (value2 = "", num = 0) => {
    state.consumed += value2;
    state.index += num;
  };
  const append = (token) => {
    state.output += token.output != null ? token.output : token.value;
    consume(token.value);
  };
  const negate = () => {
    let count = 1;
    while (peek() === "!" && (peek(2) !== "(" || peek(3) === "?")) {
      advance();
      state.start++;
      count++;
    }
    if (count % 2 === 0) {
      return false;
    }
    state.negated = true;
    state.start++;
    return true;
  };
  const increment = (type) => {
    state[type]++;
    stack.push(type);
  };
  const decrement = (type) => {
    state[type]--;
    stack.pop();
  };
  const push = (tok) => {
    if (prev.type === "globstar") {
      const isBrace = state.braces > 0 && (tok.type === "comma" || tok.type === "brace");
      const isExtglob = tok.extglob === true || extglobs.length && (tok.type === "pipe" || tok.type === "paren");
      if (tok.type !== "slash" && tok.type !== "paren" && !isBrace && !isExtglob) {
        state.output = state.output.slice(0, -prev.output.length);
        prev.type = "star";
        prev.value = "*";
        prev.output = star;
        state.output += prev.output;
      }
    }
    if (extglobs.length && tok.type !== "paren") {
      extglobs[extglobs.length - 1].inner += tok.value;
    }
    if (tok.value || tok.output) append(tok);
    if (prev && prev.type === "text" && tok.type === "text") {
      prev.output = (prev.output || prev.value) + tok.value;
      prev.value += tok.value;
      return;
    }
    tok.prev = prev;
    tokens.push(tok);
    prev = tok;
  };
  const extglobOpen = (type, value2) => {
    const token = { ...EXTGLOB_CHARS[value2], conditions: 1, inner: "" };
    token.prev = prev;
    token.parens = state.parens;
    token.output = state.output;
    token.startIndex = state.index;
    token.tokensIndex = tokens.length;
    const output = (opts.capture ? "(" : "") + token.open;
    increment("parens");
    push({ type, value: value2, output: state.output ? "" : ONE_CHAR2 });
    push({ type: "paren", extglob: true, value: advance(), output });
    extglobs.push(token);
  };
  const extglobClose = (token) => {
    const literal = input.slice(token.startIndex, state.index + 1);
    const body2 = input.slice(token.startIndex + 2, state.index);
    const analysis = analyzeRepeatedExtglob(body2, opts);
    if ((token.type === "plus" || token.type === "star") && analysis.risky) {
      const safeOutput = analysis.safeOutput ? (token.output ? "" : ONE_CHAR2) + (opts.capture ? `(${analysis.safeOutput})` : analysis.safeOutput) : void 0;
      const open = tokens[token.tokensIndex];
      open.type = "text";
      open.value = literal;
      open.output = safeOutput || utils$2.escapeRegex(literal);
      for (let i2 = token.tokensIndex + 1; i2 < tokens.length; i2++) {
        tokens[i2].value = "";
        tokens[i2].output = "";
        delete tokens[i2].suffix;
      }
      state.output = token.output + open.output;
      state.backtrack = true;
      push({ type: "paren", extglob: true, value, output: "" });
      decrement("parens");
      return;
    }
    let output = token.close + (opts.capture ? ")" : "");
    let rest;
    if (token.type === "negate") {
      let extglobStar = star;
      if (token.inner && token.inner.length > 1 && token.inner.includes("/")) {
        extglobStar = globstar(opts);
      }
      if (extglobStar !== star || eos() || /^\)+$/.test(remaining())) {
        output = token.close = `)$))${extglobStar}`;
      }
      if (token.inner.includes("*") && (rest = remaining()) && /^\.[^\\/.]+$/.test(rest)) {
        const expression = parse$1(rest, { ...options, fastpaths: false }).output;
        output = token.close = `)${expression})${extglobStar})`;
      }
      if (token.prev.type === "bos") {
        state.negatedExtglob = true;
      }
    }
    push({ type: "paren", extglob: true, value, output });
    decrement("parens");
  };
  if (opts.fastpaths !== false && !/(^[*!]|[/()[\]{}"])/.test(input)) {
    let backslashes = false;
    let output = input.replace(REGEX_SPECIAL_CHARS_BACKREF, (m, esc, chars, first, rest, index) => {
      if (first === "\\") {
        backslashes = true;
        return m;
      }
      if (first === "?") {
        if (esc) {
          return esc + first + (rest ? QMARK2.repeat(rest.length) : "");
        }
        if (index === 0) {
          return qmarkNoDot + (rest ? QMARK2.repeat(rest.length) : "");
        }
        return QMARK2.repeat(chars.length);
      }
      if (first === ".") {
        return DOT_LITERAL2.repeat(chars.length);
      }
      if (first === "*") {
        if (esc) {
          return esc + first + (rest ? star : "");
        }
        return star;
      }
      return esc ? m : `\\${m}`;
    });
    if (backslashes === true) {
      if (opts.unescape === true) {
        output = output.replace(/\\/g, "");
      } else {
        output = output.replace(/\\+/g, (m) => {
          return m.length % 2 === 0 ? "\\\\" : m ? "\\" : "";
        });
      }
    }
    if (output === input && opts.contains === true) {
      state.output = input;
      return state;
    }
    state.output = utils$2.wrapOutput(output, state, options);
    return state;
  }
  while (!eos()) {
    value = advance();
    if (value === "\0") {
      continue;
    }
    if (value === "\\") {
      const next = peek();
      if (next === "/" && opts.bash !== true) {
        continue;
      }
      if (next === "." || next === ";") {
        continue;
      }
      if (!next) {
        value += "\\";
        push({ type: "text", value });
        continue;
      }
      const match = /^\\+/.exec(remaining());
      let slashes = 0;
      if (match && match[0].length > 2) {
        slashes = match[0].length;
        state.index += slashes;
        if (slashes % 2 !== 0) {
          value += "\\";
        }
      }
      if (opts.unescape === true) {
        value = advance();
      } else {
        value += advance();
      }
      if (state.brackets === 0) {
        push({ type: "text", value });
        continue;
      }
    }
    if (state.brackets > 0 && (value !== "]" || prev.value === "[" || prev.value === "[^")) {
      if (opts.posix !== false && value === ":") {
        const inner = prev.value.slice(1);
        if (inner.includes("[")) {
          prev.posix = true;
          if (inner.includes(":")) {
            const idx = prev.value.lastIndexOf("[");
            const pre = prev.value.slice(0, idx);
            const rest2 = prev.value.slice(idx + 2);
            const posix = POSIX_REGEX_SOURCE[rest2];
            if (posix) {
              prev.value = pre + posix;
              state.backtrack = true;
              advance();
              if (!bos.output && tokens.indexOf(prev) === 1) {
                bos.output = ONE_CHAR2;
              }
              continue;
            }
          }
        }
      }
      if (value === "[" && peek() !== ":" || value === "-" && peek() === "]") {
        value = `\\${value}`;
      }
      if (value === "]" && (prev.value === "[" || prev.value === "[^")) {
        value = `\\${value}`;
      }
      if (opts.posix === true && value === "!" && prev.value === "[") {
        value = "^";
      }
      prev.value += value;
      append({ value });
      continue;
    }
    if (state.quotes === 1 && value !== '"') {
      value = utils$2.escapeRegex(value);
      prev.value += value;
      append({ value });
      continue;
    }
    if (value === '"') {
      state.quotes = state.quotes === 1 ? 0 : 1;
      if (opts.keepQuotes === true) {
        push({ type: "text", value });
      }
      continue;
    }
    if (value === "(") {
      increment("parens");
      push({ type: "paren", value });
      continue;
    }
    if (value === ")") {
      if (state.parens === 0 && opts.strictBrackets === true) {
        throw new SyntaxError(syntaxError("opening", "("));
      }
      const extglob = extglobs[extglobs.length - 1];
      if (extglob && state.parens === extglob.parens + 1) {
        extglobClose(extglobs.pop());
        continue;
      }
      push({ type: "paren", value, output: state.parens ? ")" : "\\)" });
      decrement("parens");
      continue;
    }
    if (value === "[") {
      if (opts.nobracket === true || !remaining().includes("]")) {
        if (opts.nobracket !== true && opts.strictBrackets === true) {
          throw new SyntaxError(syntaxError("closing", "]"));
        }
        value = `\\${value}`;
      } else {
        increment("brackets");
      }
      push({ type: "bracket", value });
      continue;
    }
    if (value === "]") {
      if (opts.nobracket === true || prev && prev.type === "bracket" && prev.value.length === 1) {
        push({ type: "text", value, output: `\\${value}` });
        continue;
      }
      if (state.brackets === 0) {
        if (opts.strictBrackets === true) {
          throw new SyntaxError(syntaxError("opening", "["));
        }
        push({ type: "text", value, output: `\\${value}` });
        continue;
      }
      decrement("brackets");
      const prevValue = prev.value.slice(1);
      if (prev.posix !== true && prevValue[0] === "^" && !prevValue.includes("/")) {
        value = `/${value}`;
      }
      prev.value += value;
      append({ value });
      if (opts.literalBrackets === false || utils$2.hasRegexChars(prevValue)) {
        continue;
      }
      const escaped = utils$2.escapeRegex(prev.value);
      state.output = state.output.slice(0, -prev.value.length);
      if (opts.literalBrackets === true) {
        state.output += escaped;
        prev.value = escaped;
        continue;
      }
      prev.value = `(${capture}${escaped}|${prev.value})`;
      state.output += prev.value;
      continue;
    }
    if (value === "{" && opts.nobrace !== true) {
      increment("braces");
      const open = {
        type: "brace",
        value,
        output: "(",
        outputIndex: state.output.length,
        tokensIndex: state.tokens.length
      };
      braces.push(open);
      push(open);
      continue;
    }
    if (value === "}") {
      const brace = braces[braces.length - 1];
      if (opts.nobrace === true || !brace) {
        push({ type: "text", value, output: value });
        continue;
      }
      let output = ")";
      if (brace.dots === true) {
        const arr = tokens.slice();
        const range = [];
        for (let i2 = arr.length - 1; i2 >= 0; i2--) {
          tokens.pop();
          if (arr[i2].type === "brace") {
            break;
          }
          if (arr[i2].type !== "dots") {
            range.unshift(arr[i2].value);
          }
        }
        output = expandRange(range, opts);
        state.backtrack = true;
      }
      if (brace.comma !== true && brace.dots !== true) {
        const out2 = state.output.slice(0, brace.outputIndex);
        const toks = state.tokens.slice(brace.tokensIndex);
        brace.value = brace.output = "\\{";
        value = output = "\\}";
        state.output = out2;
        for (const t of toks) {
          state.output += t.output || t.value;
        }
      }
      push({ type: "brace", value, output });
      decrement("braces");
      braces.pop();
      continue;
    }
    if (value === "|") {
      if (extglobs.length > 0) {
        extglobs[extglobs.length - 1].conditions++;
      }
      push({ type: "text", value });
      continue;
    }
    if (value === ",") {
      let output = value;
      const brace = braces[braces.length - 1];
      if (brace && stack[stack.length - 1] === "braces") {
        brace.comma = true;
        output = "|";
      }
      push({ type: "comma", value, output });
      continue;
    }
    if (value === "/") {
      if (prev.type === "dot" && state.index === state.start + 1) {
        state.start = state.index + 1;
        state.consumed = "";
        state.output = "";
        tokens.pop();
        prev = bos;
        continue;
      }
      push({ type: "slash", value, output: SLASH_LITERAL2 });
      continue;
    }
    if (value === ".") {
      if (state.braces > 0 && prev.type === "dot") {
        if (prev.value === ".") prev.output = DOT_LITERAL2;
        const brace = braces[braces.length - 1];
        prev.type = "dots";
        prev.output += value;
        prev.value += value;
        brace.dots = true;
        continue;
      }
      if (state.braces + state.parens === 0 && prev.type !== "bos" && prev.type !== "slash") {
        push({ type: "text", value, output: DOT_LITERAL2 });
        continue;
      }
      push({ type: "dot", value, output: DOT_LITERAL2 });
      continue;
    }
    if (value === "?") {
      const isGroup = prev && prev.value === "(";
      if (!isGroup && opts.noextglob !== true && peek() === "(" && peek(2) !== "?") {
        extglobOpen("qmark", value);
        continue;
      }
      if (prev && prev.type === "paren") {
        const next = peek();
        let output = value;
        if (prev.value === "(" && !/[!=<:]/.test(next) || next === "<" && !/<([!=]|\w+>)/.test(remaining())) {
          output = `\\${value}`;
        }
        push({ type: "text", value, output });
        continue;
      }
      if (opts.dot !== true && (prev.type === "slash" || prev.type === "bos")) {
        push({ type: "qmark", value, output: QMARK_NO_DOT2 });
        continue;
      }
      push({ type: "qmark", value, output: QMARK2 });
      continue;
    }
    if (value === "!") {
      if (opts.noextglob !== true && peek() === "(") {
        if (peek(2) !== "?" || !/[!=<:]/.test(peek(3))) {
          extglobOpen("negate", value);
          continue;
        }
      }
      if (opts.nonegate !== true && state.index === 0) {
        negate();
        continue;
      }
    }
    if (value === "+") {
      if (opts.noextglob !== true && peek() === "(" && peek(2) !== "?") {
        extglobOpen("plus", value);
        continue;
      }
      if (prev && prev.value === "(" || opts.regex === false) {
        push({ type: "plus", value, output: PLUS_LITERAL2 });
        continue;
      }
      if (prev && (prev.type === "bracket" || prev.type === "paren" || prev.type === "brace") || state.parens > 0) {
        push({ type: "plus", value });
        continue;
      }
      push({ type: "plus", value: PLUS_LITERAL2 });
      continue;
    }
    if (value === "@") {
      if (opts.noextglob !== true && peek() === "(" && peek(2) !== "?") {
        push({ type: "at", extglob: true, value, output: "" });
        continue;
      }
      push({ type: "text", value });
      continue;
    }
    if (value !== "*") {
      if (value === "$" || value === "^") {
        value = `\\${value}`;
      }
      const match = REGEX_NON_SPECIAL_CHARS.exec(remaining());
      if (match) {
        value += match[0];
        state.index += match[0].length;
      }
      push({ type: "text", value });
      continue;
    }
    if (prev && (prev.type === "globstar" || prev.star === true)) {
      prev.type = "star";
      prev.star = true;
      prev.value += value;
      prev.output = star;
      state.backtrack = true;
      state.globstar = true;
      consume(value);
      continue;
    }
    let rest = remaining();
    if (opts.noextglob !== true && /^\([^?]/.test(rest)) {
      extglobOpen("star", value);
      continue;
    }
    if (prev.type === "star") {
      if (opts.noglobstar === true) {
        consume(value);
        continue;
      }
      const prior = prev.prev;
      const before = prior.prev;
      const isStart = prior.type === "slash" || prior.type === "bos";
      const afterStar = before && (before.type === "star" || before.type === "globstar");
      if (opts.bash === true && (!isStart || rest[0] && rest[0] !== "/")) {
        push({ type: "star", value, output: "" });
        continue;
      }
      const isBrace = state.braces > 0 && (prior.type === "comma" || prior.type === "brace");
      const isExtglob = extglobs.length && (prior.type === "pipe" || prior.type === "paren");
      if (!isStart && prior.type !== "paren" && !isBrace && !isExtglob) {
        push({ type: "star", value, output: "" });
        continue;
      }
      while (rest.slice(0, 3) === "/**") {
        const after = input[state.index + 4];
        if (after && after !== "/") {
          break;
        }
        rest = rest.slice(3);
        consume("/**", 3);
      }
      if (prior.type === "bos" && eos()) {
        prev.type = "globstar";
        prev.value += value;
        prev.output = globstar(opts);
        state.output = prev.output;
        state.globstar = true;
        consume(value);
        continue;
      }
      if (prior.type === "slash" && prior.prev.type !== "bos" && !afterStar && eos()) {
        state.output = state.output.slice(0, -(prior.output + prev.output).length);
        prior.output = `(?:${prior.output}`;
        prev.type = "globstar";
        prev.output = globstar(opts) + (opts.strictSlashes ? ")" : "|$)");
        prev.value += value;
        state.globstar = true;
        state.output += prior.output + prev.output;
        consume(value);
        continue;
      }
      if (prior.type === "slash" && prior.prev.type !== "bos" && rest[0] === "/") {
        const end = rest[1] !== void 0 ? "|$" : "";
        state.output = state.output.slice(0, -(prior.output + prev.output).length);
        prior.output = `(?:${prior.output}`;
        prev.type = "globstar";
        prev.output = `${globstar(opts)}${SLASH_LITERAL2}|${SLASH_LITERAL2}${end})`;
        prev.value += value;
        state.output += prior.output + prev.output;
        state.globstar = true;
        consume(value + advance());
        push({ type: "slash", value: "/", output: "" });
        continue;
      }
      if (prior.type === "bos" && rest[0] === "/") {
        prev.type = "globstar";
        prev.value += value;
        prev.output = `(?:^|${SLASH_LITERAL2}|${globstar(opts)}${SLASH_LITERAL2})`;
        state.output = prev.output;
        state.globstar = true;
        consume(value + advance());
        push({ type: "slash", value: "/", output: "" });
        continue;
      }
      state.output = state.output.slice(0, -prev.output.length);
      prev.type = "globstar";
      prev.output = globstar(opts);
      prev.value += value;
      state.output += prev.output;
      state.globstar = true;
      consume(value);
      continue;
    }
    const token = { type: "star", value, output: star };
    if (opts.bash === true) {
      token.output = ".*?";
      if (prev.type === "bos" || prev.type === "slash") {
        token.output = nodot + token.output;
      }
      push(token);
      continue;
    }
    if (prev && (prev.type === "bracket" || prev.type === "paren") && opts.regex === true) {
      token.output = value;
      push(token);
      continue;
    }
    if (state.index === state.start || prev.type === "slash" || prev.type === "dot") {
      if (prev.type === "dot") {
        state.output += NO_DOT_SLASH2;
        prev.output += NO_DOT_SLASH2;
      } else if (opts.dot === true) {
        state.output += NO_DOTS_SLASH2;
        prev.output += NO_DOTS_SLASH2;
      } else {
        state.output += nodot;
        prev.output += nodot;
      }
      if (peek() !== "*") {
        state.output += ONE_CHAR2;
        prev.output += ONE_CHAR2;
      }
    }
    push(token);
  }
  while (state.brackets > 0) {
    if (opts.strictBrackets === true) throw new SyntaxError(syntaxError("closing", "]"));
    state.output = utils$2.escapeLast(state.output, "[");
    decrement("brackets");
  }
  while (state.parens > 0) {
    if (opts.strictBrackets === true) throw new SyntaxError(syntaxError("closing", ")"));
    state.output = utils$2.escapeLast(state.output, "(");
    decrement("parens");
  }
  while (state.braces > 0) {
    if (opts.strictBrackets === true) throw new SyntaxError(syntaxError("closing", "}"));
    state.output = utils$2.escapeLast(state.output, "{");
    decrement("braces");
  }
  if (opts.strictSlashes !== true && (prev.type === "star" || prev.type === "bracket")) {
    push({ type: "maybe_slash", value: "", output: `${SLASH_LITERAL2}?` });
  }
  if (state.backtrack === true) {
    state.output = "";
    for (const token of state.tokens) {
      state.output += token.output != null ? token.output : token.value;
      if (token.suffix) {
        state.output += token.suffix;
      }
    }
  }
  return state;
};
parse$1.fastpaths = (input, options) => {
  const opts = { ...options };
  const max = typeof opts.maxLength === "number" ? Math.min(MAX_LENGTH, opts.maxLength) : MAX_LENGTH;
  const len = input.length;
  if (len > max) {
    throw new SyntaxError(`Input length: ${len}, exceeds maximum allowed length: ${max}`);
  }
  input = REPLACEMENTS[input] || input;
  const {
    DOT_LITERAL: DOT_LITERAL2,
    SLASH_LITERAL: SLASH_LITERAL2,
    ONE_CHAR: ONE_CHAR2,
    DOTS_SLASH: DOTS_SLASH2,
    NO_DOT: NO_DOT2,
    NO_DOTS: NO_DOTS2,
    NO_DOTS_SLASH: NO_DOTS_SLASH2,
    STAR: STAR2,
    START_ANCHOR: START_ANCHOR2
  } = constants$1.globChars(opts.windows);
  const nodot = opts.dot ? NO_DOTS2 : NO_DOT2;
  const slashDot = opts.dot ? NO_DOTS_SLASH2 : NO_DOT2;
  const capture = opts.capture ? "" : "?:";
  const state = { negated: false, prefix: "" };
  let star = opts.bash === true ? ".*?" : STAR2;
  if (opts.capture) {
    star = `(${star})`;
  }
  const globstar = (opts2) => {
    if (opts2.noglobstar === true) return star;
    return `(${capture}(?:(?!${START_ANCHOR2}${opts2.dot ? DOTS_SLASH2 : DOT_LITERAL2}).)*?)`;
  };
  const create = (str) => {
    switch (str) {
      case "*":
        return `${nodot}${ONE_CHAR2}${star}`;
      case ".*":
        return `${DOT_LITERAL2}${ONE_CHAR2}${star}`;
      case "*.*":
        return `${nodot}${star}${DOT_LITERAL2}${ONE_CHAR2}${star}`;
      case "*/*":
        return `${nodot}${star}${SLASH_LITERAL2}${ONE_CHAR2}${slashDot}${star}`;
      case "**":
        return nodot + globstar(opts);
      case "**/*":
        return `(?:${nodot}${globstar(opts)}${SLASH_LITERAL2})?${slashDot}${ONE_CHAR2}${star}`;
      case "**/*.*":
        return `(?:${nodot}${globstar(opts)}${SLASH_LITERAL2})?${slashDot}${star}${DOT_LITERAL2}${ONE_CHAR2}${star}`;
      case "**/.*":
        return `(?:${nodot}${globstar(opts)}${SLASH_LITERAL2})?${DOT_LITERAL2}${ONE_CHAR2}${star}`;
      default: {
        const match = /^(.*?)\.(\w+)$/.exec(str);
        if (!match) return;
        const source2 = create(match[1]);
        if (!source2) return;
        return source2 + DOT_LITERAL2 + match[2];
      }
    }
  };
  const output = utils$2.removePrefix(input, state);
  let source = create(output);
  if (source && opts.strictSlashes !== true) {
    source += `${SLASH_LITERAL2}?`;
  }
  return source;
};
var parse_1 = parse$1;
const scan = scan_1;
const parse = parse_1;
const utils$1 = utils$4;
const constants = constants$2;
const isObject = (val) => val && typeof val === "object" && !Array.isArray(val);
const picomatch$2 = (glob, options, returnState = false) => {
  if (Array.isArray(glob)) {
    const fns = glob.map((input) => picomatch$2(input, options, returnState));
    const arrayMatcher = (str) => {
      for (const isMatch of fns) {
        const state2 = isMatch(str);
        if (state2) return state2;
      }
      return false;
    };
    return arrayMatcher;
  }
  const isState = isObject(glob) && glob.tokens && glob.input;
  if (glob === "" || typeof glob !== "string" && !isState) {
    throw new TypeError("Expected pattern to be a non-empty string");
  }
  const opts = options || {};
  const posix = opts.windows;
  const regex = isState ? picomatch$2.compileRe(glob, options) : picomatch$2.makeRe(glob, options, false, true);
  const state = regex.state;
  delete regex.state;
  let isIgnored = () => false;
  if (opts.ignore) {
    const ignoreOpts = { ...options, ignore: null, onMatch: null, onResult: null };
    isIgnored = picomatch$2(opts.ignore, ignoreOpts, returnState);
  }
  const matcher = (input, returnObject = false) => {
    const { isMatch, match, output } = picomatch$2.test(input, regex, options, { glob, posix });
    const result = { glob, state, regex, posix, input, output, match, isMatch };
    if (typeof opts.onResult === "function") {
      opts.onResult(result);
    }
    if (isMatch === false) {
      result.isMatch = false;
      return returnObject ? result : false;
    }
    if (isIgnored(input)) {
      if (typeof opts.onIgnore === "function") {
        opts.onIgnore(result);
      }
      result.isMatch = false;
      return returnObject ? result : false;
    }
    if (typeof opts.onMatch === "function") {
      opts.onMatch(result);
    }
    return returnObject ? result : true;
  };
  if (returnState) {
    matcher.state = state;
  }
  return matcher;
};
picomatch$2.test = (input, regex, options, { glob, posix } = {}) => {
  if (typeof input !== "string") {
    throw new TypeError("Expected input to be a string");
  }
  if (input === "") {
    return { isMatch: false, output: "" };
  }
  const opts = options || {};
  const format = opts.format || (posix ? utils$1.toPosixSlashes : null);
  let match = input === glob;
  let output = match && format ? format(input) : input;
  if (match === false) {
    output = format ? format(input) : input;
    match = output === glob;
  }
  if (match === false || opts.capture === true) {
    if (opts.matchBase === true || opts.basename === true) {
      match = picomatch$2.matchBase(input, regex, options, posix);
    } else {
      match = regex.exec(output);
    }
  }
  return { isMatch: Boolean(match), match, output };
};
picomatch$2.matchBase = (input, glob, options, posix = options && options.windows) => {
  const regex = glob instanceof RegExp ? glob : picomatch$2.makeRe(glob, options);
  return regex.test(utils$1.basename(input, { windows: posix }));
};
picomatch$2.isMatch = (str, patterns, options) => picomatch$2(patterns, options)(str);
picomatch$2.parse = (pattern, options) => {
  if (Array.isArray(pattern)) return pattern.map((p) => picomatch$2.parse(p, options));
  return parse(pattern, { ...options, fastpaths: false });
};
picomatch$2.scan = (input, options) => scan(input, options);
picomatch$2.compileRe = (state, options, returnOutput = false, returnState = false) => {
  if (returnOutput === true) {
    return state.output;
  }
  const opts = options || {};
  const prepend = opts.contains ? "" : "^";
  const append = opts.contains ? "" : "$";
  let source = `${prepend}(?:${state.output})${append}`;
  if (state && state.negated === true) {
    source = `^(?!${source}).*$`;
  }
  const regex = picomatch$2.toRegex(source, options);
  if (returnState === true) {
    regex.state = state;
  }
  return regex;
};
picomatch$2.makeRe = (input, options = {}, returnOutput = false, returnState = false) => {
  if (!input || typeof input !== "string") {
    throw new TypeError("Expected a non-empty string");
  }
  let parsed = { negated: false, fastpaths: true };
  if (options.fastpaths !== false && (input[0] === "." || input[0] === "*")) {
    parsed.output = parse.fastpaths(input, options);
  }
  if (!parsed.output) {
    parsed = parse(input, options);
  }
  return picomatch$2.compileRe(parsed, options, returnOutput, returnState);
};
picomatch$2.toRegex = (source, options) => {
  try {
    const opts = options || {};
    return new RegExp(source, opts.flags || (opts.nocase ? "i" : ""));
  } catch (err2) {
    if (options && options.debug === true) throw err2;
    return /$^/;
  }
};
picomatch$2.constants = constants;
var picomatch_1$1 = picomatch$2;
const pico = picomatch_1$1;
const utils = utils$4;
function picomatch(glob, options, returnState = false) {
  if (options && (options.windows === null || options.windows === void 0)) {
    options = { ...options, windows: utils.isWindows() };
  }
  return pico(glob, options, returnState);
}
Object.assign(picomatch, pico);
var picomatch_1 = picomatch;
const picomatch$1 = /* @__PURE__ */ getDefaultExportFromCjs(picomatch_1);
function isExcluded(relPath, extraPatterns) {
  const parts2 = relPath.split(/[\/\\]/);
  if (parts2.some((p) => p.startsWith(".") || p === "node_modules")) {
    return true;
  }
  if (extraPatterns && extraPatterns.length > 0) {
    const isMatch = picomatch$1(extraPatterns, { dot: true });
    return isMatch(relPath);
  }
  return false;
}
class ProjectIntentsToFilesUseCase {
  constructor(fileRepo) {
    this.fileRepo = fileRepo;
  }
  // ==================== 全量同步 ====================
  /**
   * @contract
   * 全量扫描 sourceRoot，重建 .intentflow/intents/ 投射文件树。
   * 输入：sourceRoot - 项目根目录绝对路径
   * 输出：FullSyncResult - 创建/更新/删除了多少投射文件
   * 副作用：写文件系统，清理过时投射文件
   */
  async fullSync(input) {
    const { sourceRoot, sourceRoots, excludePatterns } = input;
    const outputRoot = path__namespace.join(sourceRoot, ".intentflow", "intents");
    const result = { filesCreated: 0, filesUpdated: 0, filesDeleted: 0 };
    const allFiles = [];
    if (sourceRoots && sourceRoots.length > 0) {
      for (const relRoot of sourceRoots) {
        const absRoot = path__namespace.resolve(sourceRoot, relRoot);
        const exists = await this.fileRepo.exists(absRoot).catch(() => false);
        if (!exists) continue;
        const files = await this.fileRepo.scanDirectory(absRoot, { recursive: true });
        allFiles.push(...files);
      }
    } else {
      const files = await this.fileRepo.scanDirectory(sourceRoot, { recursive: true });
      allFiles.push(...files);
    }
    const activeProjectionPaths = /* @__PURE__ */ new Set();
    for (const absPath of allFiles) {
      const relPath = path__namespace.relative(sourceRoot, absPath);
      if (isExcluded(relPath, excludePatterns)) continue;
      const content = await this.fileRepo.readFile(absPath);
      const intent = extractIntentFromLines(content.split("\n"));
      const projPath = path__namespace.join(outputRoot, relPath) + ".md";
      if (intent) {
        const projContent = this.buildProjectionContent(relPath, intent);
        const exists = await this.fileRepo.exists(projPath);
        await this.fileRepo.writeFile(projPath, projContent);
        if (exists) result.filesUpdated++;
        else result.filesCreated++;
        activeProjectionPaths.add(projPath);
        const lostPath = projPath.replace(/\.md$/, ".lost.md");
        if (await this.fileRepo.exists(lostPath)) {
          await this.fileRepo.deleteFile(lostPath);
        }
      } else {
        const lostPath = projPath.replace(/\.md$/, ".lost.md");
        if (await this.fileRepo.exists(projPath)) {
          await this.fileRepo.renameFile(projPath, lostPath);
          result.filesDeleted++;
        }
      }
    }
    await this.cleanupStaleProjections(outputRoot, activeProjectionPaths);
    return result;
  }
  // ==================== 单文件增量同步 ====================
  /** 判断文件是否在指定的 sourceRoots 范围内 */
  isInRoots(relPath, sourceRoots) {
    if (!sourceRoots || sourceRoots.length === 0) return true;
    return sourceRoots.some((r) => {
      if (r === ".") return true;
      const normR = r.replace(/\\/g, "/");
      const normP = relPath.replace(/\\/g, "/");
      return normP === normR || normP.startsWith(normR + "/");
    });
  }
  /**
   * @contract
   * 单个源文件变更后，更新或删除对应的投射文件。
   * 输入：sourceRoot + filePath（源文件绝对路径）
   * 输出：SyncFileResult
   */
  async syncFile(input) {
    const { sourceRoot, filePath, sourceRoots, excludePatterns } = input;
    const relPath = path__namespace.relative(sourceRoot, filePath);
    if (!relPath || relPath.startsWith("..") || isExcluded(relPath, excludePatterns) || !this.isInRoots(relPath, sourceRoots)) {
      return { projectionWritten: false };
    }
    const outputRoot = path__namespace.join(sourceRoot, ".intentflow", "intents");
    const projPath = path__namespace.join(outputRoot, relPath) + ".md";
    const content = await this.fileRepo.readFile(filePath);
    const intent = extractIntentFromLines(content.split("\n"));
    if (intent) {
      const projContent = this.buildProjectionContent(relPath, intent);
      await this.fileRepo.ensureDir(path__namespace.dirname(projPath));
      await this.fileRepo.writeFile(projPath, projContent);
      const lostPath = projPath.replace(/\.md$/, ".lost.md");
      if (await this.fileRepo.exists(lostPath)) {
        await this.fileRepo.deleteFile(lostPath);
      }
    } else {
      const lostPath = projPath.replace(/\.md$/, ".lost.md");
      if (await this.fileRepo.exists(projPath)) {
        await this.fileRepo.renameFile(projPath, lostPath);
      }
    }
    return { projectionWritten: !!intent };
  }
  /**
   * @contract
   * 源文件被删除后，清除对应的投射文件。
   * 输入：sourceRoot + filePath（被删源文件绝对路径）
   * 输出：RemoveFileResult
   */
  async removeFile(input) {
    const { sourceRoot, filePath, sourceRoots, excludePatterns } = input;
    const relPath = path__namespace.relative(sourceRoot, filePath);
    if (!relPath || relPath.startsWith("..") || isExcluded(relPath, excludePatterns) || !this.isInRoots(relPath, sourceRoots)) {
      return { projectionDeleted: false };
    }
    const outputRoot = path__namespace.join(sourceRoot, ".intentflow", "intents");
    const projPath = path__namespace.join(outputRoot, relPath) + ".md";
    const lostPath = projPath.replace(/\.md$/, ".lost.md");
    let deleted = false;
    if (await this.fileRepo.exists(projPath)) {
      await this.fileRepo.deleteFile(projPath);
      deleted = true;
    }
    if (await this.fileRepo.exists(lostPath)) {
      await this.fileRepo.deleteFile(lostPath);
    }
    return { projectionDeleted: deleted };
  }
  // ==================== 内部方法 ====================
  /** 构建单个文件的投射内容 */
  buildProjectionContent(relPath, intent) {
    const fileName = path__namespace.basename(relPath);
    const normPath = relPath.replace(/\\/g, "/");
    return `# ${fileName}

\`${normPath}\`

**intent:** ${intent}
`;
  }
  /** 清除 .intentflow/intents/ 下不在活跃列表中的文件 */
  async cleanupStaleProjections(outputRoot, activePaths) {
    const allFiles = await this.fileRepo.scanDirectory(outputRoot, { recursive: true });
    for (const absPath of allFiles) {
      if (absPath.endsWith(".md") && !activePaths.has(absPath)) {
        const lostPath = absPath.replace(/\.md$/, ".lost.md");
        if (!await this.fileRepo.exists(lostPath)) {
          await this.fileRepo.deleteFile(absPath);
        }
      }
    }
  }
}
class CoreDIContainer {
  // @warn: 意图包相关（GenerateIntentPackage/MaintainIntentPackages/IntentPackageQueryService）已废弃
  constructor() {
    this.fileRepo = new FileSystemRepository();
    this.cacheRepo = CacheRepositoryImpl.getInstance();
    this.parserRepo = new CodeParserRepositoryImpl();
    this.agentRepo = new AgentRepositoryImpl();
    this.guardToggleStore = new GuardToggleStore();
    this.guardToggleService = new GuardToggleService(this.guardToggleStore);
    this.checkFileSizeUseCase = new CheckFileSizeUseCase(
      this.fileRepo,
      this.parserRepo
    );
    this.traceDependencyChainUseCase = new TraceDependencyChainUseCase(
      this.parserRepo,
      this.fileRepo
    );
    this.projectIntentUseCase = new ProjectIntentUseCase(
      this.fileRepo
    );
    this.listFolderIntentsUseCase = new ListFolderIntentsUseCase(
      this.fileRepo
    );
    this.projectIntentsToFilesUseCase = new ProjectIntentsToFilesUseCase(
      this.fileRepo
    );
  }
}
class DIContainer {
  constructor() {
    this.agentTracker = new AgentRunTracker();
    this.core = new CoreDIContainer();
    this.agentRepo = this.core.agentRepo;
    this.rpcPool = new RpcProcessPool(this.agentRepo);
    this.agentMessagingService = new AgentMessagingService(this.rpcPool);
    this.discoverAgentsUseCase = new DiscoverAgentsUseCase(this.agentRepo);
    this.agentRequestUseCase = new AgentRequestUseCase(this.agentRepo, this.agentMessagingService);
    this.agentCommTools = new AgentCommTools(this.agentRequestUseCase, this.agentTracker);
    this.listAgentsTool = new ListAgentsTool(this.discoverAgentsUseCase);
    this.accessPolicy = new ScopePolicy();
    this.guardToggleService = this.core.guardToggleService;
    this.toolAccessGuard = new ToolAccessGuard(this.accessPolicy, this.guardToggleService);
  }
  static getInstance() {
    if (!DIContainer.instance) {
      DIContainer.instance = new DIContainer();
    }
    return DIContainer.instance;
  }
}
class ClearSubagentCacheCommand {
  register(pi) {
    pi.registerCommand("clear-subagent-cache", {
      description: "清理子 agent 残留的临时目录（iflow-agent-* / iflow-rpc-*）",
      handler: async (_args, ctx) => {
        const tmpBase = node_os.tmpdir();
        let entries;
        try {
          entries = await promises.readdir(tmpBase);
        } catch {
          ctx.ui.notify("无法读取临时目录", "error");
          return;
        }
        const targets = entries.filter(
          (name2) => name2.startsWith("iflow-agent-") || name2.startsWith("iflow-rpc-")
        );
        if (targets.length === 0) {
          ctx.ui.notify("没有需要清理的子 agent 缓存", "info");
          return;
        }
        let deleted = 0;
        let failed = 0;
        for (const name2 of targets) {
          try {
            await promises.rm(node_path.join(tmpBase, name2), { recursive: true, force: true });
            deleted++;
          } catch {
            failed++;
          }
        }
        const msg = `清理了 ${deleted} 个子 agent 临时目录` + (failed > 0 ? `，${failed} 个无法删除（可能正在使用）` : "");
        ctx.ui.notify(msg, deleted > 0 ? "info" : "warn");
      }
    });
  }
}
class GuardToggleCommand {
  constructor(guardToggle) {
    this.guardToggle = guardToggle;
  }
  register(pi) {
    pi.registerCommand("guard-auto", {
      description: "切换工具访问守卫：关闭后 edit/write/bash 不再弹确认框（放行模式）",
      handler: async (_args, ctx) => {
        try {
          const enabled = await this.guardToggle.toggle();
          ctx.ui.notify(
            enabled ? "守卫已开启：恢复确认审查" : "守卫已关闭：edit/write/bash 不再确认（放行模式）",
            enabled ? "info" : "warning"
          );
        } catch {
          ctx.ui.notify("守卫状态写入失败，本次会话已生效", "error");
        }
      }
    });
  }
}
function fmtDuration(ms) {
  if (ms === void 0 || ms < 0) return "...";
  if (ms < 1e3) return `${ms}ms`;
  if (ms < 6e4) return `${(ms / 1e3).toFixed(1)}s`;
  const m = Math.floor(ms / 6e4);
  const s = Math.floor(ms % 6e4 / 1e3);
  return `${m}m${s}s`;
}
function fmtTime(ts) {
  if (ts <= 0) return "";
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`;
}
function fmtCost(cost) {
  if (cost <= 0) return "-";
  if (cost < 0.01) return "<$0.01";
  return `$${cost.toFixed(4)}`;
}
function statusIcon(status, themeFg) {
  switch (status) {
    case "running":
      return themeFg("warning", "▶");
    case "completed":
      return themeFg("success", "✓");
    case "failed":
      return themeFg("error", "✗");
    case "aborted":
      return themeFg("muted", "⊘");
    default:
      return themeFg("dim", "○");
  }
}
function logIcon(level, themeFg) {
  switch (level) {
    case "thinking":
      return themeFg("mdQuote", "🤔");
    case "tool_call":
      return themeFg("accent", "🔧");
    case "tool_result":
      return themeFg("mdCode", "📦");
    case "output":
      return themeFg("toolOutput", "💬");
    case "error":
      return themeFg("error", "❌");
    case "done":
      return themeFg("success", "✅");
    case "question":
      return themeFg("error", "❓");
    case "reply":
      return themeFg("success", "↩");
    case "info":
      return themeFg("dim", "ℹ");
    default:
      return " ";
  }
}
function trunc(text, max) {
  return piTui.truncateToWidth(text, max);
}
const MAX_VISIBLE_AGENTS = 12;
class AgentListPanel {
  constructor(config = {}) {
    this.config = config;
    this.selectedIndex = 0;
    this.scrollOffset = 0;
  }
  /** 重置选中到第一项（在 runs 变更时调用） */
  resetSelection() {
    this.selectedIndex = 0;
    this.scrollOffset = 0;
  }
  /** 选中最后一项（新 agent 加入时跳到它） */
  selectLast(total) {
    if (total === 0) return;
    this.selectedIndex = total - 1;
    this.ensureVisible();
  }
  // ==================== 键盘事件 ====================
  /**
   * 处理列表键盘事件。
   * @returns 是否需要切换到日志视图（enter 按下时）
   */
  handleInput(data, total) {
    if (total === 0) return false;
    if (piTui.matchesKey(data, piTui.Key.up)) {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
      this.ensureVisible();
    } else if (piTui.matchesKey(data, piTui.Key.down)) {
      this.selectedIndex = Math.min(total - 1, this.selectedIndex + 1);
      this.ensureVisible();
    } else if (piTui.matchesKey(data, piTui.Key.enter)) {
      return true;
    } else if (piTui.matchesKey(data, "k") || data === "K") {
      return false;
    } else if (piTui.matchesKey(data, "r") || data === "R") {
      return false;
    }
    return false;
  }
  /** 获取当前选中的索引（外部需要据此获取对应的 run） */
  getSelectedIndex() {
    return this.selectedIndex;
  }
  /** 外部触发 kill 操作时调用，返回被操作的 toolCallId */
  handleKill(runs) {
    if (runs.length === 0) return null;
    const run2 = runs[this.selectedIndex];
    if (run2 && run2.status === "running" && this.config.onKill) {
      this.config.onKill(run2.toolCallId);
    }
    return (run2 == null ? void 0 : run2.toolCallId) ?? null;
  }
  /** 外部触发 retry 操作时调用，返回被操作的 toolCallId */
  handleRetry(runs) {
    if (runs.length === 0) return null;
    const run2 = runs[this.selectedIndex];
    if (run2 && (run2.status === "failed" || run2.status === "aborted") && this.config.onRetry) {
      this.config.onRetry(run2.toolCallId);
    }
    return (run2 == null ? void 0 : run2.toolCallId) ?? null;
  }
  // ==================== 渲染 ====================
  /**
   * 渲染 agent 列表行。
   * @param runs 所有运行记录
   * @param innerWidth 内部可用宽度（不含边框）
   * @param isFocused 列表是否处于焦点状态
   * @param themeFg 主题着色函数
   * @returns 行数组（不含边框包裹，由调用方包裹）
   */
  render(runs, innerWidth, isFocused, themeFg) {
    const lines = [];
    if (runs.length === 0) {
      lines.push(themeFg("dim", "  暂无子 agent 运行记录"));
      lines.push(themeFg("dim", "  调用 spawn_agent 后自动出现"));
      return lines;
    }
    const headerText = "# Agent".padEnd(innerWidth);
    lines.push(themeFg("muted", headerText));
    const visible = runs.slice(this.scrollOffset, this.scrollOffset + MAX_VISIBLE_AGENTS);
    for (let i2 = 0; i2 < visible.length; i2++) {
      const globalIndex = this.scrollOffset + i2;
      const run2 = visible[i2];
      const isSelected = globalIndex === this.selectedIndex && isFocused;
      const icon = statusIcon(run2.status, themeFg);
      const agentName = trunc(run2.agent, 20);
      const statusText = run2.status === "running" ? "运行中" : run2.status === "completed" ? "完成" : run2.status === "failed" ? "失败" : "终止";
      const turnsStr = `${run2.turns}轮`;
      const costStr = fmtCost(run2.cost);
      const modelStr = run2.model ? trunc(run2.model, 12) : "";
      const durStr = run2.durationMs ? fmtDuration(run2.durationMs) : run2.status === "running" ? "..." : "";
      const prefix = isSelected ? themeFg("accent", "▸") : " ";
      const parts2 = [
        prefix,
        icon,
        " ",
        themeFg(isSelected ? "accent" : "text", agentName.padEnd(20)),
        " ",
        themeFg(
          run2.status === "completed" ? "success" : run2.status === "failed" ? "error" : run2.status === "running" ? "warning" : "muted",
          statusText.padEnd(6)
        ),
        " ",
        themeFg("dim", turnsStr.padEnd(5)),
        " ",
        themeFg("dim", costStr.padEnd(8)),
        " ",
        themeFg("dim", modelStr.padEnd(12)),
        " ",
        themeFg("muted", durStr.padEnd(8))
      ];
      let line = parts2.join("");
      line = piTui.truncateToWidth(line, innerWidth);
      lines.push(" " + line);
    }
    return lines;
  }
  // ==================== 内部 ====================
  ensureVisible() {
    if (this.selectedIndex < this.scrollOffset) {
      this.scrollOffset = this.selectedIndex;
    } else if (this.selectedIndex >= this.scrollOffset + MAX_VISIBLE_AGENTS) {
      this.scrollOffset = this.selectedIndex - MAX_VISIBLE_AGENTS + 1;
    }
  }
}
const LOG_AREA_HEIGHT = 12;
class LogPanel {
  constructor() {
    this.logScrollOffset = 0;
    this.lastFingerprint = "";
    this.cachedLines = null;
  }
  // ==================== 键盘事件 ====================
  handleInput(data, logs) {
    const maxScroll = this.getMaxScroll(logs);
    if (piTui.matchesKey(data, piTui.Key.up)) {
      this.logScrollOffset = Math.min(maxScroll, this.logScrollOffset + 1);
      this.cachedLines = null;
    } else if (piTui.matchesKey(data, piTui.Key.down)) {
      this.logScrollOffset = Math.max(0, this.logScrollOffset - 1);
      this.cachedLines = null;
    } else if (piTui.matchesKey(data, piTui.Key.enter) || piTui.matchesKey(data, piTui.Key.escape)) {
      return true;
    }
    return false;
  }
  /** 重置滚动到底部（新日志追加时调用） */
  scrollToBottom() {
    this.logScrollOffset = 0;
  }
  /** 重置状态（切换 agent 时调用） */
  reset() {
    this.logScrollOffset = 0;
    this.lastFingerprint = "";
    this.cachedLines = null;
  }
  // ==================== 渲染 ====================
  /**
   * 渲染日志区域。
   * 始终返回 LOG_AREA_HEIGHT 行，固定行高保证整体布局稳定。
   *
   * @param run 当前选中的 agent 运行状态
   * @param innerWidth 内部可用宽度
   * @param isFocused 日志面板是否在焦点
   * @param themeFg 主题着色函数
   * @returns 固定 LOG_AREA_HEIGHT 行的数组
   */
  render(run2, innerWidth, _isFocused, themeFg) {
    const displayLogs = this.getDisplayLogs(run2);
    const fingerprint = this.computeFingerprint(displayLogs);
    if (fingerprint === this.lastFingerprint && this.cachedLines) {
      return this.cachedLines;
    }
    this.lastFingerprint = fingerprint;
    const logLines = this.buildLogLines(displayLogs, innerWidth, themeFg);
    const result = new Array(LOG_AREA_HEIGHT);
    const visibleLogs = logLines.slice(
      Math.max(0, logLines.length - LOG_AREA_HEIGHT - this.logScrollOffset),
      Math.max(0, logLines.length - this.logScrollOffset)
    );
    for (let i2 = 0; i2 < LOG_AREA_HEIGHT; i2++) {
      if (i2 < visibleLogs.length) {
        result[i2] = visibleLogs[i2];
      } else {
        result[i2] = "";
      }
    }
    this.cachedLines = result;
    return result;
  }
  // ==================== 内部：日志提取 ====================
  /** 获取展示用的日志列表（chain 模式展平处理） */
  getDisplayLogs(run2) {
    if (!run2) return [];
    if (run2.mode === "chain" && run2.steps && run2.steps.length > 0) {
      const allLogs = [];
      for (const step of run2.steps) {
        allLogs.push({
          timestamp: 0,
          level: "info",
          text: `── Step ${step.index}: ${step.agent} (${step.status}) ──`
        });
        const deduped = this.dedupeLogs(step.logs);
        allLogs.push(...deduped);
      }
      return allLogs;
    }
    return this.dedupeLogs(run2.logs);
  }
  /** 日志去重：连续相同 text + level 的日志只保留一条 */
  dedupeLogs(logs) {
    if (logs.length <= 1) return logs;
    const result = [logs[0]];
    for (let i2 = 1; i2 < logs.length; i2++) {
      const prev = result[result.length - 1];
      const curr = logs[i2];
      if (prev.text === curr.text && prev.level === curr.level) {
        continue;
      }
      result.push(curr);
    }
    return result;
  }
  /** 计算日志指纹（用于去重判断） */
  computeFingerprint(logs) {
    if (logs.length === 0) return "empty";
    const last = logs[logs.length - 1];
    return `${logs.length}:${last.level}:${last.text.slice(0, 60)}`;
  }
  /** 获取最大可滚动偏移 */
  getMaxScroll(logs) {
    return Math.max(0, logs.length - LOG_AREA_HEIGHT);
  }
  // ==================== 内部：行构建 ====================
  /** 构建日志展示行 */
  buildLogLines(logs, innerWidth, themeFg) {
    if (logs.length === 0) return [];
    const lines = [];
    for (const log of logs) {
      const time = log.timestamp > 0 ? themeFg("dim", fmtTime(log.timestamp)) : "";
      const icon = logIcon(log.level, themeFg);
      let coloredText;
      switch (log.level) {
        case "error":
          coloredText = themeFg("error", log.text);
          break;
        case "tool_call":
          coloredText = themeFg("accent", trunc(log.text, innerWidth - 12));
          break;
        case "thinking":
          coloredText = themeFg("mdQuote", trunc(log.text, innerWidth - 12));
          break;
        case "output":
          coloredText = themeFg("toolOutput", trunc(log.text, innerWidth - 12));
          break;
        case "done":
          coloredText = themeFg("success", log.text);
          break;
        default:
          coloredText = trunc(log.text, innerWidth - 12);
      }
      const rawLine = `  ${time} ${icon} ${coloredText}`;
      const wrapped = piTui.wrapTextWithAnsi(rawLine, innerWidth);
      for (const wl of wrapped) {
        lines.push(wl);
      }
    }
    return lines;
  }
}
class StatusBar {
  /**
   * 渲染底部状态栏。
   * @returns 单行字符串（不含边框，由调用方包裹 │ │）
   */
  render(runs, summary, innerWidth, themeFg) {
    let statusLine = "";
    if (summary.total === 0) {
      statusLine = themeFg("dim", "待命中");
    } else {
      const runningNames = runs.filter((r) => r.status === "running").map((r) => r.agent);
      if (runningNames.length > 0) {
        statusLine += `${statusIcon("running", themeFg)} ${runningNames.join(", ")}`;
      }
      if (summary.completed > 0 && runningNames.length === 0) {
        statusLine += `${statusIcon("completed", themeFg)} 完成`;
      }
    }
    const keybindings = themeFg("dim", "q关闭  ↑↓  Enter日志  Tab切换");
    const content = `${statusLine}${" ".repeat(Math.max(0, innerWidth - piTui.visibleWidth(statusLine) - piTui.visibleWidth(keybindings)))}${keybindings}`;
    return content;
  }
}
const MIN_TERM_WIDTH = 60;
class SubAgentView {
  constructor(config) {
    this.focusMode = "list";
    this.tracker = config.tracker;
    this.onClose = config.onClose;
    this.onKill = config.onKill;
    this.onRetry = config.onRetry;
    this.agentList = new AgentListPanel({
      onKill: config.onKill,
      onRetry: config.onRetry
    });
    this.logPanel = new LogPanel();
    this.statusBar = new StatusBar();
  }
  // ==================== 键盘事件路由 ====================
  handleInput(data) {
    if (piTui.matchesKey(data, piTui.Key.escape) || piTui.matchesKey(data, "q")) {
      this.onClose();
      return;
    }
    const runs = this.tracker.getAllRuns();
    if (runs.length === 0) return;
    if (piTui.matchesKey(data, piTui.Key.tab)) {
      this.focusMode = this.focusMode === "list" ? "logs" : "list";
      return;
    }
    if (this.focusMode === "list") {
      if (piTui.matchesKey(data, "k") || data === "K") {
        const run2 = runs[this.agentList.getSelectedIndex()];
        if (run2 && run2.status === "running" && this.onKill) {
          this.onKill(run2.toolCallId);
        }
        return;
      }
      if (piTui.matchesKey(data, "r") || data === "R") {
        const run2 = runs[this.agentList.getSelectedIndex()];
        if (run2 && (run2.status === "failed" || run2.status === "aborted") && this.onRetry) {
          this.onRetry(run2.toolCallId);
        }
        return;
      }
      const shouldSwitch = this.agentList.handleInput(data, runs.length);
      if (shouldSwitch) {
        this.focusMode = "logs";
        this.logPanel.reset();
      }
    } else {
      if (piTui.matchesKey(data, piTui.Key.up) || piTui.matchesKey(data, piTui.Key.down)) {
        const selectedRun = runs[this.agentList.getSelectedIndex()];
        if (selectedRun) {
          this.logPanel.handleInput(data, selectedRun.logs);
        }
        return;
      }
      if (piTui.matchesKey(data, piTui.Key.enter) || piTui.matchesKey(data, piTui.Key.escape)) {
        this.focusMode = "list";
        return;
      }
    }
  }
  // ==================== 渲染 ====================
  render(width, themeFg, themeBold) {
    if (width < MIN_TERM_WIDTH) {
      return [
        themeFg("error", `终端太窄 (${width} < ${MIN_TERM_WIDTH})，无法显示仪表盘`)
      ];
    }
    const runs = this.tracker.getAllRuns();
    const summary = this.tracker.getSummary();
    const selectedRun = runs[this.agentList.getSelectedIndex()] ?? void 0;
    const innerW = width - 2;
    const border = (c) => themeFg("border", c);
    const agentLines = this.agentList.render(
      runs,
      innerW,
      this.focusMode === "list",
      themeFg
    );
    const logLines = this.logPanel.render(
      selectedRun,
      innerW,
      this.focusMode === "logs",
      themeFg
    );
    const statusText = this.statusBar.render(runs, summary, innerW, themeFg);
    const title = themeBold ? themeBold("SubAgent Monitor") : "SubAgent Monitor";
    const titleWidth = piTui.visibleWidth(title);
    const topPad = Math.max(0, innerW - titleWidth);
    const result = [];
    result.push(border(`┌ ${title}${"─".repeat(topPad > 0 ? topPad : 0)}┐`));
    for (const al of agentLines) {
      result.push(this.wrapLine(al, innerW, themeFg));
    }
    result.push(border(`├${"─".repeat(innerW)}┤`));
    for (const ll of logLines) {
      result.push(this.wrapLine(ll, innerW, themeFg));
    }
    result.push(border(`├${"─".repeat(innerW)}┤`));
    result.push(this.wrapLine(statusText, innerW, themeFg));
    result.push(border(`└${"─".repeat(innerW)}┘`));
    return result;
  }
  /** 用 │ │ 包裹一行内容，自动补齐右空格 */
  wrapLine(content, innerWidth, _themeFg) {
    const trimmed = piTui.truncateToWidth(content, innerWidth);
    const pad = innerWidth - piTui.visibleWidth(trimmed);
    return `│${trimmed}${" ".repeat(Math.max(0, pad))}│`;
  }
}
async function openSubAgentView(ctx, tracker, options) {
  await ctx.ui.custom(
    (tui, theme, _kb, done) => {
      const themeFg = theme.fg.bind(theme);
      let closed = false;
      let unsub = null;
      const safeDone = (userDismiss) => {
        var _a;
        if (closed) return;
        closed = true;
        unsub == null ? void 0 : unsub();
        if (userDismiss) (_a = options == null ? void 0 : options.onUserDismiss) == null ? void 0 : _a.call(options);
        done(void 0);
      };
      const config = {
        tracker,
        onClose: () => safeDone(true),
        // 用户主动关闭
        onKill: options == null ? void 0 : options.onKill,
        onRetry: options == null ? void 0 : options.onRetry,
        onUserDismiss: options == null ? void 0 : options.onUserDismiss
      };
      const view = new SubAgentView(config);
      unsub = tracker.subscribe(() => {
        if (closed) return;
        if (tracker.getRunningRuns().length === 0 && tracker.getAllRuns().length > 0) {
          safeDone(false);
          return;
        }
        tui.requestRender();
      });
      return {
        render: (w) => {
          var _a;
          if (closed) return [];
          const themeBold = ((_a = theme.bold) == null ? void 0 : _a.bind) ? theme.bold.bind(theme) : void 0;
          return view.render(w, themeFg, themeBold);
        },
        handleInput: (data) => {
          if (closed) return;
          view.handleInput(data);
          tui.requestRender();
        },
        invalidate: () => {
        }
      };
    },
    {
      overlay: true,
      overlayOptions: {
        width: "90%",
        minWidth: MIN_TERM_WIDTH,
        maxHeight: "90%",
        anchor: "center",
        margin: 1
      }
    }
  );
}
const ASK_PARENT_MAX = 3;
function registerChildTools(pi) {
  let askCount = 0;
  pi.on("message_start", () => {
    askCount = 0;
  });
  pi.registerTool({
    name: "ask_parent",
    label: "Ask Parent",
    description: [
      "向主 agent 提问并等待回答。仅在信息缺失、必须澄清才能继续时使用。",
      `单任务最多 ${ASK_PARENT_MAX} 次，超出后必须自行决策。`
    ].join(" "),
    promptSnippet: "Ask the parent agent a question and wait for its answer",
    promptGuidelines: [
      "Use ask_parent only when essential information is missing and guessing would be harmful.",
      `Limit: at most ${ASK_PARENT_MAX} questions per task; after that decide on your own.`,
      "Wait for the answer before proceeding; do not guess or assume."
    ],
    parameters: typebox.Type.Object({
      question: typebox.Type.String({
        description: "要向主 agent 提问的内容（尽量具体，附上必要上下文）"
      })
    }),
    execute: async (_toolCallId, params, _signal, _onUpdate, ctx) => {
      if (askCount >= ASK_PARENT_MAX) {
        return {
          content: [
            {
              type: "text",
              text: `ask_parent 已达单任务上限(${ASK_PARENT_MAX} 次)。请基于已有信息自行决策，不要再提问。`
            }
          ],
          details: {}
        };
      }
      askCount++;
      const answer = await ctx.ui.input(params.question);
      return {
        content: [
          {
            type: "text",
            text: answer ?? "（主 agent 未回答）"
          }
        ],
        details: {}
      };
    }
  });
}
function extension(pi) {
  if (process.env.IFLOW_CHILD === "1") {
    registerChildTools(pi);
    return;
  }
  const container = DIContainer.getInstance();
  const tracker = container.agentTracker;
  let agentViewOpen = false;
  pi.on("session_start", async (_event, ctx) => {
    let userDismissed = false;
    tracker.subscribe(() => {
      if (!agentViewOpen && tracker.getRunningRuns().length > 0 && ctx.mode === "tui" && !userDismissed) {
        agentViewOpen = true;
        openSubAgentView(ctx, tracker, {
          onUserDismiss: () => {
            userDismissed = true;
          }
        }).finally(() => {
          agentViewOpen = false;
        });
      }
    });
  });
  pi.on("session_shutdown", async (_event) => {
    await container.rpcPool.shutdown();
  });
  container.agentCommTools.register(pi);
  container.listAgentsTool.register(pi);
  container.toolAccessGuard.register(pi);
  new ClearSubagentCacheCommand().register(pi);
  new GuardToggleCommand(container.guardToggleService).register(pi);
  pi.registerCommand("sub-agent", {
    description: "打开子 agent 监控视图，查看运行状态、实时日志和详情",
    handler: async (_args, ctx) => {
      if (ctx.mode !== "tui") {
        ctx.ui.notify("/sub-agent 仅在 TUI 模式可用", "error");
        return;
      }
      await openSubAgentView(ctx, tracker);
    }
  });
}
module.exports = extension;
//# sourceMappingURL=extension.js.map
