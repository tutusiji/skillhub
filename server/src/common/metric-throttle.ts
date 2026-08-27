/**
 * 互动计数去重节流（进程内滑动窗口）
 *
 * 背景：下载计数按产品要求必须允许匿名上报（访客可直接下载源码），
 * 但没有任何约束时，一个循环脚本就能把任意技能的 downloads 刷到几万，
 * 从而操纵集市的「热门榜」排序 —— 这是真实可利用的业务数据污染。
 *
 * 策略：同一来源（IP 或用户 ID）对同一技能的同一计数项，在冷却窗口内只计一次。
 * 这既保留了「访客下载也计数」的产品行为，又让批量刷量失效。
 *
 * 多副本部署时应替换为集中式存储（Redis）；单进程内网部署下 Map 足够，
 * 且窗口过期即清理，不会无界增长。
 */

/** 同一来源对同一技能同一计数项的冷却窗口：10 分钟 */
const COOLDOWN_MS = 10 * 60 * 1000;

/** 超过该条目数即触发一次全量清理，避免长期运行下 Map 膨胀 */
const CLEANUP_THRESHOLD = 20000;

const lastSeen = new Map<string, number>();

/**
 * 清理已过期的记录
 * @param now 当前时间戳
 */
function pruneExpired(now: number): void {
  for (const [key, ts] of lastSeen) {
    if (now - ts >= COOLDOWN_MS) lastSeen.delete(key);
  }
}

/**
 * 判断本次计数上报是否应被计入
 * @param skillId 技能 ID
 * @param metric 计数项（likes / stars / downloads）
 * @param actor 上报来源标识（登录用户 ID 或来源 IP）
 * @returns true 表示应计数，false 表示在冷却窗口内需忽略
 */
export function shouldCountMetric(
  skillId: string,
  metric: string,
  actor?: string,
): boolean {
  // 无法识别来源时不做节流（避免因代理配置缺失导致正常下载不计数）
  if (!actor) return true;

  const now = Date.now();
  if (lastSeen.size > CLEANUP_THRESHOLD) pruneExpired(now);

  const key = `${actor}::${skillId}::${metric}`;
  const previous = lastSeen.get(key);
  if (previous !== undefined && now - previous < COOLDOWN_MS) {
    return false;
  }
  lastSeen.set(key, now);
  return true;
}
