import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

/**
 * 全局测试环境初始化：
 * 1. RTL 在每个用例后自动卸载挂载的 React 树（cleanup 由 RTL 自带，这里显式再挂 afterEach 保险）。
 * 2. 清空 localStorage / sessionStorage——业务代码会读写 token 与会话恢复，不能跨用例泄漏。
 * 3. jsdom 缺失的浏览器 API 桩：
 *    - ResizeObserver：Radix Select / 下拉 popper 定位依赖它。
 *    - matchMedia：暗色主题 / prefers-color-scheme 查询。
 *    - Element.prototype.scrollIntoView：列表滚动到选中项。
 *    - PointerEvent：Radix Select 的指针交互需要，jsdom 没有实现。
 *    - Range.prototype.getBoundingClientRect：Radix Select 计算 item 尺寸需要。
 */

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  document.body.innerHTML = '';
});

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  configurable: true,
  value: ResizeObserverStub,
});

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  configurable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

Object.defineProperty(Element.prototype, 'scrollIntoView', {
  writable: true,
  configurable: true,
  value: vi.fn(),
});

if (typeof window.PointerEvent === 'undefined') {
  class PointerEventStub extends Event {
    readonly pointerId = 1;
    readonly pointerType = 'mouse';
    readonly isPrimary = true;
    readonly clientX = 0;
    readonly clientY = 0;
    readonly button = 0;
    readonly buttons = 0;
  }
  Object.defineProperty(window, 'PointerEvent', { writable: true, configurable: true, value: PointerEventStub });
}

if (typeof window.Range !== 'undefined') {
  window.Range.prototype.getBoundingClientRect = () => ({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: 0,
    height: 0,
    toJSON: () => ({}),
  });
}
