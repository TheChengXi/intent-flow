// @contract: main() => Promise<void>
// @step: [读取] 读取 _source/prompts/*-paradigm.md 文件
// @step: [提取] 提取每个文件的内容（去除元信息）
// @step: [生成] 生成 src/generated/prompts.ts
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
  const outputFile = path.join(__dirname, '../src/generated/prompts.ts');

  // 确保输出目录存在
  const outputDir = path.dirname(outputFile);
  await fs.mkdir(outputDir, { recursive: true });

  // 读取所有 -paradigm.md 文件
  const files = await fs.readdir(promptsDir);
  const paradigmFiles = files.filter(f => f.endsWith('-paradigm.md'));

  const prompts: PromptFile[] = [];

  for (const file of paradigmFiles) {
    const filePath = path.join(promptsDir, file);
    const content = await fs.readFile(filePath, 'utf-8');

    // 提取角色名（compiler-paradigm.md -> compiler）
    const role = file.replace('-paradigm.md', '');

    // 去除标题和元信息（保留核心提示词内容）
    const lines = content.split('\n');
    const contentLines: string[] = [];
    let inContent = false;

    for (const line of lines) {
      // 跳过标题行
      if (line.startsWith('# ')) {
        inContent = true;
        continue;
      }
      // 跳过分隔线和元信息
      if (line.startsWith('---') || line.startsWith('**来源：')) {
        break;
      }
      if (inContent && line.trim() !== '') {
        contentLines.push(line);
      }
    }

    prompts.push({
      role,
      content: contentLines.join('\n').trim()
    });
  }

  // 生成 TypeScript 文件
  let output = '// 自动生成的提示词文件\n';
  output += '// 请勿手动修改，运行 npm run generate-prompts 重新生成\n\n';

  for (const prompt of prompts) {
    const constName = prompt.role.toUpperCase() + '_PROMPT';
    output += `export const ${constName} = \`${prompt.content}\`;\n\n`;
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
