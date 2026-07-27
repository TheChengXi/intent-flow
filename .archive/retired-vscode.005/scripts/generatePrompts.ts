// @contract: main() => Promise<void>
// @step: [读取] 读取 _source/prompts/*.md 文件（排除 README.md）
// @step: [提取] 提取每个文件的内容
// @step: [生成] 生成 src/data/prompts/prompts.ts
// @step: [输出] 输出成功信息
// @boundary: 当 _source/prompts/ 不存在时，抛出错误
// @boundary: 当文件读取失败时，抛出错误

import * as fs from 'fs/promises';
import * as path from 'path';

interface PromptFile {
  role: string;
  content: string;
}

async function main(): Promise<void> {
  const promptsDir = path.join(__dirname, '../_source/prompts');
  const outputFile = path.join(__dirname, '../src/data/prompts/prompts.ts');

  // 确保输出目录存在
  const outputDir = path.dirname(outputFile);
  await fs.mkdir(outputDir, { recursive: true });

  // 读取所有 .md 文件（排除 README.md）
  const files = await fs.readdir(promptsDir);
  const promptFiles = files.filter((f: string) => f.endsWith('.md') && f !== 'README.md');

  const prompts: PromptFile[] = [];

  for (const file of promptFiles) {
    const filePath = path.join(promptsDir, file);
    const content = await fs.readFile(filePath, 'utf-8');

    // 提取角色名（compiler.md -> compiler）
    const role = file.replace('.md', '');

    // 直接使用文件内容（新的函数风格提示词不需要额外处理）
    prompts.push({
      role,
      content: content.trim()
    });
  }

  // 生成 TypeScript 文件
  let output = '// 自动生成的提示词文件\n';
  output += '// 请勿手动修改，运行 npm run generate-prompts 重新生成\n\n';

  for (const prompt of prompts) {
    // 将连字符转换为下划线，确保变量名合法
    const constName = prompt.role.toUpperCase().replace(/-/g, '_') + '_PROMPT';
    // 转义模板字符串中的反引号和反斜杠
    const escapedContent = prompt.content.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
    output += `export const ${constName} = \`${escapedContent}\`;\n\n`;
  }

  await fs.writeFile(outputFile, output, 'utf-8');

  console.log(`✅ 提示词生成完成：${outputFile}`);
  console.log(`   生成了 ${prompts.length} 个提示词常量`);
}

main().catch(error => {
  console.error('❌ 生成失败：', error);
  process.exit(1);
});
// @end
