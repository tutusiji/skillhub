import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../services/api';
import { useDemandsStore, type CreateDemandInput } from '../demandsStore';
import { useAuthStore } from '../authStore';
import { useUiStore } from '../uiStore';
import { useToastStore } from '../toastStore';
import { useSkillsStore } from '../skillsStore';
import { makeApiDemand, makeDemand, makeSkill, makeUser } from '../../test/factories';

// mock api 模块：展开真实模块方法名逐一替换为 vi.fn()，保留真实 mapper。
vi.mock('../../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/api')>();
  const { createApiMock } = await import('../../test/helpers/mockApi');
  return { ...actual, api: createApiMock(actual.api) };
});

// 捕获 authStore 真实积分回源 action，用于测试内替换为 spy 后恢复
const realRefreshPoints = useAuthStore.getState().refreshPointsFromServer;

const createDemand = () => vi.mocked(api.createDemand);
const approveDemand = () => vi.mocked(api.approveDemand);
const rejectDemand = () => vi.mocked(api.rejectDemand);
const deleteDemand = () => vi.mocked(api.deleteDemand);
const submitDemandCandidate = () => vi.mocked(api.submitDemandCandidate);
const acceptDemandCandidate = () => vi.mocked(api.acceptDemandCandidate);

const RESET_UI = {
  showUploadModal: false,
  showCreateDemandModal: false,
  showFeedbackModal: false,
  newVersionContext: null,
  editingSkill: null,
  showCommandPalette: false,
  showLoginModal: false,
  loginActionHint: undefined,
  detailLoading: false,
};

/** 新需求输入：从工厂样本剥离后端生成的字段 */
function makeCreateDemandInput(): CreateDemandInput {
  const { id, createdAt, updatedAt, submissionsCount, ...rest } = makeDemand();
  void id;
  void createdAt;
  void updatedAt;
  void submissionsCount;
  return rest;
}

/**
 * demandsStore 单测：需求发布/审核/驳回/删除/投稿/验收。
 * 断言跨 store 联动：积分回源（authStore.refreshPointsFromServer 被调用）、
 * 越权拦截（非管理员/非作者）、未登录投稿弹登录窗、详情弹窗选中态随后端回写同步。
 */

beforeEach(() => {
  localStorage.clear();
  useDemandsStore.setState({ demands: [], selectedDemand: null });
  useAuthStore.setState({
    currentUser: null,
    authResolved: true,
    allUsers: [],
    _sessionRestoreStarted: false,
    refreshPointsFromServer: realRefreshPoints,
  });
  useUiStore.setState(RESET_UI);
  useToastStore.setState({ toasts: [] });
  useSkillsStore.setState({ skills: [] });
  vi.clearAllMocks();
});

describe('demandsStore.createDemand', () => {
  it('未登录不发起请求', async () => {
    await useDemandsStore.getState().createDemand(makeCreateDemandInput());
    expect(createDemand()).not.toHaveBeenCalled();
  });

  it('发布成功：前置插入需求、回源积分并弹提示', async () => {
    useAuthStore.setState({ currentUser: makeUser({ id: 'u1', role: 'user' }) });
    const refreshSpy = vi.fn().mockResolvedValue(undefined);
    useAuthStore.setState({ refreshPointsFromServer: refreshSpy });
    createDemand().mockResolvedValue(makeApiDemand({ id: 'd1', title: '做 SQL 助手' }));

    await useDemandsStore.getState().createDemand(makeCreateDemandInput());

    expect(createDemand()).toHaveBeenCalledTimes(1);
    expect(useDemandsStore.getState().demands[0].id).toBe('d1');
    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(useToastStore.getState().toasts[0]).toMatchObject({
      type: 'success',
      title: '需求已提交审核',
    });
  });

  it('发布失败：弹错误 toast 且列表不变', async () => {
    useAuthStore.setState({ currentUser: makeUser({ id: 'u1' }) });
    createDemand().mockRejectedValue(new Error('余额不足'));

    await useDemandsStore.getState().createDemand(makeCreateDemandInput());

    expect(useDemandsStore.getState().demands).toHaveLength(0);
    expect(useToastStore.getState().toasts[0]).toMatchObject({
      type: 'error',
      title: '需求发布失败',
    });
  });
});

describe('demandsStore.approveDemand', () => {
  it('非管理员被拒并提示越权', async () => {
    useAuthStore.setState({ currentUser: makeUser({ id: 'u1', role: 'user' }) });

    await useDemandsStore.getState().approveDemand('d1');

    expect(approveDemand()).not.toHaveBeenCalled();
    expect(useToastStore.getState().toasts[0]).toMatchObject({
      type: 'warning',
      title: '权限不足',
    });
  });

  it('管理员通过：以后端结果回写列表与详情弹窗选中态', async () => {
    useAuthStore.setState({ currentUser: makeUser({ id: 'u1', role: 'admin' }) });
    useDemandsStore.setState({
      demands: [makeDemand({ id: 'd1', status: 'pending' })],
      selectedDemand: makeDemand({ id: 'd1', status: 'pending' }),
    });
    approveDemand().mockResolvedValue(makeApiDemand({ id: 'd1', status: 'approved' }));

    await useDemandsStore.getState().approveDemand('d1');

    expect(useDemandsStore.getState().demands[0].status).toBe('approved');
    expect(useDemandsStore.getState().selectedDemand?.status).toBe('approved');
    expect(useToastStore.getState().toasts[0]).toMatchObject({
      type: 'success',
      title: '需求审核通过',
    });
  });
});

describe('demandsStore.rejectDemand', () => {
  it('驳回成功：回写状态并回源积分', async () => {
    useAuthStore.setState({ currentUser: makeUser({ id: 'u1', role: 'admin' }) });
    const refreshSpy = vi.fn().mockResolvedValue(undefined);
    useAuthStore.setState({ refreshPointsFromServer: refreshSpy });
    useDemandsStore.setState({ demands: [makeDemand({ id: 'd1', status: 'pending' })] });
    rejectDemand().mockResolvedValue(makeApiDemand({ id: 'd1', status: 'rejected' }));

    await useDemandsStore.getState().rejectDemand('d1', '重复需求');

    expect(useDemandsStore.getState().demands[0].status).toBe('rejected');
    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(useToastStore.getState().toasts[0]).toMatchObject({
      type: 'info',
      title: '需求已驳回并退还积分',
    });
  });
});

describe('demandsStore.deleteDemand', () => {
  it('非作者且非管理员被拒', async () => {
    useAuthStore.setState({ currentUser: makeUser({ id: 'other', role: 'user' }) });
    useDemandsStore.setState({ demands: [makeDemand({ id: 'd1' })] });

    await useDemandsStore.getState().deleteDemand('d1');

    expect(deleteDemand()).not.toHaveBeenCalled();
    expect(useToastStore.getState().toasts[0]).toMatchObject({ type: 'warning' });
  });

  it('作者删除：移除需求、清详情弹窗选中态并回源积分', async () => {
    // 工厂样本默认 author.id === 'user-2'，直接用其作为当前登录用户（作者本人）
    useAuthStore.setState({ currentUser: makeUser({ id: 'user-2', role: 'user' }) });
    useDemandsStore.setState({
      demands: [makeDemand({ id: 'd1' })],
      selectedDemand: makeDemand({ id: 'd1' }),
    });
    const refreshSpy = vi.fn().mockResolvedValue(undefined);
    useAuthStore.setState({ refreshPointsFromServer: refreshSpy });
    deleteDemand().mockResolvedValue({ success: true, id: 'd1', refunded: 0 });

    await useDemandsStore.getState().deleteDemand('d1');

    expect(useDemandsStore.getState().demands).toHaveLength(0);
    expect(useDemandsStore.getState().selectedDemand).toBeNull();
    expect(refreshSpy).toHaveBeenCalledTimes(1);
  });
});

describe('demandsStore.submitSolution', () => {
  it('未登录：打开登录窗提示先登录，不提交', async () => {
    await useDemandsStore.getState().submitSolution('d1', '方案说明', 's1');
    expect(submitDemandCandidate()).not.toHaveBeenCalled();
    expect(useUiStore.getState().showLoginModal).toBe(true);
  });

  it('已登录投稿：附带技能名提交，成功后回写需求', async () => {
    useAuthStore.setState({ currentUser: makeUser({ id: 'u1' }) });
    useSkillsStore.setState({ skills: [makeSkill({ id: 's1', name: 'SQL 助手' })] });
    useDemandsStore.setState({ demands: [makeDemand({ id: 'd1' })] });
    submitDemandCandidate().mockResolvedValue(
      makeApiDemand({
        id: 'd1',
        candidates: [
          { id: 'c1', skillId: 's1', skillName: 'SQL 助手', submitterId: 'u1', submitterName: '李', submitterAvatar: '', submittedAt: '2026-01-01', notes: '用 SQL 助手投稿', status: 'pending' },
        ],
      }),
    );

    await useDemandsStore.getState().submitSolution('d1', '用 SQL 助手投稿', 's1');

    expect(submitDemandCandidate()).toHaveBeenCalledWith('d1', {
      notes: '用 SQL 助手投稿',
      skillId: 's1',
      skillName: 'SQL 助手',
    });
    expect(useDemandsStore.getState().demands[0].candidates).toHaveLength(1);
    expect(useToastStore.getState().toasts[0]).toMatchObject({
      type: 'success',
      title: '方案提交成功',
    });
  });
});

describe('demandsStore.acceptCandidate', () => {
  it('验收成功：回写需求、回源积分并提示积分发放给中选者', async () => {
    useAuthStore.setState({ currentUser: makeUser({ id: 'u1', role: 'user' }) });
    const refreshSpy = vi.fn().mockResolvedValue(undefined);
    useAuthStore.setState({ refreshPointsFromServer: refreshSpy });
    useDemandsStore.setState({ demands: [makeDemand({ id: 'd1' })] });
    acceptDemandCandidate().mockResolvedValue(
      makeApiDemand({
        id: 'd1',
        status: 'accepted',
        candidates: [
          { id: 'c1', skillName: '', submitterId: 'u9', submitterName: '王测试', submitterAvatar: '', submittedAt: '2026-01-01', notes: 'x', status: 'pending' },
        ],
      }),
    );

    await useDemandsStore.getState().acceptCandidate('d1', 'c1');

    expect(acceptDemandCandidate()).toHaveBeenCalledWith('d1', 'c1');
    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(useDemandsStore.getState().demands[0].status).toBe('accepted');
    const toast = useToastStore.getState().toasts[0];
    expect(toast.title).toBe('方案验收完成');
    expect(toast.message).toContain('王测试');
  });
});
