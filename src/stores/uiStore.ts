import { create } from 'zustand';
import type { SkillItem } from '../types';

/**
 * UI 层全局状态 store：所有全局弹窗的可见性/上下文 + 详情页直达加载态。
 * 依赖 DAG 中无上游依赖。
 *
 * 弹窗状态被提升到全局（而非下沉到各视图）的原因：
 * 所有 Modal 都由 App 顶层渲染（见 App.tsx 底部 MODALS 区），
 * 状态必须对全局渲染器可见，视图只通过 open/close action 打开它们。
 */
interface NewVersionContext {
  parentSkillId: string;
  parentSkillName: string;
}

interface UiState {
  showUploadModal: boolean;
  showCreateDemandModal: boolean;
  showFeedbackModal: boolean;
  /** 多版本发布：父版本上下文（个人中心「发布新版本」按钮触发） */
  newVersionContext: NewVersionContext | null;
  /** 元数据编辑弹窗上下文（正被编辑的技能） */
  editingSkill: SkillItem | null;
  showCommandPalette: boolean;
  showLoginModal: boolean;
  /** 登录弹窗的引导文案（如「发布技能征集」），Header 主动打开时清空 */
  loginActionHint: string | undefined;
  /** 详情页直达加载态：刷新访问 /skill/:slug 时技能不在本地，需从后端异步拉取 */
  detailLoading: boolean;

  openUploadModal: () => void;
  closeUploadModal: () => void;
  openCreateDemandModal: () => void;
  closeCreateDemandModal: () => void;
  openFeedbackModal: () => void;
  closeFeedbackModal: () => void;
  setNewVersionContext: (ctx: NewVersionContext | null) => void;
  setEditingSkill: (skill: SkillItem | null) => void;
  openCommandPalette: () => void;
  toggleCommandPalette: () => void;
  closeCommandPalette: () => void;
  /** 打开登录弹窗并写入引导文案；不传 / undefined 时清除文案 */
  openLoginModal: (actionHint?: string) => void;
  /** 关闭登录弹窗（保留引导文案，等待下次 openLoginModal 覆盖） */
  closeLoginModal: () => void;
  setDetailLoading: (loading: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  showUploadModal: false,
  showCreateDemandModal: false,
  showFeedbackModal: false,
  newVersionContext: null,
  editingSkill: null,
  showCommandPalette: false,
  showLoginModal: false,
  loginActionHint: undefined,
  detailLoading: false,

  openUploadModal: () => set({ showUploadModal: true }),
  closeUploadModal: () => set({ showUploadModal: false }),
  openCreateDemandModal: () => set({ showCreateDemandModal: true }),
  closeCreateDemandModal: () => set({ showCreateDemandModal: false }),
  openFeedbackModal: () => set({ showFeedbackModal: true }),
  closeFeedbackModal: () => set({ showFeedbackModal: false }),
  setNewVersionContext: (ctx) => set({ newVersionContext: ctx }),
  setEditingSkill: (skill) => set({ editingSkill: skill }),
  openCommandPalette: () => set({ showCommandPalette: true }),
  toggleCommandPalette: () => set((state) => ({ showCommandPalette: !state.showCommandPalette })),
  closeCommandPalette: () => set({ showCommandPalette: false }),
  openLoginModal: (actionHint) => set({ loginActionHint: actionHint, showLoginModal: true }),
  closeLoginModal: () => set({ showLoginModal: false }),
  setDetailLoading: (loading) => set({ detailLoading: loading }),
}));
