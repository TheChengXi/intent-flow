// @service: DryRunStatisticsService
// 计算拦截内容的统计信息
export class DryRunStatisticsService {
  // @contract: calculate(content: string) => { totalCharacters: number, estimatedTokens: number, codeBlocks: number, fileReferences: number }
  // @step: [计算字符数] 统计完整内容的字符总数
  // @step: [估算 Token] 使用简单算法（字符数 / 4）估算 Token 数
  // @step: [统计代码块] 统计 ``` 标记的代码块数量
  // @step: [统计文件引用] 统计文件路径引用数量
  // @boundary: 所有计算必须在 100ms 内完成
  calculate(content: string): {
    totalCharacters: number;
    estimatedTokens: number;
    codeBlocks: number;
    fileReferences: number;
  } {
    const totalCharacters = content.length;
    const estimatedTokens = this.estimateTokens(content);
    const codeBlocks = this.countCodeBlocks(content);
    const fileReferences = this.countFileReferences(content);

    return {
      totalCharacters,
      estimatedTokens,
      codeBlocks,
      fileReferences
    };
  }

  // @contract: estimateTokens(content: string) => number
  // @step: [简单估算] 使用字符数除以 4 估算 Token 数
  // @boundary: 返回整数
  private estimateTokens(content: string): number {
    return Math.ceil(content.length / 4);
  }

  // @contract: countCodeBlocks(content: string) => number
  // @step: [正则匹配] 使用正则表达式匹配 ``` 标记
  // @step: [计数] 统计匹配到的代码块数量
  // @boundary: 代码块以 ``` 开始和结束
  private countCodeBlocks(content: string): number {
    const codeBlockPattern = /```[\s\S]*?```/g;
    const matches = content.match(codeBlockPattern);
    return matches ? matches.length : 0;
  }

  // @contract: countFileReferences(content: string) => number
  // @step: [正则匹配] 匹配常见的文件路径模式
  // @step: [去重] 使用 Set 去除重复的文件路径
  // @step: [计数] 返回唯一文件路径数量
  // @boundary: 匹配 .ts, .js, .py, .java, .go 等常见文件扩展名
  private countFileReferences(content: string): number {
    // 匹配文件路径：包含 / 或 \ 且以常见扩展名结尾
    const filePathPattern = /(?:[\w\-\.]+[\/\\])*[\w\-\.]+\.(ts|js|tsx|jsx|py|java|go|rs|cpp|c|h|cs|rb|php|swift|kt|md|json|yaml|yml|xml|html|css|scss|sass)/gi;
    const matches = content.match(filePathPattern);

    if (!matches) {
      return 0;
    }

    // 去重
    const uniquePaths = new Set(matches.map(path => path.toLowerCase()));
    return uniquePaths.size;
  }
}
