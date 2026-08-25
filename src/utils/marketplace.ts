/**
 * Claude Code 插件市场接入辅助工具
 * 集中维护市场名称与市场地址的推导逻辑，避免各处硬编码不一致
 */

/** 企业市场在 Claude Code 中注册的名称，与 marketplace.json 的 name 字段保持一致 */
export const MARKETPLACE_NAME = 'skillhub';

/**
 * 推导当前环境下可用的 Git 市场克隆地址
 * 优先使用显式配置的 API 基址；未配置时回退到当前页面来源，
 * 保证内网/公网/本地开发三种访问方式复制到的命令都能直接执行
 */
export function getMarketplaceGitUrl(): string {
  const configured = (import.meta.env.VITE_API_BASE_URL ?? '').replace(
    /\/$/,
    '',
  );
  const origin =
    configured ||
    (typeof window !== 'undefined' ? window.location.origin : '') ||
    'http://localhost:3001';
  return `${origin}/${MARKETPLACE_NAME}.git`;
}

/**
 * 生成首次接入企业市场需要执行的前置命令
 * Claude Code 必须先 `marketplace add` 注册市场，才能 `plugin install` 具体插件
 */
export function getMarketplaceAddCommand(): string {
  return `claude plugin marketplace add ${getMarketplaceGitUrl()}`;
}
