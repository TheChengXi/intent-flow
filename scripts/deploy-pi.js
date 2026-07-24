/**
 * deploy-pi.js — 部署 pi 扩展到 ~/.pi/agent/extensions/cdd-framework/
 *
 * 用法: node scripts/deploy-pi.js
 * 推荐: npm run compile:pi && npm run deploy:pi
 */

const { execSync } = require('child_process');
const { join } = require('path');
const { homedir } = require('os');

const dst = join(homedir(), '.pi', 'agent', 'extensions', 'cdd-framework');
const src = join(__dirname, '..', 'dist', 'pi', 'extension.js');

// 用原生 fs 操作，不用 shell 命令（避免 Windows/Linux 差异和中文路径问题）
const { rmSync, mkdirSync, writeFileSync, existsSync, readdirSync, statSync } = require('fs');

// 清理旧目录
if (existsSync(dst)) {
  for (const f of readdirSync(dst)) {
    rmSync(join(dst, f), { recursive: true, force: true });
  }
} else {
  mkdirSync(dst, { recursive: true });
}

// 读源文件 → 写目标文件（绕过 cpSync 的 Windows 中文路径 bug）
const content = require('fs').readFileSync(src);
require('fs').writeFileSync(join(dst, 'extension.js'), content);

// 创建 index.ts 入口
writeFileSync(join(dst, 'index.ts'), 'export { default } from "./extension.js";\n', 'utf-8');

console.log(`✅ 部署完成: ${dst}`);
console.log(`   文件: extension.js (${statSync(src).size} bytes), index.ts`);
