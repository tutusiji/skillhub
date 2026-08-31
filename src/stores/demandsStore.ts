import { create } from 'zustand';
import type { SkillDemand } from '../types';
import { api, mapApiDemand } from '../services/api';
import { requireAuth } from '../auth/requireAuth';
import { useAuthStore } from './authStore';
import { useToastStore } from './toastStore';
import { useSkillsStore } from './skillsStore';

/**
 * 征集需求 store（迁移自 App.tsx 全部需求 handler）。
 * 依赖 DAG：→ requireAuth（→ authStore, uiStore, toastStore）、authStore
 * （当前用户判定越权 + 积分回源）、toastStore、skillsStore（提交方案时取技能名）。
 * 需求与悬赏积分强依赖后端事务：积分扣减/退还/发放必须由服务端裁决，
 * 前端只回显结果，操作后统一 refreshPointsFromServer() 回源余额，避免刷新后漂移。
 */

/** 当前用户是否具备管理员权限（需求审核/删除用） */
function isPrivilegedUser(): boolean {
  const { currentUser } = useAuthStore.getState();
  return (
    !!currentUser && (currentUser.role === 'admin' || currentUser.role === 'super_admin')
  );
}

/** 新需求提交载荷：与 App.tsx 原 handleCreateDemand 一致（ID/时间戳/提交数由后端生成） */
export type CreateDemandInput = Omit<
  SkillDemand,
  'id' | 'createdAt' | 'updatedAt' | 'submissionsCount'
>;

interface DemandsState {
  demands: SkillDemand[];
  /** 详情弹窗选中的需求 */
  selectedDemand: SkillDemand | null;

  setDemands: (demands: SkillDemand[]) => void;
  setSelectedDemand: (demand: SkillDemand | null) => void;
  /** 以后端返回结果回写单条需求，并同步详情弹窗选中态 */
  mergeDemandFromServer: (updated: SkillDemand) => void;
  /** 发布需求：后端同一事务校验余额扣积分，成功后回源积分 */
  createDemand: (input: CreateDemandInput) => Promise<void>;
  /** 审核通过（仅管理员）；成功后公开到征集广场 */
  approveDemand: (demandId: string) => Promise<void>;
  /** 驳回（仅管理员）：后端事务退还积分，成功后回源积分 */
  rejectDemand: (demandId: string, reason: string) => Promise<void>;
  /** 删除需求（发布者或管理员）；后端按状态决定是否退还积分 */
  deleteDemand: (demandId: string) => Promise<void>;
  /** 提交技能方案（需登录）；需求发布者将收到通知进行验收 */
  submitSolution: (demandId: string, solutionNote: string, skillId?: string) => Promise<void>;
  /** 发布者验收中选方案：后端事务把悬赏积分发放给提交者 */
  acceptCandidate: (demandId: string, candidateId: string) => Promise<void>;
}

export const useDemandsStore = create<DemandsState>((set, get) => ({
  // 业务数据一律以后端为权威：初值必须为空，由 fetchMarketData 填充
  demands: [],
  selectedDemand: null,

  setDemands: (demands) => set({ demands }),
  setSelectedDemand: (demand) => set({ selectedDemand: demand }),

  mergeDemandFromServer: (updated) => {
    set((state) => ({
      demands: state.demands.map((d) => (d.id === updated.id ? updated : d)),
      selectedDemand:
        state.selectedDemand && state.selectedDemand.id === updated.id
          ? updated
          : state.selectedDemand,
    }));
  },

  createDemand: async (input) => {
    const { currentUser } = useAuthStore.getState();
    if (!currentUser) return;

    // 由后端在同一事务内校验余额、扣减积分并落库需求
    try {
      const created = await api.createDemand({
        title: input.title,
        description: input.description,
        targetDomain: input.targetDomain,
        expectedOutput: input.expectedOutput,
        bountyPoints: input.bountyPoints,
        deadlineText: input.deadlineText,
      });

      set((state) => ({ demands: [mapApiDemand(created), ...state.demands] }));
      await useAuthStore.getState().refreshPointsFromServer();
      useToastStore
        .getState()
        .addToast(
          'success',
          '需求已提交审核',
          `已扣除 ${created.bountyPoints} 奖励积分，管理员审核通过后将在征集广场展示！`,
        );
    } catch (error) {
      useToastStore.getState().addToast('error', '需求发布失败', (error as Error).message);
    }
  },

  approveDemand: async (demandId) => {
    if (!isPrivilegedUser()) {
      useToastStore.getState().addToast('warning', '权限不足', '仅管理员可审核征集需求');
      return;
    }

    try {
      const updated = await api.approveDemand(demandId);
      get().mergeDemandFromServer(mapApiDemand(updated));
      useToastStore
        .getState()
        .addToast('success', '需求审核通过', '该技能征集需求已在全站征集广场公开！');
    } catch (error) {
      useToastStore.getState().addToast('error', '审核失败', (error as Error).message);
    }
  },

  rejectDemand: async (demandId, reason) => {
    if (!isPrivilegedUser()) {
      useToastStore.getState().addToast('warning', '权限不足', '仅管理员可驳回征集需求');
      return;
    }

    try {
      const updated = await api.rejectDemand(demandId, reason);
      get().mergeDemandFromServer(mapApiDemand(updated));
      await useAuthStore.getState().refreshPointsFromServer();
      useToastStore
        .getState()
        .addToast(
          'info',
          '需求已驳回并退还积分',
          `已将 ${updated.bountyPoints} 积分退回发布者账户`,
        );
    } catch (error) {
      useToastStore.getState().addToast('error', '驳回失败', (error as Error).message);
    }
  },

  deleteDemand: async (demandId) => {
    const { currentUser } = useAuthStore.getState();
    const targetDemand = get().demands.find((d) => d.id === demandId);
    if (!targetDemand) return;

    const isAuthor = currentUser?.id === targetDemand.author.id;
    if (!isAuthor && !isPrivilegedUser()) {
      useToastStore
        .getState()
        .addToast('warning', '权限不足', '仅需求发布者或管理员有权删除该需求');
      return;
    }

    try {
      // 后端按需求状态决定是否退还积分（已交付的不再退还），并返回实际退款额
      const result = await api.deleteDemand(demandId);
      set((state) => ({ demands: state.demands.filter((d) => d.id !== demandId) }));
      if (get().selectedDemand?.id === demandId) {
        set({ selectedDemand: null });
      }
      await useAuthStore.getState().refreshPointsFromServer();
      useToastStore
        .getState()
        .addToast(
          'success',
          '需求已删除',
          result.refunded > 0
            ? `已删除该需求并退还 ${result.refunded} 悬赏积分`
            : '已成功删除该技能征集需求记录',
        );
    } catch (error) {
      useToastStore.getState().addToast('error', '删除失败', (error as Error).message);
    }
  },

  submitSolution: async (demandId, solutionNote, skillId) => {
    if (!requireAuth('提交技能方案')) return;
    const { currentUser } = useAuthStore.getState();
    if (!currentUser) return;

    // 附带技能名（如有），让需求方看到用什么技能方案投稿
    const matchedSkill = skillId
      ? useSkillsStore.getState().skills.find((s) => s.id === skillId)
      : undefined;

    try {
      const updated = await api.submitDemandCandidate(demandId, {
        notes: solutionNote,
        skillId,
        skillName: matchedSkill?.name,
      });
      get().mergeDemandFromServer(mapApiDemand(updated));
      useToastStore
        .getState()
        .addToast('success', '方案提交成功', '需求发布者将收到通知并进行验收！');
    } catch (error) {
      useToastStore.getState().addToast('error', '方案提交失败', (error as Error).message);
    }
  },

  acceptCandidate: async (demandId, candidateId) => {
    if (!requireAuth('验收技能方案')) return;

    try {
      const updated = await api.acceptDemandCandidate(demandId, candidateId);
      const mapped = mapApiDemand(updated);
      get().mergeDemandFromServer(mapped);
      await useAuthStore.getState().refreshPointsFromServer();

      const winner = mapped.candidates?.find((c) => c.id === candidateId);
      useToastStore
        .getState()
        .addToast(
          'success',
          '方案验收完成',
          `已将 ${mapped.bountyPoints} 悬赏积分发放给 ${winner?.submitterName ?? '方案提交者'}`,
        );
    } catch (error) {
      useToastStore.getState().addToast('error', '验收失败', (error as Error).message);
    }
  },
}));
