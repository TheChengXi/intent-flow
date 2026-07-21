/**
 * /init-feature — Feature 开发状态机（自动检测版）
 *
 * 手动触发 + 自动检测双机制：
 *   1. /init-feature 命令启动流水线（无 feature 时进入 requirement）
 *   2. 每次 turn_end 检测文件变更，自动派发下一阶段
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

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

interface FeatureInfo {
	name: string;
	dir: string;
	phase: "requirement" | "design" | "execute" | "complete";
}

export default function (pi: ExtensionAPI) {
	// ── 已派发记录（防止重复自动派发） ──
	const dispatched = new Set<string>();
	const dispatchedKey = (name: string, phase: string) => `${name}:${phase}`;
	const markDispatched = (f: FeatureInfo) => {
		dispatched.add(dispatchedKey(f.name, f.phase));
	};

	// ── 初始扫描（session 启动时标记已有文件为已派发） ──
	pi.on("session_start", async (_event, ctx) => {
		const features = scanAll(join(ctx.cwd, ".cdd"));
		for (const f of features) {
			if (f.phase === "design" || f.phase === "execute") {
				dispatched.add(dispatchedKey(f.name, "design"));
			}
			if (f.phase === "execute") {
				dispatched.add(dispatchedKey(f.name, "execute"));
			}
		}
	});

	// ── 自动检测：每个 turn 结束后扫描文件变更 ──
	pi.on("turn_end", async (_event, ctx) => {
		const cddDir = join(ctx.cwd, ".cdd");
		if (!existsSync(cddDir)) return;

		const features = scanAll(cddDir);
		for (const f of features) {
			if (f.phase === "design" && !dispatched.has(dispatchedKey(f.name, "design"))) {
				markDispatched(f);
				pi.sendUserMessage(
					`Feature **${f.name}** 的需求分析已完成。\n\n` +
					`请按 **design skill** 执行架构设计，输出 \`.cdd/${f.name}/design.md\` 和 \`.cdd/${f.name}/later-on.md\`。`,
					{ deliverAs: "followUp" }
				);
			} else if (f.phase === "execute" && !dispatched.has(dispatchedKey(f.name, "execute"))) {
				markDispatched(f);
				pi.sendUserMessage(
					`Feature **${f.name}** 的设计已完成。\n\n` +
					`请按 **execute skill** 进入实现阶段：先投射 @intent，再 TDD 逐文件对齐，最后集成验证。`,
					{ deliverAs: "followUp" }
				);
			}
		}
	});

	// ── /init-feature 命令（手动触发 / 恢复） ──
	pi.registerCommand("init-feature", {
		description: "Feature 开发状态机。手动启动流水线或恢复到下一阶段。自动检测模式下只需启动一次。",
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
					markDispatched(feature);
					pi.sendUserMessage(
						`Feature **${feature.name}** 的需求分析已完成。\n\n` +
						`请按 **design skill** 执行架构设计，输出 \`.cdd/${feature.name}/design.md\` 和 \`.cdd/${feature.name}/later-on.md\`。`
					);
					break;

				case "execute":
					markDispatched(feature);
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
		const hasReq = existsSync(join(dir, "requirement.md"));
		const hasDesign = existsSync(join(dir, "design.md"));

		let phase: FeatureInfo["phase"];
		if (!hasReq) phase = "requirement";
		else if (!hasDesign) phase = "design";
		else phase = "execute";

		return { name: d.name, dir, phase };
	});

	const order = { requirement: 0, design: 1, execute: 2, complete: 3 };
	features.sort((a, b) => order[a.phase] - order[b.phase]);

	return features;
}
