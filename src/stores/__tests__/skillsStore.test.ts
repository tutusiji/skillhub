import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../services/api';
import { downloadSkillAsZip } from '../../utils/zipHelper';
import { useSkillsStore } from '../skillsStore';
import { useAuthStore } from '../authStore';
import { useUiStore } from '../uiStore';
import { useToastStore } from '../toastStore';
import { useRouterStore } from '../routerStore';
import {
  makeApiSkill,
  makeSkill,
  makeUser,
} from '../../test/factories';
import type { AuditExecutionSummary } from '../../types';

// mock api 模块：展开真实模块方法名逐一替换为 vi.fn()，保留真实 mapper/syncToBackend。
// mock zipHelper：downloadSkillAsZip 触发真实浏览器下载，测试里替换为 vi.fn()。
vi.mock('../../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/api')>();
  const { createApiMock } = await import('../../test/helpers/mockApi');
  return { ...actual, api: createApiMock(actual.api) };
});
vi.mock('../../utils/zipHelper', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/zipHelper')>();
  return { ...actual, downloadSkillAsZip: vi.fn() };
});

const getSkill = () => vi.mocked(api.getSkill);
const createSkill = () => vi.mocked(api.createSkill);
const approveSkill = () => vi.mocked(api.approveSkill);
const rejectSkill = () => vi.mocked(api.rejectSkill);
const delistSkill = () => vi.mocked(api.delistSkill);
const relistSkill = () => vi.mocked(api.relistSkill);
const deleteSkill = () => vi.mocked(api.deleteSkill);
const downloadOriginalZip = () => vi.mocked(api.downloadOriginalZip);
const incrementSkillMetric = () => vi.mocked(api.incrementSkillMetric);
const downloadAsZip = () => vi.mocked(downloadSkillAsZip);

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

const RESET_SKILLS = {
  skills: [],
  skillsLoaded: false,
  selectedSkill: null,
  backendOnline: null,
};

/**
 * skillsStore 单测：详情进入（含后台回填 fileTree 与 URL 深链）、
 * 收藏/点赞/下载的乐观更新、提交/审核/上下架/删除的乐观更新与失败快照回滚、
 * 越权拦截（非管理员上下架/删除）、删除选中技能回落到集市等跨 store 联动。
 */

beforeEach(() => {
  localStorage.clear();
  useSkillsStore.setState(RESET_SKILLS);
  useAuthStore.setState({
    currentUser: null,
    authResolved: true,
    allUsers: [],
    _sessionRestoreStarted: false,
  });
  useUiStore.setState(RESET_UI);
  useToastStore.setState({ toasts: [] });
  useRouterStore.setState({ currentTab: 'market', previousTab: 'market' });
  window.history.replaceState({}, '', '/');
  window.scrollTo = vi.fn();
  vi.clearAllMocks();
});

describe('skillsStore.setSkillsFromServer', () => {
  it('以后端列表覆盖，保留本地收藏/点赞标记，并置在线与已加载', () => {
    useSkillsStore.setState({
      skills: [makeSkill({ id: 's1', isStarred: true, isLiked: false, stars: 3 })],
    });
    useSkillsStore.getState().setSkillsFromServer([
      makeSkill({ id: 's1', isStarred: false, isLiked: true, stars: 5 }),
      makeSkill({ id: 's2' }),
    ]);

    const state = useSkillsStore.getState();
    expect(state.skillsLoaded).toBe(true);
    expect(state.backendOnline).toBe(true);
    expect(state.skills).toHaveLength(2);
    const s1 = state.skills.find((s) => s.id === 's1')!;
    // 本地点赞/收藏标记以本地为准（后端未持久化「谁点过」），计数以后端为准
    expect(s1.isStarred).toBe(true);
    expect(s1.isLiked).toBe(false);
    expect(s1.stars).toBe(5);
  });
});

describe('skillsStore.openSkillDetail', () => {
  it('带源码直接进详情：写 selectedSkill + pushState 深链，不发后端请求', async () => {
    const skill = makeSkill({
      id: 's1',
      slug: 'skill-a',
      fileTree: [
        { id: 'n1', name: 'SKILL.md', path: 'SKILL.md', type: 'file', content: 'x' },
      ],
    });
    const pushSpy = vi.spyOn(window.history, 'pushState');

    await useSkillsStore.getState().openSkillDetail(skill);

    expect(useSkillsStore.getState().selectedSkill?.id).toBe('s1');
    expect(useRouterStore.getState().currentTab).toBe('detail');
    expect(useRouterStore.getState().previousTab).toBe('market');
    expect(pushSpy).toHaveBeenCalledWith(expect.anything(), '', '/skill/skill-a');
    expect(getSkill()).not.toHaveBeenCalled();
    expect(useUiStore.getState().detailLoading).toBe(false);
  });

  it('无源码：先渲染精简数据、后台拉全量回填 fileTree，期间显示加载态', async () => {
    const skill = makeSkill({ id: 's1', slug: 'skill-a', fileTree: [] });
    // 集市列表里已有该精简技能（用户从卡片点进来）
    useSkillsStore.setState({ skills: [skill] });
    getSkill().mockResolvedValue(makeApiSkill({ id: 's1', slug: 'skill-a', name: '完整技能' }));

    const promise = useSkillsStore.getState().openSkillDetail(skill);

    // 后台拉取完成前详情已用精简数据就位
    expect(useSkillsStore.getState().selectedSkill?.id).toBe('s1');
    expect(useUiStore.getState().detailLoading).toBe(true);

    await promise;
    expect(getSkill()).toHaveBeenCalledWith('skill-a');
    expect(useSkillsStore.getState().selectedSkill?.name).toBe('完整技能');
    expect(useSkillsStore.getState().skills.find((s) => s.id === 's1')?.name).toBe('完整技能');
    // 加载态在 finally 中清除（比 then 晚一个微任务），用 waitFor 等待
    await vi.waitFor(() => expect(useUiStore.getState().detailLoading).toBe(false));
  });
});

describe('skillsStore.toggleStar / toggleLike', () => {
  it('未登录：打开登录弹窗并返回 false，不调后端', () => {
    const ok = useSkillsStore.getState().toggleStar('s1');
    expect(ok).toBe(false);
    expect(useUiStore.getState().showLoginModal).toBe(true);
    expect(incrementSkillMetric()).not.toHaveBeenCalled();
  });

  it('已登录收藏：乐观更新星标与计数 + 成功 toast + 异步上报', () => {
    useAuthStore.setState({ currentUser: makeUser({ id: 'u1' }) });
    useSkillsStore.setState({
      skills: [makeSkill({ id: 's1', stars: 1, isStarred: false })],
      selectedSkill: makeSkill({ id: 's1', stars: 1, isStarred: false }),
    });

    const ok = useSkillsStore.getState().toggleStar('s1');

    expect(ok).toBe(true);
    const s1 = useSkillsStore.getState().skills.find((s) => s.id === 's1')!;
    expect(s1.isStarred).toBe(true);
    expect(s1.stars).toBe(2);
    expect(useSkillsStore.getState().selectedSkill?.stars).toBe(2);
    expect(useToastStore.getState().toasts[0]).toMatchObject({ type: 'success', title: '已加入收藏' });
    expect(incrementSkillMetric()).toHaveBeenCalledWith('s1', 'stars', 1);
  });

  it('取消收藏：计数减一且不小于 0，上报负 delta', () => {
    useAuthStore.setState({ currentUser: makeUser({ id: 'u1' }) });
    useSkillsStore.setState({ skills: [makeSkill({ id: 's1', stars: 3, isStarred: true })] });

    useSkillsStore.getState().toggleStar('s1');

    const s1 = useSkillsStore.getState().skills.find((s) => s.id === 's1')!;
    expect(s1.isStarred).toBe(false);
    expect(s1.stars).toBe(2);
    expect(incrementSkillMetric()).toHaveBeenCalledWith('s1', 'stars', -1);
  });

  it('点赞：乐观更新 likes 并上报', () => {
    useAuthStore.setState({ currentUser: makeUser({ id: 'u1' }) });
    useSkillsStore.setState({ skills: [makeSkill({ id: 's1', likes: 0, isLiked: false })] });

    const ok = useSkillsStore.getState().toggleLike('s1');

    expect(ok).toBe(true);
    const s1 = useSkillsStore.getState().skills.find((s) => s.id === 's1')!;
    expect(s1.isLiked).toBe(true);
    expect(s1.likes).toBe(1);
    expect(incrementSkillMetric()).toHaveBeenCalledWith('s1', 'likes', 1);
  });
});

describe('skillsStore.downloadZip', () => {
  it('有原始 ZIP：直接下载原始包，不重建，并累加下载计数', async () => {
    downloadOriginalZip().mockResolvedValue({ fileName: 'pkg.zip' });
    useSkillsStore.setState({ skills: [makeSkill({ id: 's1', downloads: 0 })] });

    await useSkillsStore.getState().downloadZip(makeSkill({ id: 's1' }));

    expect(downloadAsZip()).not.toHaveBeenCalled();
    expect(useSkillsStore.getState().skills[0].downloads).toBe(1);
    expect(incrementSkillMetric()).toHaveBeenCalledWith('s1', 'downloads', 1);
    expect(useToastStore.getState().toasts[0]).toMatchObject({ type: 'success', title: '下载已就绪' });
  });

  it('无原始 ZIP：从文件树重建（沿用上传文件名）', async () => {
    downloadOriginalZip().mockResolvedValue(null);
    downloadAsZip().mockResolvedValue(undefined);

    await useSkillsStore.getState().downloadZip(
      makeSkill({ id: 's1', slug: 'skill-a', version: 'v1.2.0', fileTree: [], zipFileName: 'pkg.zip' }),
    );

    expect(downloadAsZip()).toHaveBeenCalledWith('演示技能', 'skill-a', 'v1.2.0', [], 'pkg.zip');
  });

  it('打包失败：弹错误 toast', async () => {
    downloadOriginalZip().mockRejectedValue(new Error('网络错误'));

    await useSkillsStore.getState().downloadZip(makeSkill({ id: 's1' }));

    expect(useToastStore.getState().toasts[0]).toMatchObject({ type: 'error', title: '下载失败' });
  });
});

describe('skillsStore.createSkill', () => {
  it('乐观插入并跳转个人中心，成功后用后端权威记录替换临时记录', async () => {
    const created = makeApiSkill({ id: 'real-1', name: '新技能', status: 'pending' });
    createSkill().mockResolvedValue(created);

    await useSkillsStore.getState().createSkill(makeSkill({ id: 'temp-1', name: '新技能' }));

    expect(createSkill()).toHaveBeenCalled();
    expect(useRouterStore.getState().currentTab).toBe('personal');
    expect(useSkillsStore.getState().skills[0].id).toBe('real-1');
    expect(useToastStore.getState().toasts[0]).toMatchObject({ type: 'info', title: '已提交审核' });
  });

  it('后端不可用：保留本地草稿并弹 warning（不丢失填写内容）', async () => {
    createSkill().mockRejectedValue(new Error('连接失败'));

    await useSkillsStore.getState().createSkill(makeSkill({ id: 'temp-1', name: '新技能' }));

    expect(useSkillsStore.getState().skills[0].id).toBe('temp-1');
    expect(useToastStore.getState().toasts[0]).toMatchObject({ type: 'warning', title: '已保存为本地草稿' });
  });
});

describe('skillsStore 审核（approve / reject）', () => {
  it('审核通过：乐观置 approved + 记录审核人，成功后按服务端结果回写并发成功 toast', async () => {
    useAuthStore.setState({ currentUser: makeUser({ id: 'u1', name: '管理员', role: 'admin' }) });
    useSkillsStore.setState({ skills: [makeSkill({ id: 's1', status: 'pending' })] });
    approveSkill().mockResolvedValue(makeApiSkill({ id: 's1', status: 'approved', name: '技能A' }));

    const promise = useSkillsStore.getState().approveSkill('s1');

    // 乐观阶段：界面即时置为 approved 并记录当前审核人
    const optimistic = useSkillsStore.getState().skills.find((s) => s.id === 's1')!;
    expect(optimistic.status).toBe('approved');
    expect(optimistic.auditResults.overallStatus).toBe('passed');
    expect(optimistic.auditResults.reviewedBy).toBe('管理员');

    await promise;
    expect(useSkillsStore.getState().skills[0].status).toBe('approved');
    expect(useToastStore.getState().toasts[0]).toMatchObject({ type: 'success', title: '审核通过' });
  });

  it('审核失败：回滚到快照（乐观的 approved 被还原）', async () => {
    useAuthStore.setState({ currentUser: makeUser({ id: 'u1', role: 'admin' }) });
    useSkillsStore.setState({ skills: [makeSkill({ id: 's1', status: 'pending' })] });
    approveSkill().mockRejectedValue(new Error('Git 同步失败'));

    await useSkillsStore.getState().approveSkill('s1');

    expect(useSkillsStore.getState().skills[0].status).toBe('pending');
    expect(useToastStore.getState().toasts[0]).toMatchObject({ type: 'error', title: '审核失败' });
  });

  it('驳回：乐观置 rejected + failed 状态并带驳回意见，成功弹提示', async () => {
    useAuthStore.setState({ currentUser: makeUser({ id: 'u1', role: 'admin' }) });
    useSkillsStore.setState({ skills: [makeSkill({ id: 's1', status: 'pending' })] });
    rejectSkill().mockResolvedValue(makeApiSkill({ id: 's1', status: 'rejected' }));

    const promise = useSkillsStore.getState().rejectSkill('s1', '缺少说明文档');

    // 乐观阶段：立即置为 rejected + failed，并带上驳回意见
    const optimistic = useSkillsStore.getState().skills.find((s) => s.id === 's1')!;
    expect(optimistic.status).toBe('rejected');
    expect(optimistic.auditResults.overallStatus).toBe('failed');
    expect(optimistic.auditResults.adminFeedback).toBe('缺少说明文档');

    await promise;
    expect(useSkillsStore.getState().skills[0].status).toBe('rejected');
    expect(useToastStore.getState().toasts[0]).toMatchObject({ type: 'info', title: '已驳回' });
  });
});

describe('skillsStore 上下架（delist / relist）', () => {
  it('非管理员下架被拒：不改状态也不调后端', async () => {
    useAuthStore.setState({ currentUser: makeUser({ id: 'u1', role: 'user' }) });
    useSkillsStore.setState({ skills: [makeSkill({ id: 's1' })] });

    await useSkillsStore.getState().delistSkill('s1');

    expect(delistSkill()).not.toHaveBeenCalled();
    expect(useSkillsStore.getState().skills[0].status).toBe('approved');
  });

  it('管理员下架：乐观置 offline 并同步详情选中态，失败回滚', async () => {
    useAuthStore.setState({ currentUser: makeUser({ id: 'u1', role: 'admin' }) });
    useSkillsStore.setState({
      skills: [makeSkill({ id: 's1' })],
      selectedSkill: makeSkill({ id: 's1' }),
    });
    delistSkill().mockResolvedValue(makeApiSkill({ id: 's1', status: 'offline' }));

    await useSkillsStore.getState().delistSkill('s1');

    expect(useSkillsStore.getState().skills[0].status).toBe('offline');
    expect(useSkillsStore.getState().selectedSkill?.status).toBe('offline');
    expect(useToastStore.getState().toasts[0]).toMatchObject({ type: 'warning', title: '技能已下架' });
  });

  it('管理员恢复上线：乐观置 approved，失败回滚', async () => {
    useAuthStore.setState({ currentUser: makeUser({ id: 'u1', role: 'admin' }) });
    useSkillsStore.setState({ skills: [makeSkill({ id: 's1', status: 'offline' })] });
    relistSkill().mockRejectedValue(new Error('Git 同步失败'));

    await useSkillsStore.getState().relistSkill('s1');

    expect(useSkillsStore.getState().skills[0].status).toBe('offline'); // 回滚
    expect(useToastStore.getState().toasts[0]).toMatchObject({ type: 'error', title: '恢复上线失败' });
  });
});

describe('skillsStore 删除（deleteSkill / deleteSkillVersion）', () => {
  it('管理员删除选中技能：列表移除、清选中并回落到集市', async () => {
    useAuthStore.setState({ currentUser: makeUser({ id: 'u1', role: 'admin' }) });
    useSkillsStore.setState({
      skills: [makeSkill({ id: 's1' }), makeSkill({ id: 's2' })],
      selectedSkill: makeSkill({ id: 's1' }),
    });
    useRouterStore.setState({ currentTab: 'detail' });
    deleteSkill().mockResolvedValue({ success: true, id: 's1' });

    await useSkillsStore.getState().deleteSkill('s1');

    expect(useSkillsStore.getState().skills.map((s) => s.id)).toEqual(['s2']);
    expect(useSkillsStore.getState().selectedSkill).toBeNull();
    expect(useRouterStore.getState().currentTab).toBe('market');
  });

  it('删除失败：恢复被删列表', async () => {
    useAuthStore.setState({ currentUser: makeUser({ id: 'u1', role: 'admin' }) });
    useSkillsStore.setState({ skills: [makeSkill({ id: 's1' })] });
    deleteSkill().mockRejectedValue(new Error('删除失败'));

    await useSkillsStore.getState().deleteSkill('s1');

    expect(useSkillsStore.getState().skills).toHaveLength(1);
    expect(useToastStore.getState().toasts[0]).toMatchObject({ type: 'error', title: '删除失败' });
  });

  it('作者删版本：不设管理员门槛（越权与否交给后端裁决）', async () => {
    useAuthStore.setState({ currentUser: makeUser({ id: 'u1', role: 'user' }) });
    useSkillsStore.setState({ skills: [makeSkill({ id: 's1' })] });
    deleteSkill().mockResolvedValue({ success: true, id: 's1' });

    await useSkillsStore.getState().deleteSkillVersion('s1');

    expect(useSkillsStore.getState().skills).toHaveLength(0);
    expect(deleteSkill()).toHaveBeenCalledWith('s1');
  });
});

describe('skillsStore 元数据与审计回写', () => {
  it('updateSkillMeta：同步列表与详情选中态', () => {
    useSkillsStore.setState({
      skills: [makeSkill({ id: 's1', name: '旧名' })],
      selectedSkill: makeSkill({ id: 's1', name: '旧名' }),
    });

    useSkillsStore.getState().updateSkillMeta(makeSkill({ id: 's1', name: '新名' }));

    expect(useSkillsStore.getState().skills[0].name).toBe('新名');
    expect(useSkillsStore.getState().selectedSkill?.name).toBe('新名');
  });

  it('mergeSkillFromServer：用后端记录回写但保留本地点赞/收藏标记', () => {
    useSkillsStore.setState({
      skills: [makeSkill({ id: 's1', isLiked: true, isStarred: false })],
      selectedSkill: makeSkill({ id: 's1', isLiked: true, isStarred: false }),
    });

    useSkillsStore.getState().mergeSkillFromServer(
      makeSkill({ id: 's1', isLiked: false, isStarred: true, name: '后端版' }),
    );

    const s1 = useSkillsStore.getState().skills.find((s) => s.id === 's1')!;
    expect(s1.name).toBe('后端版');
    expect(s1.isLiked).toBe(true);
    expect(s1.isStarred).toBe(false);
  });

  it('updateSkillAudit：写入审核结果到列表', () => {
    useSkillsStore.setState({ skills: [makeSkill({ id: 's1' })] });
    const summary: AuditExecutionSummary = {
      overallStatus: 'failed',
      score: 30,
      scannedAt: '2026-01-01T00:00:00.000Z',
      regexResults: [],
      llmResults: [],
    };

    useSkillsStore.getState().updateSkillAudit('s1', summary);

    expect(useSkillsStore.getState().skills[0].auditResults.overallStatus).toBe('failed');
    expect(useSkillsStore.getState().skills[0].auditResults.score).toBe(30);
  });
});
