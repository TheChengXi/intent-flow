/**
 * engine — Feature 开发状态机的工作流引擎
 *
 * 职责：纯内部逻辑，不依赖 pi API。包含类型定义、文件状态扫描、阶段判定。
 *
 * @intent 提供 feature 扫描/阶段判定的纯函数，供 register.ts 使用。
 * 四态判定：无 requirement.md → requirement；有 req 无 design → design；
 * 有 req + design 无 package.yml → execute；有 req + design + package.yml → complete。
 * complete 标志为 .intentflow/packages/<name>.yml（report 关账产出）。
 */

import { readdirSync, existsSync } from "node:fs";
import { join, basename } from "node:path";

// ── 类型定义 ──

export interface FeatureInfo {
	name: string;
	dir: string;
	phase: "requirement" | "design" | "execute" | "complete";
}

export interface FileState {
	hasReq: boolean;
	hasDesign: boolean;
	hasPackage: boolean;
}

// ── 系统目录（非 feature，自动跳过） ──

const SYSTEM_DIRS = new Set([
	"intents",
	"packages",
	"history",
	"test-output",
]);

// ── 阶段优先级（用于排序） ──

const PHASE_ORDER: Record<FeatureInfo["phase"], number> = {
	requirement: 0,
	design: 1,
	execute: 2,
	complete: 3,
};

// ── 扫描与判定 ──

/**
 * 扫描 .intentflow 目录下所有 feature 目录，按阶段优先级排序返回。
 * @param iflowDir .intentflow 目录绝对路径
 */
export function scanAll(iflowDir: string): FeatureInfo[] {
	if (!existsSync(iflowDir)) return [];

	const entries = readdirSync(iflowDir, { withFileTypes: true });
	const dirs = entries.filter(
		(e) => e.isDirectory() && !SYSTEM_DIRS.has(e.name)
	);
	const packagesDir = join(iflowDir, "packages");

	const features: FeatureInfo[] = dirs.map((d) => {
		const dir = join(iflowDir, d.name);
		const state = readFileState(dir, packagesDir);

		let phase: FeatureInfo["phase"];
		if (!state.hasReq) phase = "requirement";
		else if (!state.hasDesign) phase = "design";
		else if (!state.hasPackage) phase = "execute";
		else phase = "complete";

		return { name: d.name, dir, phase };
	});

	features.sort((a, b) => PHASE_ORDER[a.phase] - PHASE_ORDER[b.phase]);

	return features;
}

/**
 * 读取单个 feature 目录的文件状态快照。
 * @param featureDir feature 目录绝对路径
 * @param packagesDir 可选，.intentflow/packages 目录绝对路径；提供时检测 <feature-name>.yml 作为完成标志
 */
export function readFileState(featureDir: string, packagesDir?: string): FileState {
	return {
		hasReq: existsSync(join(featureDir, "requirement.md")),
		hasDesign: existsSync(join(featureDir, "design.md")),
		hasPackage: packagesDir
			? existsSync(join(packagesDir, `${basename(featureDir)}.yml`))
			: false,
	};
}
