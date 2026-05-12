"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HistoryService = void 0;
const HistoryRepository_1 = require("../repositories/HistoryRepository");
// @contract: HistoryService.getHistory(workspaceRoot: string, filePath: string, functionName: string) => Promise<WorkLineHistory | null>
// @step: [调用 Repository] 调用 HistoryRepository.getHistory
// @step: [返回结果] 返回历史记录
// @boundary: 当历史不存在时，应返回 null
// @contract: HistoryService.addRecord(workspaceRoot: string, filePath: string, functionName: string, contract: string, record: WorkLineHistoryRecord) => Promise<void>
// @step: [调用 Repository] 调用 HistoryRepository.addRecord
// @step: [保存] 保存历史记录
// @boundary: 当目录不存在时，应创建目录
// @contract: HistoryService.getLastCompilerRecord(workspaceRoot: string, filePath: string, functionName: string) => Promise<WorkLineHistoryRecord | null>
// @step: [调用 Repository] 调用 HistoryRepository.getLastCompilerRecord
// @step: [返回结果] 返回最后一条编译记录
// @boundary: 当记录不存在时，应返回 null
// @contract: HistoryService.getLastReviewerRecord(workspaceRoot: string, filePath: string, functionName: string) => Promise<WorkLineHistoryRecord | null>
// @step: [调用 Repository] 调用 HistoryRepository.getLastReviewerRecord
// @step: [返回结果] 返回最后一条审查记录
// @boundary: 当记录不存在时，应返回 null
// @contract: HistoryService.getOldContract(workspaceRoot: string, filePath: string, functionName: string) => Promise<string | null>
// @step: [调用 Repository] 调用 HistoryRepository.getOldContract
// @step: [返回结果] 返回旧的 @contract
// @boundary: 当历史不存在时，应返回 null
// @contract: HistoryService.getAllCompilerRecords(workspaceRoot: string, filePath: string, functionName: string) => Promise<WorkLineHistoryRecord[]>
// @step: [调用 Repository] 调用 HistoryRepository.getAllCompilerRecords
// @step: [返回结果] 返回所有编译记录
// @boundary: 当历史不存在时，应返回空数组
// @contract: HistoryService.getAllContractsForFunction(workspaceRoot: string, filePath: string, functionName: string) => Promise<string[]>
// @step: [获取历史] 调用 getHistory 获取完整历史
// @step: [提取契约] 从所有编译记录中提取 @contract 行
// @step: [去重] 使用 Set 去除重复的契约
// @step: [返回] 返回契约数组
// @boundary: 当历史不存在时，应返回空数组
class HistoryService {
    static async getHistory(workspaceRoot, filePath, functionName) {
        return await HistoryRepository_1.HistoryRepository.getHistory(workspaceRoot, filePath, functionName);
    }
    static async addRecord(workspaceRoot, filePath, functionName, contract, record) {
        await HistoryRepository_1.HistoryRepository.addRecord(workspaceRoot, filePath, functionName, contract, record);
    }
    static async getLastCompilerRecord(workspaceRoot, filePath, functionName) {
        return await HistoryRepository_1.HistoryRepository.getLastCompilerRecord(workspaceRoot, filePath, functionName);
    }
    static async getLastReviewerRecord(workspaceRoot, filePath, functionName) {
        return await HistoryRepository_1.HistoryRepository.getLastReviewerRecord(workspaceRoot, filePath, functionName);
    }
    static async getOldContract(workspaceRoot, filePath, functionName) {
        return await HistoryRepository_1.HistoryRepository.getOldContract(workspaceRoot, filePath, functionName);
    }
    static async getAllCompilerRecords(workspaceRoot, filePath, functionName) {
        return await HistoryRepository_1.HistoryRepository.getAllCompilerRecords(workspaceRoot, filePath, functionName);
    }
    static async getAllContractsForFunction(workspaceRoot, filePath, functionName) {
        const history = await this.getHistory(workspaceRoot, filePath, functionName);
        if (!history) {
            return [];
        }
        const contracts = new Set();
        const compilerRecords = history.history.filter(r => r.role === 'compiler' && r.output.success);
        for (const record of compilerRecords) {
            if (record.input.parsedComment) {
                const comment = record.input.parsedComment;
                const contractLine = `// @contract: ${comment.contract.functionName}(${comment.contract.parameters.map(p => `${p.name}: ${p.type}`).join(', ')}) => ${comment.contract.returnType}`;
                contracts.add(contractLine);
            }
        }
        return Array.from(contracts);
    }
}
exports.HistoryService = HistoryService;
// @end
//# sourceMappingURL=HistoryService.js.map