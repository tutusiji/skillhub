import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../services/api';
import { useAuthStore } from '../authStore';
import { useUiStore } from '../uiStore';
import { useToastStore } from '../toastStore';
import { useFeedbackStore } from '../feedbackStore';
import { useRouterStore } from '../routerStore';
import {
  makeApiFeedback,
  makeApiUser,
  makeUser,
} from '../../test/factories';

// mock api 模块：展开真实模块方法名逐一替换为 vi.fn()，保留真实 mapper。
// 注意：vi.mock 工厂会被提升到文件顶部，不能引用文件内顶层 import 绑定（TDZ）。
vi.mock('../../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/api')>();
  const { createApiMock } = await import('../../test/helpers/mockApi');
  return { ...actual, api: createApiMock(actual.api) };
});

const profile = () => vi.mocked(api.profile);
const listUsers = () => vi.mocked(api.listUsers);
const listFeedback = () => vi.mocked(api.listFeedback);
const updateUserRole = () => vi.mocked(api.updateUserRole);
const updateMenuPermissions = () => vi.mocked(api.updateUserMenuPermissions);

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

/**
 * authStore 单测：会话回源（一次性守卫）、登录/登出（含受保护页回落）、
 * 积分/组织名单回源、超管角色/菜单权限的乐观更新与失败回滚。
 * 跨 store 联动（router/ui/toast/feedback）一并断言。
 */

beforeEach(() => {
  localStorage.clear();
  useAuthStore.setState({
    currentUser: null,
    authResolved: true,
    allUsers: [],
    _sessionRestoreStarted: false,
  });
  useUiStore.setState(RESET_UI);
  useToastStore.setState({ toasts: [] });
  useFeedbackStore.setState({ feedbackList: [] });
  useRouterStore.setState({ currentTab: 'market', previousTab: 'market' });
  window.history.replaceState({}, '', '/');
  vi.clearAllMocks();
});

describe('authStore.restoreSession', () => {
  it('无令牌时不发请求，立即就绪', async () => {
    await useAuthStore.getState().restoreSession();
    expect(profile()).not.toHaveBeenCalled();
    expect(useAuthStore.getState().authResolved).toBe(true);
    expect(useAuthStore.getState().currentUser).toBeNull();
  });

  it('有效令牌：回源 profile、拉建议列表；普通用户不拉组织名单', async () => {
    localStorage.setItem('skillhub_token', 'token-abc');
    const me = makeApiUser({ id: 'u1', role: 'user', points: 500 });
    profile().mockResolvedValue(me);
    listFeedback().mockResolvedValue([makeApiFeedback({ id: 'f1' })]);

    await useAuthStore.getState().restoreSession();

    expect(profile()).toHaveBeenCalledTimes(1);
    expect(listUsers()).not.toHaveBeenCalled();
    expect(useAuthStore.getState().authResolved).toBe(true);
    expect(useAuthStore.getState().currentUser?.id).toBe('u1');
    expect(useAuthStore.getState().currentUser?.points).toBe(500);
    expect(useFeedbackStore.getState().feedbackList.map((f) => f.id)).toEqual(['f1']);
  });

  it('管理员令牌：额外拉取组织成员名单', async () => {
    localStorage.setItem('skillhub_token', 'token-abc');
    profile().mockResolvedValue(makeApiUser({ id: 'u1', role: 'admin' }));
    listUsers().mockResolvedValue([makeApiUser({ id: 'u2', role: 'user' })]);

    await useAuthStore.getState().restoreSession();

    expect(listUsers()).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().allUsers).toHaveLength(1);
  });

  it('失效令牌：清 token、回访客态、不拉组织名单/建议', async () => {
    localStorage.setItem('skillhub_token', 'token-expired');
    profile().mockRejectedValue(new Error('401 Unauthorized'));

    await useAuthStore.getState().restoreSession();

    expect(localStorage.getItem('skillhub_token')).toBeNull();
    expect(useAuthStore.getState().currentUser).toBeNull();
    expect(listUsers()).not.toHaveBeenCalled();
    expect(listFeedback()).not.toHaveBeenCalled();
  });

  it('一次性守卫：重复调用只回源一次（StrictMode 双挂载去重）', async () => {
    localStorage.setItem('skillhub_token', 'token-abc');
    profile().mockResolvedValue(makeApiUser({ id: 'u1' }));

    await useAuthStore.getState().restoreSession();
    await useAuthStore.getState().restoreSession();

    expect(profile()).toHaveBeenCalledTimes(1);
  });
});

describe('authStore.handleLogin', () => {
  it('写入用户、关闭登录弹窗、弹成功 toast；管理员拉组织名单', async () => {
    listUsers().mockResolvedValue([makeApiUser({ id: 'u2' })]);
    listFeedback().mockResolvedValue([]);

    const admin = makeUser({ id: 'u1', role: 'admin', name: '管理员' });
    useAuthStore.getState().handleLogin(admin);

    expect(useAuthStore.getState().currentUser?.id).toBe('u1');
    expect(useUiStore.getState().showLoginModal).toBe(false);
    expect(useToastStore.getState().toasts[0]).toMatchObject({
      type: 'success',
      title: '登录成功',
    });
    await vi.waitFor(() => expect(listUsers()).toHaveBeenCalledTimes(1));
  });

  it('普通用户登录不拉组织名单', async () => {
    listFeedback().mockResolvedValue([]);
    useAuthStore.getState().handleLogin(makeUser({ id: 'u1', role: 'user' }));
    await vi.waitFor(() => expect(listFeedback()).toHaveBeenCalled());
    expect(listUsers()).not.toHaveBeenCalled();
  });
});

describe('authStore.handleLogout', () => {
  it('清用户与令牌；受保护页（审核）回落集市', () => {
    localStorage.setItem('skillhub_token', 'token');
    localStorage.setItem('skillhub_user', 'x');
    useAuthStore.setState({ currentUser: makeUser({ id: 'u1' }) });
    useRouterStore.setState({ currentTab: 'audit' });

    useAuthStore.getState().handleLogout();

    expect(useAuthStore.getState().currentUser).toBeNull();
    expect(localStorage.getItem('skillhub_token')).toBeNull();
    expect(localStorage.getItem('skillhub_user')).toBeNull();
    expect(useRouterStore.getState().currentTab).toBe('market');
    expect(useToastStore.getState().toasts[0].type).toBe('info');
  });

  it('公开页（集市）登出不跳转', () => {
    useAuthStore.setState({ currentUser: makeUser({ id: 'u1' }) });
    useRouterStore.setState({ currentTab: 'market' });
    const pushSpy = vi.spyOn(window.history, 'pushState');

    useAuthStore.getState().handleLogout();

    expect(useRouterStore.getState().currentTab).toBe('market');
    expect(pushSpy).not.toHaveBeenCalled();
  });
});

describe('authStore.refreshPointsFromServer', () => {
  it('普通用户：只回源 profile 更新积分', async () => {
    useAuthStore.setState({ currentUser: makeUser({ id: 'u1', role: 'user', points: 100 }) });
    profile().mockResolvedValue(makeApiUser({ id: 'u1', points: 300 }));

    await useAuthStore.getState().refreshPointsFromServer();

    expect(useAuthStore.getState().currentUser?.points).toBe(300);
    expect(listUsers()).not.toHaveBeenCalled();
  });

  it('管理员：同时刷新组织成员名单', async () => {
    useAuthStore.setState({ currentUser: makeUser({ id: 'u1', role: 'admin' }) });
    profile().mockResolvedValue(makeApiUser({ id: 'u1', points: 50 }));
    listUsers().mockResolvedValue([makeApiUser({ id: 'u2' })]);

    await useAuthStore.getState().refreshPointsFromServer();

    expect(listUsers()).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().allUsers).toHaveLength(1);
  });
});

describe('authStore.updateUserRole', () => {
  it('超管乐观更新角色，成功后按服务端结果回写 + toast', async () => {
    useAuthStore.setState({
      currentUser: makeUser({ id: 'me', role: 'super_admin' }),
      allUsers: [makeUser({ id: 'u1', role: 'user', name: '张三' })],
    });
    updateUserRole().mockResolvedValue(makeApiUser({ id: 'u1', role: 'admin', name: '张三' }));

    await useAuthStore.getState().updateUserRole('u1', 'admin');

    expect(useAuthStore.getState().allUsers[0].role).toBe('admin');
    expect(useToastStore.getState().toasts[0]).toMatchObject({
      type: 'success',
      title: '权限已更新',
    });
  });

  it('失败时回滚组织名单与被改用户', async () => {
    useAuthStore.setState({
      currentUser: makeUser({ id: 'me', role: 'super_admin' }),
      allUsers: [makeUser({ id: 'me', role: 'super_admin' }), makeUser({ id: 'u1', role: 'user' })],
    });
    updateUserRole().mockRejectedValue(new Error('网络错误'));

    await useAuthStore.getState().updateUserRole('u1', 'admin');

    expect(useAuthStore.getState().allUsers.find((u) => u.id === 'u1')?.role).toBe('user');
    expect(useToastStore.getState().toasts[0]).toMatchObject({
      type: 'error',
      title: '权限更新失败',
    });
  });

  it('非超管发起被拒并提示越权', async () => {
    useAuthStore.setState({ currentUser: makeUser({ id: 'u1', role: 'admin' }) });
    await useAuthStore.getState().updateUserRole('u2', 'admin');
    expect(useToastStore.getState().toasts[0]).toMatchObject({
      type: 'error',
      title: '越权操作',
    });
    expect(updateUserRole()).not.toHaveBeenCalled();
  });
});

describe('authStore.updateMenuPermissions', () => {
  it('超管乐观更新菜单权限，失败回滚', async () => {
    useAuthStore.setState({
      currentUser: makeUser({ id: 'me', role: 'super_admin' }),
      allUsers: [makeUser({ id: 'u1', role: 'admin', menuPermissions: ['audit'] })],
    });
    updateMenuPermissions().mockResolvedValue(
      makeApiUser({ id: 'u1', role: 'admin', menuPermissions: ['audit', 'rules'] }),
    );

    await useAuthStore.getState().updateMenuPermissions('u1', ['audit', 'rules']);

    expect(useAuthStore.getState().allUsers[0].menuPermissions).toEqual(['audit', 'rules']);
    expect(useToastStore.getState().toasts[0].type).toBe('success');
  });

  it('失败时回滚菜单权限', async () => {
    useAuthStore.setState({
      currentUser: makeUser({ id: 'me', role: 'super_admin' }),
      allUsers: [makeUser({ id: 'u1', role: 'admin', menuPermissions: ['audit'] })],
    });
    updateMenuPermissions().mockRejectedValue(new Error('失败'));

    await useAuthStore.getState().updateMenuPermissions('u1', ['rules']);

    expect(useAuthStore.getState().allUsers[0].menuPermissions).toEqual(['audit']);
    expect(useToastStore.getState().toasts[0].type).toBe('error');
  });
});

describe('authStore.refreshRoster', () => {
  it('普通用户不发起组织名单请求', async () => {
    useAuthStore.setState({ currentUser: makeUser({ id: 'u1', role: 'user' }) });
    await useAuthStore.getState().refreshRoster();
    expect(listUsers()).not.toHaveBeenCalled();
  });

  it('管理员刷新组织名单', async () => {
    useAuthStore.setState({ currentUser: makeUser({ id: 'u1', role: 'admin' }) });
    listUsers().mockResolvedValue([makeApiUser({ id: 'u2' })]);
    await useAuthStore.getState().refreshRoster();
    expect(listUsers()).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().allUsers).toHaveLength(1);
  });
});
