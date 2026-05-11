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
exports.addRecord = addRecord;
exports.archiveOldRecords = archiveOldRecords;
exports.getAllRecords = getAllRecords;
const FileRepository = __importStar(require("./FileRepository"));
const path = __importStar(require("path"));
const HEADER = '## 工作日志\n\n格式：`日期 | 时间 | 执行角色 | 工作简述 | 耗时 | 依赖契约版本`\n\n---\n\n';
// @contract: addRecord(record: CompileRecord, workspaceRoot: string) => Promise<void>
// @step: [格式化] 按 BR-004 格式化记录：日期 | 时间 | 角色 | 简述 | 耗时 | 依赖
// @step: [追加] 调用 FileRepository.appendFile 追加到 WorkSchedule.md
// @step: [检查行数] 读取文件行数，超过 500 行触发归档
// @boundary: 当 WorkSchedule.md 不存在时，自动创建并添加表头
async function addRecord(record, workspaceRoot) {
    const filePath = path.join(workspaceRoot, 'WorkSchedule.md');
    const depsStr = record.dependencies.map(d => `${d.contractName}:${d.version}`).join(', ') || '-';
    const line = `${record.date} | ${record.time} | ${record.role} | ${record.description} | ${record.duration}秒 | ${depsStr}\n`;
    const exists = await FileRepository.fileExists(filePath);
    if (!exists) {
        await FileRepository.writeFile(filePath, HEADER + line);
    }
    else {
        await FileRepository.appendFile(filePath, line);
        const content = await FileRepository.readFile(filePath);
        const lines = content.split('\n');
        if (lines.length > 500) {
            await archiveOldRecords(workspaceRoot);
        }
    }
}
// @end
// @contract: archiveOldRecords(workspaceRoot: string) => Promise<void>
// @step: [读取] 读取 WorkSchedule.md 全部内容
// @step: [分割] 保留最近 100 行，其余移动到 WorkSchedule_v[N].md
// @step: [写入] 更新 WorkSchedule.md，创建归档文件
// @boundary: 当已存在同名归档文件时，递增版本号
async function archiveOldRecords(workspaceRoot) {
    const filePath = path.join(workspaceRoot, 'WorkSchedule.md');
    const content = await FileRepository.readFile(filePath);
    const lines = content.split('\n');
    const recentLines = lines.slice(-100);
    const oldLines = lines.slice(0, -100);
    let version = 1;
    let archivePath = path.join(workspaceRoot, `WorkSchedule_v${version}.md`);
    while (await FileRepository.fileExists(archivePath)) {
        version++;
        archivePath = path.join(workspaceRoot, `WorkSchedule_v${version}.md`);
    }
    await FileRepository.writeFile(archivePath, oldLines.join('\n'));
    await FileRepository.writeFile(filePath, HEADER + recentLines.join('\n'));
}
// @end
// @contract: getAllRecords(workspaceRoot: string) => Promise<CompileRecord[]>
// @step: [读取] 读取 WorkSchedule.md 全部内容
// @step: [解析] 按 BR-004 格式解析每一行为 CompileRecord
// @step: [过滤] 跳过表头和空行
// @boundary: 当文件不存在时，返回空数组
async function getAllRecords(workspaceRoot) {
    const filePath = path.join(workspaceRoot, 'WorkSchedule.md');
    const exists = await FileRepository.fileExists(filePath);
    if (!exists) {
        return [];
    }
    const content = await FileRepository.readFile(filePath);
    const lines = content.split('\n');
    const records = [];
    for (const line of lines) {
        if (!line.trim() || line.startsWith('#') || line.startsWith('格式') || line.startsWith('---')) {
            continue;
        }
        const parts = line.split('|').map(p => p.trim());
        if (parts.length >= 6) {
            const depsStr = parts[5];
            const dependencies = depsStr === '-' ? [] : depsStr.split(',').map(d => {
                const [contractName, version] = d.trim().split(':');
                return { contractName, version };
            });
            records.push({
                date: parts[0],
                time: parts[1],
                role: parts[2],
                description: parts[3],
                duration: parseInt(parts[4].replace('秒', '')) || 0,
                dependencies
            });
        }
    }
    return records;
}
// @end
//# sourceMappingURL=WorkScheduleRepo.js.map