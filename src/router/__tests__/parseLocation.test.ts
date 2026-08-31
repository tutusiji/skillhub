import { describe, expect, it } from 'vitest';
import { parseLocation } from '../parseLocation';

/** 路径 → tab 解析单测：深链详情、未知路径回落、URL 编码 slug */

describe('parseLocation', () => {
  it('解析 /skill/:slug 为详情页并返回 slug', () => {
    expect(parseLocation('/skill/sql-agent')).toEqual({ tab: 'detail', skillSlug: 'sql-agent' });
  });

  it('详情路径只取第一个路径段', () => {
    expect(parseLocation('/skill/sql-agent/extra')).toEqual({ tab: 'detail', skillSlug: 'sql-agent' });
  });

  it('URL 编码的 slug 解码还原', () => {
    expect(parseLocation('/skill/%40skillhub%2Fdemo')).toEqual({
      tab: 'detail',
      skillSlug: '@skillhub/demo',
    });
  });

  it.each([
    ['/', 'market'],
    ['/demands', 'demands'],
    ['/personal', 'personal'],
    ['/audit', 'audit'],
    ['/rules', 'rules'],
    ['/settings', 'settings'],
    ['/feedback', 'feedback'],
    ['/manage', 'manage'],
  ])('解析 %s → %s', (path, tab) => {
    expect(parseLocation(path)).toEqual({ tab, skillSlug: null });
  });

  it('未知路径回落到 market', () => {
    expect(parseLocation('/no-such-page')).toEqual({ tab: 'market', skillSlug: null });
    expect(parseLocation('')).toEqual({ tab: 'market', skillSlug: null });
  });
});
