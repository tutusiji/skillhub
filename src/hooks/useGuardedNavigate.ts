import { useCallback } from 'react';
import { RouteTab } from '../router/paths';
import { useRouterStore } from '../stores/routerStore';
import { useAuthStore } from '../stores/authStore';
import { useToastStore } from '../stores/toastStore';
import { requireAuth } from '../auth/requireAuth';
import { usePermissions } from '../auth/usePermissions';

/**
 * 带 RBAC 守卫的统一导航（Header 顶部导航调用）。
 * 受保护 tab（audit/rules/settings/manage）先做「已登录 + 菜单权限」双重检查，
 * 未通过则 toast 提示且不跳转；其余 tab 直接 navigate。
 *
 * 从 App.tsx 的 Header onSelectTab 内联守卫提取，逻辑逐字一致，无行为变化。
 * 依赖 DAG：→ routerStore, authStore, toastStore, requireAuth, usePermissions（均无环）。
 */
export function useGuardedNavigate(): (tab: RouteTab) => void {
  const navigate = useRouterStore((s) => s.navigate);
  const currentUser = useAuthStore((s) => s.currentUser);
  const addToast = useToastStore((s) => s.addToast);
  const { isSuperAdmin, canAccessAudit, canAccessRules, canAccessManage } =
    usePermissions();

  return useCallback(
    (tab: RouteTab) => {
      if (tab === 'rules') {
        if (!currentUser) {
          requireAuth('配置风控中心');
          return;
        }
        if (!canAccessRules) {
          addToast('warning', '权限不足', '您未被授予风控中心访问权限');
          return;
        }
        navigate('rules');
      } else if (tab === 'audit') {
        if (!currentUser) {
          requireAuth('访问审核管理中心');
          return;
        }
        if (!canAccessAudit) {
          addToast('warning', '权限不足', '您未被授予审核管理访问权限');
          return;
        }
        navigate('audit');
      } else if (tab === 'settings') {
        if (!currentUser) {
          requireAuth('访问权限设置中心');
          return;
        }
        if (!isSuperAdmin) {
          addToast('error', '权限不足', '权限设置中心仅限超级管理员访问');
          return;
        }
        navigate('settings');
      } else if (tab === 'manage') {
        if (!currentUser) {
          requireAuth('进入分类和专家组管理');
          return;
        }
        if (!canAccessManage) {
          addToast('warning', '权限不足', '您未被授予分类和专家组管理访问权限');
          return;
        }
        navigate('manage');
      } else {
        navigate(tab);
      }
    },
    [navigate, currentUser, addToast, isSuperAdmin, canAccessAudit, canAccessRules, canAccessManage],
  );
}
