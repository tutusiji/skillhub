import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useRouterStore } from '../routerStore';

/**
 * 路由 store 单测：navigate 的 pushState/URL 联动、同路径去重、
 * detail 路径由调用方显式给出、setCurrentTab/setPreviousTab 纯状态。
 * popstate 分发与 hash 迁移 effect 在 App/useRouteEffects 侧覆盖。
 */

beforeEach(() => {
  // 重置 store 状态与 jsdom URL，保证用例间独立
  useRouterStore.setState({ currentTab: 'market', previousTab: 'market' });
  window.history.replaceState({}, '', '/');
});

describe('routerStore.navigate', () => {
  it('切换 tab 时 pushState 更新 URL 并切 currentTab', () => {
    const pushSpy = vi.spyOn(window.history, 'pushState');
    useRouterStore.getState().navigate('demands');
    expect(window.location.pathname).toBe('/demands');
    expect(useRouterStore.getState().currentTab).toBe('demands');
    expect(pushSpy).toHaveBeenCalledTimes(1);
  });

  it('目标路径与当前一致时不重复 pushState', () => {
    const pushSpy = vi.spyOn(window.history, 'pushState');
    useRouterStore.getState().navigate('market');
    expect(pushSpy).not.toHaveBeenCalled();
    expect(useRouterStore.getState().currentTab).toBe('market');
  });

  it('detail 页路径由调用方 pathOverride 给出', () => {
    const pushSpy = vi.spyOn(window.history, 'pushState');
    useRouterStore.getState().navigate('detail', '/skill/%40skillhub%2Fdemo');
    expect(window.location.pathname).toBe('/skill/%40skillhub%2Fdemo');
    expect(useRouterStore.getState().currentTab).toBe('detail');
    expect(pushSpy).toHaveBeenCalledWith({}, '', '/skill/%40skillhub%2Fdemo');
  });

  it('detail 无 pathOverride 时只切状态不写 URL（防误写 /）', () => {
    const pushSpy = vi.spyOn(window.history, 'pushState');
    useRouterStore.getState().navigate('detail');
    expect(useRouterStore.getState().currentTab).toBe('detail');
    expect(pushSpy).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe('/');
  });
});

describe('routerStore 状态动作', () => {
  it('setCurrentTab 仅切状态不写 URL', () => {
    const pushSpy = vi.spyOn(window.history, 'pushState');
    useRouterStore.getState().setCurrentTab('audit');
    expect(useRouterStore.getState().currentTab).toBe('audit');
    expect(window.location.pathname).toBe('/');
    expect(pushSpy).not.toHaveBeenCalled();
  });

  it('setPreviousTab 记录返回目标', () => {
    useRouterStore.getState().setPreviousTab('demands');
    expect(useRouterStore.getState().previousTab).toBe('demands');
  });
});
