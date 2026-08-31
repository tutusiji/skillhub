import { afterEach, describe, expect, it, vi } from 'vitest';
import { MARKETPLACE_NAME, getMarketplaceAddCommand, getMarketplaceGitUrl, getMarketplaceUpdateCommand } from '../marketplace';

/**
 * 插件市场接入命令单测。
 * - 默认回退到 window.location.origin（jsdom 为 http://localhost:3000）
 * - VITE_API_BASE_URL 显式配置时优先（vi.stubEnv，函数内读取 import.meta.env）
 */

describe('getMarketplaceGitUrl', () => {
  it('默认回退到当前页面来源', () => {
    expect(getMarketplaceGitUrl()).toBe(`http://localhost:3000/${MARKETPLACE_NAME}.git`);
  });

  it('去掉配置尾斜杠', () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://souxy.com:7300/');
    expect(getMarketplaceGitUrl()).toBe('https://souxy.com:7300/skillhub.git');
  });
});

describe('marketplace 命令拼接', () => {
  it('add 命令 = claude plugin marketplace add <gitUrl>', () => {
    expect(getMarketplaceAddCommand()).toBe(`claude plugin marketplace add http://localhost:3000/skillhub.git`);
  });

  it('update 命令 = claude plugin marketplace update skillhub', () => {
    expect(getMarketplaceUpdateCommand()).toBe('claude plugin marketplace update skillhub');
  });

  it('市场名与 URL 保持一致（marketplace.json name 字段）', () => {
    expect(MARKETPLACE_NAME).toBe('skillhub');
    expect(getMarketplaceGitUrl()).toContain('/skillhub.git');
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});
