import { HistoryRepository } from '../repositories/HistoryRepository';
import { WorkLineHistory, WorkLineHistoryRecord } from '../entities/WorkLineHistory';

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

export class HistoryService {
  static async getHistory(workspaceRoot: string, filePath: string, functionName: string): Promise<WorkLineHistory | null> {
    return await HistoryRepository.getHistory(workspaceRoot, filePath, functionName);
  }

  static async addRecord(
    workspaceRoot: string,
    filePath: string,
    functionName: string,
    contract: string,
    record: WorkLineHistoryRecord
  ): Promise<void> {
    await HistoryRepository.addRecord(workspaceRoot, filePath, functionName, contract, record);
  }

  static async getLastCompilerRecord(workspaceRoot: string, filePath: string, functionName: string): Promise<WorkLineHistoryRecord | null> {
    return await HistoryRepository.getLastCompilerRecord(workspaceRoot, filePath, functionName);
  }

  static async getLastReviewerRecord(workspaceRoot: string, filePath: string, functionName: string): Promise<WorkLineHistoryRecord | null> {
    return await HistoryRepository.getLastReviewerRecord(workspaceRoot, filePath, functionName);
  }

  static async getOldContract(workspaceRoot: string, filePath: string, functionName: string): Promise<string | null> {
    return await HistoryRepository.getOldContract(workspaceRoot, filePath, functionName);
  }
}
