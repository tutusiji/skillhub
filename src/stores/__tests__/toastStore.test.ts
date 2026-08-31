import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useToastStore } from '../toastStore';

/**
 * Toast store 单测：追加 / 自动移除（4500ms）/ 手动关闭。
 * 用 fake timers 控制自动移除，避免真实计时器跨用例泄漏。
 */

beforeEach(() => {
  useToastStore.setState({ toasts: [] });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('toastStore.addToast', () => {
  it('追加一条通知并生成唯一 id', () => {
    useToastStore.getState().addToast('success', '登录成功', '欢迎回来');
    const { toasts } = useToastStore.getState();
    expect(toasts).toHaveLength(1);
    expect(toasts[0]).toMatchObject({ type: 'success', title: '登录成功', message: '欢迎回来' });
    expect(toasts[0].id).toMatch(/^toast-/);
  });

  it('连续添加多条互不覆盖', () => {
    useToastStore.getState().addToast('success', 'a', 'msg-a');
    useToastStore.getState().addToast('info', 'b', 'msg-b');
    expect(useToastStore.getState().toasts).toHaveLength(2);
  });
});

describe('toastStore 自动移除', () => {
  it('4500ms 后自动移除通知', () => {
    useToastStore.getState().addToast('warning', '请先登录', '未登录');
    vi.advanceTimersByTime(4499);
    expect(useToastStore.getState().toasts).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });
});

describe('toastStore.removeToast', () => {
  it('只移除指定 id 的通知', () => {
    useToastStore.getState().addToast('success', 'a', 'msg-a');
    useToastStore.getState().addToast('info', 'b', 'msg-b');
    const firstId = useToastStore.getState().toasts[0].id;
    useToastStore.getState().removeToast(firstId);
    const remaining = useToastStore.getState().toasts;
    expect(remaining).toHaveLength(1);
    expect(remaining[0].title).toBe('b');
  });
});
