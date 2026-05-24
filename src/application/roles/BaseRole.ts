import { ClaudeAPIService } from '../../data/services/ClaudeAPIService';

// @entity: RoleResult
// 角色执行结果
export interface RoleResult {
  success: boolean;
  message: string;
  artifacts?: any;
}

// @contract: BaseRole (抽象基类)
// 所有角色的基类
export abstract class BaseRole {
  constructor(protected apiService: ClaudeAPIService) {}

  // @contract: execute(context: any) => Promise<RoleResult>
  // @step: [抽象方法] 子类必须实现具体执行逻辑
  // @boundary: 当执行失败时，返回 success: false 和错误信息
  abstract execute(context: any): Promise<RoleResult>;
}
