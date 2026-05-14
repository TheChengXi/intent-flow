import * as vscode from 'vscode';
import { TreeSitterParser } from './TreeSitterParser';
import { WorkLine } from '../entities/WorkLine';
import { FunctionCallExtractor } from './codeAnalysis/FunctionCallExtractor';
import { TypeReferenceExtractor } from './codeAnalysis/TypeReferenceExtractor';
import { ImportExtractor } from './codeAnalysis/ImportExtractor';
import { ContractSearcher } from './codeSearch/ContractSearcher';
import { TypeDefinitionSearcher } from './codeSearch/TypeDefinitionSearcher';

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

export class WorkLineService {
  static async parseWorkLine(document: vscode.TextDocument, position: vscode.Position): Promise<WorkLine | null> {
    const language = this.detectLanguage(document.languageId);
    const code = document.getText();
    const cursorLine = position.line;

    return await TreeSitterParser.parseWorkLine(code, language, cursorLine);
  }

  static detectLanguage(languageId: string): string {
    const map: { [key: string]: string } = {
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

  static async extractReferencedContracts(workLine: WorkLine, workspaceRoot: string): Promise<string[]> {
    const vscode = require('vscode');

    // 1. 从代码中提取 import/include 语句，获取依赖的文件路径
    const importedFiles = await ImportExtractor.extractImportedFiles(workLine.codeText, workspaceRoot);

    // 2. 从代码中提取函数调用
    const functionCalls = await FunctionCallExtractor.extractFromText(workLine.codeText);

    // 3. 在导入的文件中搜索这些函数的契约
    const contracts: string[] = [];
    const notFoundFunctions: string[] = [];

    for (const funcName of functionCalls) {
      let found = false;

      // 优先在导入的文件中搜索
      for (const filePath of importedFiles) {
        const contract = await ContractSearcher.searchInFile(funcName, filePath);
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
      const choice = await vscode.window.showInformationMessage(
        `在导入的文件中未找到以下函数的契约：${notFoundFunctions.join(', ')}\n\n是否在整个工作区搜索？`,
        '搜索',
        '跳过'
      );

      if (choice === '搜索') {
        for (const funcName of notFoundFunctions) {
          const result = await ContractSearcher.searchInWorkspaceWithPath(funcName, workspaceRoot);
          if (result) {
            contracts.push(result.contract);

            // 询问是否添加 import
            const importChoice = await vscode.window.showInformationMessage(
              `找到 ${funcName} 的契约（位于 ${result.relativePath}），是否添加导入语句？`,
              '添加',
              '跳过'
            );

            if (importChoice === '添加') {
              // 这里只是提示，实际导入由用户手动添加或通过 IDE 功能
              vscode.window.showInformationMessage(
                `请在文件顶部添加：import { ${funcName} } from '${result.importPath}';`
              );
            }
          }
        }
      }
    }

    return contracts;
  }

  // @contract: extractFunctionCallsFromText(text: string, language?: string) => Promise<string[]>
  // @step: [委托] 委托给 FunctionCallExtractor.extractFromText
  // @step: [返回] 返回函数名数组
  static async extractFunctionCallsFromText(text: string, language?: string): Promise<string[]> {
    return await FunctionCallExtractor.extractFromText(text, language);
  }

  // @contract: extractImportedFilesFromText(text: string, workspaceRoot: string, language?: string) => Promise<string[]>
  // @step: [委托] 委托给 ImportExtractor.extractImportedFiles
  // @step: [返回] 返回文件路径数组
  static async extractImportedFilesFromText(text: string, workspaceRoot: string, language?: string): Promise<string[]> {
    return await ImportExtractor.extractImportedFiles(text, workspaceRoot, language);
  }

  // @contract: searchContractsForFunctions(functionNames: string[], importedFiles: string[], workspaceRoot: string) => Promise<string[]>
  // @step: [初始化] 创建契约数组和未找到函数列表
  // @step: [搜索导入文件] 在导入的文件中搜索每个函数的契约
  // @step: [全局搜索] 如果有未找到的函数，询问用户是否全局搜索
  // @step: [返回] 返回找到的契约数组
  static async searchContractsForFunctions(
    functionNames: string[],
    importedFiles: string[],
    workspaceRoot: string
  ): Promise<string[]> {
    const vscode = require('vscode');
    const contracts: string[] = [];
    const notFoundFunctions: string[] = [];

    console.log('[WorkLineService] 开始搜索契约，函数数量:', functionNames.length);
    console.log('[WorkLineService] 导入文件数量:', importedFiles.length);

    // 在导入的文件中搜索
    for (const funcName of functionNames) {
      console.log('[WorkLineService] 搜索函数:', funcName);
      let found = false;

      for (const filePath of importedFiles) {
        console.log('[WorkLineService] 在文件中搜索:', filePath);
        const contract = await ContractSearcher.searchInFile(funcName, filePath);
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
      const choice = await vscode.window.showInformationMessage(
        `在导入的文件中未找到以下函数的契约：${notFoundFunctions.join(', ')}\n\n是否在整个工作区搜索？`,
        '搜索',
        '跳过'
      );
      console.log('[WorkLineService] 用户选择:', choice);

      if (choice === '搜索') {
        for (const funcName of notFoundFunctions) {
          console.log('[WorkLineService] 全局搜索函数:', funcName);
          const result = await ContractSearcher.searchInWorkspaceWithPath(funcName, workspaceRoot);
          if (result) {
            console.log('[WorkLineService] 全局搜索找到契约:', result.relativePath);
            contracts.push(result.contract);

            // 询问是否添加 import
            const importChoice = await vscode.window.showInformationMessage(
              `找到 ${funcName} 的契约（位于 ${result.relativePath}），是否添加导入语句？`,
              '添加',
              '跳过'
            );
            console.log('[WorkLineService] 用户选择是否添加导入:', importChoice);

            if (importChoice === '添加') {
              vscode.window.showInformationMessage(
                `请在文件顶部添加：import { ${funcName} } from '${result.importPath}';`
              );
            }
          } else {
            console.log('[WorkLineService] 全局搜索未找到函数:', funcName);
          }
        }
      }
    }

    console.log('[WorkLineService] 契约搜索完成，找到数量:', contracts.length);
    return contracts;
  }
  // @end

  // @contract: searchTypeDefinitionInFile(typeName: string, filePath: string) => Promise<string | null>
  // @step: [构建搜索模式] 构建 @contract: functionName 的搜索模式
  // @step: [执行搜索] 使用 vscode.workspace.findFiles 和文件读取搜索契约
  // @step: [解析契约] 找到后提取完整的契约注释块
  // @step: [计算路径] 计算相对路径和导入路径
  // @step: [返回] 返回契约文本、文件路径、相对路径和导入路径
  // @boundary: 当找不到契约时，返回 null
  private static async searchContractInWorkspaceWithPath(functionName: string, workspaceRoot: string): Promise<{ contract: string; filePath: string; relativePath: string; importPath: string } | null> {
    const vscode = require('vscode');
    const fs = require('fs').promises;
    const path = require('path');

    try {
      // 搜索所有代码文件
      const files = await vscode.workspace.findFiles(
        '**/*.{ts,js,py,go,java,cpp,c,rs,kt,swift,cs,rb,php}',
        '**/node_modules/**',
        100 // 限制搜索文件数
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
    } catch (error) {
      console.error(`搜索契约 ${functionName} 失败:`, error);
      return null;
    }
  }
  // @end

  // @contract: extractTypeReferences(contractLine: string, language?: string) => Promise<string[]>
  // @step: [委托] 委托给 TypeReferenceExtractor.extractFromContractLine
  // @step: [返回] 返回类型名数组
  static async extractTypeReferences(contractLine: string, language?: string): Promise<string[]> {
    return await TypeReferenceExtractor.extractFromContractLine(contractLine, language);
  }

  // @contract: searchTypeDefinitionInFile(typeName: string, filePath: string, language?: string) => Promise<string | null>
  // @step: [委托] 委托给 TypeDefinitionSearcher.searchInFile
  // @step: [返回] 返回类型定义文本或 null
  static async searchTypeDefinitionInFile(typeName: string, filePath: string, language?: string): Promise<string | null> {
    return await TypeDefinitionSearcher.searchInFile(typeName, filePath, language);
  }
  // @end
}
