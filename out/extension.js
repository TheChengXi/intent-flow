"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const CompileCommand = __importStar(require("./viewmodel/commands/CompileCommand"));
const ReviewCommand = __importStar(require("./viewmodel/commands/ReviewCommand"));
const TranslateCommand = __importStar(require("./viewmodel/commands/TranslateCommand"));
const AnalyzeCommand = __importStar(require("./viewmodel/commands/AnalyzeCommand"));
const InitCommand = __importStar(require("./viewmodel/commands/InitCommand"));
// @contract: activate(context: vscode.ExtensionContext) => void
// @step: [初始化] 输出激活日志
// @step: [注册] 注册 5 个命令处理器（compile、review、translate、analyze、init）
// @step: [订阅] 将所有命令注册器推入上下文订阅列表以确保资源清理
// @boundary: 当 context 为 undefined 时，应抛出 TypeError
// @boundary: 当命令注册失败时，应捕获异常并输出错误日志
// @boundary: 当订阅列表已满时，应检查内存泄漏风险
function activate(context) {
    console.log('CDD Validator 已激活');
    const compileCommand = vscode.commands.registerCommand('cdd.compile', CompileCommand.execute);
    const reviewCommand = vscode.commands.registerCommand('cdd.review', ReviewCommand.execute);
    const translateCommand = vscode.commands.registerCommand('cdd.translate', TranslateCommand.execute);
    const analyzeCommand = vscode.commands.registerCommand('cdd.analyze', AnalyzeCommand.execute);
    const initCommand = vscode.commands.registerCommand('cdd.init', InitCommand.execute);
    context.subscriptions.push(compileCommand);
    context.subscriptions.push(reviewCommand);
    context.subscriptions.push(translateCommand);
    context.subscriptions.push(analyzeCommand);
    context.subscriptions.push(initCommand);
}
// @end
// @contract: deactivate() => void
// @step: [通知] 输出停用日志到控制台
// @boundary: 当函数执行时，应输出 'CDD Validator 已停用' 消息
function deactivate() {
    console.log('CDD Validator 已停用');
}
// @end
//# sourceMappingURL=extension.js.map