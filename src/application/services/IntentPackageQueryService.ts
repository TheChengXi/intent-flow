import { IIntentPackageRepository } from '../../data/repositories/IIntentPackageRepository';
import { IntentPackagePublicView, IntentPackage } from '../../data/entities/IntentPackage';

/**
 * @intent
 * 意图包的只读查询入口。
 * 为 MCP 工具和 CLI 提供 get/list/search 能力，
 * 将内部实体（含 hash/pinned/deprecated）映射为公开视图。
 * searchPackages 使用 LLM 进行语义检索，预留 embedding 字段后续升级。
 */

export interface SearchResult {
  packageName: string;
  matchedGroup: string;
  relevance: 'high' | 'medium' | 'low';
  reason: string;
}

export class IntentPackageQueryService {
  private repo: IIntentPackageRepository;
  private llmCall?: (prompt: string) => Promise<string>;

  constructor(
    repo: IIntentPackageRepository,
    llmCall?: (prompt: string) => Promise<string>
  ) {
    this.repo = repo;
    this.llmCall = llmCall;
  }

  // @contract: getPackage(name) => IntentPackagePublicView | null
  // @step: [加载包] 从仓库加载 IntentPackage
  // @step: [检查废弃] deprecated 的包返回 null
  // @step: [转换视图] 调用 toPublicView 去掉内部字段
  // @boundary: 包不存在时返回 null
  async getPackage(name: string): Promise<IntentPackagePublicView | null> {
    const pkg = await this.repo.load(name);
    if (!pkg || pkg.deprecated) return null;
    return this.toPublicView(pkg);
  }

  // @contract: listPackages(includeDeprecated?) => string[]
  // @step: [获取列表] 从仓库获取所有包名
  // @step: [过滤废弃] 如果 includeDeprecated 为 false，加载每个包检查 deprecated 标记
  // @boundary: 默认排除 deprecated 包
  async listPackages(includeDeprecated: boolean = false): Promise<string[]> {
    const names = await this.repo.list();
    if (includeDeprecated) return names;

    const active: string[] = [];
    for (const name of names) {
      const pkg = await this.repo.load(name);
      if (pkg && !pkg.deprecated) {
        active.push(name);
      }
    }
    return active;
  }

  // @contract: searchPackages(query) => SearchResult[]
  // @step: [检查 LLM] 如果没有配置 llmCall，返回空数组
  // @step: [粗筛] 读取所有包名 + summary，LLM 粗筛候选包
  // @step: [精排] 对候选包加载完整数据，LLM 精排匹配组
  // @boundary: 无 LLM 时返回空数组（将来可降级为字符串匹配）
  async searchPackages(query: string): Promise<SearchResult[]> {
    if (!this.llmCall) return [];

    const names = await this.listPackages(false);
    if (names.length === 0) return [];

    const candidates = await this.coarseFilter(query, names);
    return this.fineRank(query, candidates);
  }

  // @step: [粗筛] 读取每个包的摘要，LLM 选出候选包
  private async coarseFilter(query: string, names: string[]): Promise<string[]> {
    const summaries: { name: string; summary: string }[] = [];
    for (const name of names) {
      const pkg = await this.repo.load(name);
      if (pkg) summaries.push({ name, summary: pkg.summary });
    }

    const coarsePrompt = `查询: "${query}"\n\n可用包:\n${
      summaries.map(s => `- ${s.name}: ${s.summary}`).join('\n')
    }\n\n请选出最相关的 1-3 个包名，用逗号分隔输出。`;

    try {
      const result = await this.llmCall!(coarsePrompt);
      return result.split(',').map(s => s.trim()).filter(Boolean);
    } catch {
      return [];
    }
  }

  // @step: [精排] 对候选包加载完整数据，LLM 输出每个匹配的组和理由
  private async fineRank(query: string, candidates: string[]): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    for (const name of candidates) {
      const pkg = await this.repo.load(name);
      if (!pkg) continue;

      const finePrompt = `查询: "${query}"\n\n包 "${name}" 的完整内容:\n${
        JSON.stringify({ summary: pkg.summary, groups: pkg.groups })
      }\n\n从 groups 中找出最匹配的一个组，输出 JSON: { "groupName": "...", "relevance": "high|medium|low", "reason": "..." }`;

      try {
        const result = await this.llmCall!(finePrompt);
        const parsed = JSON.parse(result);
        results.push({
          packageName: name,
          matchedGroup: parsed.groupName || '',
          relevance: parsed.relevance || 'medium',
          reason: parsed.reason || '',
        });
      } catch {
        results.push({
          packageName: name,
          matchedGroup: '',
          relevance: 'low',
          reason: '解析 LLM 结果失败',
        });
      }
    }

    return results;
  }

  // @contract: toPublicView(pkg) => IntentPackagePublicView
  // @step: [映射字段] 只保留 packageName/summary/groups/crossRefs
  // @step: [屏蔽内部字段] 去掉 hash/pinned/deprecated/embedding
  private toPublicView(pkg: IntentPackage): IntentPackagePublicView {
    return {
      packageName: pkg.packageName,
      summary: pkg.summary,
      groups: pkg.groups,
      crossRefs: pkg.crossRefs,
    };
  }
}
