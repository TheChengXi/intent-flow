/**
 * register — Feature 开发状态机的 pi 注册层
 *
 * 职责：依赖 pi ExtensionAPI，管理 lastFiles 内存快照，注册
 * session_start / turn_end 事件和 /init-feature 命令。
 *
 * @intent 将 feature 状态机绑定到 pi 扩展体系上，负责事件响应与用户通知。
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

			if (!prev) {
				// 新 feature 目录首次出现（本轮 session 中刚创建）
				if (current.hasReport) {
					// 已完成，不额外提示
				} else if (current.hasDesign && current.hasReq) {
					pi.sendUserMessage(
						`Feature **${f.name}** 的设计已完成。\n\n` +
						`Feature 目录：\`.cdd/${f.name}/\`（含 requirement.md 和 design.md）。` +
						`\n\n` +
						`请按 **execute skill** 进入实现阶段：先投射 @intent，再 TDD 逐文件对齐，最后集成验证。`,
						{ deliverAs: "followUp" }
					);
				} else if (current.hasReq) {
					pi.sendUserMessage(
						`Feature **${f.name}** 的需求分析已完成。\n\n` +
						`请按 **design skill** 执行架构设计，输出 \`.cdd/${f.name}/design.md\` 和 \`.cdd/${f.name}/later-on.md\`。`,
						{ deliverAs: "followUp" }
					);
				}
			} else {
				// 已有 feature → 检测新文件出现
				if (current.hasReport && !prev.hasReport) {
					pi.sendUserMessage(
						`Feature **${f.name}** 已关账。\n\n` +
						`报告：\`.cdd/${f.name}/report.md\``,
						{ deliverAs: "followUp" }
					);
				} else if (current.hasDesign && current.hasReq && !prev.hasDesign) {
					pi.sendUserMessage(
						`Feature **${f.name}** 的设计已完成。\n\n` +
						`Feature 目录：\`.cdd/${f.name}/\`（含 requirement.md 和 design.md）。` +
						`\n\n` +
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

		// 将 session 名称设为当前最靠前的 feature 名称
		if (features.length > 0) {
			pi.setSessionName(features[0].name);
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

			// 将 session 名称设为当前 feature 名称
			pi.setSessionName(feature.name);

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
						`Feature 目录：\`.cdd/${feature.name}/\`（含 requirement.md 和 design.md）。` +
						`\n\n` +
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
