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
exports.execute = execute;
const vscode = __importStar(require("vscode"));
const FileRepository = __importStar(require("../../model/repositories/FileRepository"));
const path = __importStar(require("path"));
// @contract: execute() => Promise<void>
// @step: [检查] 检查 _source/ 是否已存在
// @step: [创建目录] 创建 _source/ 目录
// @step: [复制模板] 从 templates/ 复制所有 .template.md 文件到 _source/
// @step: [创建日志] 创建空的 WorkSchedule.md
// @step: [提示] 显示"CDD 项目结构已创建，请填写 PROJECT_SOUL.md"
// @boundary: 当 _source/ 已存在时，按 BUSINESS_RULES 流程5异常处理
async function execute() {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
    if (!workspaceRoot) {
        vscode.window.showErrorMessage('未打开工作区');
        return;
    }
    const sourcePath = path.join(workspaceRoot, '_source');
    const sourceExists = await FileRepository.fileExists(sourcePath);
    if (sourceExists) {
        vscode.window.showInformationMessage('检测到已有 CDD 结构，已补充缺失文件');
    }
    const templates = [
        { name: 'PROJECT_SOUL.md', content: '# PROJECT_SOUL.md\n\n## 项目愿景\n\n[填写项目愿景]\n' },
        { name: 'BUSINESS_RULES.md', content: '# BUSINESS_RULES.md\n\n## 业务规则\n\n[填写业务规则]\n' },
        { name: 'TECH_STACK.md', content: '# TECH_STACK.md\n\n## 技术栈\n\n[填写技术栈]\n' },
        { name: 'CONTRACTS.md', content: '# CONTRACTS.md\n\n## 模块契约\n\n[填写契约]\n' },
        { name: 'COMPILE_SPEC.md', content: '# COMPILE_SPEC.md\n\n## 编译规范\n\n[填写编译规范]\n' },
        { name: 'CHANGELOG.md', content: '# CHANGELOG.md\n\n## 变更日志\n\n格式：`日期 | 文件 | 变更内容 | 变更原因 | 类型`\n\n---\n\n' }
    ];
    for (const template of templates) {
        const filePath = path.join(sourcePath, template.name);
        const exists = await FileRepository.fileExists(filePath);
        if (!exists) {
            await FileRepository.writeFile(filePath, template.content);
        }
    }
    const workSchedulePath = path.join(workspaceRoot, 'WorkSchedule.md');
    const workScheduleExists = await FileRepository.fileExists(workSchedulePath);
    if (!workScheduleExists) {
        const header = '# WorkSchedule.md\n\n## 工作日志\n\n格式：`日期 | 时间 | 执行角色 | 工作简述 | 耗时 | 依赖契约版本`\n\n---\n\n';
        await FileRepository.writeFile(workSchedulePath, header);
    }
    vscode.window.showInformationMessage('CDD 项目结构已创建，请填写 PROJECT_SOUL.md');
}
// @end
//# sourceMappingURL=InitCommand.js.map