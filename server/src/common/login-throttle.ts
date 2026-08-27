import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * 登录失败节流器（进程内滑动窗口计数）
 *
 * 背景：登录接口此前没有任何频次限制，实测连续 30 次错误密码全部被正常处理，
 * 攻击者可以对固定账号（例如已知的超管登录名 `admin`）做在线口令爆破。
 * 这里按「账号标识 + 来源 IP」两个维度分别计数，任一维度超阈值即返回 429。
 *
 * 为什么用进程内 Map 而不是 Redis：本系统是单进程内网部署（后端同时托管前端），
 * 引入外部依赖反而增加运维面。多副本部署时应替换为集中式存储，
 * 此处保持单一职责，便于后续替换。
 */

/** 计数窗口长度：15 分钟 */
const WINDOW_MS = 15 * 60 * 1000;

/** 同一账号在窗口内允许的最大失败次数 */
const MAX_FAILURES_PER_ACCOUNT = 8;

/** 同一来源 IP 在窗口内允许的最大失败次数（宽松些，避免 NAT 出口误伤整栋楼） */
const MAX_FAILURES_PER_IP = 30;

interface FailureRecord {
  /** 窗口内累计失败次数 */
  count: number;
  /** 窗口起始时间戳 */
  windowStart: number;
}

/**
 * 单维度失败计数器
 */
class FailureCounter {
  private readonly records = new Map<string, FailureRecord>();

  constructor(private readonly limit: number) {}

  /**
   * 判断某个 key 是否已被锁定，并返回剩余锁定秒数
   * @param key 计数维度的键（账号或 IP）
   */
  retryAfterSeconds(key: string): number {
    const record = this.records.get(key);
    if (!record) return 0;

    const elapsed = Date.now() - record.windowStart;
    if (elapsed >= WINDOW_MS) {
      // 窗口已过期，顺手清理，避免 Map 无界增长
      this.records.delete(key);
      return 0;
    }
    if (record.count < this.limit) return 0;
    return Math.ceil((WINDOW_MS - elapsed) / 1000);
  }

  /**
   * 记录一次失败
   * @param key 计数维度的键
   */
  recordFailure(key: string): void {
    const now = Date.now();
    const record = this.records.get(key);
    if (!record || now - record.windowStart >= WINDOW_MS) {
      this.records.set(key, { count: 1, windowStart: now });
      return;
    }
    record.count += 1;
  }

  /**
   * 登录成功后清空该 key 的失败记录
   * @param key 计数维度的键
   */
  reset(key: string): void {
    this.records.delete(key);
  }
}

const accountCounter = new FailureCounter(MAX_FAILURES_PER_ACCOUNT);
const ipCounter = new FailureCounter(MAX_FAILURES_PER_IP);

/** 归一化账号标识：大小写与首尾空格不应绕过计数 */
const normalize = (value: string): string => (value || '').trim().toLowerCase();

/**
 * 进入登录流程前的准入检查，超过阈值抛 429
 * @param account 账号标识（登录名/工号/邮箱）
 * @param ip 请求来源 IP
 */
export function assertLoginAllowed(account: string, ip?: string): void {
  const waits = [
    accountCounter.retryAfterSeconds(normalize(account)),
    ip ? ipCounter.retryAfterSeconds(ip) : 0,
  ];
  const retryAfter = Math.max(...waits);
  if (retryAfter > 0) {
    throw new HttpException(
      `登录失败次数过多，请在 ${Math.ceil(retryAfter / 60)} 分钟后重试`,
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

/**
 * 记录一次登录失败
 * @param account 账号标识
 * @param ip 请求来源 IP
 */
export function recordLoginFailure(account: string, ip?: string): void {
  accountCounter.recordFailure(normalize(account));
  if (ip) ipCounter.recordFailure(ip);
}

/**
 * 记录一次登录成功，清空该账号的失败计数
 * @param account 账号标识
 * @param ip 请求来源 IP
 */
export function recordLoginSuccess(account: string, ip?: string): void {
  accountCounter.reset(normalize(account));
  if (ip) ipCounter.reset(ip);
}
