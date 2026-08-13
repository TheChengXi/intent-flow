/**
 * vite.config.ts — IntentFlow 构建配置
 *
 * 通过 IFLOW_BUILD 环境变量选择编译哪个适配层入口。
 * Vite lib 模式不支持多入口分别打包，一次只能编译一个目标。
 * 需要全量编译时使用 npm run compile（依次执行三个单独命令）。
 *
 * 可选值：
 *   cli/iflow     → CLI 工具（默认）
 *   mcp-server    → MCP 服务器
 *   pi/extension  → Pi 扩展
 */

import { defineConfig } from 'vite'
import path from 'path'
import { builtinModules } from 'module'

const nodeBuiltins = [
  ...builtinModules,
  ...builtinModules.map(m => `node:${m}`),
  'fs/promises',
]

/** Pi 在运行时提供的包，不需要打包进产物 */
const piProvidedPackages = [
  '@earendil-works/pi-coding-agent',
  '@earendil-works/pi-ai',
  '@earendil-works/pi-tui',
  'typebox',
]

// 三个适配层入口
const allEntries: Record<string, string> = {
  'cli/iflow':    path.resolve(__dirname, 'src/adapter/cli/index.ts'),
  'mcp-server': path.resolve(__dirname, 'src/adapter/mcp/MCPServer.ts'),
  'pi/extension': path.resolve(__dirname, 'src/adapter/pi/extension.ts'),
}

// 单入口选择
const buildTarget = (process.env.IFLOW_BUILD || 'cli/iflow').trim()
const entryPath = allEntries[buildTarget]

if (!entryPath) {
  const valid = Object.keys(allEntries).join(', ')
  console.error(`[vite] IFLOW_BUILD 必须指定单一入口: ${valid}`)
  console.error(`[vite] 需要全量编译请执行: npm run compile`)
  process.exit(1)
}

/** 单入口模式下显式指定输出文件名，与之前对象 key 行为一致 */
const outFileName = buildTarget === 'cli/iflow'     ? 'cli/iflow'
  : buildTarget === 'mcp-server'  ? 'mcp-server'
  : buildTarget === 'pi/extension' ? 'pi/extension'
  : buildTarget.replace(/\//g, '-')

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: { entry: entryPath, formats: ['cjs'], fileName: outFileName },
    rollupOptions: {
      // @note: @modelcontextprotocol/* 必须 external——vite 打包会将其内部 shims 子路径解析为 browser 版
      // （StdioServerTransport 的 process.stdin 变为 notSupported stub，运行时即抛错）；external 后运行时
      // 经 require 条件命中 Node 版 shims
      external: [/^@modelcontextprotocol\//, ...nodeBuiltins, ...piProvidedPackages],
      output: { format: 'cjs' },
    },
    sourcemap: true,
    minify: false,
  },
})
