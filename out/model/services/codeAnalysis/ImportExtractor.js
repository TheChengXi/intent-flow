"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImportExtractor = void 0;
const TreeSitterParser_1 = require("../TreeSitterParser");
// @contract: ImportExtractor.extractImportedFiles(code: string, workspaceRoot: string, language?: string) => Promise<string[]>
// @step: [检测语言] 如果提供了 language，使用 Tree-sitter 方案
// @step: [调用方法] 调用 extractWithTreeSitter 或 extractWithRegex
// @step: [返回] 返回文件路径数组
class ImportExtractor {
    // @contract: extractImportedFiles(code: string, workspaceRoot: string, language?: string) => Promise<string[]>
    // @step: [检测语言] 如果提供了 language，使用 Tree-sitter 方案
    // @step: [调用方法] 调用 extractWithTreeSitter 或 extractWithRegex
    // @step: [返回] 返回文件路径数组
    static async extractImportedFiles(code, workspaceRoot, language) {
        if (language) {
            return await this.extractWithTreeSitter(code, workspaceRoot, language);
        }
        return this.extractWithRegex(code, workspaceRoot);
    }
    // @contract: extractWithRegex(code: string, workspaceRoot: string) => string[]
    // @step: [提取 import] 使用正则提取 import/require/include 语句
    // @step: [解析路径] 解析相对路径为绝对路径
    // @step: [返回] 返回文件路径数组
    static extractWithRegex(code, workspaceRoot) {
        const path = require('path');
        const files = [];
        // TypeScript/JavaScript: import ... from '...'
        const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
        let match;
        while ((match = importRegex.exec(code)) !== null) {
            const importPath = match[1];
            if (importPath.startsWith('./') || importPath.startsWith('../')) {
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
    // @contract: extractWithTreeSitter(code: string, workspaceRoot: string, language: string) => Promise<string[]>
    // @step: [初始化] 初始化 Tree-sitter parser
    // @step: [解析代码] 使用 Tree-sitter 解析代码生成 AST
    // @step: [遍历 AST] 递归遍历 AST 查找 import 节点
    // @step: [提取路径] 从 import 节点中提取文件路径
    // @step: [解析路径] 解析相对路径为绝对路径
    // @step: [去重] 使用 Set 去除重复
    // @step: [返回] 返回文件路径数组
    // @boundary: 当 Tree-sitter 初始化失败时，回退到正则方案
    // @boundary: 当语言不支持时，回退到正则方案
    static async extractWithTreeSitter(code, workspaceRoot, language) {
        try {
            await TreeSitterParser_1.TreeSitterParser.init();
            // 使用 TreeSitterParser 的内部 parser
            const lang = await TreeSitterParser_1.TreeSitterParser['getLanguage'](language);
            if (!lang) {
                console.warn('[ImportExtractor] Tree-sitter 不支持该语言，回退到正则方案');
                return this.extractWithRegex(code, workspaceRoot);
            }
            const Parser = require('web-tree-sitter');
            const parser = new Parser();
            parser.setLanguage(lang);
            const tree = parser.parse(code);
            if (!tree) {
                console.warn('[ImportExtractor] Tree-sitter 解析失败，回退到正则方案');
                return this.extractWithRegex(code, workspaceRoot);
            }
            const files = new Set();
            const traverse = (node) => {
                const importPath = this.extractImportPathFromNode(node, language);
                if (importPath) {
                    // 只处理相对路径
                    if (importPath.startsWith('./') || importPath.startsWith('../') || importPath.startsWith('.')) {
                        const resolvedPaths = this.resolveImportPath(importPath, workspaceRoot, language);
                        resolvedPaths.forEach(p => files.add(p));
                    }
                }
                for (const child of node.children) {
                    traverse(child);
                }
            };
            traverse(tree.rootNode);
            return Array.from(files);
        }
        catch (error) {
            console.warn('[ImportExtractor] Tree-sitter 提取失败，回退到正则方案:', error);
            return this.extractWithRegex(code, workspaceRoot);
        }
    }
    // @end
    // @contract: extractImportPathFromNode(node: any, language: string) => string | null
    // @step: [根据语言] 根据不同语言的 AST 结构提取 import 路径
    // @step: [查找字符串] 查找路径字符串节点
    // @step: [返回] 返回路径字符串或 null
    static extractImportPathFromNode(node, language) {
        const lang = language.toLowerCase();
        if (lang === 'typescript' || lang === 'javascript' || lang === 'tsx') {
            // import ... from 'path'
            if (node.type === 'import_statement') {
                const source = node.children.find((c) => c.type === 'string');
                if (source) {
                    return this.cleanStringLiteral(source.text);
                }
            }
            // require('path')
            if (node.type === 'call_expression') {
                const func = node.children.find((c) => c.type === 'identifier' && c.text === 'require');
                if (func) {
                    const args = node.children.find((c) => c.type === 'arguments');
                    if (args) {
                        const str = args.children.find((c) => c.type === 'string');
                        if (str) {
                            return this.cleanStringLiteral(str.text);
                        }
                    }
                }
            }
        }
        else if (lang === 'python') {
            // from ... import ... / import ...
            if (node.type === 'import_statement' || node.type === 'import_from_statement') {
                // from module import ...
                if (node.type === 'import_from_statement') {
                    const moduleName = node.children.find((c) => c.type === 'dotted_name' || c.type === 'relative_import');
                    if (moduleName) {
                        return moduleName.text;
                    }
                }
                // import module
                if (node.type === 'import_statement') {
                    const moduleName = node.children.find((c) => c.type === 'dotted_name');
                    if (moduleName) {
                        return moduleName.text;
                    }
                }
            }
        }
        else if (lang === 'go') {
            // import "path"
            if (node.type === 'import_spec') {
                const path = node.children.find((c) => c.type === 'interpreted_string_literal' || c.type === 'raw_string_literal');
                if (path) {
                    return this.cleanStringLiteral(path.text);
                }
            }
        }
        else if (lang === 'cpp' || lang === 'c') {
            // #include "path" or #include <path>
            if (node.type === 'preproc_include') {
                const path = node.children.find((c) => c.type === 'string_literal' || c.type === 'system_lib_string');
                if (path) {
                    return this.cleanStringLiteral(path.text);
                }
            }
        }
        return null;
    }
    // @end
    // @contract: cleanStringLiteral(str: string) => string
    // @step: [移除引号] 移除字符串两端的引号
    // @step: [返回] 返回清理后的字符串
    static cleanStringLiteral(str) {
        return str.replace(/^['"`<]|['"`>]$/g, '');
    }
    // @end
    // @contract: resolveImportPath(importPath: string, workspaceRoot: string, language: string) => string[]
    // @step: [根据语言] 根据不同语言添加对应的扩展名
    // @step: [解析路径] 解析相对路径为绝对路径
    // @step: [返回] 返回可能的文件路径数组
    static resolveImportPath(importPath, workspaceRoot, language) {
        const path = require('path');
        const lang = language.toLowerCase();
        const files = [];
        if (lang === 'typescript' || lang === 'javascript' || lang === 'tsx') {
            const extensions = ['.ts', '.js', '.tsx', '.jsx'];
            for (const ext of extensions) {
                files.push(path.resolve(workspaceRoot, importPath + ext));
            }
        }
        else if (lang === 'python') {
            // Python 相对导入：. 开头
            if (importPath.startsWith('.')) {
                const modulePath = importPath.replace(/\./g, '/') + '.py';
                files.push(path.resolve(workspaceRoot, modulePath));
            }
        }
        else if (lang === 'go') {
            files.push(path.resolve(workspaceRoot, importPath + '.go'));
        }
        else if (lang === 'cpp' || lang === 'c') {
            files.push(path.resolve(workspaceRoot, importPath));
        }
        return files;
    }
}
exports.ImportExtractor = ImportExtractor;
//# sourceMappingURL=ImportExtractor.js.map