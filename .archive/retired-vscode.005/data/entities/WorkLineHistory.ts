import { CDDComment } from './CDDComment';
import { StepDiff } from '../services/StepDiffDetector';

// @entity: IncrementalContext
// 增量编译上下文
export interface IncrementalContext {
  isIncremental: boolean;
  stepDiff?: StepDiff;
  previousCode?: string;
}

// @entity: WorkLineHistoryRecord
// 工作行历史记录
export interface WorkLineHistoryRecord {
  timestamp: string;
  role: 'compiler' | 'reviewer' | 'translator';
  input: {
    comment?: string;
    code?: string;
    compileSpec?: string;
    reviewFeedback?: string;
    oldContract?: string;
    parsedComment?: CDDComment;
    incrementalContext?: IncrementalContext;
  };
  output: {
    success: boolean;
    content: string;
    issues?: string[];
  };
}

// @entity: WorkLineHistory
// 工作行完整历史
export interface WorkLineHistory {
  functionName: string;
  contract: string;
  contractVersion: string;
  filePath: string;
  history: WorkLineHistoryRecord[];
}
