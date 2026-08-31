import { vi } from 'vitest';

/**
 * 生成 api 对象（src/services/api.ts）的全量方法 mock。
 *
 * 用法（测试文件顶部，vi.mock 工厂里）：
 *   vi.mock('../../services/api', async (importOriginal) => {
 *     const actual = await importOriginal<typeof import('../../services/api')>();
 *     return { ...actual, api: createApiMock(actual.api) };
 *   });
 *
 * 这样展开真实模块的方法名逐一替换成 vi.fn()，不用手抄 50 个方法；
 * `...actual` 保留真实 mapper 函数（mapApiSkill 等），需要时可直接用真实实现。
 * 注意：本模块不能静态 import api.ts——那会经 mock 注册表读到被 mock 的对象，
 * 必须在 vi.mock 工厂里由 importOriginal 传入真实模块。
 */
export function createApiMock<T extends Record<string, unknown>>(
  apiSource: T,
): Record<keyof T, ReturnType<typeof vi.fn>> {
  const mocked = {} as Record<keyof T, ReturnType<typeof vi.fn>>;
  for (const key of Object.keys(apiSource)) {
    mocked[key as keyof T] = vi.fn();
  }
  return mocked;
}
