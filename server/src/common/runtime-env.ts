/**
 * 运行环境判定与生产环境启动前置校验
 *
 * 背景：本项目同时服务「本机开发/演示」与「内网生产部署」两种形态。
 * 大量便利性设计（默认 JWT 密钥、演示账号播种、CORS 全开）在开发时是效率工具，
 * 在生产环境则是实打实的安全漏洞。这里把「当前是不是生产」收敛成唯一判定入口，
 * 由各模块显式引用，避免同一个判断在多处写出不同语义。
 */

/** JWT 签名密钥的历史内置默认值：仅允许非生产环境使用 */
export const INSECURE_DEFAULT_JWT_SECRET =
  'skillhub_enterprise_secret_key_2026';

/**
 * 当前是否运行在生产环境
 * 以 APP_ENV 为准（部署脚本用它选择 .env.prod），兼容 NODE_ENV=production
 */
export function isProduction(): boolean {
  const appEnv = (process.env.APP_ENV || '').trim().toLowerCase();
  if (appEnv) return appEnv === 'prod' || appEnv === 'production';
  return (process.env.NODE_ENV || '').trim().toLowerCase() === 'production';
}

/**
 * 解析 JWT 签名密钥
 *
 * 生产环境未显式配置 JWT_SECRET 时直接终止启动：源码里的默认密钥是公开的，
 * 任何人都能用它离线签发一个 role=super_admin 的令牌，等价于无鉴权。
 * 这类问题必须在启动期暴露（起不来），而不是等到被利用才发现。
 */
export function resolveJwtSecret(configured?: string | null): string {
  const secret = (configured || process.env.JWT_SECRET || '').trim();

  if (isProduction()) {
    if (!secret || secret === INSECURE_DEFAULT_JWT_SECRET) {
      throw new Error(
        '生产环境必须配置足够强度的 JWT_SECRET（不得使用源码内置默认值）。' +
          '请在 .env.prod 中设置，例如：JWT_SECRET=$(openssl rand -hex 32)',
      );
    }
    if (secret.length < 32) {
      throw new Error(
        `生产环境 JWT_SECRET 长度不足（当前 ${secret.length} 字符，至少 32 字符）`,
      );
    }
    return secret;
  }

  return secret || INSECURE_DEFAULT_JWT_SECRET;
}

/**
 * 解析允许跨域访问的来源白名单
 *
 * 生产环境默认同源部署（后端直接托管前端静态资源），无需放开跨域；
 * 确有独立前端域名时通过 CORS_ORIGINS 显式列出，逗号分隔。
 * 开发环境返回 true（等价于回显请求来源），方便 Vite dev server 直连。
 * @returns Express CORS 的 origin 配置值
 */
export function resolveCorsOrigin(): string[] | boolean {
  const raw = (process.env.CORS_ORIGINS || '').trim();
  if (raw) {
    return raw
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  // 生产未配置白名单：只允许同源（不下发 CORS 头），杜绝任意站点携带令牌调用内网 API
  return isProduction() ? false : true;
}

/**
 * 是否播种演示数据（模拟员工 / 演示技能 / 演示建议 / 预置种子技能）
 *
 * 生产环境默认关闭：演示账号使用统一弱口令 `Password123!`，
 * 一旦随生产实例上线即是一组可直接登录的后门账号。
 * 需要在类生产环境做演练时，显式设置 SEED_DEMO_DATA=true。
 */
export function shouldSeedDemoData(): boolean {
  const flag = (process.env.SEED_DEMO_DATA || '').trim().toLowerCase();
  if (flag === 'true' || flag === '1') return true;
  if (flag === 'false' || flag === '0') return false;
  return !isProduction();
}
