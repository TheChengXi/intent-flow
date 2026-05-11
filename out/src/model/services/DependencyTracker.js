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
exports.recordDependency = recordDependency;
exports.checkOutdated = checkOutdated;
exports.getDependencies = getDependencies;
const WorkScheduleRepo = __importStar(require("../repositories/WorkScheduleRepo"));
const dependencyMap = new Map();
// @contract: recordDependency(functionName: string, dependencies: ContractDependency[]) => void
// @step: [存储] 将依赖关系存储在内存 Map 中，key 为 functionName
// @step: [版本] 记录每个依赖契约的当前版本
function recordDependency(functionName, dependencies) {
    dependencyMap.set(functionName, dependencies);
}
// @end
// @contract: checkOutdated(changedContracts: string[], workspaceRoot: string) => Promise<string[]>
// @step: [读取记录] 调用 WorkScheduleRepo.getAllRecords 获取所有编译记录
// @step: [遍历记录] 遍历每条记录的 dependencies
// @step: [比对版本] 检查依赖的契约名称是否在 changedContracts 中
// @step: [收集结果] 将受影响的函数名添加到结果数组
// @step: [去重] 对结果数组去重
// @boundary: 当 WorkSchedule.md 不存在时，返回空数组
// @boundary: 当 changedContracts 为空时，返回空数组
async function checkOutdated(changedContracts, workspaceRoot) {
    if (changedContracts.length === 0) {
        return [];
    }
    const records = await WorkScheduleRepo.getAllRecords(workspaceRoot);
    const affectedFunctions = new Set();
    for (const record of records) {
        for (const dep of record.dependencies) {
            if (changedContracts.includes(dep.contractName)) {
                affectedFunctions.add(record.description);
            }
        }
    }
    return Array.from(affectedFunctions);
}
// @end
// @contract: getDependencies(functionName: string) => ContractDependency[]
// @step: [查询] 从内存 Map 中查询指定函数的依赖
// @boundary: 当函数名不存在时，返回空数组
function getDependencies(functionName) {
    return dependencyMap.get(functionName) || [];
}
// @end
//# sourceMappingURL=DependencyTracker.js.map