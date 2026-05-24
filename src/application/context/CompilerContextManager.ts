import * as vscode from 'vscode';
import { HistoryService } from '../../data/services/HistoryService';
import { WorkLineHistoryRecord } from '../../data/entities/WorkLineHistory';
import { CompileContext } from '../roles/CompilerVM';
import * as CommentParser from '../../data/services/CommentParser';
import * as FileRepository from '../../data/repositories/FileRepository';
import { WorkLineService } from '../../data/services/WorkLineService';
import * as StepDiffDetector from '../../data/services/StepDiffDetector';

// @contract: CompilerContextManager.prepare(document: vscode.TextDocument, selection: vscode.Selection, workspaceRoot: string, apiKey: string, apiBaseUrl?: string, modelId?: string, targetLanguage?: string) => Promise<CompileContext | null>
// @step: [解析注释] 调用 CommentParser.parseComment 解析选中的注释
// @step: [读取规范] 读取 COMPILE_SPEC.md
// @step: [读取历史] 调用 HistoryService.getLastCompilerRecord 获取上次编译记录
// @step: [检测差异] 如果存在历史记录，调用 StepDiffDetector.detectDiff 检测步骤差异
// @step: [判断增量] 调用 StepDiffDetector.shouldUseIncrementalMode 判断是否使用增量模式
// @step: [读取审查记录] 调用 HistoryService.getLastReviewerRecord 获取上次审查结果
// @step: [检查是否不通过] 如果审查不通过，读取审查反馈和上次编译代码
// @step: [构建上下文] 构建 CompileContext 对象，包含增量编译信息
// @step: [返回] 返回上下文
// @boundary: 当注释解析失败时，应返回 null

// @contract: CompilerContextManager.save(workspaceRoot: string, filePath: string, functionName: string, contract: string, commentText: string, code: string, success: boolean, compileSpec: string) => Promise<void>
// @step: [解析注释] 调用 CommentParser.parseComment 解析注释文本
// @step: [构建记录] 构建 WorkLineHistoryRecord，包含 parsedComment
// @step: [保存] 调用 HistoryService.addRecord 保存记录
// @boundary: 当保存失败时，应抛出错误

export class CompilerContextManager {
  static async prepare(
    document: vscode.TextDocument,
    selection: vscode.Selection,
    workspaceRoot: string,
    apiKey: string,
    apiBaseUrl?: string,
    modelId?: string,
    targetLanguage?: string
  ): Promise<CompileContext | null> {
    console.log('[CompilerContextManager] 开始准备编译上下文');

    // 解析注释
    console.log('[CompilerContextManager] 解析注释...');
    const selectedText = document.getText(selection);
    console.log('[CompilerContextManager] 选中的文本长度:', selectedText.length);
    console.log('[CompilerContextManager] 选中的文本内容:', selectedText);
    const comment = CommentParser.parseComment(selectedText, document, selection.start.line);

    if (!comment) {
      console.log('[CompilerContextManager] 注释解析失败');
      return null;
    }
    console.log('[CompilerContextManager] 注释解析成功:', comment.contract.functionName);
    console.log('[CompilerContextManager] 解析到的 boundaries 数量:', comment.boundaries.length);
    console.log('[CompilerContextManager] boundaries 详情:', JSON.stringify(comment.boundaries, null, 2));

    // 读取 COMPILE_SPEC
    console.log('[CompilerContextManager] 读取 COMPILE_SPEC...');
    const compileSpec = await this.selectCompileSpec(workspaceRoot, document.fileName);
    console.log('[CompilerContextManager] COMPILE_SPEC 读取成功，长度:', compileSpec.length);

    // 读取上次编译记录
    console.log('[CompilerContextManager] 读取上次编译记录...');
    const lastCompile = await HistoryService.getLastCompilerRecord(
      workspaceRoot,
      document.fileName,
      comment.contract.functionName
    );
    console.log('[CompilerContextManager] 上次编译记录:', lastCompile ? '存在' : '不存在');

    // 检测步骤差异和增量编译
    console.log('[CompilerContextManager] 检测步骤差异...');
    let stepDiff: StepDiffDetector.StepDiff | undefined;
    let isIncremental = false;
    let previousCode: string | undefined;

    if (lastCompile && lastCompile.input.parsedComment && lastCompile.output.success) {
      console.log('[CompilerContextManager] 验证上次生成的代码...');
      // 验证上次生成的代码是有效的（不是错误消息）
      const lastCode = lastCompile.output.content;
      const isValidCode = lastCode &&
                          !lastCode.includes('I cannot proceed') &&
                          !lastCode.includes('Missing Prerequisites') &&
                          !lastCode.includes('CRITICAL:') &&
                          lastCode.length >= 50;

      console.log('[CompilerContextManager] 上次代码有效性:', isValidCode);

      if (isValidCode) {
        console.log('[CompilerContextManager] 调用 StepDiffDetector.detectDiff...');
        stepDiff = StepDiffDetector.detectDiff(lastCompile.input.parsedComment, comment);
        console.log('[CompilerContextManager] 步骤差异检测完成');

        isIncremental = StepDiffDetector.shouldUseIncrementalMode(stepDiff);
        console.log('[CompilerContextManager] 是否使用增量模式:', isIncremental);

        if (isIncremental) {
          previousCode = lastCode;
        }
      }
    } else {
      console.log('[CompilerContextManager] 跳过步骤差异检测（无有效历史记录）');
    }

    // 读取上次审查记录
    console.log('[CompilerContextManager] 读取上次审查记录...');
    const lastReview = await HistoryService.getLastReviewerRecord(
      workspaceRoot,
      document.fileName,
      comment.contract.functionName
    );
    console.log('[CompilerContextManager] 上次审查记录:', lastReview ? '存在' : '不存在');

    // 提取引用的契约（跨文件引用）
    console.log('[CompilerContextManager] 提取引用的契约...');
    let referencedContracts: string[] = [];

    // 如果存在上次编译记录且代码有效，说明这是重新编译
    const hasValidPreviousCode = lastCompile &&
                                  lastCompile.output.success &&
                                  lastCompile.output.content &&
                                  !lastCompile.output.content.includes('I cannot proceed') &&
                                  !lastCompile.output.content.includes('Missing Prerequisites') &&
                                  lastCompile.output.content.length >= 50;
    console.log('[CompilerContextManager] 是否存在有效的上次编译:', hasValidPreviousCode);

    try {
      // 从文档中提取 import 语句（总是执行，不跳过）
      console.log('[CompilerContextManager] 提取 import 语句...');
      const fullText = document.getText();
      const importedFiles = await WorkLineService.extractImportedFilesFromText(fullText, workspaceRoot, targetLanguage);
      console.log('[CompilerContextManager] 提取到的导入文件数量:', importedFiles.length);

      // 将当前文件添加到搜索列表的最前面（优先搜索同文件内的定义）
      const searchFiles = [document.fileName, ...importedFiles];
      console.log('[CompilerContextManager] 搜索文件列表（含当前文件）:', searchFiles.length);

      // 检查当前文件已有的 import 语句（总是执行）
      console.log('[CompilerContextManager] 检查已有的 import 语句...');
      const existingImports = this.extractExistingImports(fullText, targetLanguage);
      console.log('[CompilerContextManager] 已有的 import 数量:', existingImports.length);

      // 如果有已存在的 import，添加到 referencedContracts
      if (existingImports.length > 0) {
        const importHint = '## 当前文件已有的导入语句\n以下导入已存在，不要重复添加：\n\n' + existingImports.join('\n');
        referencedContracts.push(importHint);
      }

      // 只在首次编译时进行完整的契约搜索（避免重复弹出对话框）
      if (!hasValidPreviousCode) {
        // 1. 提取并搜索类型引用（父依赖）
        console.log('[CompilerContextManager] 提取类型引用...');
        const contractLine = selectedText.split('\n')[0]; // 第一行是 @contract
        const typeReferences = await WorkLineService.extractTypeReferences(contractLine, targetLanguage);
        console.log('[CompilerContextManager] 提取到的类型引用数量:', typeReferences.length);
        console.log('[CompilerContextManager] 类型引用:', typeReferences);

        if (typeReferences.length > 0) {
          console.log('[CompilerContextManager] 搜索类型定义...');
          for (const typeName of typeReferences) {
            for (const filePath of searchFiles) {
              const typeDef = await WorkLineService.searchTypeDefinitionInFile(typeName, filePath, targetLanguage);
              if (typeDef) {
                console.log(`[CompilerContextManager] 找到类型定义: ${typeName}`);
                referencedContracts.push(typeDef);
                break; // 找到后跳出，不再搜索其他文件
              }
            }
          }
        }

        // 2. 提取并搜索函数调用（子依赖）
        // 只从 @step 和 @boundary 中提取，排除 @contract
        const stepsText = comment.steps.map(s => s.description).join(' ');
        const boundariesText = comment.boundaries.map(b => b.description).join(' ');
        const searchText = stepsText + ' ' + boundariesText;

        console.log('[CompilerContextManager] 调用 extractFunctionCallsFromText...');
        const functionCalls = await WorkLineService.extractFunctionCallsFromText(searchText, targetLanguage);
        console.log('[CompilerContextManager] 提取到的函数调用数量:', functionCalls.length);

        // 排除当前正在编译的函数本身（双重保险）
        const filteredCalls = functionCalls.filter(name => name !== comment.contract.functionName);
        console.log('[CompilerContextManager] 过滤后的函数调用数量:', filteredCalls.length);

        if (filteredCalls.length > 0) {
          console.log('[CompilerContextManager] 调用 searchContractsForFunctions...');
          const functionContracts = await WorkLineService.searchContractsForFunctions(
            filteredCalls,
            searchFiles,
            workspaceRoot
          );
          console.log('[CompilerContextManager] 搜索到的函数契约数量:', functionContracts.length);
          referencedContracts.push(...functionContracts);

          // 问题 2 修复：对于每个找到的函数，检查是否有多个重载版本
          console.log('[CompilerContextManager] 检查重载版本...');
          const allContracts: string[] = [];
          for (const funcName of filteredCalls) {
            // 从每个搜索文件中查找该函数的所有契约版本
            for (const filePath of searchFiles) {
              const contracts = await HistoryService.getAllContractsForFunction(
                workspaceRoot,
                filePath,
                funcName
              );
              if (contracts.length > 0) {
                console.log(`[CompilerContextManager] 函数 ${funcName} 有 ${contracts.length} 个重载版本`);
                allContracts.push(...contracts);
              }
            }
          }

          // 合并搜索到的契约和历史记录中的重载版本
          if (allContracts.length > 0) {
            referencedContracts.push(...allContracts);
          }
        }

        // 去重
        referencedContracts = [...new Set(referencedContracts)];
        console.log('[CompilerContextManager] 最终契约数量（去重后）:', referencedContracts.length);
      } else {
        console.log('[CompilerContextManager] 跳过契约搜索（重新编译模式）');
      }
    } catch (error) {
      console.warn('[CompilerContextManager] 提取引用契约失败:', error);
    }

    // 构建基础上下文
    console.log('[CompilerContextManager] 构建基础上下文...');
    const context: CompileContext = {
      comment,
      compileSpec,
      apiKey,
      apiBaseUrl,
      modelId,
      filePath: document.fileName,
      targetLanguage,
      referencedContracts: referencedContracts.length > 0 ? referencedContracts : undefined,
      stepDiff,
      isIncremental,
      previousCode
    };

    // 如果上次审查不通过，加载反馈（优先级高于增量编译）
    // 但需要验证审查是否针对当前注释（避免使用过时的反馈）
    console.log('[CompilerContextManager] 检查审查反馈...');
    if (lastReview && !lastReview.output.success) {
      console.log('[CompilerContextManager] 上次审查不通过，验证是否针对当前注释...');

      // 比较当前注释和审查记录中的注释
      const currentCommentText = selectedText.trim();
      const reviewCommentText = lastReview.input.comment?.trim() || '';

      if (currentCommentText === reviewCommentText) {
        console.log('[CompilerContextManager] 审查反馈有效，加载反馈');
        context.reviewFeedback = lastReview.output.issues?.join('\n') || '';
        context.previousCode = lastReview.input.code || '';
        context.isIncremental = false; // 审查不通过时禁用增量模式
      } else {
        console.log('[CompilerContextManager] 注释已改变，忽略旧的审查反馈');
      }
    }

    console.log('[CompilerContextManager] 上下文准备完成');
    return context;
  }

  static async save(
    workspaceRoot: string,
    filePath: string,
    functionName: string,
    contract: string,
    commentText: string,
    code: string,
    success: boolean,
    compileSpec: string
  ): Promise<void> {
    // 解析注释以保存到历史记录
    const parsedComment = CommentParser.parseComment(commentText, null as any, 0);

    const record: WorkLineHistoryRecord = {
      timestamp: new Date().toISOString(),
      role: 'compiler',
      input: {
        comment: commentText,
        compileSpec,
        parsedComment: parsedComment || undefined
      },
      output: {
        success,
        content: code
      }
    };

    await HistoryService.addRecord(workspaceRoot, filePath, functionName, contract, record);
  }

  // @contract: selectCompileSpec(workspaceRoot: string, filePath: string) => Promise<string>
  // @step: [尝试读取配置] 尝试读取 .cdd/config.json 中的 compileSpecRules
  // @step: [配置文件规则] 如果配置存在，使用配置文件规则匹配
  // @step: [默认路径规则] 如果配置不存在，使用默认路径规则匹配
  // @step: [返回规范] 返回匹配到的编译规范内容
  // @boundary: 当所有规范都不存在时，返回空字符串
  private static async selectCompileSpec(workspaceRoot: string, filePath: string): Promise<string> {
    const path = require('path');

    // 1. 尝试读取配置文件
    const configPath = path.join(workspaceRoot, '.cdd', 'config.json');
    try {
      const configContent = await FileRepository.readFile(configPath);
      const config = JSON.parse(configContent);

      if (config.compileSpecRules && Array.isArray(config.compileSpecRules)) {
        console.log('[CompilerContextManager] 使用配置文件规则');
        return await this.selectByConfig(workspaceRoot, filePath, config.compileSpecRules);
      }
    } catch {
      // 配置不存在或解析失败，使用默认规则
      console.log('[CompilerContextManager] 配置文件不存在，使用默认规则');
    }

    // 2. 使用默认路径规则
    return await this.selectByPath(workspaceRoot, filePath);
  }
  // @end

  // @contract: selectByPath(workspaceRoot: string, filePath: string) => Promise<string>
  // @step: [计算相对路径] 计算文件相对于工作区的路径
  // @step: [匹配路径规则] 根据路径模式判断使用哪个规范文件
  // @step: [读取规范] 尝试读取对应的规范文件
  // @step: [兜底] 如果特定规范不存在，尝试读取通用规范
  // @boundary: 当所有规范都不存在时，返回空字符串
  private static async selectByPath(workspaceRoot: string, filePath: string): Promise<string> {
    const path = require('path');
    const relativePath = path.relative(workspaceRoot, filePath).replace(/\\/g, '/');

    let specFileName = 'COMPILE_SPEC.md';  // 默认通用规范

    // 前端文件
    if (relativePath.match(/^(src\/view|src\/components|src\/pages|frontend|client|web|ui)/i)) {
      specFileName = 'COMPILE_SPEC_FRONTEND.md';
      console.log('[CompilerContextManager] 检测到前端文件，尝试使用前端规范');
    }
    // 后端文件
    else if (relativePath.match(/^(src\/model|src\/viewmodel|src\/controller|backend|server|api|service)/i)) {
      specFileName = 'COMPILE_SPEC_BACKEND.md';
      console.log('[CompilerContextManager] 检测到后端文件，尝试使用后端规范');
    }
    // 测试文件
    else if (relativePath.match(/\.(test|spec)\.(ts|js|py|go|java|cpp|c|rs)$/i) || relativePath.includes('/test/') || relativePath.includes('/tests/')) {
      specFileName = 'COMPILE_SPEC_TEST.md';
      console.log('[CompilerContextManager] 检测到测试文件，尝试使用测试规范');
    }

    // 尝试读取特定规范
    const specPath = path.join(workspaceRoot, '_source', specFileName);
    try {
      const spec = await FileRepository.readFile(specPath);
      console.log(`[CompilerContextManager] 使用规范: ${specFileName}`);
      return spec;
    } catch {
      // 如果特定规范不存在，尝试读取通用规范
      if (specFileName !== 'COMPILE_SPEC.md') {
        const defaultSpecPath = path.join(workspaceRoot, '_source', 'COMPILE_SPEC.md');
        try {
          const spec = await FileRepository.readFile(defaultSpecPath);
          console.log('[CompilerContextManager] 特定规范不存在，使用通用规范: COMPILE_SPEC.md');
          return spec;
        } catch {
          console.log('[CompilerContextManager] 未找到任何编译规范');
          return '';
        }
      }
      console.log('[CompilerContextManager] 未找到任何编译规范');
      return '';
    }
  }
  // @end

  // @contract: selectByConfig(workspaceRoot: string, filePath: string, rules: any[]) => Promise<string>
  // @step: [计算相对路径] 计算文件相对于工作区的路径
  // @step: [遍历规则] 按顺序遍历配置文件中的规则
  // @step: [匹配模式] 使用 glob 模式匹配文件路径
  // @step: [读取规范] 匹配成功后读取对应的规范文件
  // @step: [返回] 返回第一个匹配的规范内容
  // @boundary: 当没有规则匹配时，返回空字符串
  // @boundary: 当规范文件不存在时，继续尝试下一个规则
  private static async selectByConfig(workspaceRoot: string, filePath: string, rules: any[]): Promise<string> {
    const path = require('path');
    const minimatch = require('minimatch');

    const relativePath = path.relative(workspaceRoot, filePath).replace(/\\/g, '/');

    // 按顺序匹配规则
    for (const rule of rules) {
      if (!rule.pattern || !rule.spec) {
        continue;
      }

      if (minimatch(relativePath, rule.pattern)) {
        const specPath = path.join(workspaceRoot, rule.spec);
        try {
          const spec = await FileRepository.readFile(specPath);
          console.log(`[CompilerContextManager] 匹配规则: ${rule.pattern} -> ${rule.spec}`);
          return spec;
        } catch {
          console.warn(`[CompilerContextManager] 规范文件不存在: ${rule.spec}，继续尝试下一个规则`);
          continue;
        }
      }
    }

    console.log('[CompilerContextManager] 没有规则匹配，返回空字符串');
    return '';
  }
  // @end

  // @contract: extractExistingImports(fileContent: string, language?: string) => string[]
  // @step: [检测语言] 如果提供了 language，使用对应的正则
  // @step: [正则匹配] 使用正则提取所有 import 语句
  // @step: [过滤空行] 过滤掉空字符串
  // @step: [返回] 返回 import 语句数组
  private static extractExistingImports(fileContent: string, language?: string): string[] {
    const imports: string[] = [];

    // 根据语言选择不同的正则表达式
    let importRegex: RegExp;

    if (language) {
      const lang = language.toLowerCase();
      if (lang === 'python') {
        // Python: import re, from typing import Dict
        importRegex = /^\s*(import\s+[\w.,\s]+|from\s+[\w.]+\s+import\s+[\w.,\s*()]+)/gm;
      } else if (lang === 'go') {
        // Go: import "fmt" 或 import ( ... )
        importRegex = /^\s*import\s+(\([\s\S]*?\)|"[^"]+"|`[^`]+`)/gm;
      } else if (lang === 'c' || lang === 'cpp' || lang === 'c++') {
        // C/C++: #include <stdio.h> 或 #include "myheader.h"
        importRegex = /^\s*#include\s+[<"][^>"]+[>"]/gm;
      } else if (lang === 'java') {
        // Java: import java.util.List;
        importRegex = /^\s*import\s+[\w.]+(\.\*)?;/gm;
      } else {
        // TypeScript/JavaScript (默认)
        importRegex = /^\s*import\s+.*?from\s+['"][^'"]+['"]\s*;?/gm;
      }
    } else {
      // 未指定语言，尝试匹配多种格式
      const patterns = [
        /^\s*import\s+.*?from\s+['"][^'"]+['"]\s*;?/gm,  // TS/JS
        /^\s*(import\s+[\w.,\s]+|from\s+[\w.]+\s+import\s+[\w.,\s*()]+)/gm,  // Python
        /^\s*import\s+(\([\s\S]*?\)|"[^"]+"|`[^`]+`)/gm,  // Go
        /^\s*#include\s+[<"][^>"]+[>"]/gm,  // C/C++
        /^\s*import\s+[\w.]+(\.\*)?;/gm  // Java
      ];

      for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(fileContent)) !== null) {
          const importStatement = match[0].trim();
          if (!imports.includes(importStatement)) {
            imports.push(importStatement);
          }
        }
      }

      return imports;
    }

    let match;
    while ((match = importRegex.exec(fileContent)) !== null) {
      imports.push(match[0].trim());
    }

    return imports;
  }
  // @end
}

