import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // 让 Electron(file://) 与 Capacitor(本地资源) 下的静态资源路径工作正常
  base: './',
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: false,
    proxy: {
      // 代理 LrcApi 请求解决跨域
      '/api/lrc': {
        target: 'https://api.lrc.cx',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/lrc/, ''),
      },
    },
  },
  build: {
    outDir: 'dist',
    // 压缩优化
    minify: 'esbuild',
    target: 'esnext',
    // 分包策略，减少重复
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'antd-vendor': ['antd', '@ant-design/icons'],
        },
      },
    },
    // 关闭 source map 减小体积
    sourcemap: false,
    // 压缩选项
    cssMinify: true,
  },
});
