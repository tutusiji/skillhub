/**
 * 头像地址生成（前端侧，与后端 server/src/common/avatar.util.ts 保持同一协议）
 *
 * 形态：{VITE_AVATAR_BASE_URL}/{style}/svg?seed={seed}
 *   外网版（默认）：https://api.dicebear.com/10.x/adventurer/svg?seed=7462200
 *   内网版        ：http://10.9.43.61:4987/9.x/adventurer/svg?seed=zhang.san123
 *
 * 前端只在「后端没给头像」时兜底生成，正常链路的头像一律来自后端字段，
 * 避免同一个人在不同页面被算出不同头像。
 *
 * 注意：Vite 的 import.meta.env 是构建期常量，改 host 需要重新构建前端；
 * 后端则是运行期读环境变量。两边都要配同一个地址。
 */

/** 官方公共服务，未配置时的缺省值 */
const DEFAULT_AVATAR_BASE_URL = 'https://api.dicebear.com/10.x';

/** 缺省头像风格 */
const DEFAULT_AVATAR_STYLE = 'adventurer';

const AVATAR_BASE_URL = (
  import.meta.env.VITE_AVATAR_BASE_URL || DEFAULT_AVATAR_BASE_URL
).replace(/\/+$/, '');

const AVATAR_STYLE = import.meta.env.VITE_AVATAR_STYLE || DEFAULT_AVATAR_STYLE;

/**
 * 按 seed 生成头像 URL
 * @param seed 稳定标识（工号优先，保证同一个人头像不变）
 */
export function buildAvatarUrl(seed?: string | null): string {
  const safeSeed = encodeURIComponent((seed || '').trim() || 'anonymous');
  return `${AVATAR_BASE_URL}/${AVATAR_STYLE}/svg?seed=${safeSeed}`;
}

/**
 * 头像兜底：后端字段为空时按身份派生
 *
 * seed 优先级与后端一致：工号 → 登录名 → 邮箱 → 姓名，
 * 任何一项都没有时退化为固定的 'anonymous' 头像（而不是随机图，保证幂等）。
 */
export function resolveAvatar(
  avatar: string | null | undefined,
  identity?: {
    employeeId?: string | null;
    loginName?: string | null;
    email?: string | null;
    name?: string | null;
  },
): string {
  const value = (avatar || '').trim();
  if (value) return value;
  const seed =
    identity?.employeeId?.trim() ||
    identity?.loginName?.trim() ||
    identity?.email?.trim() ||
    identity?.name?.trim() ||
    'anonymous';
  return buildAvatarUrl(seed);
}
