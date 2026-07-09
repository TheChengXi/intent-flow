/**
 * @intent
 * 全局静态注册表，将语言名映射到对应的 ImportResolver 实例。
 * register(resolver, ...aliases) 一次注册 + 多个别名（如 TS/JS/TSX 共用一个）。
 * get(lang) 供 ImportExtractor 调度器查表分发。
 * 同语言重复注册发出警告并用后者覆盖（方便测试 mock）。
 */

import { ImportResolver } from './ImportResolver';

export class ResolverRegistry {
  private static readonly resolvers = new Map<string, ImportResolver>();

  /** 注册一个 resolver 及其别名。后注册覆盖前注册。 */
  static register(resolver: ImportResolver, ...aliases: string[]): void {
    const languages = [resolver.language, ...aliases];
    for (const lang of languages) {
      if (this.resolvers.has(lang)) {
        console.warn(`[ResolverRegistry] 覆盖已注册的语言: ${lang}`);
      }
      this.resolvers.set(lang, resolver);
    }
  }

  /** 按语言名查找 resolver，未注册返回 null */
  static get(language: string): ImportResolver | null {
    return this.resolvers.get(language.toLowerCase()) ?? null;
  }

  /** 该语言是否已注册 */
  static has(language: string): boolean {
    return this.resolvers.has(language.toLowerCase());
  }

  /** 列出所有已注册的语言名 */
  static registeredLanguages(): string[] {
    return Array.from(this.resolvers.keys());
  }
}
