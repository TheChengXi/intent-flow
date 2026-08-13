/**
 * @intent
 * 守卫开关状态的持久化存储。读写项目根目录 .intentflow/guard-state.json（内容 { enabled: boolean }），enabled=true 表示守卫开启（拦截确认），false 表示守卫关闭（放行）。
 * 边界：文件不存在 / JSON 解析失败 / enabled 字段缺失或类型非法时，read() 一律返回 true（默认安全态），不抛异常；write() 失败抛错，不做任何兜底。
 * 验收条件：
 * - read() 在无文件、损坏 JSON、非法字段三种情况下均返回 true 且不抛异常
 * - write(true) 后 read() 返回 true；write(false) 后 read() 返回 false
 * - 配置文件路径固定为 <process.cwd()>/.intentflow/guard-state.json
 */

import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export class GuardToggleStore {
  private get configPath(): string {
    return join(process.cwd(), '.intentflow', 'guard-state.json');
  }

  /** 同步读取当前开关状态，任何异常回退安全态 true */
  read(): boolean {
    // @boundary 文件不存在 / JSON 解析失败 / enabled 缺失或类型非 boolean → 一律返回 true，不抛异常
    try {
      const raw = readFileSync(this.configPath, 'utf-8');
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null) {
        return true;
      }
      const enabled = (parsed as Record<string, unknown>).enabled;
      return typeof enabled === 'boolean' ? enabled : true;
    } catch {
      return true;
    }
  }

  /** 异步写入开关状态，失败抛错 */
  async write(enabled: boolean): Promise<void> {
    // @step 确保 .intentflow 目录存在（recursive），再异步写文件；失败直接抛出，不做兜底
    await mkdir(join(process.cwd(), '.intentflow'), { recursive: true });
    await writeFile(this.configPath, JSON.stringify({ enabled }), 'utf-8');
  }
}
