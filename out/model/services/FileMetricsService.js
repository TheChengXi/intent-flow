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
exports.FileMetricsService = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class FileMetricsService {
    static async getLineCount(filePath) {
        try {
            const content = await fs.promises.readFile(filePath, 'utf-8');
            if (content.length === 0) {
                return 0;
            }
            const lines = content.split('\n');
            return lines.length;
        }
        catch (error) {
            throw new Error(`Failed to read file ${filePath}: ${error}`);
        }
    }
    // @end
    // @contract: FileMetricsService.checkProjectFiles(projectPath: string, threshold: number, extensions: string[]) => Promise<FileSizeCheckResult[]>
    // @step: [扫描文件] 递归扫描项目目录，找到所有匹配扩展名的文件
    // @step: [检查每个文件] 对每个文件调用 getLineCount
    // @step: [过滤结果] 只返回需要重构的文件
    // @step: [排序] 按超出行数降序排序
    // @boundary: 当目录不存在时，抛出错误
    static async checkProjectFiles(projectPath, threshold = FileMetricsService.WARNING_THRESHOLD, extensions = ['.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.cpp', '.c', '.go']) {
        const results = [];
        async function scanDirectory(dirPath) {
            const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                if (entry.isDirectory()) {
                    if (!['node_modules', '.git', 'dist', 'out', 'build'].includes(entry.name)) {
                        await scanDirectory(fullPath);
                    }
                }
                else if (entry.isFile()) {
                    const ext = path.extname(entry.name);
                    if (extensions.includes(ext)) {
                        const lineCount = await FileMetricsService.getLineCount(fullPath);
                        if (lineCount > threshold) {
                            results.push({
                                filePath: fullPath,
                                lineCount,
                                threshold,
                                needsRefactoring: true,
                                exceedsBy: lineCount - threshold
                            });
                        }
                    }
                }
            }
        }
        await scanDirectory(projectPath);
        // 按超出行数降序排序
        results.sort((a, b) => (b.exceedsBy || 0) - (a.exceedsBy || 0));
        return results;
    }
    // @end
    // @contract: FileMetricsService.formatReport(results: FileSizeCheckResult[]) => string
    // @step: [分类] 将结果按严重程度分类（critical > 500, warning 400-500）
    // @step: [构建报告] 构建格式化的报告文本
    // @step: [返回] 返回报告字符串
    static formatReport(results) {
        if (results.length === 0) {
            return '✓ All files are within the recommended size limits.';
        }
        const critical = results.filter(r => r.lineCount > this.CRITICAL_THRESHOLD);
        const warning = results.filter(r => r.lineCount <= this.CRITICAL_THRESHOLD);
        let report = `Found ${results.length} file(s) that need attention:\n\n`;
        if (critical.length > 0) {
            report += `🚨 Critical (>${this.CRITICAL_THRESHOLD} lines):\n`;
            critical.forEach(r => {
                const fileName = path.basename(r.filePath);
                report += `  - ${fileName}: ${r.lineCount} lines (exceeds by ${r.exceedsBy})\n`;
            });
            report += '\n';
        }
        if (warning.length > 0) {
            report += `⚠️  Warning (${this.WARNING_THRESHOLD}-${this.CRITICAL_THRESHOLD} lines):\n`;
            warning.forEach(r => {
                const fileName = path.basename(r.filePath);
                report += `  - ${fileName}: ${r.lineCount} lines (exceeds by ${r.exceedsBy})\n`;
            });
        }
        report += '\n→ These files should be submitted to the project iteration planner for refactoring.';
        return report;
    }
}
exports.FileMetricsService = FileMetricsService;
// 警告阈值：400 行
FileMetricsService.WARNING_THRESHOLD = 400;
// 严重阈值：500 行
FileMetricsService.CRITICAL_THRESHOLD = 500;
//# sourceMappingURL=FileMetricsService.js.map