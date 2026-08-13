/**
 * deploy-pi.js — 部署 pi 扩展（项目级）
 *
 * 部署内容：
 *   1. intent-flow 主扩展（编译产物 dist/pi/extension.js）→ .pi/extensions/intent-flow/
 *
 * 用法: node scripts/deploy-pi.js
 * 推荐: npm run compile:pi && npm run deploy:pi
 */

const { join } = require('path');

// 用原生 fs 操作，不用 shell 命令（避免 Windows/Linux 差异和中文路径问题）
const {
  rmSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  readdirSync,
  statSync,
} = require('fs');

/** 清空并重建目标目录 */
function resetDir(dir) {
  if (existsSync(dir)) {
    for (const f of readdirSync(dir)) {
      rmSync(join(dir, f), { recursive: true, force: true });
    }
  } else {
    mkdirSync(dir, { recursive: true });
  }
}

/** 按字节复制文件（绕过 cpSync 的 Windows 中文路径 bug） */
function copyFile(src, dst) {
  writeFileSync(dst, readFileSync(src));
  console.log(`   文件: ${dst} (${statSync(src).size} bytes)`);
}

// ── 1. intent-flow 主扩展（编译产物）→ 项目级 .pi/extensions/ ──
const dstMain = join(__dirname, '..', '.pi', 'extensions', 'intent-flow');
const srcMain = join(__dirname, '..', 'dist', 'pi', 'extension.js');

resetDir(dstMain);
copyFile(srcMain, join(dstMain, 'extension.js'));
writeFileSync(join(dstMain, 'index.ts'), 'export { default } from "./extension.js";\n', 'utf-8');
console.log(`✅ 部署完成: ${dstMain}`);


