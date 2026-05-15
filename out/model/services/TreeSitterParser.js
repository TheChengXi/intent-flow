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
exports.TreeSitterParser = void 0;
const web_tree_sitter_1 = require("web-tree-sitter");
const path = __importStar(require("path"));
// @contract: TreeSitterParser.init() => Promise<void>
// @step: [初始化] 初始化 web-tree-sitter
// @step: [加载语言] 预加载常用语言的 parser
// @boundary: 当初始化失败时，应抛出错误
// @contract: TreeSitterParser.parseWorkLine(code: string, language: string, cursorLine: number) => Promise<WorkLine | null>
// @step: [选择 parser] 根据 language 选择对应的 parser
// @step: [解析代码] 使用 tree-sitter 解析代码
// @step: [查找函数] 从 cursorLine 向上查找包含该行的函数定义
// @step: [查找注释] 从函数定义向上查找 @contract 注释块
// @step: [提取范围] 提取注释和代码的起止行号
// @step: [构建 WorkLine] 返回 WorkLine 对象
// @boundary: 当 language 不支持时，应返回 null
// @boundary: 当找不到函数定义时，应返回 null
// @boundary: 当找不到 @contract 注释时，应返回 null
class TreeSitterParser {
    static async init() {
        if (this.initialized) {
            return;
        }
        await web_tree_sitter_1.Parser.init();
        this.parser = new web_tree_sitter_1.Parser();
        this.initialized = true;
    }
    // @contract: getParser() => Promise<Parser>
    // @step: [检查初始化] 如果未初始化，先调用 init()
    // @step: [返回 parser] 返回已初始化的 parser
    // @boundary: 当 parser 为 null 时，抛出错误
    static async getParser() {
        if (!this.initialized) {
            await this.init();
        }
        if (!this.parser) {
            throw new Error('TreeSitterParser: parser is null after initialization');
        }
        return this.parser;
    }
    // @end
    static async parseWorkLine(code, language, cursorLine) {
        if (!this.initialized) {
            await this.init();
        }
        const lang = await this.getLanguage(language);
        if (!lang || !this.parser) {
            return null;
        }
        this.parser.setLanguage(lang);
        const tree = this.parser.parse(code);
        if (!tree) {
            return null;
        }
        const rootNode = tree.rootNode;
        // 查找包含 cursorLine 的函数节点
        const functionNode = this.findFunctionAtLine(rootNode, cursorLine);
        if (!functionNode) {
            return null;
        }
        const functionName = this.extractFunctionName(functionNode);
        if (!functionName) {
            return null;
        }
        const codeStartLine = functionNode.startPosition.row;
        const codeEndLine = functionNode.endPosition.row;
        // 查找函数上方的注释块
        const lines = code.split('\n');
        const commentBlock = this.findCommentBlock(lines, codeStartLine);
        if (!commentBlock) {
            return null;
        }
        return {
            functionName,
            startLine: commentBlock.startLine,
            endLine: codeEndLine,
            commentStartLine: commentBlock.startLine,
            commentEndLine: commentBlock.endLine,
            codeStartLine,
            codeEndLine,
            commentText: lines.slice(commentBlock.startLine, commentBlock.endLine + 1).join('\n'),
            codeText: lines.slice(codeStartLine, codeEndLine + 1).join('\n')
        };
    }
    static async getLanguage(language) {
        if (this.languages.has(language)) {
            return this.languages.get(language);
        }
        const wasmFile = this.getWasmFileName(language);
        if (!wasmFile) {
            return null;
        }
        try {
            const wasmPath = path.join(__dirname, '../../../parsers', wasmFile);
            const lang = await web_tree_sitter_1.Language.load(wasmPath);
            this.languages.set(language, lang);
            return lang;
        }
        catch (error) {
            console.error(`Failed to load language ${language}:`, error);
            return null;
        }
    }
    static getWasmFileName(language) {
        const map = {
            'typescript': 'tree-sitter-typescript.wasm',
            'tsx': 'tree-sitter-tsx.wasm',
            'javascript': 'tree-sitter-javascript.wasm',
            'python': 'tree-sitter-python.wasm',
            'cpp': 'tree-sitter-cpp.wasm',
            'c': 'tree-sitter-c.wasm',
            'java': 'tree-sitter-java.wasm',
            'go': 'tree-sitter-go.wasm',
            'rust': 'tree-sitter-rust.wasm',
            'kotlin': 'tree-sitter-kotlin.wasm',
            'swift': 'tree-sitter-swift.wasm',
            'csharp': 'tree-sitter-c_sharp.wasm',
            'ruby': 'tree-sitter-ruby.wasm',
            'php': 'tree-sitter-php.wasm'
        };
        return map[language.toLowerCase()] || null;
    }
    static findFunctionAtLine(node, line) {
        // 函数定义的节点类型（不同语言不同）
        const functionTypes = [
            'function_declaration',
            'function_definition',
            'method_declaration',
            'method_definition',
            'function_item', // Rust
            'function', // Python
            'arrow_function',
            'function_expression'
        ];
        if (functionTypes.includes(node.type) &&
            node.startPosition.row <= line &&
            node.endPosition.row >= line) {
            return node;
        }
        for (const child of node.children) {
            const result = this.findFunctionAtLine(child, line);
            if (result) {
                return result;
            }
        }
        return null;
    }
    static extractFunctionName(node) {
        // 查找函数名节点
        for (const child of node.children) {
            if (child.type === 'identifier' || child.type === 'property_identifier') {
                return child.text;
            }
        }
        return null;
    }
    // @contract: extractFunctionSignature(node: any, language: string) => { name: string; parameters: Array<{name: string; type: string}>; returnType: string } | null
    // @step: [提取函数名] 从节点中提取函数名
    // @step: [提取参数] 根据语言类型，查找参数列表节点
    // @step: [提取返回类型] 根据语言类型，查找返回类型节点
    // @step: [返回] 返回结构化的函数签名
    // @boundary: 当无法提取签名时，返回 null
    static extractFunctionSignature(node, language) {
        const functionName = this.extractFunctionName(node);
        if (!functionName) {
            return null;
        }
        const parameters = [];
        let returnType = 'void';
        // 根据不同语言提取参数和返回类型
        switch (language.toLowerCase()) {
            case 'typescript':
            case 'javascript':
                return this.extractTypeScriptSignature(node, functionName);
            case 'python':
                return this.extractPythonSignature(node, functionName);
            case 'go':
                return this.extractGoSignature(node, functionName);
            case 'cpp':
            case 'c':
                return this.extractCppSignature(node, functionName);
            default:
                return { name: functionName, parameters, returnType };
        }
    }
    // @end
    static extractTypeScriptSignature(node, functionName) {
        const parameters = [];
        let returnType = 'void';
        for (const child of node.children) {
            if (child.type === 'formal_parameters') {
                for (const param of child.children) {
                    if (param.type === 'required_parameter' || param.type === 'optional_parameter') {
                        const paramName = param.children.find((c) => c.type === 'identifier')?.text || '';
                        const typeAnnotation = param.children.find((c) => c.type === 'type_annotation');
                        const paramType = typeAnnotation ? typeAnnotation.text.replace(/^:\s*/, '') : 'any';
                        if (paramName) {
                            parameters.push({ name: paramName, type: paramType });
                        }
                    }
                }
            }
            if (child.type === 'type_annotation') {
                returnType = child.text.replace(/^:\s*/, '');
            }
        }
        return { name: functionName, parameters, returnType };
    }
    static extractPythonSignature(node, functionName) {
        const parameters = [];
        let returnType = 'None';
        for (const child of node.children) {
            if (child.type === 'parameters') {
                for (const param of child.children) {
                    if (param.type === 'typed_parameter' || param.type === 'identifier') {
                        const paramName = param.children.find((c) => c.type === 'identifier')?.text || param.text;
                        const typeNode = param.children.find((c) => c.type === 'type');
                        const paramType = typeNode ? typeNode.text : 'any';
                        if (paramName && paramName !== 'self' && paramName !== 'cls') {
                            parameters.push({ name: paramName, type: paramType });
                        }
                    }
                }
            }
            if (child.type === 'type') {
                returnType = child.text;
            }
        }
        return { name: functionName, parameters, returnType };
    }
    static extractGoSignature(node, functionName) {
        const parameters = [];
        let returnType = 'void';
        for (const child of node.children) {
            if (child.type === 'parameter_list') {
                for (const param of child.children) {
                    if (param.type === 'parameter_declaration') {
                        const paramName = param.children.find((c) => c.type === 'identifier')?.text || '';
                        const typeNode = param.children.find((c) => c.type !== 'identifier' && c.type !== ',');
                        const paramType = typeNode ? typeNode.text : 'interface{}';
                        if (paramName) {
                            parameters.push({ name: paramName, type: paramType });
                        }
                    }
                }
            }
            if (child.type === 'type_identifier' || child.type === 'pointer_type' || child.type === 'slice_type') {
                returnType = child.text;
            }
        }
        return { name: functionName, parameters, returnType };
    }
    static extractCppSignature(node, functionName) {
        const parameters = [];
        let returnType = 'void';
        for (const child of node.children) {
            if (child.type === 'parameter_list') {
                for (const param of child.children) {
                    if (param.type === 'parameter_declaration') {
                        const declarator = param.children.find((c) => c.type === 'identifier' || c.type === 'pointer_declarator' || c.type === 'reference_declarator');
                        const paramName = declarator?.text || '';
                        const typeNode = param.children.find((c) => c.type !== 'identifier' && c.type !== ',' && c.type !== 'pointer_declarator' && c.type !== 'reference_declarator');
                        const paramType = typeNode ? typeNode.text : 'void*';
                        if (paramName) {
                            parameters.push({ name: paramName, type: paramType });
                        }
                    }
                }
            }
            if (child.type === 'primitive_type' || child.type === 'type_identifier' || child.type === 'template_type') {
                returnType = child.text;
            }
        }
        return { name: functionName, parameters, returnType };
    }
    static findCommentBlock(lines, functionStartLine) {
        let commentEndLine = functionStartLine - 1;
        let commentStartLine = -1;
        // 向上查找注释块
        for (let i = commentEndLine; i >= 0; i--) {
            const line = lines[i].trim();
            if (line.includes('@contract:')) {
                commentStartLine = i;
                break;
            }
            if (!line.startsWith('//') && !line.startsWith('#') && line !== '') {
                // 遇到非注释行，停止
                break;
            }
        }
        if (commentStartLine === -1) {
            return null;
        }
        return { startLine: commentStartLine, endLine: commentEndLine };
    }
}
exports.TreeSitterParser = TreeSitterParser;
TreeSitterParser.parser = null;
TreeSitterParser.languages = new Map();
TreeSitterParser.initialized = false;
//# sourceMappingURL=TreeSitterParser.js.map