import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        // 用 127.0.0.1 避免 Node 把 localhost 解析为 IPv6 ::1 导致 ECONNREFUSED
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        // SSE 需要关闭代理超时缓冲
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            proxyRes.headers['x-accel-buffering'] = 'no';
          });
        },
      },
    },
  },
});
