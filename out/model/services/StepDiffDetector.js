"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectDiff = detectDiff;
exports.computeStepHash = computeStepHash;
exports.normalizeStepContent = normalizeStepContent;
exports.shouldUseIncrementalMode = shouldUseIncrementalMode;
const crypto = __importStar(require("crypto"));
// @contract: detectDiff(oldComment: CDDComment, newComment: CDDComment) => StepDiff
// @step: [计算旧哈希] 为 oldComment.steps 的每个 step 计算 MD5 哈希
// @step: [计算新哈希] 为 newComment.steps 的每个 step 计算 MD5 哈希
// @step: [匹配步骤] 基于哈希值匹配新旧步骤（位置无关）
// @step: [分类] 将步骤分为 unchanged、added、modified、deleted
// @step: [计算占比] 计算 unchangedRatio = unchanged.length / oldComment.steps.length
// @step: [返回结果] 返回 StepDiff 对象
// @boundary: 当 oldComment.steps 为空时，所有新步骤都是 added，unchangedRatio = 0
// @boundary: 当 newComment.steps 为空时，所有旧步骤都是 deleted，unchangedRatio = 0
function detectDiff(oldComment, newComment) {
    const oldHashes = oldComment.steps.map(step => ({
        step,
        hash: computeStepHash(step)
    }));
    const newHashes = newComment.steps.map(step => ({
        step,
        hash: computeStepHash(step)
    }));
    const unchanged = [];
    const added = [];
    const modified = [];
    const deleted = [];
    // 构建旧哈希映射（哈希 -> 步骤列表，因为可能有重复哈希）
    const oldHashMap = new Map();
    for (const { step, hash } of oldHashes) {
        if (!oldHashMap.has(hash)) {
            oldHashMap.set(hash, []);
        }
        oldHashMap.get(hash).push(step);
    }
    // 匹配新步骤
    const matchedOldSteps = new Set();
    for (const { step, hash } of newHashes) {
        const matchingOldSteps = oldHashMap.get(hash);
        if (matchingOldSteps && matchingOldSteps.length > 0) {
            // 找到未被匹配的旧步骤
            const unmatchedOldStep = matchingOldSteps.find(s => !matchedOldSteps.has(s));
            if (unmatchedOldStep) {
                unchanged.push(step);
                matchedOldSteps.add(unmatchedOldStep);
            }
            else {
                // 所有相同哈希的旧步骤都已匹配，当作新增
                added.push(step);
            }
        }
        else {
            added.push(step);
        }
    }
    // 未匹配的旧步骤视为删除
    for (const { step } of oldHashes) {
        if (!matchedOldSteps.has(step)) {
            deleted.push(step);
        }
    }
    // 计算占比
    const unchangedRatio = oldComment.steps.length > 0
        ? unchanged.length / oldComment.steps.length
        : 0;
    return {
        unchanged,
        added,
        modified,
        deleted,
        unchangedRatio
    };
}
// @end
// @contract: computeStepHash(step: StepAnnotation) => string
// @step: [规范化] 将 step.description 规范化（trim、折叠空格、标准化标点）
// @step: [计算 MD5] 使用 crypto.createHash('md5') 计算哈希
// @step: [截取前8位] 返回 MD5 的前8位十六进制字符
// @boundary: 当 step.description 为空时，返回 '00000000'
function computeStepHash(step) {
    const normalized = normalizeStepContent(step.description);
    if (!normalized) {
        return '00000000';
    }
    const hash = crypto.createHash('md5').update(normalized, 'utf8').digest('hex');
    return hash.substring(0, 8);
}
// @end
// @contract: normalizeStepContent(content: string) => string
// @step: [trim] 去除首尾空白
// @step: [折叠空格] 将连续空格替换为单个空格
// @step: [标准化标点] 统一中英文标点周围的空格（中文标点后无空格，英文标点后有空格）
// @step: [返回] 返回规范化后的字符串
// @boundary: 当 content 为空或全是空白时，返回空字符串
function normalizeStepContent(content) {
    if (!content) {
        return '';
    }
    let normalized = content.trim();
    // 折叠连续空格
    normalized = normalized.replace(/\s+/g, ' ');
    // 标准化标点：中文标点后无空格
    normalized = normalized.replace(/([，。！？；：、])\s+/g, '$1');
    // 标准化标点：英文标点后有空格（如果后面不是空格或结尾）
    normalized = normalized.replace(/([,\.!?;:])([^\s])/g, '$1 $2');
    return normalized;
}
// @end
// @contract: shouldUseIncrementalMode(diff: StepDiff, threshold?: number) => boolean
// @step: [检查阈值] 默认阈值为 0.5（50%）
// @step: [比较] 判断 diff.unchangedRatio >= threshold
// @step: [返回] 返回布尔值
// @boundary: 当 threshold 未提供时，使用 0.5
function shouldUseIncrementalMode(diff, threshold = 0.5) {
    return diff.unchangedRatio >= threshold;
}
// @end
//# sourceMappingURL=StepDiffDetector.js.map