import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildAvatarUrl, resolveAvatar } from '../avatar';

/**
 * 头像 URL 生成单测。
 * 默认断言对外网 DiceBear 10.x + adventurer 的兜底形态；
 * 内网 host 覆盖用 vi.stubEnv + vi.resetModules + 动态 import（常量在模块加载期读取）。
 */

const DEFAULT_URL = 'https://api.dicebear.com/10.x/adventurer/svg';

describe('buildAvatarUrl', () => {
  it('按 seed 生成默认形态 URL', () => {
    expect(buildAvatarUrl('7462200')).toBe(`${DEFAULT_URL}?seed=7462200`);
  });

  it('空值/空白 seed 退化为固定 anonymous（幂等，非随机）', () => {
    expect(buildAvatarUrl('')).toBe(`${DEFAULT_URL}?seed=anonymous`);
    expect(buildAvatarUrl('   ')).toBe(`${DEFAULT_URL}?seed=anonymous`);
    expect(buildAvatarUrl(null)).toBe(`${DEFAULT_URL}?seed=anonymous`);
    expect(buildAvatarUrl(undefined)).toBe(`${DEFAULT_URL}?seed=anonymous`);
  });

  it('非 ASCII / 空格 seed 做 URL 编码', () => {
    expect(buildAvatarUrl('张 三')).toBe(`${DEFAULT_URL}?seed=${encodeURIComponent('张 三')}`);
  });
});

describe('resolveAvatar', () => {
  it('已有头像原样返回', () => {
    expect(resolveAvatar('https://cdn.corp.com/uploads/me.png', { employeeId: '7462201' })).toBe(
      'https://cdn.corp.com/uploads/me.png',
    );
  });

  it('空白头像按优先级派生：工号 > 登录名 > 邮箱 > 姓名 > anonymous', () => {
    const full = { employeeId: '7462201', loginName: 'admin', email: 'a@b.c', name: '李' };
    expect(resolveAvatar('', full)).toBe(`${DEFAULT_URL}?seed=7462201`);
    expect(resolveAvatar('', { loginName: 'admin', email: 'a@b.c' })).toBe(`${DEFAULT_URL}?seed=admin`);
    expect(resolveAvatar('', { email: 'a@b.c' })).toBe(`${DEFAULT_URL}?seed=${encodeURIComponent('a@b.c')}`);
    expect(resolveAvatar('', { name: '李' })).toBe(`${DEFAULT_URL}?seed=${encodeURIComponent('李')}`);
    expect(resolveAvatar('')).toBe(`${DEFAULT_URL}?seed=anonymous`);
  });

  it('身份字段全空白时取下一个优先级', () => {
    expect(resolveAvatar('', { employeeId: '  ', name: '王' })).toBe(
      `${DEFAULT_URL}?seed=${encodeURIComponent('王')}`,
    );
  });
});

describe('avatar host 覆盖', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('设置 VITE_AVATAR_BASE_URL 后按内网 host 生成', async () => {
    vi.stubEnv('VITE_AVATAR_BASE_URL', 'http://10.9.43.61:4987/9.x/');
    vi.resetModules();
    const mod = await import('../avatar');
    expect(mod.buildAvatarUrl('7462200')).toBe('http://10.9.43.61:4987/9.x/adventurer/svg?seed=7462200');
  });
});
