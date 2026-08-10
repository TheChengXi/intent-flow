#!/usr/bin/env node
/**
 * fetch-release.js — 一键拉取 IntentFlow Release 到目标子目录
 *
 * 用法:
 *   node scripts/fetch-release.js              # 最新版 → ./.pi/
 *   node scripts/fetch-release.js v0.6.0       # 指定版本 → ./.pi/
 *   node scripts/fetch-release.js v0.6.0 my-pi # 指定版本 + 目标目录
 *
 * 认证（仓库为私有时必需）:
 *   自动从 git 凭证管理器读取（无需配置）；
 *   也可用环境变量 GITHUB_TOKEN / GH_TOKEN 覆盖。
 *
 * 依赖: Node 18+。解压为纯 Node 实现（zlib），无需外部工具。
 */

const { join, dirname, relative, isAbsolute } = require('path');
const { tmpdir } = require('os');
const { mkdirSync, writeFileSync, readFileSync, readdirSync, statSync, copyFileSync, rmSync, createWriteStream } = require('fs');
const { execFileSync } = require('child_process');
const https = require('https');
const zlib = require('zlib');

const REPO = 'TheChengXi/intent-flow';

/** HTTPS GET（跟随重定向，重定向时去掉 Authorization），返回 { status, body } */
function httpsGet(url, headers = {}, redirects = 5) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers }, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        if (redirects <= 0) return reject(new Error('重定向次数过多'));
        return resolve(httpsGet(new URL(res.headers.location, url).href, {}, redirects - 1));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf-8') }));
    }).on('error', reject);
  });
}

/** HTTPS GET 流式下载到文件（跟随重定向，重定向时去掉 Authorization），返回 status */
function httpsDownload(url, destFile, headers = {}, redirects = 5) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers }, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        if (redirects <= 0) return reject(new Error('重定向次数过多'));
        return resolve(httpsDownload(new URL(res.headers.location, url).href, destFile, {}, redirects - 1));
      }
      if (res.statusCode >= 400) { res.resume(); return resolve(res.statusCode); }
      const out = createWriteStream(destFile);
      res.pipe(out);
      out.on('finish', () => resolve(res.statusCode));
      out.on('error', reject);
    }).on('error', reject);
  });
}

/** 从 git 凭证管理器读取 github.com token；无则返回 null */
function tokenFromGit() {
  try {
    const out = execFileSync('git', ['credential', 'fill'], {
      input: 'protocol=https\nhost=github.com\n\n',
      encoding: 'utf-8',
    });
    const m = out.match(/^password=(.+)$/m);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/**
 * 纯 Node 解压 zip（零依赖，避免外部解压工具在 Windows 中文路径下的兼容问题）
 * 支持 store(0) 与 deflate(8)，含 zip-slip 防护
 */
function extractZip(zipFile, destDir) {
  const buf = readFileSync(zipFile);

  // 定位 EOCD（文件末尾 64KB+22 内搜索签名 0x06054b50）
  let eocd = -1;
  const searchStart = Math.max(0, buf.length - 65557);
  for (let i = buf.length - 22; i >= searchStart; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error(`${zipFile} 不是有效的 zip 文件`);

  const entryCount = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16); // 中央目录偏移

  for (let i = 0; i < entryCount; i++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) throw new Error('zip 中央目录损坏');
    const method = buf.readUInt16LE(off + 10);
    const compSize = buf.readUInt32LE(off + 20);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const localOff = buf.readUInt32LE(off + 42);
    // Windows 工具（Compress-Archive）可能用 \ 作分隔符，统一规范化为 /
    const name = buf.toString('utf-8', off + 46, off + 46 + nameLen).replace(/\\/g, '/');
    off += 46 + nameLen + extraLen + commentLen;

    if (name.endsWith('/')) { // 目录项
      mkdirSync(join(destDir, name), { recursive: true });
      continue;
    }
    const target = join(destDir, name);
    const rel = relative(destDir, target);
    if (rel.startsWith('..') || isAbsolute(rel)) throw new Error(`zip 含非法路径: ${name}`);
    mkdirSync(dirname(target), { recursive: true });

    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const data = buf.subarray(localOff + 30 + lNameLen + lExtraLen, localOff + 30 + lNameLen + lExtraLen + compSize);
    const content = method === 0 ? data : method === 8 ? zlib.inflateRawSync(data) : (() => { throw new Error(`不支持的压缩方法: ${method}`); })();
    writeFileSync(target, content);
  }
}

/** 合并复制：同名覆盖，不删除目标里已有的其他内容 */
function copyTree(src, dst) {
  for (const name of readdirSync(src)) {
    const s = join(src, name);
    const d = join(dst, name);
    if (statSync(s).isDirectory()) {
      mkdirSync(d, { recursive: true });
      copyTree(s, d);
    } else {
      copyFileSync(s, d);
    }
  }
}

async function main() {
  const [versionArg, destArg] = process.argv.slice(2);
  const dest = destArg || '.pi';
  const tag = versionArg ? (versionArg.startsWith('v') ? versionArg : `v${versionArg}`) : null;

  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || tokenFromGit();
  const headers = { 'User-Agent': 'intent-flow-fetch-release' };
  if (token) headers.Authorization = `Bearer ${token}`;

  // 1. 查 Release
  const apiUrl = tag
    ? `https://api.github.com/repos/${REPO}/releases/tags/${tag}`
    : `https://api.github.com/repos/${REPO}/releases/latest`;
  console.log(`[1/4] 查询 Release: ${tag || 'latest'}`);
  const res = await httpsGet(apiUrl, headers);
  if (res.status !== 200) throw new Error(`查询 Release 失败: HTTP ${res.status}\n  ${apiUrl}`);
  const release = JSON.parse(res.body);
  const zipAsset = release.assets.find(a => a.name.endsWith('.zip'));
  if (!zipAsset) throw new Error(`Release ${release.tag_name} 中未找到 zip 资产`);

  // 2. 下载（browser_download_url 会 302 到 CDN，已处理重定向跟随）
  const zipFile = join(tmpdir(), zipAsset.name);
  console.log(`[2/4] 下载 ${zipAsset.name} (${(zipAsset.size / 1024 / 1024).toFixed(1)} MB)`);
  const dlStatus = await httpsDownload(zipAsset.browser_download_url, zipFile, headers);
  if (dlStatus >= 400) throw new Error(`下载失败: HTTP ${dlStatus}`);

  // 3. 解压（纯 Node）
  const extractDir = join(tmpdir(), `intent-flow-extract-${Date.now()}`);
  mkdirSync(extractDir, { recursive: true });
  console.log(`[3/4] 解压`);
  extractZip(zipFile, extractDir);

  // 4. 合并到目标目录（zip 内只有一个顶层目录 intent-flow-vX.Y.Z/，取其内容）
  const topDir = readdirSync(extractDir).find(n => statSync(join(extractDir, n)).isDirectory());
  if (!topDir) throw new Error('zip 内容异常: 未找到顶层目录');
  console.log(`[4/4] 合并到 ${dest}/`);
  mkdirSync(dest, { recursive: true });
  copyTree(join(extractDir, topDir), dest);
  rmSync(extractDir, { recursive: true, force: true });
  rmSync(zipFile, { force: true });

  console.log(`✅ 完成: ${release.tag_name} → ${dest}/`);
  console.log(`   内容: skills/ extensions/ mcp/ README.md`);
  console.log(`   MCP 接入 .mcp.json:`);
  console.log(`     { "servers": { "intent-flow": { "type": "stdio", "command": "node",`);
  console.log(`       "args": ["${join(dest, 'mcp', 'mcp-server.js')}"], "cwd": "${join(dest, 'mcp')}" } } }`);
}

main().catch(err => {
  console.error(`❌ ${err.message}`);
  process.exit(1);
});
