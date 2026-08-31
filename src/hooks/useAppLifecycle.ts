import { useEffect, useRef } from 'react';
import { useRouterStore } from '../stores/routerStore';
import { useAuthStore } from '../stores/authStore';
import { fetchMarketData } from '../stores/coordinator';

/**
 * 应用生命周期：登录回源 + 主数据拉取 + 权限设置页名单刷新。
 * 从 App.tsx 收敛而来，让 App 只保留渲染职责。
 */

/**
 * 用持久化的 JWT 恢复登录态（restoreSession 的一次性回源守卫在 store 内，
 * StrictMode 双挂载下只回源一次；无令牌时 authResolved 初始即 true 直接返回）。
 * 拉取集市主数据（技能/规则/征集需求）：首屏启动 + 每次进入数据驱动页面时重新校准
 * ——管理员审核通过一个技能后回到集市必须重新请求才能看到（这正是「审核通过后首页
 * 看不到新技能」的根因）。
 */
export function useAppLifecycle() {
  const currentTab = useRouterStore((s) => s.currentTab);
  const restoreSession = useAuthStore((s) => s.restoreSession);
  const refreshRoster = useAuthStore((s) => s.refreshRoster);

  /** 首屏是否已发起过主数据拉取（避免「启动」与「进入集市」重复请求同一份数据） */
  const bootstrappedRef = useRef(false);

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  useEffect(() => {
    const isDataTab =
      currentTab === 'market' || currentTab === 'personal' || currentTab === 'audit';
    if (!bootstrappedRef.current || isDataTab) {
      bootstrappedRef.current = true;
      void fetchMarketData();
    }
  }, [currentTab]);

  // 打开权限设置页时按需刷新组织名单（refreshRoster 内部按角色放行，
  // 普通用户不发起必 403 的 /auth/users；设置页启动前列表为空，进入时统一回源）
  useEffect(() => {
    if (currentTab !== 'settings') return;
    void refreshRoster();
  }, [currentTab, refreshRoster]);
}
