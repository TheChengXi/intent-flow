/**
 * engine 测试 — 锁定四态判定与文件状态扫描行为
 *
 * 四态：requirement / design / execute / complete
 * complete 标志：.cdd/packages/<name>.yml 存在（report 关账产出）
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scanAll, readFileState } from "./engine";

let cddDir: string;

beforeEach(() => {
	cddDir = mkdtempSync(join(tmpdir(), "cdd-engine-"));
});

afterEach(() => {
	rmSync(cddDir, { recursive: true, force: true });
});

function makeFeature(name: string, files: string[]): void {
	const dir = join(cddDir, name);
	mkdirSync(dir, { recursive: true });
	for (const f of files) {
		writeFileSync(join(dir, f), "# x");
	}
}

function makePackage(name: string): void {
	const dir = join(cddDir, "packages");
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, `${name}.yml`), "packageName: " + name);
}

describe("readFileState", () => {
	it("识别 requirement / design / package 存在性", () => {
		makeFeature("a", ["requirement.md", "design.md"]);
		makePackage("a");

		const state = readFileState(join(cddDir, "a"), join(cddDir, "packages"));
		expect(state).toEqual({ hasReq: true, hasDesign: true, hasPackage: true });
	});

	it("未传 packagesDir 时 hasPackage 为 false", () => {
		makeFeature("a", ["requirement.md", "design.md"]);
		makePackage("a");

		const state = readFileState(join(cddDir, "a"));
		expect(state.hasPackage).toBe(false);
	});
});

describe("scanAll 四态判定", () => {
	it("空目录返回空数组", () => {
		expect(scanAll(cddDir)).toEqual([]);
	});

	it("无 requirement.md → requirement 态", () => {
		makeFeature("a", []);
		expect(scanAll(cddDir)).toEqual([
			{ name: "a", dir: join(cddDir, "a"), phase: "requirement" },
		]);
	});

	it("有 req 无 design → design 态", () => {
		makeFeature("a", ["requirement.md"]);
		expect(scanAll(cddDir)[0].phase).toBe("design");
	});

	it("有 req + design 无 package → execute 态", () => {
		makeFeature("a", ["requirement.md", "design.md"]);
		expect(scanAll(cddDir)[0].phase).toBe("execute");
	});

	it("有 req + design + package.yml → complete 态", () => {
		makeFeature("a", ["requirement.md", "design.md"]);
		makePackage("a");
		expect(scanAll(cddDir)[0].phase).toBe("complete");
	});

	it("package.yml 存在但缺 req/design 不判定 complete", () => {
		makeFeature("a", ["requirement.md"]);
		makePackage("a");
		expect(scanAll(cddDir)[0].phase).toBe("design");
	});

	it("按阶段优先级排序：requirement < design < execute < complete", () => {
		makeFeature("c", ["requirement.md", "design.md"]); // execute
		makeFeature("d", ["requirement.md", "design.md"]); // execute
		makeFeature("b", ["requirement.md"]); // design
		makeFeature("a", []); // requirement
		makeFeature("e", ["requirement.md", "design.md"]); // complete 需 package
		makePackage("e");

		const phases = scanAll(cddDir).map((f) => `${f.name}:${f.phase}`);
		expect(phases).toEqual([
			"a:requirement",
			"b:design",
			"c:execute",
			"d:execute",
			"e:complete",
		]);
	});

	it("系统目录不视为 feature", () => {
		makeFeature("intents", ["requirement.md"]);
		makeFeature("history", ["requirement.md"]);
		makeFeature("packages", []);
		makeFeature("test-output", []);

		expect(scanAll(cddDir)).toEqual([]);
	});
});
