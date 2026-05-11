"use strict";
// 自定义错误类型
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserCancelledError = exports.LogicUnclearError = exports.TimeoutError = exports.APIError = exports.ConfigurationError = exports.PermissionError = exports.FileNotFoundError = exports.ValidationError = void 0;
// @entity: ValidationError
// 表示注释或代码格式不符合 CDD 规范
class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
    }
}
exports.ValidationError = ValidationError;
// @entity: FileNotFoundError
// 表示文件不存在
class FileNotFoundError extends Error {
    constructor(message) {
        super(message);
        this.name = 'FileNotFoundError';
    }
}
exports.FileNotFoundError = FileNotFoundError;
// @entity: PermissionError
// 表示无文件读写权限
class PermissionError extends Error {
    constructor(message) {
        super(message);
        this.name = 'PermissionError';
    }
}
exports.PermissionError = PermissionError;
// @entity: ConfigurationError
// 表示配置缺失（如 API Key）
class ConfigurationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ConfigurationError';
    }
}
exports.ConfigurationError = ConfigurationError;
// @entity: APIError
// 表示 Claude API 调用失败
class APIError extends Error {
    constructor(message, originalError) {
        super(message);
        this.originalError = originalError;
        this.name = 'APIError';
    }
}
exports.APIError = APIError;
// @entity: TimeoutError
// 表示 API 调用超时
class TimeoutError extends Error {
    constructor(message) {
        super(message);
        this.name = 'TimeoutError';
    }
}
exports.TimeoutError = TimeoutError;
// @entity: LogicUnclearError
// 表示代码逻辑混乱，无法转译
class LogicUnclearError extends Error {
    constructor(message) {
        super(message);
        this.name = 'LogicUnclearError';
    }
}
exports.LogicUnclearError = LogicUnclearError;
// @entity: UserCancelledError
// 表示用户取消操作
class UserCancelledError extends Error {
    constructor(message = '用户取消操作') {
        super(message);
        this.name = 'UserCancelledError';
    }
}
exports.UserCancelledError = UserCancelledError;
//# sourceMappingURL=Errors.js.map