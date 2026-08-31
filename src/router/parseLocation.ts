import { TAB_PATHS, type AppTab } from './paths';

export interface ParsedLocation {
  tab: AppTab;
  skillSlug: string | null;
}

/**
 * 解析浏览器路径为页面 tab
 * 支持 /skill/:slugOrId 详情路径，未知路径回落到 market
 * @param pathname 当前路径
 */
export function parseLocation(pathname: string): ParsedLocation {
  const skillMatch = pathname.match(/^\/skill\/([^/]+)/);
  if (skillMatch) {
    return { tab: 'detail', skillSlug: decodeURIComponent(skillMatch[1]) };
  }
  for (const [tab, path] of Object.entries(TAB_PATHS)) {
    if (path === pathname) return { tab: tab as AppTab, skillSlug: null };
  }
  return { tab: 'market', skillSlug: null };
}
