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
}
exports.HistoryService = HistoryService;
//# sourceMappingURL=HistoryService.js.map