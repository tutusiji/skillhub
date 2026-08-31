import { useEffect } from 'react';
import { api, mapApiSkill } from '../services/api';
import { useRouterStore } from '../stores/routerStore';
import { useSkillsStore } from '../stores/skillsStore';
import { useUiStore } from '../stores/uiStore';
import { parseLocation } from '../router/parseLocation';
import { TAB_PATHS } from '../router/paths';

/**
 * 路由副作用：URL 与页面状态之间的同步（旧 hash 迁移 / tab 记忆 / 深链直达 /
 * 前进后退 / ⌘K 快捷键）。从 App.tsx 收敛而来。
 *
 * popstate 的「详情回落」需要读 skills 列表判断技能是否还在，因此放在本 hook
 * （同时拿 router + skills 两 store），routerStore 本身保持无环。
 */
export function useRouteEffects() {
  const currentTab = useRouterStore((s) => s.currentTab);
  const selectedSkill = useSkillsStore((s) => s.selectedSkill);
  const skills = useSkillsStore((s) => s.skills);
  const setSelectedSkill = useSkillsStore((s) => s.setSelectedSkill);
  const setDetailLoading = useUiStore((s) => s.setDetailLoading);
  const toggleCommandPalette = useUiStore((s) => s.toggleCommandPalette);

  // 兼容旧 hash 链接：把 /#tab=xxx / /#skill=xxx 一次性迁移为路径型 URL
  useEffect(() => {
    try {
      const hash = window.location.hash.replace('#', '');
      if (!hash || window.location.pathname !== '/') return;
      let path = '/';
      if (hash.startsWith('skill=')) {
        path = `/skill/${encodeURIComponent(hash.split('skill=')[1])}`;
      } else if (hash.startsWith('tab=')) {
        path = TAB_PATHS[hash.split('tab=')[1]] || '/';
      }
      if (path !== '/') {
        window.history.replaceState({}, '', path);
      }
    } catch (e) {}
  }, []);

  // 记忆当前 tab（刷新兜底；URL path 始终是主来源）。
  // 详情页不再记忆技能 id：/skill/:slug 已经能唯一还原，
  // 且技能必须从后端回源，本地记忆只会带来过期数据。
  useEffect(() => {
    try {
      sessionStorage.setItem('skillhub_active_tab', currentTab);
    } catch (e) {}
  }, [currentTab]);

  // 刷新直达详情页：/skill/:slug 对应的技能不在本地时，从后端拉取，避免白屏
  useEffect(() => {
    if (currentTab !== 'detail' || selectedSkill) return;
    const m = window.location.pathname.match(/^\/skill\/([^/]+)/);
    const slug = m ? decodeURIComponent(m[1]) : null;
    if (!slug) return;

    let cancelled = false;
    setDetailLoading(true);
    api
      .getSkill(slug)
      .then((detail) => {
        if (cancelled) return;
        const full = mapApiSkill(detail);
        // 深链直达的技能可能不在本地列表：仅当缺失时前置插入（不重复）
        useSkillsStore.setState((state) => ({
          skills: state.skills.some((s) => s.id === full.id)
            ? state.skills
            : [full, ...state.skills],
        }));
        setSelectedSkill(full);
      })
      .catch(() => {
        /* 技能不存在或后端不可用：渲染「未找到」占位 */
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTab, selectedSkill, setDetailLoading, setSelectedSkill]);

  // 浏览器前进 / 后退：以 URL path 为准回写路由状态
  useEffect(() => {
    const handlePopState = () => {
      const setCurrentTab = useRouterStore.getState().setCurrentTab;
      const { tab, skillSlug } = parseLocation(window.location.pathname);
      if (tab === 'detail' && skillSlug) {
        const target = skills.find((s) => s.id === skillSlug || s.slug === skillSlug);
        if (target) {
          setSelectedSkill(target);
          setCurrentTab('detail');
        } else {
          // 技能已被删除等情况下回落到技能集市
          setCurrentTab('market');
        }
      } else {
        setCurrentTab(tab);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [skills, setSelectedSkill]);

  // 全局 ⌘K 快捷键：打开/关闭命令面板
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        toggleCommandPalette();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleCommandPalette]);
}
