import { IHook } from './IHook';
import {
  BeforeExtractData,
  AfterExtractData,
  BeforeSearchData,
  AfterSearchData,
  OnErrorData
} from './HookTypes';

/**
 * @intent
 * 在 Hook 链中自动记录关键操作的开始、完成和耗时。
 */

export class LoggingHook implements IHook {
  name = 'LoggingHook';

  async onBeforeExtract(data: BeforeExtractData): Promise<void> {
    console.log(`[LoggingHook] 开始提取: ${data.filePath}, 深度: ${data.depth}`);
  }

  async onAfterExtract(data: AfterExtractData): Promise<void> {
    console.log(`[LoggingHook] 提取完成: ${data.filePath}, 耗时: ${data.duration}ms`);
  }

  async onBeforeSearch(data: BeforeSearchData): Promise<void> {
    console.log(`[LoggingHook] 开始搜索: ${data.type} - ${data.name} in ${data.filePath}`);
  }

  async onAfterSearch(data: AfterSearchData): Promise<void> {
    const status = data.found ? '找到' : '未找到';
    console.log(`[LoggingHook] 搜索完成: ${data.name} - ${status}, 耗时: ${data.duration}ms`);
  }

  async onError(data: OnErrorData): Promise<void> {
    console.error(`[LoggingHook] 错误: ${data.operation}`, {
      message: data.error.message,
      stack: data.error.stack,
      input: data.input
    });
  }
}
