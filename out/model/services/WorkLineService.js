"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkLineService = void 0;
const TreeSitterParser_1 = require("./TreeSitterParser");
// @contract: WorkLineService.parseWorkLine(document: vscode.TextDocument, position: vscode.Position) => Promise<WorkLine | null>
// @step: [检测语言] 从文档语言 ID 推断语言
// @step: [获取代码] 获取文档全部文本
// @step: [调用 parser] 调用 TreeSitterParser.parseWorkLine
// @step: [返回结果] 返回 WorkLine 对象
// @boundary: 当语言不支持时，应返回 null
// @boundary: 当找不到工作行时，应返回 null
// @contract: WorkLineService.detectLanguage(languageId: string) => string
// @step: [映射语言] 将 VSCode 语言 ID 映射为 tree-sitter 语言名
// @step: [返回] 返回语言名
// @boundary: 当语言 ID 未知时，应返回 'typescript'
class WorkLineService {
    static async parseWorkLine(document, position) {
        const language = this.detectLanguage(document.languageId);
        const code = document.getText();
        const cursorLine = position.line;
        return await TreeSitterParser_1.TreeSitterParser.parseWorkLine(code, language, cursorLine);
    }
    static detectLanguage(languageId) {
        const map = {
            'typescript': 'typescript',
            'typescriptreact': 'tsx',
            'javascript': 'javascript',
            'javascriptreact': 'javascript',
            'python': 'python',
            'cpp': 'cpp',
            'c': 'c',
            'java': 'java',
            'go': 'go',
            'rust': 'rust',
            'kotlin': 'kotlin',
            'swift': 'swift',
            'csharp': 'csharp',
            'ruby': 'ruby',
            'php': 'php'
        };
        return map[languageId] || 'typescript';
    }
    static async extractReferencedContracts(workLine, workspaceRoot) {
        const vscode = require('vscode');
        const fs = require('fs').promises;
        const path = require('path');
        // 1. 从代码中提取 import/include 语句，获取依赖的文件路径
        const importedFiles = this.extractImportedFiles(workLine.codeText, workspaceRoot);
        // 2. 从代码中提取函数调用
        const functionCalls = this.extractFunctionCalls(workLine.codeText);
        // 3. 在导入的文件中搜索这些函数的契约
        const contracts = [];
        const notFoundFunctions = [];
        for (const funcName of functionCalls) {
            let found = false;
            // 优先在导入的文件中搜索
            for (const filePath of importedFiles) {
                const contract = await this.searchContractInFile(funcName, filePath);
                if (contract) {
                    contracts.push(contract);
                    found = true;
                    break;
                }
            }
            if (!found) {
                notFoundFunctions.push(funcName);
            }
        }
        // 4. 如果有未找到的函数，询问用户是否扩大搜索
        if (notFoundFunctions.length > 0) {
            const choice = await vscode.window.showInformationMessage(`在导入的文件中未找到以下函数的契约：${notFoundFunctions.join(', ')}\n\n是否在整个工作区搜索？`, '搜索', '跳过');
            if (choice === '搜索') {
                for (const funcName of notFoundFunctions) {
                    const result = await this.searchContractInWorkspaceWithPath(funcName, workspaceRoot);
                    if (result) {
                        contracts.push(result.contract);
                        // 询问是否添加 import
                        const importChoice = await vscode.window.showInformationMessage(`找到 ${funcName} 的契约（位于 ${result.relativePath}），是否添加导入语句？`, '添加', '跳过');
                        if (importChoice === '添加') {
                            // 这里只是提示，实际导入由用户手动添加或通过 IDE 功能
                            vscode.window.showInformationMessage(`请在文件顶部添加：import { ${funcName} } from '${result.importPath}';`);
                        }
                    }
                }
            }
        }
        return contracts;
    }
    // @contract: extractImportedFiles(code: string, workspaceRoot: string) => string[]
    // @step: [提取 import] 使用正则提取 import/require/include 语句
    // @step: [解析路径] 解析相对路径为绝对路径
    // @step: [返回] 返回文件路径数组
    static extractImportedFiles(code, workspaceRoot) {
        const path = require('path');
        const files = [];
        // TypeScript/JavaScript: import ... from '...'
        const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
        let match;
        while ((match = importRegex.exec(code)) !== null) {
            const importPath = match[1];
            // 只处理相对路径（./或../开头）
            if (importPath.startsWith('./') || importPath.startsWith('../')) {
                // 尝试添加常见扩展名
                const extensions = ['.ts', '.js', '.tsx', '.jsx'];
                for (const ext of extensions) {
                    files.push(path.resolve(workspaceRoot, importPath + ext));
                }
            }
        }
        // TypeScript/JavaScript: require('...')
        const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
        while ((match = requireRegex.exec(code)) !== null) {
            const requirePath = match[1];
            if (requirePath.startsWith('./') || requirePath.startsWith('../')) {
                const extensions = ['.ts', '.js', '.tsx', '.jsx'];
                for (const ext of extensions) {
                    files.push(path.resolve(workspaceRoot, requirePath + ext));
                }
            }
        }
        // Python: from ... import ... / import ...
        const pythonImportRegex = /(?:from\s+([.\w]+)\s+import|import\s+([.\w]+))/g;
        while ((match = pythonImportRegex.exec(code)) !== null) {
            const moduleName = match[1] || match[2];
            if (moduleName.startsWith('.')) {
                // 相对导入
                const modulePath = moduleName.replace(/\./g, '/') + '.py';
                files.push(path.resolve(workspaceRoot, modulePath));
            }
        }
        // C/C++: #include "..."
        const includeRegex = /#include\s+["<]([^">]+)[">]/g;
        while ((match = includeRegex.exec(code)) !== null) {
            const includePath = match[1];
            files.push(path.resolve(workspaceRoot, includePath));
        }
        // Go: import "..."
        const goImportRegex = /import\s+(?:\(\s*)?["']([^"']+)["']/g;
        while ((match = goImportRegex.exec(code)) !== null) {
            const importPath = match[1];
            if (importPath.startsWith('./') || importPath.startsWith('../')) {
                files.push(path.resolve(workspaceRoot, importPath + '.go'));
            }
        }
        return files;
    }
    // @end
    // @contract: extractFunctionCallsFromText(text: string) => string[]
    // @step: [调用私有方法] 调用 extractFunctionCalls 提取函数调用
    // @step: [返回] 返回函数名数组
    static extractFunctionCallsFromText(text) {
        return this.extractFunctionCalls(text);
    }
    // @contract: extractImportedFilesFromText(text: string, workspaceRoot: string) => string[]
    // @step: [调用私有方法] 调用 extractImportedFiles 提取导入文件
    // @step: [返回] 返回文件路径数组
    static extractImportedFilesFromText(text, workspaceRoot) {
        return this.extractImportedFiles(text, workspaceRoot);
    }
    // @contract: searchContractsForFunctions(functionNames: string[], importedFiles: string[], workspaceRoot: string) => Promise<string[]>
    // @step: [初始化] 创建契约数组和未找到函数列表
    // @step: [搜索导入文件] 在导入的文件中搜索每个函数的契约
    // @step: [全局搜索] 如果有未找到的函数，询问用户是否全局搜索
    // @step: [返回] 返回找到的契约数组
    static async searchContractsForFunctions(functionNames, importedFiles, workspaceRoot) {
        const vscode = require('vscode');
        const contracts = [];
        const notFoundFunctions = [];
        console.log('[WorkLineService] 开始搜索契约，函数数量:', functionNames.length);
        console.log('[WorkLineService] 导入文件数量:', importedFiles.length);
        // 在导入的文件中搜索
        for (const funcName of functionNames) {
            console.log('[WorkLineService] 搜索函数:', funcName);
            let found = false;
            for (const filePath of importedFiles) {
                console.log('[WorkLineService] 在文件中搜索:', filePath);
                const contract = await this.searchContractInFile(funcName, filePath);
                if (contract) {
                    console.log('[WorkLineService] 找到契约');
                    contracts.push(contract);
                    found = true;
                    break;
                }
            }
            if (!found) {
                console.log('[WorkLineService] 未找到函数契约:', funcName);
                notFoundFunctions.push(funcName);
            }
        }
        // 如果有未找到的函数，询问用户是否全局搜索
        if (notFoundFunctions.length > 0) {
            console.log('[WorkLineService] 弹出全局搜索对话框，未找到的函数:', notFoundFunctions);
            const choice = await vscode.window.showInformationMessage(`在导入的文件中未找到以下函数的契约：${notFoundFunctions.join(', ')}\n\n是否在整个工作区搜索？`, '搜索', '跳过');
            console.log('[WorkLineService] 用户选择:', choice);
            if (choice === '搜索') {
                for (const funcName of notFoundFunctions) {
                    console.log('[WorkLineService] 全局搜索函数:', funcName);
                    const result = await this.searchContractInWorkspaceWithPath(funcName, workspaceRoot);
                    if (result) {
                        console.log('[WorkLineService] 全局搜索找到契约:', result.relativePath);
                        contracts.push(result.contract);
                        // 询问是否添加 import
                        const importChoice = await vscode.window.showInformationMessage(`找到 ${funcName} 的契约（位于 ${result.relativePath}），是否添加导入语句？`, '添加', '跳过');
                        console.log('[WorkLineService] 用户选择是否添加导入:', importChoice);
                        if (importChoice === '添加') {
                            vscode.window.showInformationMessage(`请在文件顶部添加：import { ${funcName} } from '${result.importPath}';`);
                        }
                    }
                    else {
                        console.log('[WorkLineService] 全局搜索未找到函数:', funcName);
                    }
                }
            }
        }
        console.log('[WorkLineService] 契约搜索完成，找到数量:', contracts.length);
        return contracts;
    }
    // @end
    // @contract: extractFunctionCalls(code: string) => string[]
    // @step: [正则匹配] 使用正则提取所有函数调用（函数名后跟括号）
    // @step: [去重] 使用 Set 去除重复的函数名
    // @step: [过滤] 过滤掉常见的内置函数和方法
    // @step: [返回] 返回函数名数组
    static extractFunctionCalls(code) {
        const functionCallRegex = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;
        const calls = new Set();
        let match;
        while ((match = functionCallRegex.exec(code)) !== null) {
            const funcName = match[1];
            // 过滤掉常见的内置函数和关键字
            const builtins = ['if', 'for', 'while', 'switch', 'catch', 'function', 'return',
                'console', 'log', 'error', 'warn', 'info', 'debug',
                'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
                'parseInt', 'parseFloat', 'isNaN', 'isFinite',
                'Array', 'Object', 'String', 'Number', 'Boolean', 'Date', 'Math',
                'JSON', 'Promise', 'Map', 'Set', 'WeakMap', 'WeakSet'];
            if (!builtins.includes(funcName)) {
                calls.add(funcName);
            }
        }
        return Array.from(calls);
    }
    // @end
    // @contract: searchContractInFile(functionName: string, filePath: string) => Promise<string | null>
    // @step: [读取文件] 读取指定文件内容
    // @step: [搜索契约] 搜索 @contract: functionName
    // @step: [提取契约块] 提取完整的契约注释块
    // @step: [返回] 返回契约文本或 null
    static async searchContractInFile(functionName, filePath) {
        const fs = require('fs').promises;
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            // 搜索 @contract: functionName
            const contractRegex = new RegExp(`@contract:\\s*${functionName}\\s*\\(`, 'i');
            if (contractRegex.test(content)) {
                // 找到了，提取完整的契约注释块
                const lines = content.split('\n');
                let contractBlock = '';
                let inContract = false;
                for (const line of lines) {
                    if (line.includes(`@contract: ${functionName}`)) {
                        inContract = true;
                    }
                    if (inContract) {
                        contractBlock += line + '\n';
                        // 遇到非注释行，停止
                        const trimmed = line.trim();
                        if (trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('#')) {
                            break;
                        }
                    }
                }
                return contractBlock.trim();
            }
            return null;
        }
        catch (error) {
            // 文件不存在或读取失败
            return null;
        }
    }
    // @end
    // @contract: searchContractInWorkspaceWithPath(functionName: string, workspaceRoot: string) => Promise<{ contract: string; filePath: string; relativePath: string; importPath: string } | null>
    // @step: [构建搜索模式] 构建 @contract: functionName 的搜索模式
    // @step: [执行搜索] 使用 vscode.workspace.findFiles 和文件读取搜索契约
    // @step: [解析契约] 找到后提取完整的契约注释块
    // @step: [计算路径] 计算相对路径和导入路径
    // @step: [返回] 返回契约文本、文件路径、相对路径和导入路径
    // @boundary: 当找不到契约时，返回 null
    static async searchContractInWorkspaceWithPath(functionName, workspaceRoot) {
        const vscode = require('vscode');
        const fs = require('fs').promises;
        const path = require('path');
        try {
            // 搜索所有代码文件
            const files = await vscode.workspace.findFiles('**/*.{ts,js,py,go,java,cpp,c,rs,kt,swift,cs,rb,php}', '**/node_modules/**', 100 // 限制搜索文件数
            );
            for (const file of files) {
                const content = await fs.readFile(file.fsPath, 'utf-8');
                // 搜索 @contract: functionName
                const contractRegex = new RegExp(`@contract:\\s*${functionName}\\s*\\(`, 'i');
                if (contractRegex.test(content)) {
                    // 找到了，提取完整的契约注释块
                    const lines = content.split('\n');
                    let contractBlock = '';
                    let inContract = false;
                    for (const line of lines) {
                        if (line.includes(`@contract: ${functionName}`)) {
                            inContract = true;
                        }
                        if (inContract) {
                            contractBlock += line + '\n';
                            // 遇到非注释行或空行后的代码行，停止
                            const trimmed = line.trim();
                            if (trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('#')) {
                                break;
                            }
                        }
                    }
                    // 计算相对路径和导入路径
                    const relativePath = path.relative(workspaceRoot, file.fsPath);
                    const importPath = './' + relativePath.replace(/\\/g, '/').replace(/\.(ts|js|py|go|java|cpp|c|rs|kt|swift|cs|rb|php)$/, '');
                    return {
                        contract: contractBlock.trim(),
                        filePath: file.fsPath,
                        relativePath,
                        importPath
                    };
                }
            }
            return null;
        }
        catch (error) {
            console.error(`搜索契约 ${functionName} 失败:`, error);
            return null;
        }
    }
    // @end
    // @contract: searchContractInWorkspace(functionName: string, workspaceRoot: string) => Promise<string | null>
    // @step: [构建搜索模式] 构建 @contract: functionName 的搜索模式
    // @step: [执行搜索] 使用 vscode.workspace.findFiles 和文件读取搜索契约
    // @step: [解析契约] 找到后提取完整的契约注释块
    // @step: [返回] 返回契约文本或 null
    // @boundary: 已废弃，使用 searchContractInFile 替代
    static async searchContractInWorkspace(functionName, workspaceRoot) {
        const vscode = require('vscode');
        const fs = require('fs').promises;
        const path = require('path');
        try {
            // 搜索所有代码文件
            const files = await vscode.workspace.findFiles('**/*.{ts,js,py,go,java,cpp,c,rs,kt,swift,cs,rb,php}', '**/node_modules/**', 100 // 限制搜索文件数
            );
            for (const file of files) {
                const content = await fs.readFile(file.fsPath, 'utf-8');
                // 搜索 @contract: functionName
                const contractRegex = new RegExp(`@contract:\\s*${functionName}\\s*\\(`, 'i');
                if (contractRegex.test(content)) {
                    // 找到了，提取完整的契约注释块
                    const lines = content.split('\n');
                    let contractBlock = '';
                    let inContract = false;
                    for (const line of lines) {
                        if (line.includes(`@contract: ${functionName}`)) {
                            inContract = true;
                        }
                        if (inContract) {
                            contractBlock += line + '\n';
                            // 遇到非注释行或空行后的代码行，停止
                            const trimmed = line.trim();
                            if (trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('#')) {
                                break;
                            }
                        }
                    }
                    return contractBlock.trim();
                }
            }
            return null;
        }
        catch (error) {
            console.error(`搜索契约 ${functionName} 失败:`, error);
            return null;
        }
    }
    // @contract: extractTypeReferences(contractLine: string) => string[]
    // @step: [提取参数类型] 从参数列表中提取类型（param: Type）
    // @step: [提取返回类型] 从返回值中提取类型（=> Type）
    // @step: [展开泛型] 从泛型中提取内部类型（Promise<User> => User）
    // @step: [过滤内置类型] 过滤掉基础类型和标准库类型
    // @step: [去重] 使用 Set 去除重复的类型名
    // @step: [返回] 返回类型名数组
    // @boundary: 当 contractLine 格式不正确时，返回空数组
    static extractTypeReferences(contractLine) {
        const types = new Set();
        // 内置类型列表
        const builtinTypes = new Set([
            // 基础类型
            'string', 'number', 'boolean', 'null', 'undefined', 'void', 'any', 'unknown', 'never', 'symbol', 'bigint',
            // 标准库类型
            'Promise', 'Array', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Date', 'Error', 'RegExp',
            'Partial', 'Required', 'Readonly', 'Record', 'Pick', 'Omit', 'Exclude', 'Extract',
            // 前端类型（假设 React 已导入）
            'JSX', 'React', 'ReactNode', 'ReactElement', 'FC', 'Component'
        ]);
        // 提取所有类型引用的正则（匹配 : Type 或 => Type）
        const typeRegex = /:\s*([A-Z][a-zA-Z0-9_<>,\s\[\]|&]*)|=>\s*([A-Z][a-zA-Z0-9_<>,\s\[\]|&]*)/g;
        let match;
        while ((match = typeRegex.exec(contractLine)) !== null) {
            const typeStr = match[1] || match[2];
            if (typeStr) {
                // 提取所有类型名（包括泛型内部的类型）
                const typeNames = this.extractTypeNamesFromTypeString(typeStr.trim());
                typeNames.forEach(typeName => {
                    if (!builtinTypes.has(typeName)) {
                        types.add(typeName);
                    }
                });
            }
        }
        return Array.from(types);
    }
    // @end
    // @contract: extractTypeNamesFromTypeString(typeStr: string) => string[]
    // @step: [移除空格] 移除所有空格
    // @step: [提取类型名] 使用正则提取所有大写开头的类型名
    // @step: [过滤关键字] 过滤掉 Promise, Array 等泛型容器
    // @step: [返回] 返回类型名数组
    static extractTypeNamesFromTypeString(typeStr) {
        const types = [];
        // 移除空格
        const cleaned = typeStr.replace(/\s+/g, '');
        // 提取所有大写开头的标识符（类型名）
        const typeNameRegex = /[A-Z][a-zA-Z0-9_]*/g;
        let match;
        while ((match = typeNameRegex.exec(cleaned)) !== null) {
            types.push(match[0]);
        }
        return types;
    }
    // @end
    // @contract: searchTypeDefinitionInFile(typeName: string, filePath: string) => Promise<string | null>
    // @step: [读取文件] 读取指定文件内容
    // @step: [搜索类型定义] 搜索 interface/type/class/enum TypeName
    // @step: [提取定义块] 提取完整的类型定义代码
    // @step: [返回] 返回类型定义文本或 null
    // @boundary: 当文件不存在时，返回 null
    // @boundary: 当类型未找到时，返回 null
    static async searchTypeDefinitionInFile(typeName, filePath) {
        const fs = require('fs').promises;
        try {
            console.log(`[WorkLineService] 搜索类型定义: ${typeName} 在文件: ${filePath}`);
            const content = await fs.readFile(filePath, 'utf-8');
            console.log(`[WorkLineService] 文件内容长度: ${content.length}`);
            // 搜索类型定义（interface, type, class, enum）
            const typeDefRegex = new RegExp(`^\\s*(export\\s+)?(interface|type|class|enum)\\s+${typeName}\\b`, 'm');
            const match = typeDefRegex.exec(content);
            if (!match) {
                console.log(`[WorkLineService] 未找到类型定义: ${typeName}`);
                return null;
            }
            console.log(`[WorkLineService] 找到类型定义: ${typeName} at index ${match.index}`);
            // 找到定义的起始位置
            const startIndex = match.index;
            const lines = content.split('\n');
            let currentIndex = 0;
            let startLine = 0;
            // 找到起始行
            for (let i = 0; i < lines.length; i++) {
                if (currentIndex + lines[i].length >= startIndex) {
                    startLine = i;
                    break;
                }
                currentIndex += lines[i].length + 1; // +1 for newline
            }
            // 提取完整的类型定义
            let definition = '';
            let braceCount = 0;
            let inDefinition = false;
            for (let i = startLine; i < lines.length; i++) {
                const line = lines[i];
                definition += line + '\n';
                // 计算大括号数量
                for (const char of line) {
                    if (char === '{') {
                        braceCount++;
                        inDefinition = true;
                    }
                    else if (char === '}') {
                        braceCount--;
                    }
                }
                // 如果是 type 别名（没有大括号），遇到分号或换行结束
                if (!inDefinition && line.includes('=') && (line.trim().endsWith(';') || line.trim().endsWith(','))) {
                    break;
                }
                // 如果大括号匹配完成，结束
                if (inDefinition && braceCount === 0) {
                    break;
                }
            }
            return definition.trim();
        }
        catch (error) {
            return null;
        }
    }
}
exports.WorkLineService = WorkLineService;
//# sourceMappingURL=WorkLineService.js.map