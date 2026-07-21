/**
 * /init-feature — Feature 开发状态机（自动检测版）
 *
 * 手动触发 + 自动检测双机制：
 *   1. /init-feature 命令启动流水线（无 feature 时进入 requirement）
 *   2. 每次 turn_end 检测文件变更，自动派发下一阶段
 *
 * 状态判断基于文件存在性，不依赖内存缓存做派发决策。
 * 内存仅记录「上次扫描时的文件状态」，用于检测新增文件。
 *
 * 状态规则：
 *   无 requirement.md → requirement 阶段
 *   有 requirement.md + 无 design.md → design 阶段
 *   有 design.md → execute 阶段（later-on.md 不参与判断）
 *
 * 用法：
 *   /init-feature          自动选择最靠前的 feature
 *   /init-feature <name>   指定 feature
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

interface FeatureInfo {
	name: string;
	dir: string;
	phase: "requirement" | "design" | "execute" | "complete";
}

interface FileState {
	hasReq: boolean;
	hasDesign: boolean;
}

export default function (pi: ExtensionAPI) {
	// ── 记录每个 feature 最近一次扫描时的文件状态 ──
	// 仅用于检测"新文件出现"，不做派发授权判断
	const lastFiles = new Map<string, FileState>();

	// ── session 启动时初始化文件状态快照 ──
	pi.on("session_start", async (_event, ctx) => {
		const features = scanAll(join(ctx.cwd, ".cdd"));
		for (const f of features) {
			lastFiles.set(f.name, readFileState(f.dir));
		}
	});

	// ── 自动检测：每次 turn 结束后比较文件变化 ──
	pi.on("turn_end", async (_event, ctx) => {
		const cddDir = join(ctx.cwd, ".cdd");
		if (!existsSync(cddDir)) return;

		const features = scanAll(cddDir);
		for (const f of features) {
			const current = readFileState(f.dir);
			const prev = lastFiles.get(f.name);

			if (prev) {
				// 新文件出现 → 自动派发下一阶段
				if (current.hasDesign && !prev.hasDesign) {
					pi.sendUserMessage(
						`Feature **${f.name}** 的设计已完成。\n\n` +
						`请按 **execute skill** 进入实现阶段：先投射 @intent，再 TDD 逐文件对齐，最后集成验证。`,
						{ deliverAs: "followUp" }
					);
				} else if (current.hasReq && !prev.hasReq) {
					pi.sendUserMessage(
						`Feature **${f.name}** 的需求分析已完成。\n\n` +
						`请按 **design skill** 执行架构设计，输出 \`.cdd/${f.name}/design.md\` 和 \`.cdd/${f.name}/later-on.md\`。`,
						{ deliverAs: "followUp" }
					);
				}
			}

			// 每次扫描都更新快照，确保下次对比基准正确
			lastFiles.set(f.name, current);
		}

		// 清理已删除 feature 的内存快照，避免重建后对比错乱
		const currentNames = new Set(features.map((f) => f.name));
		for (const [name] of lastFiles) {
			if (!currentNames.has(name)) {
				lastFiles.delete(name);
			}
		}
	});

	// ── /init-feature 命令（手动触发 / 恢复 ──
	pi.registerCommand("init-feature", {
		description:
			"Feature 开发状态机。手动启动流水线或恢复到下一阶段。自动检测模式下只需启动一次。",
		handler: async (args, ctx) => {
			const cddDir = join(ctx.cwd, ".cdd");

			const features = scanAll(cddDir, args.trim() || undefined);

			// 无 feature → 启动 requirement
			if (features.length === 0) {
				pi.sendUserMessage(
					"开始新的 feature 开发。请按 **requirement skill** 执行需求分析。\n\n" +
					"先与用户讨论意图，按步骤生成 feature 名称，创建 `.cdd/<feature-name>/` 目录并输出需求文档。"
				);
				return;
			}

			const feature = features[0];

			switch (feature.phase) {
				case "requirement":
					pi.sendUserMessage(
						`Feature **${feature.name}** 的需求分析尚未完成。\n\n` +
						`请按 **requirement skill** 执行需求分析，补全 \`.cdd/${feature.name}/requirement.md\`。`
					);
					break;

				case "design":
					pi.sendUserMessage(
						`Feature **${feature.name}** 的需求分析已完成。\n\n` +
						`请按 **design skill** 执行架构设计，输出 \`.cdd/${feature.name}/design.md\` 和 \`.cdd/${feature.name}/later-on.md\`。`
					);
					break;

				case "execute":
					pi.sendUserMessage(
						`Feature **${feature.name}** 的设计已完成。\n\n` +
						`请按 **execute skill** 进入实现阶段：先投射 @intent，再 TDD 逐文件对齐，最后集成验证。`
					);
					break;

				case "complete":
					ctx.ui.notify(`Feature "${feature.name}" 所有阶段已完成`, "success");
					break;
			}
		},
	});
}

// ── 工具函数 ──

function scanAll(cddDir: string, specificName?: string): FeatureInfo[] {
	if (!existsSync(cddDir)) return [];

	const entries = readdirSync(cddDir, { withFileTypes: true });
	const dirs = entries.filter((e) => e.isDirectory());

	let featureDirs = dirs;
	if (specificName) {
		featureDirs = dirs.filter((d) => d.name === specificName);
	}

	const features: FeatureInfo[] = featureDirs.map((d) => {
		const dir = join(cddDir, d.name);
		const state = readFileState(dir);

		let phase: FeatureInfo["phase"];
		if (!state.hasReq) phase = "requirement";
		else if (!state.hasDesign) phase = "design";
		else phase = "execute";

		return { name: d.name, dir, phase };
	});

	const order = { requirement: 0, design: 1, execute: 2, complete: 3 };
	features.sort((a, b) => order[a.phase] - order[b.phase]);

	return features;
}

function readFileState(featureDir: string): FileState {
	return {
		hasReq: existsSync(join(featureDir, "requirement.md")),
		hasDesign: existsSync(join(featureDir, "design.md")),
	};
}
