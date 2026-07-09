// @intent: Hook 类型定义，定义所有 Hook 点的数据结构

// Hook 点名称
export type HookName =
  | 'before_extract'
  | 'after_extract'
  | 'before_search'
  | 'after_search'
  | 'on_error'
  | 'on_cache_hit'
  | 'on_cache_miss'
  | 'on_file_read';

// before_extract Hook 数据
export interface BeforeExtractData {
  filePath: string;
  startLine?: number;
  endLine?: number;
  depth: number;
}

// after_extract Hook 数据
export interface AfterExtractData {
  result: unknown;
  duration: number;
  filePath: string;
}

// before_search Hook 数据
export interface BeforeSearchData {
  name: string;
  filePath: string;
  language: string;
  type: 'function' | 'type';
}

// after_search Hook 数据
export interface AfterSearchData {
  name: string;
  filePath: string;
  result: unknown;
  duration: number;
  found: boolean;
  type: 'function' | 'type';
}

// on_error Hook 数据
export interface OnErrorData {
  error: Error;
  operation: string;
  input: unknown;
}

// on_cache_hit Hook 数据
export interface OnCacheHitData {
  key: string;
  type: 'file' | 'ast' | 'definition';
}

// on_cache_miss Hook 数据
export interface OnCacheMissData {
  key: string;
  type: 'file' | 'ast' | 'definition';
}

// on_file_read Hook 数据
export interface OnFileReadData {
  filePath: string;
  size: number;
}

// Hook 数据类型映射
export type HookDataMap = {
  before_extract: BeforeExtractData;
  after_extract: AfterExtractData;
  before_search: BeforeSearchData;
  after_search: AfterSearchData;
  on_error: OnErrorData;
  on_cache_hit: OnCacheHitData;
  on_cache_miss: OnCacheMissData;
  on_file_read: OnFileReadData;
};
