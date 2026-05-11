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
// @step: [注册命令] 注册所有 Command（compile, review, translate, analyze, init）
// @step: [注册菜单] 注册右键菜单和命令面板
// @step: [初始化服务] 初始化 ClaudeAPIService、FileRepository 等单例
// @boundary: 当激活失败时，记录错误日志但不阻塞 VSCode
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
// @step: [清理] 清理所有 Disposable 资源
function deactivate() {
    console.log('CDD Validator 已停用');
}
// @end
//# sourceMappingURL=extension.js.map