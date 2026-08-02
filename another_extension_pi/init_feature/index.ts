/**
 * init_feature — Feature 开发状态机扩展入口
 *
 * 职责：统一导出，作为 pi 扩展的默认入口。
 * pi 会自动发现 init_feature/index.ts 并加载。
 *
 * @intent 对 pi 暴露 /init-feature 命令和 auto-detect 能力，
 * 驱动 IntentFlow 三层架构下的 Feature 开发流水线。
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { register } from "./register";

export default function (pi: ExtensionAPI) {
	register(pi);
}
