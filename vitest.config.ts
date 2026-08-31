import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * Vitest 单元测试配置（独立于 vite.config.ts，不参与生产构建）。
 * - globals: false：测试文件必须显式 `import { describe, it, expect, vi } from 'vitest'`，
 *   因为根 tsconfig 没有 include、`tsc --noEmit` 连 server/** 一起编译，
 *   一旦在 tsconfig 里加 `"types"` 会把 server 的 @types/node 踢出全局类型。
 * - jsdom 环境：RTL 渲染 React 组件需要真实 DOM 语义（事件、焦点、Portal）。
 * - restoreMocks/clearMocks：每个用例之间恢复 vi 桩，避免跨用例泄漏。
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
    clearMocks: true,
  },
});
