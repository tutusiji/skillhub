import { create } from 'zustand';
import { TAB_PATHS, type AppTab } from '../router/paths';
import { readInitialTab } from '../router/readInitialTab';

/**
 * 路由状态 store。
 * 依赖 DAG 中无上游依赖（不读任何其他 store），导航动作纯路由：
 * 更新 URL（pushState）并切换 currentTab，不触碰业务数据。
 * 详情页 URL 依赖技能 slug（业务域），由调用方通过 pathOverride 显式给出。
 */
interface RouterState {
  /** 当前页面 tab（含详情页） */
  currentTab: AppTab;
  /** 进入详情页前的 tab（详情页「返回」按钮使用） */
  previousTab: AppTab;
  /**
   * 纯路由跳转：pushState 更新 URL 并切换 currentTab。
   * @param tab 目标 tab
   * @param pathOverride detail 页的完整路径（如 /skill/xxx）；非 detail 页自动由 TAB_PATHS 推导
   */
  navigate: (tab: AppTab, pathOverride?: string) => void;
  /** 仅切状态不写 URL（popstate / 回落场景） */
  setCurrentTab: (tab: AppTab) => void;
  /** 记录进入详情页前的 tab */
  setPreviousTab: (tab: AppTab) => void;
}

export const useRouterStore = create<RouterState>((set) => ({
  // 启动初始 tab：旧 hash → 路径 → sessionStorage 记忆 → market
  currentTab: typeof window !== 'undefined' ? readInitialTab() : 'market',
  previousTab: 'market',
  navigate: (tab, pathOverride) => {
    // detail 页路径必须由调用方给出（skill slug 不在路由域内），缺省时只切状态不写 URL
    if (tab === 'detail' && !pathOverride) {
      set({ currentTab: tab });
      return;
    }
    const path = tab === 'detail' ? (pathOverride as string) : TAB_PATHS[tab] || '/';
    if (typeof window !== 'undefined' && window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
    set({ currentTab: tab });
  },
  setCurrentTab: (tab) => set({ currentTab: tab }),
  setPreviousTab: (tab) => set({ previousTab: tab }),
}));
