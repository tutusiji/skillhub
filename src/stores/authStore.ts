import { create } from 'zustand';
import type { UserAccount, UserRole } from '../types';
import { api, mapApiFeedback, mapApiUser } from '../services/api';
import { useRouterStore } from './routerStore';
import { useUiStore } from './uiStore';
import { useToastStore } from './toastStore';
import { useFeedbackStore } from './feedbackStore';

/**
 * 认证/用户 store。
 * 依赖 DAG：→ routerStore（登出受保护页回落）、uiStore（登录成功关闭登录弹窗）、
 * toastStore、feedbackStore（回源建议列表）。
 * 会话令牌 skillhub_token 由 api.ts / LoginModal 管理；本 store 只负责
 * 用户资料、角色/积分、组织成员名单的回源与变更（以后端为准，失败回滚）。
 */

/** 受保护页面：登出时必须回落到技能集市（与 App.tsx 原判定一致） */
const PROTECTED_TABS = ['audit', 'rules', 'settings', 'feedback', 'personal'] as const;

interface AuthState {
  currentUser: UserAccount | null;
  /** 会话是否已回源完毕。刷新时若有令牌需先异步调 /auth/me 恢复，
   *  在此之前 currentUser 恒为 null——若直接渲染依赖登录态的页面会先闪
   *  「请先登录/需要管理员权限」。无令牌时立即就绪。 */
  authResolved: boolean;
  /** 组织成员名单：仅超管的权限设置页需要，登录后由 /auth/users 拉取 */
  allUsers: UserAccount[];

  /**
   * @internal 会话回源一次性守卫（StrictMode 双挂载/重复调用去重）。
   * 放入 state 以便测试用 setState 重置；正常代码不读它。
   */
  _sessionRestoreStarted: boolean;

  setCurrentUser: (user: UserAccount | null) => void;
  setAuthResolved: (resolved: boolean) => void;
  setAllUsers: (users: UserAccount[]) => void;
  /** 启动时用持久化 JWT 恢复登录态（一次性）；失败清 token；管理员顺带拉组织名单与建议列表 */
  restoreSession: () => Promise<void>;
  /** 登录成功：写 currentUser、关登录弹窗、按角色拉组织名单 + 建议列表 */
  handleLogin: (user: UserAccount) => void;
  /** 登出：清本地会话，受保护 tab 回落到技能集市 */
  handleLogout: () => void;
  /** 需求相关操作会改动积分，操作后统一回源刷新余额与组织名单 */
  refreshPointsFromServer: () => Promise<void>;
  /** 超管调整某用户角色：乐观更新 + 失败回滚 */
  updateUserRole: (userId: string, newRole: UserRole) => Promise<void>;
  /** 超管调整某管理员菜单权限：乐观更新 + 失败回滚 */
  updateMenuPermissions: (userId: string, permissions: string[]) => Promise<void>;
  /** 打开权限设置页时按需刷新组织名单（仅管理员发起，普通用户不发必 403 的请求） */
  refreshRoster: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  // 无令牌时立即就绪（确定未登录，无需等待）；有令牌时等 restoreSession 回源
  currentUser: null,
  authResolved:
    typeof window !== 'undefined' && !window.localStorage.getItem('skillhub_token'),
  allUsers: [],
  _sessionRestoreStarted: false,

  setCurrentUser: (user) => set({ currentUser: user }),
  setAuthResolved: (resolved) => set({ authResolved: resolved }),
  setAllUsers: (users) => set({ allUsers: users }),

  restoreSession: async () => {
    if (get()._sessionRestoreStarted) return;
    set({ _sessionRestoreStarted: true });

    const token = window.localStorage.getItem('skillhub_token');
    if (!token) return; // authResolved 初始即 true（无令牌），无需等待

    // /auth/me 返回的最新角色：组织名单是否可拉取决于它，而非可能过期的 currentUser
    let profileRole: UserRole | null = null;
    try {
      const profile = await api.profile();
      profileRole = (profile.role as UserRole) ?? null;
      set((state) => ({
        currentUser: {
          ...mapApiUser(profile),
          avatar: profile.avatar || state.currentUser?.avatar || '',
          joinedAt: state.currentUser?.joinedAt || new Date().toISOString().split('T')[0],
          points: profile.points ?? state.currentUser?.points ?? 10000,
          title: state.currentUser?.title,
        },
      }));
    } catch {
      // 令牌失效（过期/被撤销）：清理掉，回到访客态，避免后续请求持续 401
      window.localStorage.removeItem('skillhub_token');
      window.localStorage.removeItem('skillhub_user');
      set({ authResolved: true });
      return; // 失效后不再拉组织名单/建议列表（与原实现一致）
    }
    set({ authResolved: true });

    // 组织成员名单（/auth/users）仅管理员可访问，且只有超管的权限设置页消费它
    if (profileRole === 'admin' || profileRole === 'super_admin') {
      try {
        const users = await api.listUsers();
        set({ allUsers: users.map(mapApiUser) });
      } catch {
        // 名单拉取失败不影响主流程
      }
    }
    // 登录态下同步拉取建议列表（建议管理页数据源）
    try {
      const feedback = await api.listFeedback();
      useFeedbackStore.getState().setFeedbackList(feedback.map(mapApiFeedback));
    } catch {
      // 建议列表拉取失败不影响主流程
    }
  },

  handleLogin: (user) => {
    set({ currentUser: user });
    useUiStore.getState().closeLoginModal();
    useToastStore
      .getState()
      .addToast('success', '登录成功', `欢迎回来，${user.name}！已为您开启全部操作权限`);

    // 组织成员名单仅管理员可访问（普通用户不拉，避免必然 403 的请求）
    if (user.role === 'admin' || user.role === 'super_admin') {
      api
        .listUsers()
        .then((users) => set({ allUsers: users.map(mapApiUser) }))
        .catch(() => {
          /* 名单拉取失败不阻塞登录 */
        });
    }
    // 登录后拉取建议列表（管理员看全部、普通用户看自己的）
    api
      .listFeedback()
      .then((feedback) =>
        useFeedbackStore.getState().setFeedbackList(feedback.map(mapApiFeedback)),
      )
      .catch(() => {
        /* 建议列表拉取失败不阻塞登录 */
      });
  },

  handleLogout: () => {
    set({ currentUser: null });
    window.localStorage.removeItem('skillhub_user');
    window.localStorage.removeItem('skillhub_token');
    const { currentTab, navigate } = useRouterStore.getState();
    if ((PROTECTED_TABS as readonly string[]).includes(currentTab)) {
      navigate('market');
    }
    useToastStore
      .getState()
      .addToast('info', '已退出登录', '当前处于访客模式，仍可自由下载和复制安装指令');
  },

  refreshPointsFromServer: async () => {
    const { currentUser } = get();
    const needsRoster =
      currentUser &&
      (currentUser.role === 'admin' || currentUser.role === 'super_admin');
    const results = await Promise.allSettled(
      needsRoster ? [api.profile(), api.listUsers()] : [api.profile()],
    );
    const profileResult = results[0];
    const usersResult = needsRoster ? results[1] : undefined;

    if (profileResult.status === 'fulfilled') {
      const fresh = profileResult.value;
      set((state) => ({
        currentUser: state.currentUser
          ? {
              ...state.currentUser,
              points: fresh.points ?? state.currentUser.points,
              role: (fresh.role as UserRole) ?? state.currentUser.role,
            }
          : state.currentUser,
      }));
    }
    if (usersResult && usersResult.status === 'fulfilled') {
      set({ allUsers: usersResult.value.map(mapApiUser) });
    }
  },

  updateUserRole: async (userId, newRole) => {
    const { currentUser, allUsers } = get();
    if (!currentUser || currentUser.role !== 'super_admin') {
      useToastStore
        .getState()
        .addToast('error', '越权操作', '仅超级管理员有权分配或调整管理员权限！');
      return;
    }

    const snapshot = allUsers;
    const previousRole = allUsers.find((u) => u.id === userId)?.role;

    // 乐观更新组织成员列表 + 当前登录用户（若正是被改的人）
    set((state) => ({
      allUsers: state.allUsers.map((u) => (u.id === userId ? { ...u, role: newRole } : u)),
      currentUser:
        state.currentUser && state.currentUser.id === userId
          ? { ...state.currentUser, role: newRole }
          : state.currentUser,
    }));

    // 持久化角色变更到后端，失败则回滚本地状态
    try {
      const updated = await api.updateUserRole(userId, newRole);
      const mapped = mapApiUser(updated);
      set((state) => ({
        allUsers: state.allUsers.map((u) =>
          u.id === userId ? { ...u, role: mapped.role } : u,
        ),
      }));
      useToastStore
        .getState()
        .addToast('success', '权限已更新', `${mapped.name} 的角色已变更为 ${newRole}`);
    } catch (error) {
      set({ allUsers: snapshot });
      if (currentUser.id === userId && previousRole) {
        set((state) => ({
          currentUser:
            state.currentUser ? { ...state.currentUser, role: previousRole } : state.currentUser,
        }));
      }
      useToastStore.getState().addToast('error', '权限更新失败', (error as Error).message);
    }
  },

  updateMenuPermissions: async (userId, permissions) => {
    const { currentUser, allUsers } = get();
    if (!currentUser || currentUser.role !== 'super_admin') {
      useToastStore
        .getState()
        .addToast('error', '越权操作', '仅超级管理员有权调整菜单权限！');
      return;
    }

    const snapshot = allUsers;

    // 乐观更新组织成员列表 + 当前登录用户
    set((state) => ({
      allUsers: state.allUsers.map((u) =>
        u.id === userId ? { ...u, menuPermissions: permissions } : u,
      ),
      currentUser:
        state.currentUser && state.currentUser.id === userId
          ? { ...state.currentUser, menuPermissions: permissions }
          : state.currentUser,
    }));

    try {
      const updated = await api.updateUserMenuPermissions(userId, permissions);
      const mapped = mapApiUser(updated);
      set((state) => ({
        allUsers: state.allUsers.map((u) =>
          u.id === userId ? { ...u, menuPermissions: mapped.menuPermissions } : u,
        ),
      }));
      useToastStore
        .getState()
        .addToast('success', '菜单权限已更新', `${mapped.name} 的菜单权限已保存`);
    } catch (error) {
      set({ allUsers: snapshot });
      useToastStore.getState().addToast('error', '菜单权限更新失败', (error as Error).message);
    }
  },

  refreshRoster: async () => {
    const { currentUser } = get();
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'super_admin')) {
      return; // 名单接口仅管理员可读，普通用户不发起
    }
    try {
      const users = await api.listUsers();
      set({ allUsers: users.map(mapApiUser) });
    } catch {
      /* 名单拉取失败不阻塞设置页 */
    }
  },
}));
