import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ command }) => ({
  base: command === 'build' ? './' : '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    headers: {
      'Content-Security-Policy': [
        "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:",
        "connect-src * ws: wss: http: https:",
      ].join('; '),
    },
  },
  build: {
    outDir: path.resolve(__dirname, '../backend/renderer/out'),
    emptyOutDir: true,
    sourcemap: false,
    minify: 'esbuild',
  },
}))