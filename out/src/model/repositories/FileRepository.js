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
exports.readFile = readFile;
exports.writeFile = writeFile;
exports.appendFile = appendFile;
exports.fileExists = fileExists;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const Errors_1 = require("../entities/Errors");
// @contract: readFile(filePath: string) => Promise<string>
// @step: [读取] 使用 fs.promises.readFile 读取文件内容
// @step: [解码] 以 UTF-8 解码
// @boundary: 当文件不存在时，抛出 FileNotFoundError
// @boundary: 当无读取权限时，抛出 PermissionError
async function readFile(filePath) {
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        return content;
    }
    catch (error) {
        if (error.code === 'ENOENT') {
            throw new Errors_1.FileNotFoundError(`文件不存在: ${filePath}`);
        }
        if (error.code === 'EACCES' || error.code === 'EPERM') {
            throw new Errors_1.PermissionError(`无读取权限: ${filePath}`);
        }
        throw error;
    }
}
// @end
// @contract: writeFile(filePath: string, content: string) => Promise<void>
// @step: [创建目录] 如果父目录不存在，递归创建
// @step: [写入] 使用 fs.promises.writeFile 写入内容
// @boundary: 当无写入权限时，抛出 PermissionError
async function writeFile(filePath, content) {
    try {
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(filePath, content, 'utf-8');
    }
    catch (error) {
        if (error.code === 'EACCES' || error.code === 'EPERM') {
            throw new Errors_1.PermissionError(`无写入权限: ${filePath}`);
        }
        throw error;
    }
}
// @end
// @contract: appendFile(filePath: string, content: string) => Promise<void>
// @step: [创建目录] 如果父目录不存在，递归创建
// @step: [追加] 使用 fs.promises.appendFile 追加内容
// @boundary: 当文件不存在时，自动创建
// @boundary: 当无写入权限时，抛出 PermissionError
async function appendFile(filePath, content) {
    try {
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });
        await fs.appendFile(filePath, content, 'utf-8');
    }
    catch (error) {
        if (error.code === 'EACCES' || error.code === 'EPERM') {
            throw new Errors_1.PermissionError(`无写入权限: ${filePath}`);
        }
        throw error;
    }
}
// @end
// @contract: fileExists(filePath: string) => Promise<boolean>
// @step: [检查] 使用 fs.promises.access 检查文件是否存在
// @step: [返回] 存在返回 true，不存在返回 false
async function fileExists(filePath) {
    try {
        await fs.access(filePath);
        return true;
    }
    catch {
        return false;
    }
}
// @end
//# sourceMappingURL=FileRepository.js.map