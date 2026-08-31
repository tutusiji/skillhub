import { describe, expect, it } from 'vitest';
import { readInitialTab } from '../readInitialTab';

/**
 * 启动初始 tab 推导单测。
 * 优先级：旧 hash（#tab= / #skill=）→ 路径 → sessionStorage 记忆 → market。
 * 用注入的假 env 控制 location / sessionStorage，避免依赖真实 jsdom 全局。
 */

type Env = Parameters<typeof readInitialTab>[0];

function fakeEnv(opts: { hash?: string; pathname?: string; savedTab?: string | null } = {}): Env {
  const store = new Map<string, string>();
  if (opts.savedTab !== undefined) {
    store.set('skillhub_active_tab', opts.savedTab);
  }
  return {
    location: { hash: opts.hash ?? '', pathname: opts.pathname ?? '/' },
    sessionStorage: { getItem: (k: string) => store.get(k) ?? null },
  } as unknown as Env;
}

describe('readInitialTab', () => {
  it('全空时回落到 market', () => {
    expect(readInitialTab(fakeEnv())).toBe('market');
  });

  it('旧 hash #tab=xxx 优先', () => {
    expect(readInitialTab(fakeEnv({ hash: '#tab=audit' }))).toBe('audit');
    expect(readInitialTab(fakeEnv({ hash: '#tab=rules', pathname: '/demands' }))).toBe('rules');
  });

  it('未知 hash tab 值忽略，继续走路径解析', () => {
    expect(readInitialTab(fakeEnv({ hash: '#tab=unknown' }))).toBe('market');
  });

  it('#skill=xxx 进入详情页', () => {
    expect(readInitialTab(fakeEnv({ hash: '#skill=sql-agent' }))).toBe('detail');
  });

  it('路径型路由解析', () => {
    expect(readInitialTab(fakeEnv({ pathname: '/demands' }))).toBe('demands');
    expect(readInitialTab(fakeEnv({ pathname: '/skill/foo' }))).toBe('detail');
  });

  // 注：sessionStorage 分支沿用原 App.tsx 逻辑，实际不可达——parseLocation 对任何
  // 路径（含 /）都能解析出合法 tab，前面的分支必然 return。刷新恢复靠 URL 本身。
  it('sessionStorage 记忆不覆盖路径解析（URL 为权威）', () => {
    expect(readInitialTab(fakeEnv({ pathname: '/personal', savedTab: 'settings' }))).toBe('personal');
  });

  it('路径为 / 时 savedTab 不生效（历史遗留：URL 始终能解析出 tab）', () => {
    expect(readInitialTab(fakeEnv({ savedTab: 'settings' }))).toBe('market');
  });
});
