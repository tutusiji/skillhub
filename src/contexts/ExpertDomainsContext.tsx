import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { ExpertDomainInfo } from '../types';
import { EXPERT_DOMAINS } from '../data/expertDomains';
import { api, ApiExpertDomain } from '../services/api';

/** 后端专家组记录映射为前端 ExpertDomainInfo（id 断言为 ExpertDomain 兼容） */
export function mapExpertDomain(d: ApiExpertDomain): ExpertDomainInfo {
  return {
    id: d.id as ExpertDomainInfo['id'],
    name: d.name,
    shortLabel: d.shortLabel,
    description: d.description,
    iconName: d.iconName,
    badgeBg: d.badgeBg,
    badgeText: d.badgeText,
    badgeBorder: d.badgeBorder,
  };
}

/**
 * 模块级 fallback：在后端未返回前用编译期常量兜底；
 * 同时保证 useExpertDomains 即使在 Provider 之外被调用也不会抛错。
 */
const FALLBACK_DOMAINS: ExpertDomainInfo[] = EXPERT_DOMAINS.filter(d => d.id !== 'all');

export interface ExpertDomainsContextValue {
  domains: ExpertDomainInfo[];
  /** 强制刷新（管理员在分类与专家组管理页 CRUD 后调用） */
  refresh: () => void;
  /** 是否已完成首轮后端拉取（用于占位/loading 区分） */
  loaded: boolean;
}

const ExpertDomainsContext = createContext<ExpertDomainsContextValue>({
  domains: FALLBACK_DOMAINS,
  refresh: () => undefined,
  loaded: false,
});

/**
 * 岗位专家组数据 Provider
 *
 * 之所以是 Provider 而不是「每个调用 useExpertDomains 的组件各自拉」：
 *   useExpertDomains 被 8 个组件调用，其中 SkillCard 在列表里被 map() 渲染 N 次。
 *   旧实现会让每个组件实例都触发一次 /api/v1/expert-domains，
 *   集市刷新一次就能产生 20+ 次重复请求。Provider 化后全应用只请求一次。
 */
export const ExpertDomainsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [domains, setDomains] = useState<ExpertDomainInfo[]>(FALLBACK_DOMAINS);
  const [loaded, setLoaded] = useState(false);
  // 用 ref 记一个 in-flight token：如果同一次 refresh 还没回来就忽略后续重复触发，
  // 避免管理员连续点击保存导致 N 个并发请求。
  const inflightRef = useRef<symbol | null>(null);

  const refresh = useCallback(() => {
    const token = Symbol('expert-domains-fetch');
    inflightRef.current = token;
    api
      .listExpertDomains()
      .then(list => {
        if (inflightRef.current !== token) return; // 被新的 refresh 抢先
        if (Array.isArray(list) && list.length > 0) {
          setDomains(list.map(mapExpertDomain));
        }
        setLoaded(true);
      })
      .catch(() => {
        if (inflightRef.current !== token) return;
        /* 后端不可用时保持常量兜底，loaded 留 false 以便上层显示「离线兜底」提示 */
      });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <ExpertDomainsContext.Provider value={{ domains, refresh, loaded }}>
      {children}
    </ExpertDomainsContext.Provider>
  );
};

/** 消费端 hook：与旧的 useExpertDomains 签名一致，调用方无需修改 */
export function useExpertDomains(): ExpertDomainsContextValue {
  return useContext(ExpertDomainsContext);
}
