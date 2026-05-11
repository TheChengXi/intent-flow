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
exports.parseComment = parseComment;
exports.parseContractLine = parseContractLine;
exports.findCommentBlock = findCommentBlock;
const vscode = __importStar(require("vscode"));
const Errors_1 = require("../entities/Errors");
// @contract: parseComment(text: string, document: vscode.TextDocument, startLine: number) => CDDComment | null
// @step: [提取契约] 使用正则 /@contract:\s*(.+)/ 提取 @contract 行
// @step: [解析契约] 解析函数名、参数、返回类型、异常类型
// @step: [提取步骤] 使用正则 /@step:\s*\[(.+?)\]\s*(.+)/ 提取所有 @step
// @step: [检测简化] 检查是否包含 @simple 标记
// @step: [提取边界] 使用正则 /@boundary:\s*当(.+?)时，应(.+)/ 提取所有 @boundary
// @step: [计算范围] 从 startLine 到找到的最后一个注释行
// @step: [构建对象] 构建 CDDComment 对象
// @boundary: 当未找到 @contract 时，返回 null
// @boundary: 当 @contract 格式不符合 BR-007 时，抛出 ValidationError
// @boundary: 当 @boundary 格式不符合"当...时，应..."时，抛出 ValidationError
function parseComment(text, document, startLine) {
    const lines = text.split('\n');
    const contractMatch = text.match(/@contract:\s*(.+)/);
    if (!contractMatch) {
        return null;
    }
    const contract = parseContractLine(contractMatch[1]);
    const steps = [];
    const stepRegex = /@step:\s*\[(.+?)\]\s*(.+)/g;
    let stepMatch;
    while ((stepMatch = stepRegex.exec(text)) !== null) {
        steps.push({
            intent: stepMatch[1],
            description: stepMatch[2],
            isSimple: false
        });
    }
    const isSimple = text.includes('@simple');
    if (isSimple && steps.length > 0) {
        steps[0].isSimple = true;
    }
    const boundaries = [];
    const boundaryRegex = /@boundary:\s*当(.+?)时，应(.+)/g;
    let boundaryMatch;
    while ((boundaryMatch = boundaryRegex.exec(text)) !== null) {
        boundaries.push({
            condition: boundaryMatch[1],
            action: boundaryMatch[2]
        });
    }
    const endLine = startLine + lines.length - 1;
    const range = new vscode.Range(startLine, 0, endLine, lines[lines.length - 1].length);
    return {
        contract,
        steps,
        boundaries,
        range
    };
}
// @end
// @contract: parseContractLine(line: string) => ContractAnnotation
// @step: [正则匹配] 使用正则提取函数名、参数列表、返回类型、throws 子句
// @step: [解析参数] 分割参数列表，解析每个参数的名称和类型
// @step: [解析异常] 提取 throws 后的异常类型列表
// @step: [生成版本] 生成版本号格式为 functionName:v1.0
// @boundary: 当格式不匹配时，抛出 ValidationError
// @boundary: 当参数格式不包含类型时，抛出 ValidationError
function parseContractLine(line) {
    const contractRegex = /(\w+)\s*\(([^)]*)\)\s*=>\s*([^|]+)(?:\s*\|\s*throws\s+(.+))?/;
    const match = line.match(contractRegex);
    if (!match) {
        throw new Errors_1.ValidationError(`@contract 格式不符合 BR-007: ${line}`);
    }
    const functionName = match[1];
    const paramsStr = match[2].trim();
    const returnType = match[3].trim();
    const throwsStr = match[4]?.trim();
    const parameters = paramsStr ? paramsStr.split(',').map(param => {
        const [name, type] = param.trim().split(':').map(s => s.trim());
        if (!name || !type) {
            throw new Errors_1.ValidationError(`参数格式错误，必须包含类型标注: ${param}`);
        }
        return { name, type };
    }) : [];
    const throwsTypes = throwsStr ? throwsStr.split(',').map(t => t.trim()) : [];
    const version = `${functionName}:v1.0`;
    return {
        functionName,
        parameters,
        returnType,
        throwsTypes,
        version
    };
}
// @end
// @contract: findCommentBlock(document: vscode.TextDocument, position: vscode.Position) => { start: number; end: number } | null
// @step: [向上查找] 从当前位置向上查找，直到找到 @contract 或非注释行
// @step: [向下查找] 从 @contract 向下查找，直到找到 // @end 或非注释行
// @step: [返回范围] 返回起始行号和结束行号
// @boundary: 当未找到 @contract 时，返回 null
function findCommentBlock(document, position) {
    let startLine = position.line;
    let foundContract = false;
    for (let i = position.line; i >= 0; i--) {
        const line = document.lineAt(i).text.trim();
        if (line.includes('@contract:')) {
            startLine = i;
            foundContract = true;
            break;
        }
        if (!line.startsWith('//') && line !== '') {
            break;
        }
    }
    if (!foundContract) {
        return null;
    }
    let endLine = startLine;
    for (let i = startLine; i < document.lineCount; i++) {
        const line = document.lineAt(i).text.trim();
        endLine = i;
        if (line === '// @end') {
            break;
        }
        if (!line.startsWith('//') && line !== '') {
            break;
        }
    }
    return { start: startLine, end: endLine };
}
// @end
//# sourceMappingURL=CommentParser.js.map