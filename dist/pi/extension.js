"use strict";
const promises = require("node:fs/promises");
const node_path = require("node:path");
const node_os = require("node:os");
const node_child_process = require("node:child_process");
const node_fs = require("node:fs");
const typebox = require("typebox");
const piTui = require("@earendil-works/pi-tui");
const piCodingAgent = require("@earendil-works/pi-coding-agent");
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
async function collectIncludeFiles(dir) {
  const files = [];
  let entries;
  try {
    entries = await promises.readdir(dir);
  } catch {
    return files;
  }
  for (const name of entries.sort()) {
    const fullPath = node_path.join(dir, name);
    let entryStat;
    try {
      entryStat = await promises.stat(fullPath);
    } catch {
      continue;
    }
    if (entryStat.isFile() && name.endsWith(".md")) {
      files.push(fullPath);
    } else if (entryStat.isDirectory()) {
      const subFiles = await collectIncludeFiles(fullPath);
      files.push(...subFiles);
    }
  }
  return files;
}
async function loadIncludes(includeDir) {
  const mdFiles = await collectIncludeFiles(includeDir);
  if (mdFiles.length === 0) {
    return { text: "", errors: [] };
  }
  const sections = [];
  const errors = [];
  for (const filePath of mdFiles) {
    const fileName = filePath.replace(/\\/g, "/").split("/").pop() || "";
    try {
      const content = await promises.readFile(filePath, "utf-8");
      const parsed = parseFrontmatter(content);
      const title = (parsed == null ? void 0 : parsed.fields["name"]) || fileName.replace(/\.md$/, "");
      const desc = (parsed == null ? void 0 : parsed.fields["description"]) || "";
      const body = (parsed == null ? void 0 : parsed.body) || content.trim();
      const header = desc ? `${title} — ${desc}` : title;
      sections.push(`## ${header}

${body}`);
    } catch (err) {
      errors.push(`${filePath}: ${err.message}`);
    }
  }
  return { text: sections.join("\n\n"), errors };
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
  const name = parsed.fields["name"];
  if (!name) return null;
  const agent = {
    name,
    description: parsed.fields["description"] ?? "",
    tools: parsed.fields["tools"] ? parsed.fields["tools"].split(",").map((t) => t.trim()).filter(Boolean) : void 0,
    model: parsed.fields["model"] || void 0,
    systemPrompt: parsed.body,
    source,
    skillName,
    filePath
  };
  const includeDir = node_path.join(filePath.replace(/SUB-SKILL\.md$/i, ""), "include");
  const { text: includeText, errors: includeErrors } = await loadIncludes(includeDir);
  if (includeText) {
    agent.systemPrompt = `${agent.systemPrompt}

## 参考规范

${includeText}`;
  }
  if (includeErrors.length > 0) {
    agent.includeErrors = includeErrors;
  }
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
    } else if (entryStat.isDirectory() && entry !== "include") {
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
  for (const name of entries) {
    if (!name.endsWith(".md")) continue;
    const filePath = node_path.join(agentsDir, name);
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
  } catch (err) {
    if (err.code === "ENOENT") return { agents, errors };
    errors.push(`${skillsDir}: ${err.message}`);
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
class SubSkillRepository {
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
  async findByName(name, scope) {
    const { agents } = await this.discoverAll(scope);
    return agents.find((a) => a.name === name) ?? null;
  }
}
const SCOPE_SKIP_ENV = "PI_EXT_SKIP";
class RpcProcessPool {
  constructor(agentRepo, baseModel) {
    this.processes = /* @__PURE__ */ new Map();
    this.pending = /* @__PURE__ */ new Map();
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
    for (const name of agentNames) {
      if (this.processes.has(name)) continue;
      try {
        await this.spawnProcess(name);
      } catch (err) {
        errors.push(`${name}: ${err.message}`);
      }
    }
    if (errors.length > 0) {
      throw new Error(`预热失败 (${errors.length}/${agentNames.length}):
${errors.join("\n")}`);
    }
  }
  /**
   * 向指定 agent 下发任务，返回结构化结果。
   * 复用已有进程，不创建新进程。
   */
  async runTask(params) {
    const managed = await this.ensureProcess(params.agent, params.skipExts);
    const timeout = params.timeoutMs ?? 10 * 60 * 1e3;
    let taskText = params.task;
    if (params.context) {
      taskText = `${taskText}

## 上下文

${params.context}`;
    }
    managed.state = "busy";
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(params.agent);
        managed.state = "idle";
        managed.process.kill("SIGTERM");
        setTimeout(() => {
          if (!managed.process.killed) managed.process.kill("SIGKILL");
        }, 5e3).unref();
        reject(new Error(`RPC 任务超时 (${timeout}ms): ${params.agent}`));
      }, timeout);
      this.pending.set(params.agent, {
        resolve,
        reject,
        timer,
        lines: [],
        onEvent: params.onEvent
      });
      const cmd = JSON.stringify({ type: "prompt", message: taskText }) + "\n";
      managed.process.stdin.write(cmd);
    }).finally(() => {
      managed.state = "idle";
    });
  }
  /**
   * Chain 模式：依次执行多个步骤，自动传递 context。
   * 内部调用 runTask，复用进程池。
   */
  async runChain(steps) {
    let prevOutput = "";
    const results = [];
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const task = step.task.replace(/\{previous\}/g, prevOutput);
      const result = await this.runTask({
        agent: step.agent,
        task
      });
      results.push(result);
      if (result.exitCode !== 0) {
        return { results, failedIndex: i };
      }
      prevOutput = result.output;
    }
    return { results, failedIndex: null };
  }
  /**
   * 销毁所有进程。/reload / 项目切换时调用。
   */
  async shutdown() {
    for (const [agent, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(new Error("RPC 进程池已关闭"));
    }
    this.pending.clear();
    const cleanupPromises = [];
    for (const [, managed] of this.processes) {
      cleanupPromises.push(this.killProcess(managed));
    }
    await Promise.all(cleanupPromises);
    this.processes.clear();
  }
  /**
   * 获取当前进程池状态摘要，用于 UI 展示/调试。
   * 返回每个子进程的 agent 名和状态（idle/busy）。
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
  /** 确保进程存在且可用，否则自动重建（按需初始化） */
  async ensureProcess(agentName, skipExts) {
    var _a;
    const managed = this.processes.get(agentName);
    if (managed && !managed.process.killed && managed.process.exitCode === null) {
      if (skipExts && ((_a = managed.skipExts) == null ? void 0 : _a.join(",")) !== skipExts.join(",")) {
        await this.killProcess(managed);
        this.processes.delete(agentName);
        return this.spawnProcess(agentName, skipExts);
      }
      return managed;
    }
    return this.spawnProcess(agentName, skipExts);
  }
  /** 启动一个 agent 子进程 */
  async spawnProcess(agentName, skipExts) {
    const agentDef = await this.agentRepo.findByName(agentName, "sub_skill");
    if (!agentDef) {
      throw new Error(`未找到 agent 定义: "${agentName}"`);
    }
    const tmpDir = await promises.mkdtemp(node_path.join(node_os.homedir(), "rpc-pool-"));
    const sysPromptFile = node_path.join(tmpDir, "system.md");
    await promises.writeFile(sysPromptFile, agentDef.systemPrompt, "utf-8");
    const args = [
      "--mode",
      "rpc",
      "--name",
      agentName,
      "--append-system-prompt",
      sysPromptFile
    ];
    if (this.baseModel) {
      args.push("--model", this.baseModel);
    }
    if (agentDef.model) {
      args.push("--model", agentDef.model);
    }
    if (agentDef.tools && agentDef.tools.length > 0) {
      args.push("--tools", agentDef.tools.join(","));
    }
    const isWindows = node_os.platform() === "win32";
    const pi = this.piInvocation(args);
    const childEnv = { ...process.env };
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
      skipExts
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
      const pending = this.pending.get(agentName);
      if (pending) {
        clearTimeout(pending.timer);
        this.pending.delete(agentName);
        pending.resolve({
          agent: agentName,
          exitCode: code ?? -1,
          output: pending.lines.join("\n").slice(0, 50 * 1024),
          error: signal ? `进程被信号终止: ${signal}` : `进程异常退出 (code=${code})`,
          usage: { input: 0, output: 0, cost: 0, turns: 0 },
          durationMs: 0
        });
      }
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
  /** 处理一行 JSON-L 事件 */
  handleEvent(agentName, line) {
    var _a;
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      return;
    }
    const pending = this.pending.get(agentName);
    if (!pending) return;
    pending.lines.push(line);
    (_a = pending.onEvent) == null ? void 0 : _a.call(pending, event);
    if (event.type === "agent_end") {
      clearTimeout(pending.timer);
      this.pending.delete(agentName);
      const result = this.parseAgentEnd(event, agentName);
      pending.resolve(result);
    }
  }
  /** 从 agent_end 事件中提取结构化结果 */
  parseAgentEnd(event, agentName) {
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
      agent: agentName,
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
  // ==================== 工具函数 ====================
  /** 构造 pi 调用命令（兼容 Windows） */
  piInvocation(args) {
    const currentScript = process.argv[1];
    if (currentScript && node_fs.existsSync(currentScript)) {
      return { command: process.execPath, args: [currentScript, ...args] };
    }
    return { command: "pi", args };
  }
}
function extractText(msg) {
  if (!(msg == null ? void 0 : msg.content)) return "";
  if (typeof msg.content === "string") return msg.content;
  if (Array.isArray(msg.content)) {
    return msg.content.filter((c) => c.type === "text").map((c) => c.text).join("\n");
  }
  return "";
}
function piInvocation(args) {
  const currentScript = process.argv[1];
  if (currentScript && node_fs.existsSync(currentScript)) {
    return { command: process.execPath, args: [currentScript, ...args] };
  }
  return { command: "pi", args };
}
class SubProcessRunner {
  /**
   * @param pool 可选。有池时优先用池，无池时 fallback 到 spawn 一次性模式。
   */
  constructor(pool) {
    this.pool = pool ?? null;
  }
  /**
   * 运行单个 agent 任务。
   * 优先使用 RPC 进程池，不可用时 fallback 到 spawn 一次性模式。
   */
  async run(params) {
    if (this.pool) {
      try {
        const result = await this.pool.runTask({
          agent: params.agentName,
          task: params.task,
          context: params.context,
          timeoutMs: params.timeoutMs,
          skipExts: params.skipExts,
          onEvent: params.onEvent
        });
        return { ...result, durationMs: result.durationMs };
      } catch (err) {
        console.warn(`[SubProcessRunner] RPC 执行失败，fallback 到 spawn: ${err.message}`);
      }
    }
    return this.spawnOnce(params);
  }
  /**
   * 链式执行多步任务。
   * 需要 RPC 进程池，无池时抛错。
   */
  async runChain(steps) {
    if (!this.pool) {
      throw new Error("runChain 需要 RPC 进程池，但未提供");
    }
    return this.pool.runChain(
      steps.map((step) => ({ agent: step.agent, task: step.task }))
    );
  }
  // ==================== Spawn 一次性模式（Fallback） ====================
  async spawnOnce(params) {
    const started = Date.now();
    const promptParts = [params.systemPrompt];
    if (params.context) {
      promptParts.push(`

## 上下文
${params.context}`);
    }
    const tmpDir = await promises.mkdtemp(node_path.join(node_os.homedir(), "agent-"));
    const systemFile = node_path.join(tmpDir, "system.md");
    const taskFile = node_path.join(tmpDir, "task.md");
    try {
      await promises.writeFile(systemFile, promptParts.join(""), "utf-8");
      await promises.writeFile(taskFile, `Task: ${params.task}
`, "utf-8");
      const args = [
        "--mode",
        "json",
        "-p",
        "--no-session"
      ];
      if (params.model) args.push("--model", params.model);
      if (params.tools && params.tools.length > 0) {
        args.push("--tools", params.tools.join(","));
      }
      args.push("--append-system-prompt", systemFile);
      args.push(`@${taskFile}`);
      const isWindows = node_os.platform() === "win32";
      const pi = piInvocation(args);
      let timedOut = false;
      const childEnv = { ...process.env };
      if (params.skipExts && params.skipExts.length > 0) {
        childEnv[SCOPE_SKIP_ENV] = params.skipExts.join(",");
      }
      return await new Promise((resolve) => {
        const child = node_child_process.spawn(pi.command, pi.args, {
          cwd: params.cwd,
          shell: isWindows,
          stdio: ["ignore", "pipe", "pipe"],
          env: childEnv
        });
        let stdout = "";
        let stderr = "";
        const outputParts = [];
        const messages = [];
        const usage = { input: 0, output: 0, cost: 0, turns: 0 };
        let resolvedModel;
        let stopReason;
        let errorMessage;
        const timer = setTimeout(() => {
          timedOut = true;
          child.kill("SIGTERM");
          setTimeout(() => {
            if (!child.killed) child.kill("SIGKILL");
          }, 5e3).unref();
        }, params.timeoutMs);
        timer.unref();
        let buf = "";
        child.stdout.on("data", (data) => {
          var _a;
          buf += data.toString();
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const ev = JSON.parse(line);
              if (ev.type === "message_end" && ev.message) {
                messages.push(ev.message);
                if (ev.message.role === "assistant") {
                  const m = ev.message;
                  usage.turns++;
                  if (m.usage) {
                    usage.input += m.usage.input ?? 0;
                    usage.output += m.usage.output ?? 0;
                    usage.cost += ((_a = m.usage.cost) == null ? void 0 : _a.total) ?? 0;
                  }
                  if (m.model) resolvedModel = m.model;
                  if (m.stopReason) stopReason = m.stopReason;
                  if (m.errorMessage) errorMessage = m.errorMessage;
                  const text = extractText(m);
                  if (text) outputParts.push(text);
                }
              }
              if (ev.type === "tool_result_end" && ev.message) {
                messages.push(ev.message);
              }
            } catch {
            }
          }
        });
        child.stderr.on("data", (data) => {
          stderr += data.toString();
        });
        child.on("close", (code) => {
          clearTimeout(timer);
          const exitCode = timedOut ? -1 : code ?? -1;
          resolve({
            agent: params.agentName,
            exitCode,
            output: outputParts.join("\n").slice(0, 50 * 1024),
            error: timedOut ? `超时(${params.timeoutMs}ms)` : stderr.slice(0, 4 * 1024) || void 0,
            usage,
            model: resolvedModel,
            durationMs: Date.now() - started,
            messages: messages.length > 0 ? messages : void 0,
            stopReason,
            errorMessage
          });
        });
        child.on("error", (err) => {
          clearTimeout(timer);
          resolve({
            agent: params.agentName,
            exitCode: -1,
            output: "",
            error: `spawn 失败: ${err.message}`,
            usage: { input: 0, output: 0, cost: 0, turns: 0 },
            durationMs: Date.now() - started
          });
        });
      });
    } finally {
      await promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {
      });
    }
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
class SpawnAgentUseCase {
  constructor(agentRepo, runner) {
    this.agentRepo = agentRepo;
    this.runner = runner;
  }
  /**
   * @contract execute(input: SpawnAgentInput) => Promise<SpawnAgentOutput>
   * @step [查找 agent] 通过 IAgentRepository.findByName() 获取 AgentDefinition
   * @step [构造参数] 组装 SubProcessRunParams（含 timeout、cwd 等默认值）
   * @step [运行] 通过 ISubProcessRunner.run() 启动子进程
   * @step [返回] 返回 AgentRunResult
   * @boundary agent 不存在时抛出错误
   * @boundary 子进程运行失败时在 result 中体现（exitCode !== 0）
   */
  async execute(input) {
    const agent = await this.agentRepo.findByName(input.agent, "sub_skill");
    if (!agent) {
      throw new Error(`Agent not found: "${input.agent}"`);
    }
    const result = await this.runner.run({
      agentName: agent.name,
      systemPrompt: agent.systemPrompt,
      task: input.task,
      tools: agent.tools,
      model: input.model || agent.model,
      timeoutMs: input.timeoutMs ?? 10 * 60 * 1e3,
      cwd: input.cwd || process.cwd(),
      context: input.context,
      skipExts: input.skipExts,
      onEvent: input.onEvent
    });
    return { result };
  }
}
function formatUsage(result, theme) {
  const parts = [];
  if (result.usage.turns) parts.push(`${result.usage.turns} 轮`);
  if (result.usage.input) parts.push(`↑${result.usage.input}`);
  if (result.usage.output) parts.push(`↓${result.usage.output}`);
  if (result.usage.cost > 0) parts.push(`$${result.usage.cost.toFixed(4)}`);
  if (result.model) parts.push(result.model);
  return parts.length > 0 ? parts.join(" ") : "";
}
function formatToolCall(toolName, args, fg) {
  if (toolName === "bash") {
    const cmd = args.command || "";
    return fg("muted", "$ ") + fg("toolOutput", cmd.length > 60 ? cmd.slice(0, 60) + "..." : cmd);
  }
  if (toolName === "read") {
    const p = args.path || args.file_path || "";
    return fg("muted", "read ") + fg("accent", p);
  }
  const argsStr = JSON.stringify(args);
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
function getFinalOutput(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if ((msg == null ? void 0 : msg.role) === "assistant") {
      for (const part of msg.content || []) {
        if (part.type === "text") return part.text;
      }
    }
  }
  return "";
}
class SpawnAgentTool {
  constructor(useCase) {
    this.useCase = useCase;
  }
  register(pi) {
    pi.registerTool({
      name: "spawn_agent",
      label: "Spawn Agent",
      description: [
        "在隔离子进程中运行一个 agent。",
        "agent 由 skills/<skill>/sub-skill/<agent>/SUB-SKILL.md 定义，",
        "include/ 目录下的 .md 自动注入为参考规范。"
      ].join(" "),
      promptSnippet: "Spawn isolated sub-agents for delegated work",
      promptGuidelines: [
        "Use spawn_agent when a task needs an isolated context separate from the main session.",
        "Chain agents by passing the previous agent's output as context to the next."
      ],
      parameters: typebox.Type.Object({
        agent: typebox.Type.String({
          description: "Agent 名称，对应 skills/<skill>/sub-skill/<agent>/SUB-SKILL.md"
        }),
        task: typebox.Type.String({
          description: "分配给该 agent 的任务描述"
        }),
        context: typebox.Type.Optional(
          typebox.Type.String({
            description: "可选上下文（如上一步 agent 的输出），会追加到 system prompt 中"
          })
        ),
        model: typebox.Type.Optional(
          typebox.Type.String({
            description: "可选模型覆盖。不传则使用 agent 定义或默认模型"
          })
        ),
        timeoutMs: typebox.Type.Optional(
          typebox.Type.Number({
            description: "超时毫秒数。默认 600000（10 分钟）"
          })
        ),
        skipExts: typebox.Type.Optional(
          typebox.Type.Array(typebox.Type.String(), {
            description: '子 agent 中跳过拦截的扩展名列表，如 ["confirm-edit"]'
          })
        )
      }),
      // ── renderCall：工具调用时在终端显示 ────────
      renderCall(args, theme, _context) {
        const name = args.agent || "...";
        const preview = args.task ? args.task.length > 60 ? args.task.slice(0, 60) + "..." : args.task : "...";
        const text = theme.fg("toolTitle", theme.bold("spawn_agent ")) + theme.fg("accent", name) + "\n  " + theme.fg("dim", preview);
        return new piTui.Text(text, 0, 0);
      },
      // ── renderResult：工具返回后在终端显示 ──────
      renderResult(result, { expanded }, theme, _context) {
        var _a;
        const r = (_a = result.details) == null ? void 0 : _a.result;
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
      },
      // ── execute ──────────────────────────────────
      execute: async (_toolCallId, params, _signal, onUpdate, ctx) => {
        const agentName = params.agent;
        ctx.ui.setStatus("subagent", `${agentName} 运行中...`);
        ctx.ui.setWidget("subagent", [
          `── 子进程: ${agentName} ──`,
          "⏳ 启动中...",
          `任务: ${params.task.slice(0, 80)}${params.task.length > 80 ? "..." : ""}`
        ], { placement: "aboveEditor" });
        try {
          const result = await this.useCase.execute({
            agent: agentName,
            task: params.task,
            context: params.context,
            model: params.model,
            timeoutMs: params.timeoutMs,
            skipExts: params.skipExts,
            cwd: ctx.cwd,
            onEvent: (event) => {
              if (event.type === "tool_execution_start") {
                const ev = event;
                const args = ev.args ? JSON.stringify(ev.args).slice(0, 60) : "";
                ctx.ui.setWidget("subagent", [
                  `── 子进程: ${agentName} ──`,
                  `🔧 ${ev.toolName} ${args}`
                ]);
                onUpdate == null ? void 0 : onUpdate({
                  content: [{ type: "text", text: `[${agentName}] 调用工具: ${ev.toolName}` }],
                  details: {}
                });
              } else if (event.type === "message_start") {
                ctx.ui.setWidget("subagent", [
                  `── 子进程: ${agentName} ──`,
                  "🤔 思考中..."
                ]);
              }
            }
          });
          const r = result.result;
          const icon = r.exitCode === 0 ? "✅" : "❌";
          const statusLabel = r.exitCode === 0 ? "完成" : `失败(code=${r.exitCode})`;
          const cost = r.usage.cost > 0 ? ` | $${r.usage.cost.toFixed(4)}` : "";
          const header = `${icon} ${r.agent} ${statusLabel} (${r.durationMs}ms, ${r.usage.turns} 轮${cost})`;
          const modelLine = r.model ? `模型: ${r.model}` : "";
          const errorLine = r.error ? `错误: ${r.error}` : "";
          ctx.ui.setStatus("subagent", `${agentName} ${statusLabel}`);
          ctx.ui.setWidget("subagent", [
            `── 子进程: ${agentName} ──`,
            `${icon} ${statusLabel} (${r.durationMs}ms, ${r.usage.turns} 轮${cost})`
          ]);
          return {
            content: [
              {
                type: "text",
                text: [header, modelLine, errorLine, "", r.output].filter(Boolean).join("\n")
              }
            ],
            details: { result: r }
          };
        } catch (err) {
          ctx.ui.setStatus("subagent", `${agentName} ❌ 异常`);
          ctx.ui.setWidget("subagent", [
            `── 子进程: ${agentName} ──`,
            `❌ ${err.message || err}`
          ]);
          return {
            content: [{ type: "text", text: `spawn_agent 异常: ${err.message || err}` }],
            details: {},
            isError: true
          };
        }
      }
    });
  }
}
class SubagentTool {
  constructor(useCase, agentRepo, runner) {
    this.useCase = useCase;
    this.agentRepo = agentRepo;
    this.runner = runner;
  }
  register(pi) {
    pi.registerTool({
      name: "subagent",
      label: "Subagent",
      description: [
        "Delegate tasks to specialized subagents with isolated context.",
        "Modes: single (agent + task), parallel (tasks array) - Phase 1 only single mode.",
        "Agents discovered from skills/<skill>/sub-skill/<agent>/SUB-SKILL.md"
      ].join(" "),
      parameters: typebox.Type.Object({
        agent: typebox.Type.Optional(
          typebox.Type.String({ description: "Name of the agent to invoke (for single mode)" })
        ),
        task: typebox.Type.Optional(
          typebox.Type.String({ description: "Task to delegate (for single mode)" })
        ),
        skipExts: typebox.Type.Optional(
          typebox.Type.Array(typebox.Type.String(), {
            description: '子 agent 中跳过拦截的扩展名列表，如 ["confirm-edit"]'
          })
        ),
        tasks: typebox.Type.Optional(
          typebox.Type.Array(
            typebox.Type.Object({
              agent: typebox.Type.String(),
              task: typebox.Type.String()
            }),
            { description: "Phase 2+: Array of {agent, task} for parallel execution" }
          )
        ),
        chain: typebox.Type.Optional(
          typebox.Type.Array(
            typebox.Type.Object({
              agent: typebox.Type.String(),
              task: typebox.Type.String({ description: "Task with optional {previous} placeholder" })
            }),
            { description: "Chain mode: Array of {agent, task} for sequential execution. {previous} is replaced with the previous step's output." }
          )
        )
      }),
      execute: async (_toolCallId, params, _signal, onUpdate, ctx) => {
        if (params.chain && params.chain.length > 0) {
          try {
            const result = await this.runner.runChain(
              params.chain.map((step) => ({
                agent: step.agent,
                task: step.task
              }))
            );
            const report = this.formatChainReport(result);
            return {
              content: [{ type: "text", text: report }],
              details: { chainResult: result }
            };
          } catch (err) {
            return {
              content: [{ type: "text", text: `chain 执行失败: ${err.message}` }],
              details: {},
              isError: true
            };
          }
        }
        if (params.agent && params.task) {
          try {
            const result = await this.useCase.execute({
              agent: params.agent,
              task: params.task,
              skipExts: params.skipExts,
              cwd: ctx.cwd
            });
            return {
              content: [{ type: "text", text: result.result.output || "(no output)" }],
              details: { result: result.result }
            };
          } catch (err) {
            return {
              content: [{ type: "text", text: `subagent failed: ${err.message}` }],
              details: {},
              isError: true
            };
          }
        }
        return {
          content: [{ type: "text", text: "请指定执行模式：single (agent + task) 或 chain (chain[])。" }],
          details: {},
          isError: true
        };
      }
    });
  }
  // ==================== 报告格式化 ====================
  formatChainReport(result) {
    const parts = [];
    parts.push(`Chain 执行完成 (${result.results.length} 步)`);
    parts.push("");
    for (let i = 0; i < result.results.length; i++) {
      const r = result.results[i];
      const icon = r.exitCode === 0 ? "✓" : "✗";
      const status = r.exitCode === 0 ? "通过" : `失败(code=${r.exitCode})`;
      const cost = r.usage.cost > 0 ? ` | $${r.usage.cost.toFixed(4)}` : "";
      parts.push(`  ${i + 1}. ${icon} ${r.agent} — ${status} (${r.usage.turns} 轮${cost})`);
    }
    if (result.failedIndex !== null) {
      parts.push("");
      parts.push(`❌ 第 ${result.failedIndex + 1} 步失败，chain 终止`);
      parts.push("");
      parts.push(`失败步骤输出:`);
      parts.push(result.results[result.failedIndex].output.slice(0, 2e3));
    } else {
      parts.push("");
      parts.push("✅ 全部通过");
      const last = result.results[result.results.length - 1];
      if (last.output) {
        parts.push("");
        parts.push(`最终输出:`);
        parts.push(last.output.slice(0, 2e3));
      }
    }
    return parts.join("\n");
  }
}
class DIContainer {
  constructor() {
    this.agentRepo = new SubSkillRepository();
    this.rpcPool = new RpcProcessPool(this.agentRepo);
    this.subProcessRunner = new SubProcessRunner(this.rpcPool);
    this.discoverAgentsUseCase = new DiscoverAgentsUseCase(this.agentRepo);
    this.spawnAgentUseCase = new SpawnAgentUseCase(this.agentRepo, this.subProcessRunner);
    this.spawnAgentTool = new SpawnAgentTool(this.spawnAgentUseCase);
    this.subagentTool = new SubagentTool(this.spawnAgentUseCase, this.agentRepo, this.subProcessRunner);
  }
  static getInstance() {
    if (!DIContainer.instance) {
      DIContainer.instance = new DIContainer();
    }
    return DIContainer.instance;
  }
}
class StopTimeCommand {
  constructor() {
    this.stopRequested = false;
  }
  register(pi, container) {
    pi.registerCommand("stop-time", {
      description: "强制中断当前正在执行的操作，等待工具执行完毕后停止",
      handler: async (_args, ctx) => {
        this.stopRequested = true;
        const processes = container.rpcPool.getProcessSummary();
        const busyList = processes.filter((p) => p.state === "busy");
        let msg = "⏹ 中断信号已发送，等待当前工具执行完毕后停止";
        if (busyList.length > 0) {
          const names = busyList.map((p) => p.agentName).join(", ");
          msg += `
当前有 ${busyList.length} 个子进程忙碌中: ${names}`;
        }
        ctx.ui.notify(msg, "info");
      }
    });
    pi.on("tool_call", async (_event, ctx) => {
      if (this.stopRequested) {
        this.stopRequested = false;
        return { block: true, reason: "用户通过 /stop-time 强制中断" };
      }
    });
    pi.on("agent_end", async () => {
      this.stopRequested = false;
    });
  }
}
class SubSkillCommand {
  register(pi, container) {
    pi.registerCommand("sub-skill", {
      description: "列出 sub-agent。/sub-skill 查看全部，/sub-skill <skill> 只看该 skill 下的",
      handler: async (args, ctx) => {
        const { agents, errors } = await container.agentRepo.discoverAll("sub_skill");
        if (agents.length === 0) {
          ctx.ui.notify("未发现任何 sub-agent", "warn");
          return;
        }
        const filter = (args || "").trim().toLowerCase();
        let msg;
        if (filter) {
          const matched = agents.filter((a) => a.skillName === filter);
          if (matched.length === 0) {
            ctx.ui.notify(`skill "${filter}" 下没有 sub-agent`, "warn");
            return;
          }
          msg = `[${filter}] sub-agent (${matched.length}):
${formatAgentList(matched)}`;
        } else {
          const grouped = groupBySkill(agents);
          const parts = [];
          for (const [skill, list] of grouped) {
            parts.push(`[${skill}] (${list.length}):
${formatAgentList(list)}`);
          }
          msg = `全部 sub-agent (${agents.length}):

${parts.join("\n\n")}`;
        }
        if (errors.length > 0) {
          msg += `

发现错误:
${errors.join("\n")}`;
        }
        ctx.ui.notify(msg, "info");
      }
    });
  }
}
function formatAgentList(agents) {
  return agents.map((a) => {
    const tools = a.tools && a.tools.length > 0 ? `[${a.tools.join(", ")}]` : "无工具";
    return `  ● ${a.name}  — ${a.description}
    工具: ${tools}`;
  }).join("\n");
}
function groupBySkill(agents) {
  const map = /* @__PURE__ */ new Map();
  for (const a of agents) {
    const skill = a.skillName || "?";
    if (!map.has(skill)) map.set(skill, []);
    map.get(skill).push(a);
  }
  return map;
}
function extension(pi) {
  const container = DIContainer.getInstance();
  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.setWidget("subagent", ["── 子进程池 ──", "待命中 (暂无活跃子进程)"], { placement: "aboveEditor" });
  });
  pi.on("session_shutdown", async (_event, ctx) => {
    await container.rpcPool.shutdown();
    ctx.ui.setWidget("subagent", void 0);
  });
  container.spawnAgentTool.register(pi);
  container.subagentTool.register(pi);
  new StopTimeCommand().register(pi, container);
  new SubSkillCommand().register(pi, container);
}
module.exports = extension;
//# sourceMappingURL=extension.js.map
