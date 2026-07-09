/**
 * @intent
 * 数据层的契约搜索器。
 * 提供框架无关的纯粹功能：给定文件路径和函数名，搜索契约。
 *
 * 注意：searchInWorkspace 和 searchInWorkspaceWithPath 已移至 VSCode 适配层
 */

export class ContractSearcher {
  static async searchInFile(functionName: string, filePath: string): Promise<string | null> {
    const fs = require('fs').promises;

    try {
      const content = await fs.readFile(filePath, 'utf-8');
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

      return null;
    } catch (error) {
      return null;
    }
  }
}
