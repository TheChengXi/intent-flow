// @contract: ContractSearcher.searchInFile(functionName: string, filePath: string) => Promise<string | null>
// @step: [读取文件] 读取指定文件内容
// @step: [搜索契约] 搜索 @contract: functionName
// @step: [提取契约块] 提取完整的契约注释块
// @step: [返回] 返回契约文本或 null
// @boundary: 当文件不存在时，返回 null
// @boundary: 当契约未找到时，返回 null

// @contract: ContractSearcher.searchInWorkspace(functionName: string, workspaceRoot: string) => Promise<string | null>
// @step: [构建搜索模式] 构建 @contract: functionName 的搜索模式
// @step: [执行搜索] 使用 vscode.workspace.findFiles 和文件读取搜索契约
// @step: [解析契约] 找到后提取完整的契约注释块
// @step: [返回] 返回契约文本或 null
// @boundary: 当找不到契约时，返回 null

// @contract: ContractSearcher.searchInWorkspaceWithPath(functionName: string, workspaceRoot: string) => Promise<{ contract: string; filePath: string; relativePath: string; importPath: string } | null>
// @step: [构建搜索模式] 构建 @contract: functionName 的搜索模式
// @step: [执行搜索] 使用 vscode.workspace.findFiles 和文件读取搜索契约
// @step: [解析契约] 找到后提取完整的契约注释块
// @step: [计算路径] 计算相对路径和导入路径
// @step: [返回] 返回契约文本、文件路径、相对路径和导入路径
// @boundary: 当找不到契约时，返回 null

export class ContractSearcher {
  // @contract: searchInFile(functionName: string, filePath: string) => Promise<string | null>
  // @step: [读取文件] 读取指定文件内容
  // @step: [搜索契约] 搜索 @contract: functionName
  // @step: [提取契约块] 提取完整的契约注释块
  // @step: [返回] 返回契约文本或 null
  // @boundary: 当文件不存在时，返回 null
  // @boundary: 当契约未找到时，返回 null
  static async searchInFile(functionName: string, filePath: string): Promise<string | null> {
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
    } catch (error) {
      // 文件不存在或读取失败
      return null;
    }
  }
  // @end

  // @contract: searchInWorkspace(functionName: string, workspaceRoot: string) => Promise<string | null>
  // @step: [构建搜索模式] 构建 @contract: functionName 的搜索模式
  // @step: [执行搜索] 使用 vscode.workspace.findFiles 和文件读取搜索契约
  // @step: [解析契约] 找到后提取完整的契约注释块
  // @step: [返回] 返回契约文本或 null
  // @boundary: 当找不到契约时，返回 null
  static async searchInWorkspace(functionName: string, workspaceRoot: string): Promise<string | null> {
    const vscode = require('vscode');
    const fs = require('fs').promises;

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

          return contractBlock.trim();
        }
      }

      return null;
    } catch (error) {
      console.error(`搜索契约 ${functionName} 失败:`, error);
      return null;
    }
  }
  // @end

  // @contract: searchInWorkspaceWithPath(functionName: string, workspaceRoot: string) => Promise<{ contract: string; filePath: string; relativePath: string; importPath: string } | null>
  // @step: [构建搜索模式] 构建 @contract: functionName 的搜索模式
  // @step: [执行搜索] 使用 vscode.workspace.findFiles 和文件读取搜索契约
  // @step: [解析契约] 找到后提取完整的契约注释块
  // @step: [计算路径] 计算相对路径和导入路径
  // @step: [返回] 返回契约文本、文件路径、相对路径和导入路径
  // @boundary: 当找不到契约时，返回 null
  static async searchInWorkspaceWithPath(
    functionName: string,
    workspaceRoot: string
  ): Promise<{ contract: string; filePath: string; relativePath: string; importPath: string } | null> {
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
}
