import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, type ProxyOptions} from 'vite';

const BACKEND_TARGET = process.env.BACKEND_TARGET ?? 'http://127.0.0.1:3001';

/**
 * 构建后端代理配置，并接管上游连接失败的场景
 * 默认情况下 Vite 代理在后端未启动时只回一个空 body 的 500，前端与浏览器
 * Network 面板都看不出原因（极易被误判为"接口没开发完"）。这里统一改写为
 * 502 + JSON 错误体，让 api.ts 能解析出可读的中文提示。
 * @param extra 额外的代理选项 (如 Git Smart HTTP 需要的配置)
 */
function backendProxy(extra: ProxyOptions = {}): ProxyOptions {
  return {
    target: BACKEND_TARGET,
    changeOrigin: true,
    ...extra,
    configure: (proxy) => {
      proxy.on('error', (err, _req, res) => {
        const message = `无法连接后端服务 ${BACKEND_TARGET} (${err.message})，请先运行 pnpm run server:dev`;
        console.error(`[vite-proxy] ${message}`);
        // res 在 WebSocket 升级失败时是 Socket，没有 writeHead，需要区分处理
        if ('writeHead' in res && !res.headersSent) {
          res.writeHead(502, {'Content-Type': 'application/json; charset=utf-8'});
          res.end(JSON.stringify({statusCode: 502, message, error: 'Bad Gateway'}));
        } else if ('destroy' in res) {
          res.destroy();
        }
      });
    },
  };
}

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
        '/api': backendProxy(),
        // Claude Code 插件市场的 Git Smart HTTP 与 manifest 端点
        '/skillhub.git': backendProxy(),
        '/market.git': backendProxy(),
        '/.claude-plugin': backendProxy(),
      },
    },
  };
});
