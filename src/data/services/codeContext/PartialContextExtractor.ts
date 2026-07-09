import * as fs from 'fs';
import * as path from 'path';
import { FunctionCallExtractor } from './extractors/FunctionCallExtractor';
import { TypeReferenceExtractor } from './extractors/TypeReferenceExtractor';
import { FunctionDefinitionSearcher, FunctionDefinitionResult } from './searchers/FunctionDefinitionSearcher';
import { TypeDefinitionSearcher } from './searchers/TypeDefinitionSearcher';
import { ImportExtractor } from './extractors/import/ImportExtractor';

// @intent: 部分上下文提取，从选中代码范围提取函数及其直接依赖（函数级别）

// @entity: PartialContextResult
// 部分上下文提取结果
export interface PartialContextResult {
  targetCode: CodeSnippet;              // 目标代码片段
  directDependencies: DependencyInfo[]; // 直接依赖
  typeDefinitions: TypeDefinition[];    // 类型定义
}

// @entity: CodeSnippet
// 代码片段
export interface CodeSnippet {
  filePath: string;
  startLine: number;
  endLine: number;
  code: string;
  language: string;
}

// @entity: DependencyInfo
// 依赖信息
export interface DependencyInfo {
  type: 'function' | 'class' | 'method';
  name: string;
  filePath: string;
  code: string;
  contract?: string;  // 如果有 @contract 注释
}

// @entity: TypeDefinition
// 类型定义
export interface TypeDefinition {
  name: string;
  filePath: string;
  code: string;
}

// @contract: extractPartialContext(filePath: string, startLine: number, endLine: number, workspaceRoot: string, depth?: number) => Promise<PartialContextResult>
// @step: [提取目标代码] 从文件中提取选中的代码范围
// @step: [检测语言] 从文件扩展名检测语言
// @step: [提取函数调用] 使用 FunctionCallExtractor 提取目标代码中的函数调用
// @step: [提取类型引用] 使用 TypeReferenceExtractor 提取目标代码中的类型引用
// @step: [搜索函数定义] 对每个函数调用，使用 FunctionDefinitionSearcher 搜索定义
// @step: [搜索类型定义] 对每个类型引用，使用 TypeDefinitionSearcher 搜索定义
// @step: [递归处理] 如果 depth > 1，递归处理依赖的依赖
// @step: [返回结果] 返回 PartialContextResult
// @boundary: 当文件不存在时，抛出错误
// @boundary: 当选中范围无效时，抛出错误
// @boundary: 当找不到依赖定义时，跳过该依赖
export async function extractPartialContext(
  filePath: string,
  startLine: number,
  endLine: number,
  workspaceRoot: string,
  depth: number = 1
): Promise<PartialContextResult> {
  // 读取文件内容
  const content = await fs.promises.readFile(filePath, 'utf-8');
  const lines = content.split('\n');

  // 验证行号范围
  if (startLine < 0 || endLine >= lines.length || startLine > endLine) {
    throw new Error(`Invalid line range: ${startLine}-${endLine}`);
  }

  // 提取目标代码
  const targetCodeLines = lines.slice(startLine, endLine + 1);
  const targetCode = targetCodeLines.join('\n');

  // 检测语言
  const ext = path.extname(filePath).toLowerCase();
  const languageMap: { [key: string]: string } = {
    '.ts': 'typescript',
    '.tsx': 'tsx',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.py': 'python',
    '.go': 'go',
    '.cpp': 'cpp',
    '.c': 'c',
    '.rs': 'rust',
    '.java': 'java'
  };
  const language = languageMap[ext] || 'typescript';

  // 构建目标代码片段
  const targetSnippet: CodeSnippet = {
    filePath,
    startLine,
    endLine,
    code: targetCode,
    language
  };

  // 提取函数调用
  const functionCalls = await FunctionCallExtractor.extractFromText(targetCode, language);
  console.log(`[PartialContextExtractor] 提取到 ${functionCalls.length} 个函数调用:`, functionCalls);

  // 提取类型引用
  const typeReferences = await TypeReferenceExtractor.extractFromContractLine(targetCode, language);
  console.log(`[PartialContextExtractor] 提取到 ${typeReferences.length} 个类型引用:`, typeReferences);

  // 搜索函数定义（并行）
  const directDependencies: DependencyInfo[] = [];
  const importedFiles = await extractImportedFilesFromContent(content, path.dirname(filePath), language);

  // 并行搜索所有函数定义
  const functionSearchPromises = functionCalls.map(async (funcName) => {
    // 先在当前文件中搜索
    let funcDef = await FunctionDefinitionSearcher.searchInFile(funcName, filePath, language);

    // 如果当前文件没找到，在导入的文件中搜索
    if (!funcDef) {
      for (const importedFile of importedFiles) {
        try {
          await fs.promises.access(importedFile);
          funcDef = await FunctionDefinitionSearcher.searchInFile(funcName, importedFile, language);
          if (funcDef) {
            break;
          }
        } catch (error) {
          continue;
        }
      }
    }

    if (funcDef) {
      return {
        type: 'function' as const,
        name: funcDef.functionName,
        filePath: filePath,
        code: funcDef.code,
        contract: funcDef.contract
      };
    }
    return null;
  });

  // 搜索类型定义（并行）
  const typeSearchPromises = typeReferences.map(async (typeName) => {
    // 先在当前文件中搜索
    let typeDef = await TypeDefinitionSearcher.searchInFile(typeName, filePath, language);

    // 如果当前文件没找到，在导入的文件中搜索
    if (!typeDef) {
      for (const importedFile of importedFiles) {
        try {
          await fs.promises.access(importedFile);
          typeDef = await TypeDefinitionSearcher.searchInFile(typeName, importedFile, language);
          if (typeDef) {
            break;
          }
        } catch (error) {
          continue;
        }
      }
    }

    if (typeDef) {
      return {
        name: typeName,
        filePath: filePath,
        code: typeDef
      };
    }
    return null;
  });

  // 等待所有搜索完成
  const [functionResults, typeResults] = await Promise.all([
    Promise.all(functionSearchPromises),
    Promise.all(typeSearchPromises)
  ]);

  // 过滤掉 null 结果
  const validFunctionResults = functionResults.filter((r) => r !== null) as DependencyInfo[];
  directDependencies.push(...validFunctionResults);
  const typeDefinitions: TypeDefinition[] = typeResults.filter((r) => r !== null) as TypeDefinition[];

  // 如果 depth > 1，递归处理依赖的依赖
  if (depth > 1) {
    const nestedDeps = await extractNestedDependencies(
      directDependencies,
      workspaceRoot,
      language,
      depth - 1
    );
    directDependencies.push(...nestedDeps);
  }

  return {
    targetCode: targetSnippet,
    directDependencies,
    typeDefinitions
  };
}
// @end

// @contract: extractImportedFilesFromContent(content: string, currentDir: string, language: string) => Promise<string[]>
// @step: [调用 ImportExtractor] 使用 ImportExtractor 提取导入的文件路径
// @step: [返回] 返回文件路径列表
// @boundary: 当提取失败时，返回空数组
async function extractImportedFilesFromContent(
  content: string,
  currentDir: string,
  language: string
): Promise<string[]> {
  try {
    return await ImportExtractor.extractImportedFiles(content, currentDir, language);
  } catch (error) {
    console.warn('[PartialContextExtractor] 提取导入文件失败:', error);
    return [];
  }
}
// @end

// @contract: extractNestedDependencies(dependencies: DependencyInfo[], workspaceRoot: string, language: string, depth: number) => Promise<DependencyInfo[]>
// @step: [遍历依赖] 遍历每个依赖
// @step: [提取函数调用] 从依赖代码中提取函数调用
// @step: [搜索定义] 搜索函数定义
// @step: [递归] 如果 depth > 1，继续递归
// @step: [返回] 返回嵌套依赖列表
// @boundary: 当 depth 为 0 时，停止递归
async function extractNestedDependencies(
  dependencies: DependencyInfo[],
  workspaceRoot: string,
  language: string,
  depth: number
): Promise<DependencyInfo[]> {
  if (depth === 0) {
    return [];
  }

  const nestedDeps: DependencyInfo[] = [];
  const visited = new Set<string>();

  for (const dep of dependencies) {
    if (visited.has(dep.name)) {
      continue;
    }
    visited.add(dep.name);

    // 从依赖代码中提取函数调用
    const funcCalls = await FunctionCallExtractor.extractFromText(dep.code, language);

    for (const funcName of funcCalls) {
      if (visited.has(funcName)) {
        continue;
      }

      // 搜索函数定义
      const funcDef = await FunctionDefinitionSearcher.searchInFile(funcName, dep.filePath, language);

      if (funcDef) {
        nestedDeps.push({
          type: 'function',
          name: funcDef.functionName,
          filePath: dep.filePath,
          code: funcDef.code,
          contract: funcDef.contract
        });
        visited.add(funcName);
      }
    }
  }

  // 递归处理
  if (depth > 1 && nestedDeps.length > 0) {
    const deeperDeps = await extractNestedDependencies(nestedDeps, workspaceRoot, language, depth - 1);
    nestedDeps.push(...deeperDeps);
  }

  return nestedDeps;
}
// @end

// @contract: formatPartialContextResult(result: PartialContextResult) => string
// @step: [格式化目标代码] 格式化目标代码片段
// @step: [格式化依赖] 格式化直接依赖列表
// @step: [格式化类型] 格式化类型定义列表
// @step: [返回] 返回格式化后的字符串
export function formatPartialContextResult(result: PartialContextResult): string {
  let output = `# 部分上下文提取结果\n\n`;

  // 目标代码
  output += `## 目标代码\n\n`;
  output += `**文件**: ${result.targetCode.filePath}\n`;
  output += `**行范围**: ${result.targetCode.startLine}-${result.targetCode.endLine}\n`;
  output += `**语言**: ${result.targetCode.language}\n\n`;
  output += `\`\`\`${result.targetCode.language}\n${result.targetCode.code}\n\`\`\`\n\n`;

  // 直接依赖
  if (result.directDependencies.length > 0) {
    output += `## 直接依赖 (${result.directDependencies.length})\n\n`;
    for (const dep of result.directDependencies) {
      output += `### ${dep.name}\n\n`;
      if (dep.contract) {
        output += `**契约**: ${dep.contract}\n\n`;
      }
      output += `\`\`\`${result.targetCode.language}\n${dep.code}\n\`\`\`\n\n`;
    }
  } else {
    output += `## 直接依赖\n\n无直接依赖\n\n`;
  }

  // 类型定义
  if (result.typeDefinitions.length > 0) {
    output += `## 类型定义 (${result.typeDefinitions.length})\n\n`;
    for (const typeDef of result.typeDefinitions) {
      output += `### ${typeDef.name}\n\n`;
      output += `\`\`\`${result.targetCode.language}\n${typeDef.code}\n\`\`\`\n\n`;
    }
  } else {
    output += `## 类型定义\n\n无类型定义\n\n`;
  }

  return output;
}
// @end
