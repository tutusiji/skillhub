import { useAuthStore } from '../stores/authStore';

/**
 * 菜单级权限派生（App 与 Header 共用的唯一入口）。
 *
 * 角色模型：super_admin / admin / user。超管恒拥有全部菜单；admin 按
 * users.menu_permissions 清单逐项控制业务菜单的可见性；普通用户全部不可见。
 * 此前的 App.tsx 与 Header.tsx 各自推导一份，曾出现漏同步导致导航与页面守卫不一致。
 */
export function usePermissions() {
  const currentUser = useAuthStore((s) => s.currentUser);

  const isSuperAdmin = currentUser?.role === 'super_admin';
  const isAdmin = currentUser?.role === 'admin' || isSuperAdmin;
  const menuPermissions = currentUser?.menuPermissions ?? [];
  const isAdminRole = currentUser?.role === 'admin';

  const hasMenu = (key: string) => isSuperAdmin || (isAdminRole && menuPermissions.includes(key));

  return {
    currentUser,
    isSuperAdmin,
    isAdmin,
    menuPermissions,
    canAccessAudit: hasMenu('audit'),
    canAccessRules: hasMenu('rules'),
    canAccessDemands: hasMenu('demands'),
    canAccessFeedback: hasMenu('feedback'),
    canAccessManage: hasMenu('manage'),
  };
}
