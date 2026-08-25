import { useState, useEffect, useCallback } from 'react';
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
 * 岗位专家组数据 hook
 * 在线时以后端 expert_domains 表为权威；后端不可用时回退到编译期常量 EXPERT_DOMAINS
 * @returns 专家组列表（不含「全部专家组」虚拟项）与刷新函数
 */
export function useExpertDomains(): { domains: ExpertDomainInfo[]; refresh: () => void } {
  const [domains, setDomains] = useState<ExpertDomainInfo[]>(() =>
    EXPERT_DOMAINS.filter(d => d.id !== 'all'),
  );

  const refresh = useCallback(() => {
    api
      .listExpertDomains()
      .then(list => {
        if (Array.isArray(list) && list.length > 0) {
          setDomains(list.map(mapExpertDomain));
        }
      })
      .catch(() => {
        /* 后端不可用时保持常量兜底 */
      });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { domains, refresh };
}
