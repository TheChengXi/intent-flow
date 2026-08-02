/**
 * @intent
 * 编排 ICodeParserRepository（解析 import）和 IFileRepository（读取文件）的数据，
 * 产出 TraceDependencyChainOutput 供 TraceDependencyChainTool（Adapter/MCP）使用。
 * 职责细分：
 * - 读取入口文件 → 解析 import 列表 → 对每个依赖提取 @intent → 按同层/跨层分组
 * 依赖接口：
 * - ICodeParserRepository（Data）：解析 TypeScript import 语句，处理相对路径 -> 绝对路径解析
 * - IFileRepository（Data）：读取文件内容、检查文件是否存在
 * 边界：入口文件不存在时报错；依赖文件读取失败跳过单条不影响整体；无 @intent 时 fallback 为文件名。
 */

import { ICodeParserRepository } from '../../data/repositories/ICodeParserRepository';
import { IFileRepository } from '../../data/repositories/IFileRepository';
import { LanguageConfig } from '../../data/services/tree-sitter/LanguageConfig';
import { ImportExtractor } from '../../data/services/codeContext/extractors/import/ImportExtractor';
import { IUseCase } from './IUseCase';
import * as path from 'path';

// ==================== 类型定义 ====================

/** 架构层级匹配规则 */
export interface LayerMatchRule {
  /** 层级名称（用于标识，实际层级名从 pattern 捕获组提取） */
  name: string;
  /** 正则字符串，应包含一个捕获组匹配层级目录名 */
  pattern: string;
  /** 是否提取该层后第一个子目录作为子模块名（如 adapter → adapter/mcp） */
  subModule?: boolean;
}

/** 架构层级检测配置 */
export interface LayerConfig {
  /** 层规则列表，按优先级顺序匹配（首条匹配即止） */
  rules: LayerMatchRule[];
}

export interface TraceDependencyChainInput {
  /** 入口文件路径（绝对路径） */
  entryFile: string;
  /** 架构层级检测配置（默认 IntentFlow 三层：data/application/adapter） */
  layerConfig?: LayerConfig;
}

export interface DependencyInfo {
  /** 架构层级（data / application / adapter / adapter/mcp 等） */
  layer: string;
  /** 相对于层级的路径（如 mcp/DIContainer.ts） */
  filePath: string;
  /** @intent 内容 */
  intent: string;
}

export interface TraceDependencyChainOutput {
  /** 入口文件信息 */
  entry: {
    filePath: string;
    intent: string;
    layer: string;
  };
  /** 依赖分组 */
  dependencies: {
    /** 同层依赖（同架构层 + 同子模块） */
    same_layer: DependencyInfo[];
    /** 跨层依赖（不同架构层 或 不同适配器），不存在时省略 */
    cross_layer?: DependencyInfo[];
  };
}

export interface ITraceDependencyChainUseCase
  extends IUseCase<TraceDependencyChainInput, TraceDependencyChainOutput> {
  execute(input: TraceDependencyChainInput): Promise<TraceDependencyChainOutput>;
}

// ==================== 层级检测（可配置） ====================

/** IntentFlow 框架默认三层架构规则 */
const DEFAULT_LAYER_RULES: LayerMatchRule[] = [
  { name: 'adapter', pattern: '/(adapter)(/|$)', subModule: true },
  { name: 'application', pattern: '/(application)(/|$)' },
  { name: 'data', pattern: '/(data)(/|$)' },
];

/** 从文件路径中提取架构层级，适配器层包含子模块名称 */
function extractLayer(filePath: string, rules?: LayerMatchRule[]): string {
  const normalized = filePath.replace(/\\/g, '/');
  const activeRules = rules || DEFAULT_LAYER_RULES;

  for (const rule of activeRules) {
    const match = normalized.match(new RegExp(rule.pattern));
    if (match) {
      if (rule.subModule) {
        const afterIndex = (match.index || 0) + match[0].length;
        const subDir = normalized.slice(afterIndex).split('/')[0];
        return subDir ? `${match[1]}/${subDir}` : match[1];
      }
      return match[1];
    }
  }
  return 'unknown';
}

/** 提取层级根目录名，用于同层/跨层比较 */
function extractLayerRoot(filePath: string, rules?: LayerMatchRule[]): string {
  const normalized = filePath.replace(/\\/g, '/');
  const activeRules = rules || DEFAULT_LAYER_RULES;

  for (const rule of activeRules) {
    const match = normalized.match(new RegExp(rule.pattern));
    if (match) return match[1];
  }
  return 'unknown';
}

/** 计算相对于层级的路径（如 src/adapter/mcp/foo.ts → mcp/foo.ts） */
function relativeToLayer(filePath: string, rules?: LayerMatchRule[]): string {
  const normalized = filePath.replace(/\\/g, '/');
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

/** 从文件内容中提取 @intent 注释，支持多语言注释风格 */
function extractIntentFromContent(content: string, language?: string): string | null {
  const lines = content.split('\n').slice(0, 50);
  const prefixes = language ? LanguageConfig.getCommentPrefixes(language) : ['//', '#'];
  const stripPrefixes = [...new Set([...prefixes, '*'])];

  let inIntent = false;
  let parts: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '*/' || trimmed === '') {
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
            if (tagMatch[1]) parts.push(tagMatch[1].trim());
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
    if (text) parts.push(text);
  }

  return parts.length > 0 ? parts.join(' ') : null;
}

/** 获取文件的语言类型 */
function getLanguage(filePath: string): string {
  return LanguageConfig.getLanguageFromExtension(path.extname(filePath)) || 'typescript';
}

// ==================== UseCase ====================

export class TraceDependencyChainUseCase
  implements ITraceDependencyChainUseCase
{
  constructor(
    private codeParserRepo: ICodeParserRepository,
    private fileRepo: IFileRepository
  ) {}

  // @contract: execute(input: TraceDependencyChainInput) => Promise<TraceDependencyChainOutput>
  // @step: [解析路径] 将入口文件路径解析为绝对路径
  // @step: [读取入口] 读取入口文件内容
  // @step: [解析导入] 使用 codeParserRepo 提取 import 语句
  // @step: [获取语义] 对每个依赖文件，读取并提取 @intent
  // @step: [层级分组] 按同层/跨层分组依赖
  // @step: [组装结果] 构建扁平化输出
  // @boundary: 文件不存在时抛出错误；无 @intent 时使用文件名作为 fallback
  async execute(
    input: TraceDependencyChainInput
  ): Promise<TraceDependencyChainOutput> {
    const entryPath = path.resolve(input.entryFile);
    const layerRules = input.layerConfig?.rules;

    const entryExists = await this.fileRepo.exists(entryPath);
    if (!entryExists) {
      throw new Error(`入口文件不存在: ${entryPath}`);
    }

    const entryContent = await this.fileRepo.readFile(entryPath);
    const entryLayer = extractLayer(entryPath, layerRules);
    const entryLanguage = getLanguage(entryPath);
    const entryIntent = extractIntentFromContent(entryContent, entryLanguage) || path.basename(entryPath);

    const entryDir = path.dirname(entryPath);
    const language = entryLanguage;
    const resolver = ImportExtractor.getResolver(language);
    const importBaseDir = resolver
      ? await resolver.getImportBaseDir(entryPath, entryDir)
      : entryDir;

    const importedPaths = await this.codeParserRepo.extractImports(
      entryContent,
      importBaseDir,
      language
    );

    const depResults: Array<{
      layer: string;
      layerRoot: string;
      filePath: string;
      intent: string;
    }> = [];

    for (const depPath of importedPaths) {
      try {
        const depExists = await this.fileRepo.exists(depPath);

        if (!depExists) {
          const ext = path.extname(depPath);
          const dirPath = ext ? depPath.slice(0, -ext.length) : depPath;
          try {
            const dirFiles = await this.fileRepo.scanDirectory(dirPath);
            for (const f of dirFiles) {
              depResults.push({
                layer: extractLayer(f, layerRules),
                layerRoot: extractLayerRoot(f, layerRules),
                filePath: relativeToLayer(f, layerRules),
                intent: extractIntentFromContent(
                  await this.fileRepo.readFile(f), getLanguage(f)
                ) || path.basename(f),
              });
            }
          } catch { /* skip */ }
          continue;
        }

        const depContent = await this.fileRepo.readFile(depPath);
        const depLayer = extractLayer(depPath, layerRules);
        const depLanguage = getLanguage(depPath);
        const depIntent = extractIntentFromContent(depContent, depLanguage) || path.basename(depPath);

        depResults.push({
          layer: depLayer,
          layerRoot: extractLayerRoot(depPath, layerRules),
          filePath: relativeToLayer(depPath, layerRules),
          intent: depIntent,
        });
      } catch { continue; }
    }

    const entryLayerRoot = extractLayerRoot(entryPath, layerRules);

    const sameLayer: DependencyInfo[] = [];
    const crossLayer: DependencyInfo[] = [];

    for (const dep of depResults) {
      const info: DependencyInfo = {
        layer: dep.layer,
        filePath: dep.filePath,
        intent: dep.intent,
      };

      if (dep.layerRoot !== entryLayerRoot) {
        crossLayer.push(info);
      } else if (dep.layer !== extractLayer(entryPath, layerRules)) {
        crossLayer.push(info);
      } else {
        sameLayer.push(info);
      }
    }

    return {
      entry: {
        filePath: relativeToLayer(entryPath, layerRules),
        intent: entryIntent,
        layer: entryLayer,
      },
      dependencies: {
        same_layer: sameLayer,
        ...(crossLayer.length > 0 ? { cross_layer: crossLayer } : {}),
      },
    };
  }
}
