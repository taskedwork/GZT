import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { resolve } from 'path'

// 后端进程引用（跨请求保持）
let backendProcess = null

// 检查后端是否在运行（通过健康检查端点）
async function checkBackend() {
  try {
    const res = await fetch('http://localhost:3001/api/health', { signal: AbortSignal.timeout(2000) })
    return res.ok
  } catch {
    return false
  }
}

// Vite 插件：在 preview 服务器上提供后端管理 API
function backendManagerPlugin() {
  return {
    name: 'backend-manager',
    configurePreviewServer(server) {
      // 启动后端
      server.middlewares.use('/api/manage/start-backend', async (req, res) => {
        if (backendProcess) {
          res.end(JSON.stringify({ success: true, message: '后端已在运行' }))
          return
        }
        try {
          const serverDir = resolve(process.cwd(), 'server')
          if (!existsSync(serverDir)) {
            res.end(JSON.stringify({ success: false, error: 'server 目录不存在' }))
            return
          }
          // Windows 上用 npm.cmd
          const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'
          backendProcess = spawn(npmCmd, ['start'], {
            cwd: serverDir,
            detached: true,
            stdio: 'ignore',
            shell: true,
          })
          backendProcess.unref()
          res.end(JSON.stringify({ success: true, message: '后端启动中...' }))
        } catch (err) {
          res.end(JSON.stringify({ success: false, error: err.message }))
        }
      })

      // 停止后端
      server.middlewares.use('/api/manage/stop-backend', (req, res) => {
        if (!backendProcess) {
          res.end(JSON.stringify({ success: true, message: '后端未运行' }))
          return
        }
        try {
          process.kill(backendProcess.pid)
          backendProcess = null
          res.end(JSON.stringify({ success: true, message: '后端已停止' }))
        } catch (err) {
          res.end(JSON.stringify({ success: false, error: err.message }))
        }
      })

      // 检查后端状态
      server.middlewares.use('/api/manage/backend-status', async (req, res) => {
        const running = await checkBackend()
        res.end(JSON.stringify({ running }))
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), viteSingleFile(), backendManagerPlugin()],
  base: './',
  server: {
    port: 5173,
    host: true
  },
  preview: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        bypass(req) {
          if (req.url && req.url.startsWith('/api/manage/')) {
            return false
          }
        },
      },
      '/ws': {
        target: 'ws://localhost:3001',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 100000000,
    chunkSizeWarningLimit: 100000000,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        manualChunks: undefined,
      },
    },
  },
})
