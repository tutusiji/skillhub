import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../services/api';
import { fetchMarketData, shuffleAvatar } from '../coordinator';
import { useAuthStore } from '../authStore';
import { useSkillsStore } from '../skillsStore';
import { useDemandsStore } from '../demandsStore';
import { useRulesStore } from '../rulesStore';
import { useToastStore } from '../toastStore';
import {
  makeApiAuditRule,
  makeApiDemand,
  makeApiSkill,
  makeApiUser,
  makeDemand,
  makeSkill,
  makeUser,
} from '../../test/factories';

// mock api 模块：展开真实模块方法名逐一替换为 vi.fn()，保留真实 mapper。
vi.mock('../../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/api')>();
  const { createApiMock } = await import('../../test/helpers/mockApi');
  return { ...actual, api: createApiMock(actual.api) };
});

const listSkills = () => vi.mocked(api.listSkills);
const listAuditRules = () => vi.mocked(api.listAuditRules);
const listDemands = () => vi.mocked(api.listDemands);
const shuffleMyAvatar = () => vi.mocked(api.shuffleMyAvatar);

/**
 * coordinator 单测：组合拉取（三表 allSettled + 离线三态）与跨表头像联动。
 * coordinator 只经各 store getState/setState 编排，不引入 store 间循环依赖。
 */

beforeEach(() => {
  localStorage.clear();
  useAuthStore.setState({
    currentUser: null,
    authResolved: true,
    allUsers: [],
    _sessionRestoreStarted: false,
  });
  useSkillsStore.setState({ skills: [], skillsLoaded: false, backendOnline: null });
  useDemandsStore.setState({ demands: [], selectedDemand: null });
  useRulesStore.setState({ rules: [], deepseekConfig: useRulesStore.getState().deepseekConfig });
  useToastStore.setState({ toasts: [] });
  vi.clearAllMocks();
});

describe('coordinator.fetchMarketData', () => {
  it('三表都成功：各自 store 落库并标记在线', async () => {
    listSkills().mockResolvedValue([makeApiSkill({ id: 's1' })]);
    listAuditRules().mockResolvedValue([makeApiAuditRule({ id: 'r1' })]);
    listDemands().mockResolvedValue([makeApiDemand({ id: 'd1' })]);

    const ok = await fetchMarketData();

    expect(ok).toBe(true);
    expect(useSkillsStore.getState().skills[0].id).toBe('s1');
    expect(useRulesStore.getState().rules[0].id).toBe('r1');
    expect(useDemandsStore.getState().demands[0].id).toBe('d1');
    expect(useSkillsStore.getState().backendOnline).toBe(true);
    expect(useSkillsStore.getState().skillsLoaded).toBe(true);
  });

  it('三表全挂：离线态 + 标记已加载（集市不再停骨架屏）', async () => {
    listSkills().mockRejectedValue(new Error('conn refused'));
    listAuditRules().mockRejectedValue(new Error('conn refused'));
    listDemands().mockRejectedValue(new Error('conn refused'));

    const ok = await fetchMarketData();

    expect(ok).toBe(false);
    expect(useSkillsStore.getState().backendOnline).toBe(false);
    expect(useSkillsStore.getState().skillsLoaded).toBe(true);
  });

  it('部分失败：技能成功即算在线，不影响已拉到的表', async () => {
    listSkills().mockResolvedValue([makeApiSkill({ id: 's1' })]);
    listAuditRules().mockRejectedValue(new Error('rules 挂了'));
    listDemands().mockRejectedValue(new Error('demands 挂了'));

    const ok = await fetchMarketData();

    expect(ok).toBe(true);
    expect(useSkillsStore.getState().skills).toHaveLength(1);
    // 失败分支不触发：backendOnline 仍由 setSkillsFromServer 置为 true
    expect(useSkillsStore.getState().backendOnline).toBe(true);
  });

  it('技能列表刷新保留本地收藏/点赞标记', async () => {
    useSkillsStore.setState({
      skills: [makeSkill({ id: 's1', isStarred: true, isLiked: true })],
    });
    // 后端新快照本身不带 isStarred/isLiked（这两个字段是本地交互态）
    listSkills().mockResolvedValue([makeApiSkill({ id: 's1' })]);
    listAuditRules().mockResolvedValue([]);
    listDemands().mockResolvedValue([]);

    await fetchMarketData();

    const skill = useSkillsStore.getState().skills[0];
    expect(skill.isStarred).toBe(true);
    expect(skill.isLiked).toBe(true);
  });
});

describe('coordinator.shuffleAvatar', () => {
  it('未登录直接返回，不发请求', async () => {
    await shuffleAvatar();
    expect(shuffleMyAvatar()).not.toHaveBeenCalled();
  });

  it('已登录：跨 auth/skills/demands 三表铺新头像并提示', async () => {
    const nextAvatar = 'https://api.dicebear.com/10.x/adventurer/svg?seed=new-face';
    useAuthStore.setState({
      currentUser: makeUser({ id: 'user-1', avatar: 'old-face' }),
      allUsers: [makeUser({ id: 'user-1', avatar: 'old-face' }), makeUser({ id: 'u9', avatar: 'keep' })],
    });
    useSkillsStore.setState({
      skills: [
        makeSkill({ id: 's1', submitterId: 'user-1' }), // 本人的技能 → 头像应更新
        makeSkill({ id: 's2', submitterId: 'someone-else' }), // 他人技能 → 不动
      ],
    });
    useDemandsStore.setState({ demands: [makeDemand({ id: 'd1', author: { id: 'user-1', name: '王', avatar: 'old-face', department: '技术研发中心' } })] });
    shuffleMyAvatar().mockResolvedValue(makeApiUser({ id: 'user-1', avatar: nextAvatar }));

    await shuffleAvatar();

    expect(useAuthStore.getState().currentUser?.avatar).toBe(nextAvatar);
    const allUsers = useAuthStore.getState().allUsers;
    expect(allUsers.find((u) => u.id === 'user-1')?.avatar).toBe(nextAvatar);
    expect(allUsers.find((u) => u.id === 'u9')?.avatar).toBe('keep');
    expect(useSkillsStore.getState().skills.find((s) => s.id === 's1')?.author.avatar).toBe(nextAvatar);
    expect(useSkillsStore.getState().skills.find((s) => s.id === 's2')?.author.avatar).not.toBe(nextAvatar);
    expect(useDemandsStore.getState().demands[0].author.avatar).toBe(nextAvatar);
    expect(useToastStore.getState().toasts[0]).toMatchObject({
      type: 'success',
      title: '头像已更新',
    });
  });
});
