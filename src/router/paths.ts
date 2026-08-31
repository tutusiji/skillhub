/**
 * 路径路由常量与 tab 类型定义。
 * 全站唯一的路由映射来源：Header 导航、App 切换、routerStore 跳转统一从这里取，
 * 避免各处在字符串上硬编码不一致。
 */

/** 普通 tab → 路径映射（不含 detail，detail 走 /skill/:slug） */
export const TAB_PATHS: Record<string, string> = {
  market: '/',
  demands: '/demands',
  personal: '/personal',
  audit: '/audit',
  rules: '/rules',
  settings: '/settings',
  feedback: '/feedback',
  manage: '/manage',
};

/** 非详情页 tab 枚举（与 Header 的 NavigationTab 值保持一致） */
export type RouteTab =
  | 'market'
  | 'demands'
  | 'personal'
  | 'audit'
  | 'rules'
  | 'settings'
  | 'feedback'
  | 'manage';

/** 页面 tab（含详情页），等价于 Header 的 NavigationTab */
export type AppTab = RouteTab | 'detail';

/** 判断一个字符串是否为合法 RouteTab */
export function isRouteTab(tab: unknown): tab is RouteTab {
  return typeof tab === 'string' && Object.prototype.hasOwnProperty.call(TAB_PATHS, tab);
}
