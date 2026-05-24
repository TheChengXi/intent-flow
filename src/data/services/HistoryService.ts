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

  static async getAllCompilerRecords(workspaceRoot: string, filePath: string, functionName: string): Promise<WorkLineHistoryRecord[]> {
    return await HistoryRepository.getAllCompilerRecords(workspaceRoot, filePath, functionName);
  }

  static async getAllContractsForFunction(workspaceRoot: string, filePath: string, functionName: string): Promise<string[]> {
    const history = await this.getHistory(workspaceRoot, filePath, functionName);
    if (!history) {
      return [];
    }

    const contracts = new Set<string>();
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
// @end
