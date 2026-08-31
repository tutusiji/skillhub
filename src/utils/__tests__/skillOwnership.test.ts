import { describe, expect, it } from 'vitest';
import { isOwnSubmission } from '../skillOwnership';
import { makeSkill, makeUser } from '../../test/factories';

/**
 * 「我的提交」判定单测：
 * - submitterId 优先（后端从登录会话写入，不受重名影响）
 * - 历史数据无 submitterId 时回落到作者姓名比对
 * - 未登录恒为 false
 */

describe('isOwnSubmission', () => {
  it('有 submitterId 时按用户 id 判定', () => {
    const skill = makeSkill({ submitterId: 'user-9' });
    expect(isOwnSubmission(skill, makeUser({ id: 'user-9' }))).toBe(true);
    expect(isOwnSubmission(skill, makeUser({ id: 'other-user' }))).toBe(false);
  });

  it('无 submitterId 时按作者姓名兜底（重名可接受的历史行为）', () => {
    const skill = makeSkill({ submitterId: undefined, author: { ...makeSkill().author, name: '张测试' } });
    expect(isOwnSubmission(skill, makeUser({ name: '张测试' }))).toBe(true);
    expect(isOwnSubmission(skill, makeUser({ name: '李四' }))).toBe(false);
  });

  it('未登录返回 false', () => {
    expect(isOwnSubmission(makeSkill(), null)).toBe(false);
  });
});
