import { IFileRepository } from '../../repositories/IFileRepository';

// @intent: 文件监听器，监听文件变化并触发缓存失效

export class FileWatcher {
  private fileRepo: IFileRepository;
  private onChangeCallbacks: Map<string, Set<(filePath: string) => void>> = new Map();

  constructor(fileRepo: IFileRepository) {
    this.fileRepo = fileRepo;
  }

  // @contract: watch(filePath: string, callback: (filePath: string) => void) => void
  // @step: [注册回调] 将回调函数添加到回调集合
  // @step: [开始监听] 如果是第一次监听该文件，调用 fileRepo.watchFile
  watch(filePath: string, callback: (filePath: string) => void): void {
    if (!this.onChangeCallbacks.has(filePath)) {
      this.onChangeCallbacks.set(filePath, new Set());

      // 开始监听文件
      this.fileRepo.watchFile(filePath, (changedPath) => {
        this.notifyChange(changedPath);
      });
    }

    this.onChangeCallbacks.get(filePath)!.add(callback);
  }

  // @contract: unwatch(filePath: string, callback?: (filePath: string) => void) => void
  // @step: [移除回调] 如果提供了回调，从集合中移除；否则清空所有回调
  // @step: [停止监听] 如果没有回调了，调用 fileRepo.unwatchFile
  unwatch(filePath: string, callback?: (filePath: string) => void): void {
    const callbacks = this.onChangeCallbacks.get(filePath);
    if (!callbacks) {
      return;
    }

    if (callback) {
      callbacks.delete(callback);
    } else {
      callbacks.clear();
    }

    // 如果没有回调了，停止监听
    if (callbacks.size === 0) {
      this.onChangeCallbacks.delete(filePath);
      this.fileRepo.unwatchFile(filePath);
    }
  }

  // @contract: notifyChange(filePath: string) => void
  // @step: [获取回调] 获取该文件的所有回调函数
  // @step: [触发回调] 依次调用所有回调函数
  private notifyChange(filePath: string): void {
    const callbacks = this.onChangeCallbacks.get(filePath);
    if (callbacks) {
      callbacks.forEach(callback => callback(filePath));
    }
  }

  // @contract: unwatchAll() => void
  // @step: [遍历所有文件] 遍历所有被监听的文件
  // @step: [停止监听] 调用 fileRepo.unwatchFile 停止监听
  // @step: [清空记录] 清空回调集合
  unwatchAll(): void {
    this.onChangeCallbacks.forEach((_, filePath) => {
      this.fileRepo.unwatchFile(filePath);
    });
    this.onChangeCallbacks.clear();
  }
}
