// 自定义错误类型

// @entity: ValidationError
// 表示注释或代码格式不符合 CDD 规范
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// @entity: FileNotFoundError
// 表示文件不存在
export class FileNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FileNotFoundError';
  }
}

// @entity: PermissionError
// 表示无文件读写权限
export class PermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermissionError';
  }
}

// @entity: ConfigurationError
// 表示配置缺失（如 API Key）
export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

// @entity: APIError
// 表示 Claude API 调用失败
export class APIError extends Error {
  constructor(message: string, public originalError?: unknown) {
    super(message);
    this.name = 'APIError';
  }
}

// @entity: TimeoutError
// 表示 API 调用超时
export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

// @entity: LogicUnclearError
// 表示代码逻辑混乱，无法转译
export class LogicUnclearError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LogicUnclearError';
  }
}

// @entity: UserCancelledError
// 表示用户取消操作
export class UserCancelledError extends Error {
  constructor(message: string = '用户取消操作') {
    super(message);
    this.name = 'UserCancelledError';
  }
}
