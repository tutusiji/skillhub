import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E 冒烟配置。
 *
 * 两个 webServer：
 * - 后端：`pnpm run server:start`（NestJS 生产启动，单进程 :3001 同源托管 dist）。
 *   若本机已有后端在跑（reuseExistingServer:true 检测到 :3001 被占用则直接复用，
 *   不会杀掉用户正在跑的 dev/watch 进程）。
 * - 前端：`pnpm run dev`（Vite :7001，已把 /api、/skillhub.git 等代理到 :3001）。
 *
 * 依赖：后端需要 Postgres 就绪（DB_* env 由 server 侧 .env.<APP_ENV> 提供）；
 * Playwright 浏览器已安装（chromium）。CI 环境两端口空闲时会自行拉起。
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  // 冒烟不求速度，给首次 dev 编译留足时间
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:7001',
    locale: 'zh-CN',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'pnpm run server:start',
      url: 'http://127.0.0.1:3001/api/v1/skills?limit=1',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: 'pnpm run dev',
      url: 'http://127.0.0.1:7001/',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
