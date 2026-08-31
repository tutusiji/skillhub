import { TAB_PATHS, type AppTab } from './paths';
import { parseLocation } from './parseLocation';

/**
 * 应用启动时确定初始 tab（迁移自 App.tsx 原 currentTab 的 useState 初始化器）：
 * 1. 旧 hash 链接（/#tab=xxx / #skill=xxx）优先（URL 本身后续由 hash 迁移 effect 改写为路径型）
 * 2. 路径型路由解析（/demands、/skill/:slug 深链等）
 * 3. sessionStorage 记忆兜底（刷新后回到上次 tab；详情页不记忆技能 id，靠 /skill/:slug 还原）
 * 4. 全无 → market
 *
 * @param env 测试注入窗口对象（默认 window）
 */
export function readInitialTab(
  env: Pick<Window, 'location' | 'sessionStorage'> = window,
): AppTab {
  try {
    // 兼容旧 hash 链接（/#tab=xxx / #skill=xxx）
    const hash = env.location.hash.replace('#', '');
    if (hash.startsWith('tab=')) {
      const tabVal = hash.split('tab=')[1] as string;
      if (TAB_PATHS[tabVal]) return tabVal as AppTab;
    }
    if (hash.startsWith('skill=')) return 'detail';

    // 路径型路由解析
    const parsed = parseLocation(env.location.pathname);
    if (parsed.tab === 'detail' || TAB_PATHS[parsed.tab]) return parsed.tab;

    // sessionStorage 记忆的 tab（刷新兜底；URL path 始终是主来源）
    const savedTab = env.sessionStorage.getItem('skillhub_active_tab');
    if (savedTab && TAB_PATHS[savedTab]) return savedTab as AppTab;
  } catch {
    // hash/sessionStorage 访问异常时回落到 market
  }
  return 'market';
}
