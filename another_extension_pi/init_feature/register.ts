/**
 * @intent
 * 将 feature 状态机绑定到 pi 扩展体系上，负责事件响应与用户通知。
 * turn_end 自动检测 req/design 新出现并通知阶段推进。
 * /init-feature 带参数时以参数为意图上下文引导 requirement 开新 feature；
 * 无参数时恢复流水线，跳过 complete 引导第一个未完成 feature。
 */



import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { scanAll, readFileState } from "./engine";

export function register(pi: ExtensionAPI) {
	// ── 记录每个 feature 最近一次扫描时的文件状态 ──
	// 仅用于检测"新文件出现"，不做派发授权判断
	const lastFiles = new Map<string, ReturnType<typeof readFileState>>();

	// ── session 启动时初始化文件状态快照 ──
	pi.on("session_start", async (_event, ctx) => {
		const iflowDir = join(ctx.cwd, ".intentflow");
		const packagesDir = join(iflowDir, "packages");
		const features = scanAll(iflowDir);
		for (const f of features) {
			lastFiles.set(f.name, readFileState(f.dir, packagesDir));
		}
	});

	// ── 自动检测：每次 turn 结束后比较文件变化 ──
	pi.on("turn_end", async (_event, ctx) => {
		const iflowDir = join(ctx.cwd, ".intentflow");
		if (!existsSync(iflowDir)) return;

		const packagesDir = join(iflowDir, "packages");
		const features = scanAll(iflowDir);
		for (const f of features) {
			const current = readFileState(f.dir, packagesDir);
			const prev = lastFiles.get(f.name);

			if (!prev) {
				// 新 feature 目录首次出现（本轮 session 中刚创建）
				if (current.hasDesign && current.hasReq) {
					pi.sendUserMessage(
						`Feature **${f.name}** 的设计已完成。\n\n` +
						`Feature 目录：\`.intentflow/${f.name}/\`（含 requirement.md 和 design.md）。` +
						`\n\n` +
						`请按 **execute skill** 进入实现阶段：先投射 @intent，再 TDD 逐文件对齐，最后集成验证。`,
						{ deliverAs: "followUp" }
					);
				} else if (current.hasReq) {
					// feature 名已在 requirement 阶段确定，同步到 session 名
					pi.setSessionName(f.name);
					pi.sendUserMessage(
						`Feature **${f.name}** 的需求分析已完成。\n\n` +
						`请按 **design skill** 执行架构设计，输出 \`.intentflow/${f.name}/design.md\` 和 \`.intentflow/${f.name}/later-on.md\`。`,
						{ deliverAs: "followUp" }
					);
				}
			} else {
				// 已有 feature → 检测新文件出现
				if (current.hasDesign && current.hasReq && !prev.hasDesign) {
					pi.sendUserMessage(
						`Feature **${f.name}** 的设计已完成。\n\n` +
						`Feature 目录：\`.intentflow/${f.name}/\`（含 requirement.md 和 design.md）。` +
						`\n\n` +
						`请按 **execute skill** 进入实现阶段：先投射 @intent，再 TDD 逐文件对齐，最后集成验证。`,
						{ deliverAs: "followUp" }
					);
				} else if (current.hasReq && !prev.hasReq) {
					// feature 名已在 requirement 阶段确定，同步到 session 名
					pi.setSessionName(f.name);
					pi.sendUserMessage(
						`Feature **${f.name}** 的需求分析已完成。\n\n` +
						`请按 **design skill** 执行架构设计，输出 \`.intentflow/${f.name}/design.md\` 和 \`.intentflow/${f.name}/later-on.md\`。`,
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

	// ── /init-feature 命令（带参数 = 新 feature；无参数 = 恢复流水线）──
	pi.registerCommand("init-feature", {
		description:
			"Feature 开发状态机。带参数：以参数为意图上下文开始新 feature；无参数：恢复到下一未完成阶段。",
		handler: async (args, ctx) => {
			const iflowDir = join(ctx.cwd, ".intentflow");
			const intent = args.trim();

			// 带参数 → 参数作为新 feature 的意图上下文，直接进 requirement
			if (intent) {
				pi.sendUserMessage(
					"开始新的 feature 开发。请按 **requirement skill** 执行需求分析。\n\n" +
					`用户意图：${intent}\n\n` +
					"先与用户讨论意图，按步骤生成 feature 名称，创建 `.intentflow/<feature-name>/` 目录并输出需求文档。"
				);
				return;
			}

			// 无参数 → 状态驱动：有未完成则恢复流水线，没有则提示（区分“从来没有” vs “全部完成”）
			const features = scanAll(iflowDir);
			const pending = features.filter((f) => f.phase !== "complete");

			if (pending.length === 0) {
				const msg =
					features.length === 0
						? "开始新的 feature 开发。请按 **requirement skill** 执行需求分析。\n\n" +
						  "先与用户讨论意图，按步骤生成 feature 名称，创建 `.intentflow/<feature-name>/` 目录并输出需求文档。"
						: "所有 feature 均已完成关账。\n\n" +
						  "如需开发新 feature，请使用 `/init-feature <意图描述>`，以意图为上下文直接开始需求分析。";
				pi.sendUserMessage(msg);
				return;
			}

			const feature = pending[0];

			// 将 session 名称设为当前 feature 名称
			pi.setSessionName(feature.name);

			switch (feature.phase) {
				case "requirement":
					pi.sendUserMessage(
						`Feature **${feature.name}** 的需求分析尚未完成。\n\n` +
						`请按 **requirement skill** 执行需求分析，补全 \`.intentflow/${feature.name}/requirement.md\`。`
					);
					break;

				case "design":
					pi.sendUserMessage(
						`Feature **${feature.name}** 的需求分析已完成。\n\n` +
						`请按 **design skill** 执行架构设计，输出 \`.intentflow/${feature.name}/design.md\` 和 \`.intentflow/${feature.name}/later-on.md\`。`
					);
					break;

				case "execute":
					pi.sendUserMessage(
						`Feature **${feature.name}** 的设计已完成。\n\n` +
						`Feature 目录：\`.intentflow/${feature.name}/\`（含 requirement.md 和 design.md）。` +
						`\n\n` +
						`请按 **execute skill** 进入实现阶段：先投射 @intent，再 TDD 逐文件对齐，最后集成验证。`
					);
					break;
			}
		},
	});
}
