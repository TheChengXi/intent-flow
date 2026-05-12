import { Parser, Language } from 'web-tree-sitter';
import * as fs from 'fs/promises';
import * as path from 'path';

// @entity: CallNode
// 调用图节点
export interface CallNode {
  functionName: string;
  filePath: string;
  callees: string[];  // 这个函数调用了谁
  callers: string[];  // 谁调用了这个函数
}

// @entity: CallGraph
// 文件级调用图
export interface CallGraph {
  filePath: string;
  nodes: Map<string, CallNode>;
  lastModified: number;  // 文件修改时间，用于缓存判断
}

// @entity: ProjectCallGraph
// 项目级调用图
export interface ProjectCallGraph {
  graphs: Map<string, CallGraph>;  // key: filePath
  globalIndex: Map<string, string[]>;  // key: functionName, value: filePaths
}

// @contract: CallGraphService.buildFileCallGraph(filePath: string, language: string) => Promise<CallGraph>
// @step: [读取文件] 读取文件内容和修改时间
// @step: [解析代码] 使用 TreeSitterParser 解析代码
// @step: [提取函数] 提取所有函数定义
// @step: [提取调用] 提取每个函数内的函数调用
// @step: [构建节点] 为每个函数创建 CallNode
// @step: [返回] 返回 CallGraph
// @boundary: 当文件不存在时，抛出错误
// @boundary: 当语言不支持时，返回空图

export class CallGraphService {
  // 内存缓存
  private static cache: Map<string, CallGraph> = new Map();
  private static parser: Parser | null = null;
  private static initialized = false;

  // @contract: init() => Promise<void>
  // @step: [检查初始化] 如果已初始化则直接返回
  // @step: [初始化 Parser] 调用 Parser.init()
  // @step: [创建实例] 创建 Parser 实例
  // @step: [标记完成] 设置 initialized 为 true
  static async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await Parser.init();
    this.parser = new Parser();
    this.initialized = true;
  }
  // @end

  static async buildFileCallGraph(filePath: string, language: string): Promise<CallGraph> {
    // 检查缓存
    const stats = await fs.stat(filePath);
    const lastModified = stats.mtimeMs;

    const cached = this.cache.get(filePath);
    if (cached && cached.lastModified === lastModified) {
      return cached;
    }

    // 读取文件
    const code = await fs.readFile(filePath, 'utf-8');

    // 解析代码（使用现有的 TreeSitterParser）
    const functions = await this.extractFunctions(code, language);
    const calls = await this.extractCalls(code, language);

    // 构建调用图
    const nodes = new Map<string, CallNode>();

    for (const funcName of functions) {
      nodes.set(funcName, {
        functionName: funcName,
        filePath,
        callees: calls.get(funcName) || [],
        callers: []
      });
    }

    // 填充 callers（反向关系）
    for (const [caller, callees] of calls.entries()) {
      for (const callee of callees) {
        const calleeNode = nodes.get(callee);
        if (calleeNode && !calleeNode.callers.includes(caller)) {
          calleeNode.callers.push(caller);
        }
      }
    }

    const graph: CallGraph = {
      filePath,
      nodes,
      lastModified
    };

    // 缓存
    this.cache.set(filePath, graph);

    return graph;
  }
  // @end

  // @contract: extractFunctions(code: string, language: string) => Promise<string[]>
  // @step: [初始化] 确保 Parser 已初始化
  // @step: [加载语言] 加载对应语言的 parser
  // @step: [解析代码] 使用 Tree-sitter 解析代码为 AST
  // @step: [遍历 AST] 递归遍历 AST 查找函数定义节点
  // @step: [提取函数名] 从函数节点中提取函数名
  // @step: [返回] 返回函数名数组
  // @boundary: 当语言不支持时，返回空数组
  private static async extractFunctions(code: string, language: string): Promise<string[]> {
    try {
      await this.init();

      const lang = await this.loadLanguage(language);
      if (!lang || !this.parser) {
        return [];
      }

      this.parser.setLanguage(lang);
      const tree = this.parser.parse(code);

      if (!tree) {
        return [];
      }

      const functions: string[] = [];
      this.traverseForFunctions(tree.rootNode, functions);

      return functions;
    } catch (error) {
      console.error('Extract functions error:', error);
      return [];
    }
  }
  // @end

  // @contract: traverseForFunctions(node: any, functions: string[]) => void
  // @step: [检查节点类型] 判断是否为函数定义节点
  // @step: [提取函数名] 如果是函数节点，提取函数名并添加到数组
  // @step: [递归遍历] 递归遍历所有子节点
  private static traverseForFunctions(node: any, functions: string[]): void {
    const functionTypes = [
      'function_declaration',
      'function_definition',
      'method_declaration',
      'method_definition',
      'function_item',
      'function',
      'arrow_function',
      'function_expression'
    ];

    if (functionTypes.includes(node.type)) {
      const name = this.extractFunctionNameFromNode(node);
      if (name) {
        functions.push(name);
      }
    }

    for (const child of node.children) {
      this.traverseForFunctions(child, functions);
    }
  }
  // @end

  // @contract: loadLanguage(language: string) => Promise<any>
  // @step: [获取 wasm 文件名] 根据语言获取对应的 wasm 文件名
  // @step: [加载语言] 使用 Tree-sitter 加载语言
  // @step: [返回] 返回 Language 对象
  // @boundary: 当语言不支持时，返回 null
  private static async loadLanguage(language: string): Promise<Language | null> {
    const wasmFile = this.getWasmFileName(language);
    if (!wasmFile) {
      return null;
    }

    try {
      const wasmPath = path.join(__dirname, '../../../parsers', wasmFile);
      return await Language.load(wasmPath);
    } catch (error) {
      console.error(`Failed to load language ${language}:`, error);
      return null;
    }
  }
  // @end

  // @contract: getWasmFileName(language: string) => string | null
  // @step: [映射] 根据语言名返回对应的 wasm 文件名
  // @step: [返回] 返回文件名或 null
  private static getWasmFileName(language: string): string | null {
    const map: { [key: string]: string } = {
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
  // @end

  // @contract: extractFunctionNameFromNode(node: any) => string | null
  // @step: [查找标识符] 在节点的子节点中查找 identifier
  // @step: [递归查找] 如果是 function_declarator，递归查找其子节点
  // @step: [返回] 返回函数名或 null
  private static extractFunctionNameFromNode(node: any): string | null {
    for (const child of node.children) {
      if (child.type === 'identifier' || child.type === 'property_identifier') {
        return child.text;
      }
      // C 语言的函数名在 function_declarator 里
      if (child.type === 'function_declarator') {
        return this.extractFunctionNameFromNode(child);
      }
    }
    return null;
  }
  // @end

  // @contract: extractCalls(code: string, language: string) => Promise<Map<string, string[]>>
  // @step: [初始化] 确保 Parser 已初始化
  // @step: [加载语言] 加载对应语言的 parser
  // @step: [解析代码] 使用 Tree-sitter 解析代码为 AST
  // @step: [遍历函数] 遍历每个函数节点
  // @step: [提取调用] 在每个函数体内查找函数调用节点
  // @step: [构建映射] 构建 functionName -> callees 的映射
  // @step: [返回] 返回映射
  private static async extractCalls(code: string, language: string): Promise<Map<string, string[]>> {
    const calls = new Map<string, string[]>();

    try {
      await this.init();

      const lang = await this.loadLanguage(language);
      if (!lang || !this.parser) {
        return calls;
      }

      this.parser.setLanguage(lang);
      const tree = this.parser.parse(code);

      if (!tree) {
        return calls;
      }

      // 遍历所有函数节点
      this.traverseForCalls(tree.rootNode, calls);

      return calls;
    } catch (error) {
      console.error('Extract calls error:', error);
      return calls;
    }
  }
  // @end

  // @contract: traverseForCalls(node: any, calls: Map<string, string[]>) => void
  // @step: [检查函数节点] 判断是否为函数定义节点
  // @step: [提取函数名] 提取函数名
  // @step: [查找调用] 在函数体内查找所有函数调用
  // @step: [记录映射] 将函数名和调用列表添加到 map
  // @step: [递归遍历] 递归遍历所有子节点
  private static traverseForCalls(node: any, calls: Map<string, string[]>): void {
    const functionTypes = [
      'function_declaration',
      'function_definition',
      'method_declaration',
      'method_definition',
      'function_item',
      'function',
      'arrow_function',
      'function_expression'
    ];

    if (functionTypes.includes(node.type)) {
      const functionName = this.extractFunctionNameFromNode(node);
      if (functionName) {
        const callees: string[] = [];
        this.findCallsInNode(node, callees);
        calls.set(functionName, callees);
      }
    }

    for (const child of node.children) {
      this.traverseForCalls(child, calls);
    }
  }
  // @end

  // @contract: findCallsInNode(node: any, callees: string[]) => void
  // @step: [检查调用节点] 判断是否为函数调用节点
  // @step: [提取被调用函数名] 提取被调用的函数名
  // @step: [添加到列表] 添加到 callees 数组
  // @step: [递归遍历] 递归遍历所有子节点
  private static findCallsInNode(node: any, callees: string[]): void {
    const callTypes = [
      'call_expression',
      'call'
    ];

    if (callTypes.includes(node.type)) {
      const calleeName = this.extractCalleeNameFromNode(node);
      if (calleeName && !callees.includes(calleeName)) {
        callees.push(calleeName);
      }
    }

    for (const child of node.children) {
      this.findCallsInNode(child, callees);
    }
  }
  // @end

  // @contract: extractCalleeNameFromNode(node: any) => string | null
  // @step: [查找函数名] 在调用表达式中查找被调用的函数名
  // @step: [返回] 返回函数名或 null
  private static extractCalleeNameFromNode(node: any): string | null {
    // 查找第一个 identifier 作为函数名
    for (const child of node.children) {
      if (child.type === 'identifier') {
        return child.text;
      }
      // 处理成员调用，如 obj.method()
      if (child.type === 'member_expression' || child.type === 'attribute') {
        for (const subChild of child.children) {
          if (subChild.type === 'property_identifier' || subChild.type === 'identifier') {
            return subChild.text;
          }
        }
      }
    }
    return null;
  }
  // @end

  // @contract: getCallers(functionName: string, graph: CallGraph) => string[]
  // @step: [查找节点] 在图中查找函数节点
  // @step: [返回调用者] 返回 callers 数组
  // @boundary: 当函数不存在时，返回空数组
  static getCallers(functionName: string, graph: CallGraph): string[] {
    const node = graph.nodes.get(functionName);
    return node ? node.callers : [];
  }
  // @end

  // @contract: getCallees(functionName: string, graph: CallGraph) => string[]
  // @step: [查找节点] 在图中查找函数节点
  // @step: [返回被调用者] 返回 callees 数组
  // @boundary: 当函数不存在时，返回空数组
  static getCallees(functionName: string, graph: CallGraph): string[] {
    const node = graph.nodes.get(functionName);
    return node ? node.callees : [];
  }
  // @end

  // @contract: collectDependencies(functionName: string, graph: CallGraph, depth: number) => string[]
  // @step: [初始化] 创建结果集和访问集
  // @step: [DFS遍历] 深度优先遍历 callees
  // @step: [限制深度] 根据 depth 参数限制遍历深度
  // @step: [去重] 使用 Set 去重
  // @step: [排序] 按字母序排序，保证顺序稳定性（缓存优化）
  // @step: [返回] 返回依赖函数名数组
  // @boundary: 当深度为 0 时，只返回直接依赖
  // @boundary: 当函数不存在时，返回空数组
  // @boundary: 当遇到循环依赖时，visited 集合防止无限递归，但会记录循环中的所有函数
  //
  // 循环依赖处理说明：
  // - A→B→A: 返回 ['A', 'B']（记录双向依赖）
  // - A→B→C→A: 返回 ['A', 'B', 'C']（记录完整循环）
  // - visited 集合在进入节点时标记，防止无限递归
  // - result.add(callee) 在递归前执行，确保所有被调用函数都被记录
  static collectDependencies(functionName: string, graph: CallGraph, depth: number = 3): string[] {
    const visited = new Set<string>();
    const result = new Set<string>();

    const dfs = (name: string, currentDepth: number) => {
      if (currentDepth > depth || visited.has(name)) {
        return;
      }

      visited.add(name);
      const callees = this.getCallees(name, graph);

      for (const callee of callees) {
        if (!visited.has(callee)) {
          result.add(callee);
          dfs(callee, currentDepth + 1);
        }
      }
    };

    dfs(functionName, 0);
    // 按字母序排序，保证顺序稳定性
    return Array.from(result).sort();
  }
  // @end

  // @contract: clearCache() => void
  // @step: [清空] 清空内存缓存
  static clearCache(): void {
    this.cache.clear();
  }
  // @end
}
