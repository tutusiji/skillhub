import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

const BACKEND_TARGET = process.env.BACKEND_TARGET ?? 'http://127.0.0.1:3001';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      // 允许通过 frp 隧道域名访问 dev server（Vite 6 默认拦截非 localhost 的 Host 头）
      allowedHosts: true as const,
      // 同源代理后端：外网通过 https://souxy.com:7300 访问时避免混合内容 / CORS
      proxy: {
        '/api': {
          target: BACKEND_TARGET,
          changeOrigin: true,
          ws: true,
        },
        // Claude Code 插件市场的 Git Smart HTTP 与 manifest 端点
        '/skillhub.git': {
          target: BACKEND_TARGET,
          changeOrigin: true,
        },
        '/market.git': {
          target: BACKEND_TARGET,
          changeOrigin: true,
        },
        '/.claude-plugin': {
          target: BACKEND_TARGET,
          changeOrigin: true,
        },
      },
    },
  };
});
