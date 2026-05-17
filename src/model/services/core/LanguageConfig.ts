// @intent: 统一管理语言配置，包括语言映射、扩展名、注释符号、内置函数和类型

// @contract: LanguageConfig.getLanguageName(languageId: string) => string
// @step: [查找映射] 在语言映射表中查找对应的语言名
// @step: [返回] 返回语言名，未找到则返回 'typescript'
// @boundary: 当 languageId 未知时，返回默认值 'typescript'

// @contract: LanguageConfig.getFileExtensions(language: string) => string[]
// @step: [查找扩展名] 根据语言返回对应的文件扩展名列表
// @step: [返回] 返回扩展名数组
// @boundary: 当语言未知时，返回空数组

// @contract: LanguageConfig.getCommentPrefixes(language: string) => string[]
// @step: [查找注释符号] 根据语言返回对应的注释前缀
// @step: [返回] 返回注释前缀数组
// @boundary: 当语言未知时，返回 ['//']

// @contract: LanguageConfig.getBuiltinFunctions(language: string) => Set<string>
// @step: [查找内置函数] 根据语言返回内置函数集合
// @step: [返回] 返回内置函数 Set
// @boundary: 当语言未知时，返回空 Set

// @contract: LanguageConfig.getBuiltinTypes(language: string) => Set<string>
// @step: [查找内置类型] 根据语言返回内置类型集合
// @step: [返回] 返回内置类型 Set
// @boundary: 当语言未知时，返回空 Set

// @contract: LanguageConfig.getLanguageFromExtension(extension: string) => string | null
// @step: [查找语言] 根据文件扩展名查找对应的语言
// @step: [返回] 返回语言名或 null
// @boundary: 当扩展名未知时，返回 null

export class LanguageConfig {
  private static readonly LANGUAGE_MAP: { [key: string]: string } = {
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

  private static readonly EXTENSION_MAP: { [key: string]: string[] } = {
    'typescript': ['.ts'],
    'tsx': ['.tsx'],
    'javascript': ['.js'],
    'python': ['.py'],
    'cpp': ['.cpp', '.cc', '.cxx'],
    'c': ['.c', '.h'],
    'java': ['.java'],
    'go': ['.go'],
    'rust': ['.rs'],
    'kotlin': ['.kt'],
    'swift': ['.swift'],
    'csharp': ['.cs'],
    'ruby': ['.rb'],
    'php': ['.php']
  };

  private static readonly COMMENT_PREFIXES: { [key: string]: string[] } = {
    'typescript': ['//'],
    'tsx': ['//'],
    'javascript': ['//'],
    'python': ['#'],
    'cpp': ['//'],
    'c': ['//'],
    'java': ['//'],
    'go': ['//'],
    'rust': ['//'],
    'kotlin': ['//'],
    'swift': ['//'],
    'csharp': ['//'],
    'ruby': ['#'],
    'php': ['//']
  };

  private static readonly BUILTIN_FUNCTIONS: { [key: string]: Set<string> } = {
    'typescript': new Set([
      'console', 'log', 'error', 'warn', 'info', 'debug',
      'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
      'parseInt', 'parseFloat', 'isNaN', 'isFinite',
      'Array', 'Object', 'String', 'Number', 'Boolean', 'Date', 'Math',
      'JSON', 'Promise', 'Map', 'Set', 'WeakMap', 'WeakSet',
      'require', 'import', 'export', 'typeof', 'instanceof'
    ]),
    'javascript': new Set([
      'console', 'log', 'error', 'warn', 'info', 'debug',
      'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
      'parseInt', 'parseFloat', 'isNaN', 'isFinite',
      'Array', 'Object', 'String', 'Number', 'Boolean', 'Date', 'Math',
      'JSON', 'Promise', 'Map', 'Set', 'WeakMap', 'WeakSet',
      'require', 'import', 'export', 'typeof', 'instanceof'
    ]),
    'python': new Set([
      'print', 'len', 'range', 'enumerate', 'zip', 'map', 'filter', 'reduce',
      'sorted', 'reversed', 'sum', 'min', 'max', 'abs', 'round', 'pow',
      'open', 'input', 'type', 'isinstance', 'hasattr', 'getattr', 'setattr',
      'dir', 'help', 'id', 'hash', 'hex', 'oct', 'bin', 'chr', 'ord',
      'str', 'int', 'float', 'bool', 'list', 'dict', 'tuple', 'set'
    ]),
    'go': new Set([
      'make', 'len', 'cap', 'append', 'copy', 'delete', 'panic', 'recover',
      'close', 'new', 'println', 'printf', 'print'
    ]),
    'cpp': new Set([
      'printf', 'scanf', 'malloc', 'free', 'sizeof', 'strlen', 'strcpy', 'strcmp',
      'memcpy', 'memset', 'fopen', 'fclose', 'fread', 'fwrite', 'fprintf', 'fscanf'
    ]),
    'c': new Set([
      'printf', 'scanf', 'malloc', 'free', 'sizeof', 'strlen', 'strcpy', 'strcmp',
      'memcpy', 'memset', 'fopen', 'fclose', 'fread', 'fwrite', 'fprintf', 'fscanf'
    ])
  };

  private static readonly BUILTIN_TYPES: Set<string> = new Set([
    'string', 'number', 'boolean', 'null', 'undefined', 'void', 'any', 'unknown', 'never', 'symbol', 'bigint',
    'Promise', 'Array', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Date', 'Error', 'RegExp',
    'Partial', 'Required', 'Readonly', 'Record', 'Pick', 'Omit', 'Exclude', 'Extract',
    'JSX', 'React', 'ReactNode', 'ReactElement', 'FC', 'Component'
  ]);

  static getLanguageName(languageId: string): string {
    return this.LANGUAGE_MAP[languageId] || 'typescript';
  }

  static getFileExtensions(language: string): string[] {
    return this.EXTENSION_MAP[language.toLowerCase()] || [];
  }

  static getCommentPrefixes(language: string): string[] {
    return this.COMMENT_PREFIXES[language.toLowerCase()] || ['//'];
  }

  static getBuiltinFunctions(language: string): Set<string> {
    return this.BUILTIN_FUNCTIONS[language.toLowerCase()] || new Set();
  }

  static getBuiltinTypes(language: string): Set<string> {
    return this.BUILTIN_TYPES;
  }

  static getLanguageFromExtension(extension: string): string | null {
    const ext = extension.toLowerCase();
    for (const [language, extensions] of Object.entries(this.EXTENSION_MAP)) {
      if (extensions.includes(ext)) {
        return language;
      }
    }
    return null;
  }
}
