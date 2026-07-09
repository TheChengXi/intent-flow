import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.resolve(__dirname, '../../../../../dist/webview')

export default defineConfig({
  plugins: [vue()],
  root: '.',
  base: './',
  server: {
    port: 5173,
    strictPort: true,
    cors: true,
  },
  build: {
    outDir: outDir,
    emptyOutDir: true,
  },
})
