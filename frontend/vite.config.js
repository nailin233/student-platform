import vue from '@vitejs/plugin-vue'
import { defineConfig, loadEnv } from 'vite'
export default defineConfig(({ mode }) => ({
  plugins: [vue()],
  server: {
    host: '127.0.0.1', port: 5173, strictPort: true,
    // 同源代理：浏览器请求前端，由开发服务器转发给后端。
    proxy: { '/api': { target: loadEnv(mode, process.cwd(), '').API_PROXY_TARGET || 'http://127.0.0.1:8000' } },
  },
}))
