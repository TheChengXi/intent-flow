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
exports.checkFileWithDependencies = checkFileWithDependencies;
exports.scanProject = scanProject;
exports.checkSingleFile = checkSingleFile;
const IntentExtractor_1 = require("./IntentExtractor");
const FileMetricsService_1 = require("./FileMetricsService");
const path = __importStar(require("path"));
// 使用示例
// 示例 1: 检查单个文件的依赖树
async function checkFileWithDependencies(filePath, workspaceRoot) {
    console.log(`\n=== 检查文件及其依赖: ${path.basename(filePath)} ===\n`);
    // 1. 提取依赖树
    const branch = await (0, IntentExtractor_1.extractIntentWithDependencies)(filePath, workspaceRoot, 2);
    // 2. 检查依赖树中所有文件的大小
    const results = await (0, IntentExtractor_1.checkDependencyBranchSize)(branch, 400);
    // 3. 输出结果
    if (results.length === 0) {
        console.log('✓ 所有文件都在推荐大小范围内');
    }
    else {
        console.log(`发现 ${results.length} 个文件需要重构:\n`);
        console.log(FileMetricsService_1.FileMetricsService.formatReport(results));
    }
    return results;
}
// 示例 2: 扫描整个项目
async function scanProject(projectPath) {
    console.log(`\n=== 扫描项目: ${projectPath} ===\n`);
    const results = await FileMetricsService_1.FileMetricsService.checkProjectFiles(projectPath, 400);
    console.log(FileMetricsService_1.FileMetricsService.formatReport(results));
    return results;
}
// 示例 3: 检查单个文件行数
async function checkSingleFile(filePath) {
    const lineCount = await FileMetricsService_1.FileMetricsService.getLineCount(filePath);
    console.log(`${path.basename(filePath)}: ${lineCount} 行`);
    if (lineCount > FileMetricsService_1.FileMetricsService.CRITICAL_THRESHOLD) {
        console.log('🚨 严重: 需要立即重构');
    }
    else if (lineCount > FileMetricsService_1.FileMetricsService.WARNING_THRESHOLD) {
        console.log('⚠️  警告: 建议重构');
    }
    else {
        console.log('✓ 大小合理');
    }
    return lineCount;
}
//# sourceMappingURL=FileMetricsExample.js.map