/**
 * @intent
 * 多语言 import 解析的策略接口。每种语言（或语言族）实现此接口，
 * 封装 AST 节点匹配、路径过滤、路径解析和正则降级四步逻辑。
 * 加一种语言 = 新建一个实现类 + 注册一行，不改 ImportExtractor 本体。
 */

export interface ImportResolver {
  /** 该 resolver 的主语言标识（如 'typescript'），用于注册表主键 */
  language: string;

  /** AST 节点 → import 路径字符串。非 import 节点返回 null。node 是 tree-sitter 的 SyntaxNode，泛化为 any 以绕开类型导出问题。 */
  extractImportPath(node: any): string | null;

  /** 该 import 路径是否应被解析（过滤外部包/第三方库引用） */
  shouldResolve(importPath: string): boolean;

  /** import 路径 → 候选文件路径列表（支持 mod.rs / index.ts 等惯例） */
  resolve(importPath: string, workspaceRoot: string): string[];

  /** Tree-sitter 不可用时按语言降级到正则方案 */
  extractRegex(code: string, workspaceRoot: string): string[];

  /**
   * 该语言的 import 解析基目录策略。
   * 文件相对型语言（TS/JS/Python/C/Go/Ruby/C++）返回 entryFile 所在目录；
   * 包路径型语言（Java/Kotlin/C#/PHP/Swift）返回 projectRoot；
   * Rust 需要检测 crate root。
   */
  getImportBaseDir(entryFile: string, projectRoot: string): Promise<string>;
}
