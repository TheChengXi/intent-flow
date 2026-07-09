import { IntentPackage, IntentFileRef, CrossReference } from '../../data/entities/IntentPackage';
import { createHash } from 'crypto';
import * as yaml from 'js-yaml';

/**
 * @intent
 * 聚类生成引擎（纯函数）。
 * 接收一个文件夹的所有 @intent + 内部依赖关系，
 * 调用 LLM 识别语义簇，输出结构化 IntentPackage。
 * 不碰文件系统、不决策覆盖——调用方负责。
 */

export interface IntentFileIntent {
  filePath: string;
  intent: string;
}

export interface DependencyEdge {
  from: string;
  to: string;
}

export interface GenerateIntentPackageInput {
  folderName: string;
  intents: IntentFileIntent[];
  dependencyEdges: DependencyEdge[];
}

export type GenerateIntentPackageOutput = IntentPackage;

export interface IGenerateIntentPackageUseCase {
  execute(input: GenerateIntentPackageInput): Promise<GenerateIntentPackageOutput>;
}

export class GenerateIntentPackageUseCase implements IGenerateIntentPackageUseCase {
  private llmCall: (prompt: string) => Promise<string>;

  constructor(llmCall: (prompt: string) => Promise<string>) {
    this.llmCall = llmCall;
  }

  // @contract: execute(input) => Promise<IntentPackage>
  // @step: [构建 prompt] 将 @intent 列表 + 依赖关系组装成 LLM prompt
  // @step: [调用 LLM] 调用 llmCall 获取聚类结果
  // @step: [解析 YAML] 将 LLM 返回的 YAML 解析为 IntentPackage
  // @step: [计算 hash] 从输入 intents 计算 SHA256 哈希
  // @step: [填充默认字段] pinned: false / deprecated: false / embedding: []
  // @step: [返回] 返回完整的 IntentPackage
  // @boundary: LLM 调用失败或返回空时抛出
  // @boundary: YAML 解析失败时抛出
  async execute(input: GenerateIntentPackageInput): Promise<GenerateIntentPackageOutput> {
    // @step: 构建 LLM prompt
    const prompt = this.buildPrompt(input);

    // @step: 调用 LLM
    let llmResponse = await this.llmCall(prompt);
    if (!llmResponse || llmResponse.trim().length === 0) {
      throw new Error('LLM returned empty response');
    }

    // @step: 剥离 markdown 代码块标记（安全兜底，防止 LLM 仍返回 ```yaml）
    llmResponse = llmResponse.replace(/^```\w*\s*\n?/gm, '').replace(/\n?```\s*$/gm, '').trim();

    // @step: 解析 YAML
    const parsed = yaml.load(llmResponse) as Partial<IntentPackage>;

    if (!parsed || !parsed.groups || !Array.isArray(parsed.groups) || parsed.groups.length === 0) {
      throw new Error('LLM response missing required fields: groups');
    }

    // @step: 计算 hash
    const hash = this.computeHash(input.intents);

    // @step: 填充默认字段
    const result: IntentPackage = {
      packageName: parsed.packageName || input.folderName,
      summary: parsed.summary || '',
      groups: parsed.groups,
      crossRefs: parsed.crossRefs || [],
      hash,
      pinned: false,
      deprecated: false,
      embedding: [],
    };

    return result;
  }

  // @contract: buildPrompt(input) => string
  // @step: [列出文件意图] 列出每个文件的 @intent
  // @step: [列出依赖关系] 列出文件间的依赖
  // @note: system prompt 由调用方提供（通过 buildSystemPrompt 注册表），
  //   本方法只组装动态数据部分作为 user message
  private buildPrompt(input: GenerateIntentPackageInput): string {
    const intentLines = input.intents
      .map(i => `  - file: ${i.filePath}\n    intent: ${i.intent}`)
      .join('\n');

    const depLines = input.dependencyEdges.length > 0
      ? input.dependencyEdges.map(e => `  - ${e.from} → ${e.to}`).join('\n')
      : '  (无)';

    return `文件夹: ${input.folderName}

文件意图列表:
${intentLines}

文件间依赖关系:
${depLines}`;
  }

  // @contract: computeHash(intents) => string
  // @step: [排序] 按 filePath 字典序排序
  // @step: [拼接] 将所有 intent 拼接
  // @step: [SHA256] 计算 SHA256 哈希
  private computeHash(intents: IntentFileIntent[]): string {
    const sorted = [...intents].sort((a, b) => a.filePath.localeCompare(b.filePath));
    const canonical = sorted.map(i => i.intent).join('\n');
    return createHash('sha256').update(canonical, 'utf-8').digest('hex');
  }
}
