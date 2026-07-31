/**
 * @intent
 * VSCode 适配层的契约搜索器。
 * 使用 VSCode 特定的 API（vscode.workspace.findFiles）进行工作空间级的搜索。
 */

export class VSCodeContractSearcher {
  static async searchInWorkspace(functionName: string, _workspaceRoot: string): Promise<string | null> {
    const vscode = require('vscode');
    const fs = require('fs').promises;

    try {
      const files = await vscode.workspace.findFiles(
        '**/*.{ts,js,py,go,java,cpp,c,rs,kt,swift,cs,rb,php}',
        '**/node_modules/**',
        100
      );

      for (const file of files) {
        const content = await fs.readFile(file.fsPath, 'utf-8');
        const contractRegex = new RegExp(`@contract:\\s*${functionName}\\s*\\(`, 'i');

        if (contractRegex.test(content)) {
          const lines = content.split('\n');
          let contractBlock = '';
          let inContract = false;

          for (const line of lines) {
            if (line.includes(`@contract: ${functionName}`)) {
              inContract = true;
            }

            if (inContract) {
              contractBlock += line + '\n';
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

  static async searchInWorkspaceWithPath(
    functionName: string,
    workspaceRoot: string
  ): Promise<{ contract: string; filePath: string; relativePath: string; importPath: string } | null> {
    const vscode = require('vscode');
    const fs = require('fs').promises;
    const path = require('path');

    try {
      const files = await vscode.workspace.findFiles(
        '**/*.{ts,js,py,go,java,cpp,c,rs,kt,swift,cs,rb,php}',
        '**/node_modules/**',
        100
      );

      for (const file of files) {
        const content = await fs.readFile(file.fsPath, 'utf-8');
        const contractRegex = new RegExp(`@contract:\\s*${functionName}\\s*\\(`, 'i');

        if (contractRegex.test(content)) {
          const lines = content.split('\n');
          let contractBlock = '';
          let inContract = false;

          for (const line of lines) {
            if (line.includes(`@contract: ${functionName}`)) {
              inContract = true;
            }

            if (inContract) {
              contractBlock += line + '\n';
              const trimmed = line.trim();
              if (trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('#')) {
                break;
              }
            }
          }

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

  static async searchContract(
    functionName: string,
    workspaceRoot: string
  ): Promise<{ contract: string; filePath: string; relativePath: string; importPath: string } | null> {
    return this.searchInWorkspaceWithPath(functionName, workspaceRoot);
  }
}
