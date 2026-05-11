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
exports.HistoryRepository = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
// @contract: HistoryRepository.getHistory(workspaceRoot: string, filePath: string, functionName: string) => Promise<WorkLineHistory | null>
// @step: [构建路径] 构建历史文件路径 .cdd/history/文件路径/函数名.json
// @step: [读取文件] 读取 JSON 文件
// @step: [解析] 解析为 WorkLineHistory 对象
// @boundary: 当文件不存在时，应返回 null
// @boundary: 当 JSON 解析失败时，应返回 null
// @contract: HistoryRepository.addRecord(workspaceRoot: string, filePath: string, functionName: string, contract: string, record: WorkLineHistoryRecord) => Promise<void>
// @step: [读取历史] 调用 getHistory 获取现有历史
// @step: [创建或更新] 如果不存在则创建新历史，否则追加记录
// @step: [清理旧记录] 根据角色清理超出限制的记录
// @step: [保存] 写入 JSON 文件
// @boundary: 当目录不存在时，应创建目录
// @contract: HistoryRepository.cleanHistory(history: WorkLineHistory, role: string) => WorkLineHistory
// @step: [过滤记录] 根据角色过滤历史记录
// @step: [应用策略] 编译器保留10条，审查员根据状态保留，转译员保留5条
// @step: [返回] 返回清理后的历史
// @boundary: 当角色未知时，应保留所有记录
class HistoryRepository {
    static async getHistory(workspaceRoot, filePath, functionName) {
        const historyPath = this.getHistoryPath(workspaceRoot, filePath, functionName);
        try {
            const content = await fs.readFile(historyPath, 'utf-8');
            return JSON.parse(content);
        }
        catch (error) {
            return null;
        }
    }
    static async addRecord(workspaceRoot, filePath, functionName, contract, record) {
        let history = await this.getHistory(workspaceRoot, filePath, functionName);
        if (!history) {
            history = {
                functionName,
                contract,
                contractVersion: 'v1.0',
                filePath,
                history: []
            };
        }
        history.history.push(record);
        history = this.cleanHistory(history, record.role);
        const historyPath = this.getHistoryPath(workspaceRoot, filePath, functionName);
        const dir = path.dirname(historyPath);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(historyPath, JSON.stringify(history, null, 2), 'utf-8');
    }
    static cleanHistory(history, role) {
        const roleRecords = history.history.filter(r => r.role === role);
        const otherRecords = history.history.filter(r => r.role !== role);
        let cleanedRoleRecords = [];
        if (role === 'compiler') {
            // 编译器：保留最近 10 条
            cleanedRoleRecords = roleRecords.slice(-10);
        }
        else if (role === 'reviewer') {
            // 审查员：不通过全部保留，通过只保留最近 5 条
            const failedRecords = roleRecords.filter(r => !r.output.success);
            const passedRecords = roleRecords.filter(r => r.output.success).slice(-5);
            cleanedRoleRecords = [...failedRecords, ...passedRecords];
        }
        else if (role === 'translator') {
            // 转译员：保留最近 5 条
            cleanedRoleRecords = roleRecords.slice(-5);
        }
        else {
            // 未知角色：保留所有
            cleanedRoleRecords = roleRecords;
        }
        history.history = [...otherRecords, ...cleanedRoleRecords].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        return history;
    }
    static getHistoryPath(workspaceRoot, filePath, functionName) {
        // 将文件路径转换为相对路径
        const relativePath = path.relative(workspaceRoot, filePath);
        // 移除文件扩展名
        const pathWithoutExt = relativePath.replace(/\.[^.]+$/, '');
        // 构建历史文件路径
        return path.join(workspaceRoot, '.cdd', 'history', pathWithoutExt, `${functionName}.json`);
    }
    static async getLastCompilerRecord(workspaceRoot, filePath, functionName) {
        const history = await this.getHistory(workspaceRoot, filePath, functionName);
        if (!history) {
            return null;
        }
        const compilerRecords = history.history.filter(r => r.role === 'compiler');
        return compilerRecords.length > 0 ? compilerRecords[compilerRecords.length - 1] : null;
    }
    static async getLastReviewerRecord(workspaceRoot, filePath, functionName) {
        const history = await this.getHistory(workspaceRoot, filePath, functionName);
        if (!history) {
            return null;
        }
        const reviewerRecords = history.history.filter(r => r.role === 'reviewer');
        return reviewerRecords.length > 0 ? reviewerRecords[reviewerRecords.length - 1] : null;
    }
    static async getOldContract(workspaceRoot, filePath, functionName) {
        const history = await this.getHistory(workspaceRoot, filePath, functionName);
        return history ? history.contract : null;
    }
}
exports.HistoryRepository = HistoryRepository;
//# sourceMappingURL=HistoryRepository.js.map