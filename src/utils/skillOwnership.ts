import { SkillItem, UserAccount } from '../types';

/**
 * 判断一个技能是否为指定用户提交的
 *
 * 优先用后端写入的 submitterId（来自登录会话，不可伪造、不受重名影响）；
 * 历史数据没有该字段时回落到作者姓名比对，保证老技能在个人中心仍可见。
 * @param skill 待判定技能
 * @param user 当前登录用户
 */
export function isOwnSubmission(
  skill: Pick<SkillItem, 'submitterId' | 'author'>,
  user: Pick<UserAccount, 'id' | 'name'> | null
): boolean {
  if (!user) return false;
  if (skill.submitterId) return skill.submitterId === user.id;
  return skill.author.name === user.name;
}
