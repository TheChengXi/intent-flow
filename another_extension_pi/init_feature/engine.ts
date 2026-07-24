/**
 * engine — Feature 开发状态机的工作流引擎
 *
 * 职责：纯内部逻辑，不依赖 pi API。包含类型定义、文件状态扫描、阶段判定。
 *
 * @intent 提供 feature 扫描/阶段判定的纯函数，供 register.ts 使用。
 */

import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

// ── 类型定义 ──

export interface FeatureInfo {
	name: string;
	dir: string;
	phase: "requirement" | "design" | "execute" | "complete";
}

export interface FileState {
	hasReq: boolean;
	hasDesign: boolean;
	hasReport: boolean;
}

// ── 阶段优先级（用于排序） ──

const PHASE_ORDER: Record<FeatureInfo["phase"], number> = {
	requirement: 0,
	design: 1,
	execute: 2,
	complete: 3,
};

// ── 扫描与判定 ──

/**
 * 扫描 .cdd 目录下所有 feature 目录，按阶段优先级排序返回。
 * @param cddDir .cdd 目录绝对路径
 * @param specificName 可选，只返回指定名称的 feature
 */
export function scanAll(cddDir: string, specificName?: string): FeatureInfo[] {
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
		else if (!state.hasReport) phase = "execute";
		else phase = "complete";

		return { name: d.name, dir, phase };
	});

	features.sort((a, b) => PHASE_ORDER[a.phase] - PHASE_ORDER[b.phase]);

	return features;
}

/**
 * 读取单个 feature 目录的文件状态快照。
 */
export function readFileState(featureDir: string): FileState {
	return {
		hasReq: existsSync(join(featureDir, "requirement.md")),
		hasDesign: existsSync(join(featureDir, "design.md")),
		hasReport: existsSync(join(featureDir, "report.md")),
	};
}
