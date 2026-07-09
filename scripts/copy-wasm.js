/**
 * postinstall 脚本：将 @vscode/tree-sitter-wasm 中的 WASM 文件复制到 parsers/ 目录
 *
 * @vscode/tree-sitter-wasm 提供了兼容新版 tree-sitter 格式（dylink）的
 * 运行时（tree-sitter.wasm）和语言解析器 WASM 文件。
 * 复制到 src/data/services/core/parsers/ 供 ts-node 开发模式加载，
 * 以及项目根 parsers/ 供 webpack 构建脚本复制到 dist/。
 */

const fs = require('fs');
const path = require('path');

const SOURCE = path.join(__dirname, '..', 'node_modules', '@vscode', 'tree-sitter-wasm', 'wasm');
const TARGETS = [
  path.join(__dirname, '..', 'src', 'data', 'services', 'core', 'parsers'),
  path.join(__dirname, '..', 'parsers'),
];

const WASM_FILES = [
  'tree-sitter.wasm',               // 运行时 WASM
  'tree-sitter-typescript.wasm',
  'tree-sitter-tsx.wasm',
  'tree-sitter-javascript.wasm',
  'tree-sitter-python.wasm',
  'tree-sitter-cpp.wasm',
  'tree-sitter-java.wasm',
  'tree-sitter-go.wasm',
  'tree-sitter-rust.wasm',
  'tree-sitter-c-sharp.wasm',
  'tree-sitter-ruby.wasm',
  'tree-sitter-php.wasm',
  'tree-sitter-bash.wasm',
  'tree-sitter-css.wasm',
  'tree-sitter-ini.wasm',
  'tree-sitter-powershell.wasm',
  'tree-sitter-regex.wasm',
  // 以下来自 tree-sitter-wasms（@vscode 不含），与 @vscode 运行时兼容
  'tree-sitter-c.wasm',
  'tree-sitter-kotlin.wasm',
  'tree-sitter-swift.wasm',
];

function main() {
  if (!fs.existsSync(SOURCE)) {
    console.warn('[copy-wasm] 源目录不存在（npm install 未完成？）:', SOURCE);
    process.exit(0);
  }

  for (const target of TARGETS) {
    if (!fs.existsSync(target)) {
      fs.mkdirSync(target, { recursive: true });
    }

    let copied = 0;
    for (const file of WASM_FILES) {
      const src = path.join(SOURCE, file);
      const dest = path.join(target, file);

      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        copied++;
      } else {
        console.warn(`[copy-wasm] ${file} 未找到（@vscode 包不含此文件），跳过`);
      }
    }

    console.log(`[copy-wasm] 完成: ${copied}/${WASM_FILES.length} 个 WASM 文件已复制到 ${target}`);
  }
}

main();
