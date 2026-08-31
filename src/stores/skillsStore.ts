import { create } from 'zustand';
import type { AuditExecutionSummary, SkillItem } from '../types';
import { api, mapApiSkill, syncToBackend } from '../services/api';
import { downloadSkillAsZip } from '../utils/zipHelper';
import { requireAuth } from '../auth/requireAuth';
import { useRouterStore } from './routerStore';
import { useAuthStore } from './authStore';
import { useUiStore } from './uiStore';
import { useToastStore } from './toastStore';

/**
 * 技能列表/详情 store（最大域，迁移自 App.tsx 全部技能 handler）。
 * 依赖 DAG：→ requireAuth（→ authStore, uiStore, toastStore）、routerStore、
 * authStore（审核人身份/越权拦截）、uiStore（详情加载态）、toastStore。
 * 技能一律以数据库为权威；本地只保留「谁点过星标」这类后端未持久化的交互标记。
 */

/** 当前用户是否具备管理员操作权限（审核/上下架/删除） */
function isPrivilegedUser(): boolean {
  const { currentUser } = useAuthStore.getState();
  return (
    !!currentUser && (currentUser.role === 'admin' || currentUser.role === 'super_admin')
  );
}

interface SkillsState {
  skills: SkillItem[];
  /** 是否已完成首次后端拉取（区分「加载中」与「真的没有技能」） */
  skillsLoaded: boolean;
  /** 当前查看的技能详情（恒为 null 起步：直达 /skill/:slug 时由 effect 拉取） */
  selectedSkill: SkillItem | null;
  /** 后端连接状态（null = 探测中 / false = 离线演示数据） */
  backendOnline: boolean | null;

  /** 整表覆盖（分类管理 onRefreshSkills 等「以后端为准」场景） */
  setSkillsRaw: (skills: SkillItem[]) => void;
  /** 用后端拉取的整表覆盖，但保留本地收藏/点赞标记 + 置 backendOnline/skillsLoaded */
  setSkillsFromServer: (fresh: SkillItem[]) => void;
  setBackendOnline: (online: boolean | null) => void;
  setSkillsLoaded: (loaded: boolean) => void;
  setSelectedSkill: (skill: SkillItem | null) => void;

  /** 进入详情页：写 selectedSkill + pushState 路由 + 后台拉全量 fileTree 回填 */
  openSkillDetail: (skill: SkillItem) => Promise<void>;
  /** 收藏（乐观更新计数 + 异步上报）；未登录返回 false 并弹登录提示 */
  toggleStar: (skillId: string) => boolean;
  /** 点赞（乐观更新计数 + 异步上报）；未登录返回 false 并弹登录提示 */
  toggleLike: (skillId: string) => boolean;
  /** 下载 ZIP（优先原始包，兜底文件树重建）并累加下载计数 */
  downloadZip: (skill: SkillItem) => Promise<void>;
  /** 提交新技能：乐观插入个人中心 → 后端持久化 → 用权威记录替换临时记录 */
  createSkill: (newSkill: SkillItem) => Promise<void>;
  /** 作者自更新元数据（白名单字段），同步详情选中态 */
  updateSkillMeta: (updated: SkillItem) => void;
  /** 以后端返回结果回写单技能，保留本地交互态（点赞/收藏标记） */
  mergeSkillFromServer: (updated: SkillItem) => void;
  /** 审核通过：乐观置 approved → 后端发布 Git 市场 → 失败回滚 */
  approveSkill: (id: string, feedback?: string) => Promise<void>;
  /** 审核驳回：乐观置 rejected → 后端落库 → 失败回滚 */
  rejectSkill: (id: string, feedback: string) => Promise<void>;
  /** 下架：乐观置 offline → 后端移除 Git 索引 → 失败回滚 */
  delistSkill: (id: string) => Promise<void>;
  /** 恢复上线：乐观置 approved → 后端重新同步 Git → 失败回滚 */
  relistSkill: (id: string) => Promise<void>;
  /** 彻底删除（仅管理员）；删除的是当前选中技能时回落到集市 */
  deleteSkill: (id: string) => Promise<void>;
  /** 作者删除自己被驳回的版本（仅删除，越权判定交给后端） */
  deleteSkillVersion: (id: string) => Promise<void>;
  /** 审核工作台保存扫描结果后同步本地展示（得分已由后端落库） */
  updateSkillAudit: (id: string, summary: AuditExecutionSummary) => void;
}

export const useSkillsStore = create<SkillsState>((set, get) => ({
  // 业务数据一律以后端为权威：列表初值必须为空，由 fetchMarketData 填充
  skills: [],
  skillsLoaded: false,
  selectedSkill: null,
  backendOnline: null,

  setSkillsRaw: (skills) => set({ skills }),
  setSkillsFromServer: (fresh) => {
    set((state) => {
      // 保留本地收藏/点赞标记（后端未持久化「谁点过」，只存计数）
      const localFlags = new Map(
        state.skills.map((s) => [s.id, { isStarred: s.isStarred, isLiked: s.isLiked }]),
      );
      return {
        skills: fresh.map((s) => {
          const flags = localFlags.get(s.id);
          return flags ? { ...s, isStarred: flags.isStarred, isLiked: flags.isLiked } : s;
        }),
        backendOnline: true,
        skillsLoaded: true,
      };
    });
  },
  setBackendOnline: (online) => set({ backendOnline: online }),
  setSkillsLoaded: (loaded) => set({ skillsLoaded: loaded }),
  setSelectedSkill: (skill) => set({ selectedSkill: skill }),

  openSkillDetail: async (skill) => {
    const { currentTab, setPreviousTab, navigate } = useRouterStore.getState();
    if (currentTab !== 'detail') {
      setPreviousTab(currentTab);
    }

    // 列表接口已剔除 fileTree（响应体 27.7MB → 37.5KB）：这里「立即用已有数据打开
    // 详情页」，源码由后台拉全量回填，期间文件树区域显示遮罩，不阻塞整页渲染
    const hasContent = (skill.fileTree || []).some((n) => !!n.content);
    set({ selectedSkill: skill });
    navigate('detail', `/skill/${encodeURIComponent(skill.slug || skill.id)}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (hasContent) return;

    useUiStore.getState().setDetailLoading(true);
    api
      .getSkill(skill.slug)
      .then((detail) => {
        const full = mapApiSkill(detail);
        set((state) => ({
          skills: state.skills.map((s) => (s.id === skill.id ? full : s)),
          // 仅当仍停留在同一技能详情时才覆盖，避免快速切换技能时旧响应顶掉新选择
          selectedSkill:
            state.selectedSkill && state.selectedSkill.id === skill.id
              ? full
              : state.selectedSkill,
        }));
      })
      .catch(() => {
        // 离线/后端不可用时保留精简数据，源码区显示空树与下载兜底
      })
      .finally(() => {
        useUiStore.getState().setDetailLoading(false);
      });
  },

  toggleStar: (skillId) => {
    if (!requireAuth('收藏技能')) return false;
    // 乐观更新本地计数，同时异步上报后端持久化收藏数
    let starDelta = 0;
    set((state) => {
      const skills = state.skills.map((s) => {
        if (s.id !== skillId) return s;
        const nextStarred = !s.isStarred;
        starDelta = nextStarred ? 1 : -1;
        const stars = nextStarred ? s.stars + 1 : Math.max(0, s.stars - 1);
        if (nextStarred) {
          useToastStore
            .getState()
            .addToast('success', '已加入收藏', `已将 ${s.name} 收藏至您的个人中心`);
        } else {
          useToastStore
            .getState()
            .addToast('info', '已取消收藏', `已将 ${s.name} 移出个人收藏`);
        }
        return { ...s, isStarred: nextStarred, stars };
      });
      const sel = state.selectedSkill;
      return {
        skills,
        selectedSkill:
          sel && sel.id === skillId
            ? {
                ...sel,
                isStarred: !sel.isStarred,
                stars: !sel.isStarred ? sel.stars + 1 : Math.max(0, sel.stars - 1),
              }
            : sel,
      };
    });
    if (starDelta !== 0) {
      void syncToBackend(() => api.incrementSkillMetric(skillId, 'stars', starDelta), '同步收藏计数');
    }
    return true;
  },

  toggleLike: (skillId) => {
    if (!requireAuth('点赞技能')) return false;
    let likeDelta = 0;
    set((state) => {
      const skills = state.skills.map((s) => {
        if (s.id !== skillId) return s;
        const nextLiked = !s.isLiked;
        likeDelta = nextLiked ? 1 : -1;
        const likes = nextLiked ? s.likes + 1 : Math.max(0, s.likes - 1);
        if (nextLiked) {
          useToastStore
            .getState()
            .addToast('success', '点赞成功', `感谢您对 ${s.name} 的认可与支持！`);
        }
        return { ...s, isLiked: nextLiked, likes };
      });
      const sel = state.selectedSkill;
      return {
        skills,
        selectedSkill:
          sel && sel.id === skillId
            ? {
                ...sel,
                isLiked: !sel.isLiked,
                likes: !sel.isLiked ? sel.likes + 1 : Math.max(0, sel.likes - 1),
              }
            : sel,
      };
    });
    if (likeDelta !== 0) {
      void syncToBackend(() => api.incrementSkillMetric(skillId, 'likes', likeDelta), '同步点赞计数');
    }
    return true;
  },

  downloadZip: async (skill) => {
    try {
      // 优先下载用户上传时的原始 ZIP（文件名、大小、二进制内容与上传完全一致）
      const original = await api.downloadOriginalZip(skill.id);
      if (original) {
        useToastStore
          .getState()
          .addToast('success', '下载已就绪', `已下载原始插件包 ${original.fileName}`);
      } else {
        // 兜底：从文件树重建（旧数据或未保留原始 ZIP 的技能）
        useToastStore
          .getState()
          .addToast('info', '正在打包源码', `正在生成 ${skill.slug} 的 ZIP 文件结构...`);
        await downloadSkillAsZip(
          skill.name,
          skill.slug,
          skill.version,
          skill.fileTree,
          skill.zipFileName,
        );
        useToastStore
          .getState()
          .addToast('success', '下载已就绪', `已成功打包下载 ${skill.zipFileName || skill.slug}`);
      }

      // 累加下载计数并同步至后端统计
      set((state) => ({
        skills: state.skills.map((s) =>
          s.id === skill.id ? { ...s, downloads: s.downloads + 1 } : s,
        ),
        selectedSkill:
          state.selectedSkill && state.selectedSkill.id === skill.id
            ? { ...state.selectedSkill, downloads: state.selectedSkill.downloads + 1 }
            : state.selectedSkill,
      }));
      void syncToBackend(
        () => api.incrementSkillMetric(skill.id, 'downloads', 1),
        '同步下载计数',
      );
    } catch (err) {
      console.error(err);
      useToastStore.getState().addToast('error', '下载失败', '生成 ZIP 压缩包时发生错误');
    }
  },

  createSkill: async (newSkill) => {
    // 1. 乐观插入本地列表，用户立即可在个人中心看到提交记录
    set((state) => ({ skills: [newSkill, ...state.skills] }));
    useRouterStore.getState().navigate('personal');

    // 2. 提交后端持久化；服务端扫描通过会自动发布至 Git 市场
    try {
      const created = await api.createSkill({
        name: newSkill.name,
        slug: newSkill.slug,
        category: newSkill.category,
        description: newSkill.description,
        author: newSkill.author.name,
        department: newSkill.author.department,
        avatar: newSkill.author.avatar,
        version: newSkill.version,
        permissions: newSkill.permissions,
        clients: newSkill.clients,
        tags: newSkill.tags,
        readme: newSkill.readme,
        expertDomain: newSkill.expertDomain,
        fileTree: newSkill.fileTree,
        // 原始 ZIP（base64）与上传文件名：无损入库，供下载与 Git 发布
        zipBuffer: newSkill.zipBufferBase64,
        zipFileName: newSkill.zipFileName,
        // 多版本发布上下文（仅在「发布新版本」入口触发时存在）
        parentSkillId: (newSkill as unknown as { parentSkillId?: string }).parentSkillId,
        supersedeMode: (newSkill as unknown as { supersedeMode?: 'replace' | 'coexist' })
          .supersedeMode,
      });

      // 3. 用后端返回的权威记录（含真实 ID）替换本地临时记录
      const mapped = mapApiSkill(created);
      set((state) => ({
        skills: state.skills.map((s) => (s.id === newSkill.id ? mapped : s)),
      }));

      if (mapped.status === 'approved') {
        useToastStore
          .getState()
          .addToast('success', '技能已直接上架', `${mapped.name} 已发布至 Git 市场`);
      } else {
        useToastStore
          .getState()
          .addToast(
            'info',
            '已提交审核',
            `${mapped.name} 已进入待审核队列，等待管理员运行双引擎安全体检后上架`,
          );
      }
    } catch (error) {
      // 后端不可用时保留本地记录，标注为离线草稿，避免用户填写内容丢失
      useToastStore
        .getState()
        .addToast(
          'warning',
          '已保存为本地草稿',
          `后端未接收该提交（${(error as Error).message}），恢复连接后请重新提交`,
        );
    }
  },

  updateSkillMeta: (updated) => {
    set((state) => ({
      skills: state.skills.map((s) => (s.id === updated.id ? updated : s)),
      // 同步详情页选中态（如果用户正在查看这个技能）
      selectedSkill:
        state.selectedSkill && state.selectedSkill.id === updated.id
          ? updated
          : state.selectedSkill,
    }));
  },

  mergeSkillFromServer: (updated) => {
    set((state) => ({
      skills: state.skills.map((s) =>
        s.id === updated.id
          ? { ...updated, isLiked: s.isLiked, isStarred: s.isStarred }
          : s,
      ),
      selectedSkill:
        state.selectedSkill && state.selectedSkill.id === updated.id
          ? { ...updated, isLiked: state.selectedSkill.isLiked, isStarred: state.selectedSkill.isStarred }
          : state.selectedSkill,
    }));
  },

  approveSkill: async (id, feedback) => {
    const { currentUser } = useAuthStore.getState();
    if (!currentUser) return;
    const snapshot = get().skills;

    // 1. 乐观更新，界面即时反馈
    set((state) => ({
      skills: state.skills.map((s) =>
        s.id === id
          ? {
              ...s,
              status: 'approved' as const,
              auditResults: {
                ...s.auditResults,
                overallStatus: 'passed' as const,
                reviewedBy: currentUser.name,
                reviewedAt: new Date().toISOString(),
                adminFeedback: feedback || '审核通过，准予在内网市场公开。',
              },
            }
          : s,
      ),
    }));

    // 2. 请求后端落库并发布至 Git 市场
    try {
      const updated = await api.approveSkill(id, feedback);
      get().mergeSkillFromServer(mapApiSkill(updated));
      useToastStore
        .getState()
        .addToast('success', '审核通过', `${updated.name} 已发布至 Git 市场，可通过 /plugin install 安装`);
    } catch (error) {
      set({ skills: snapshot });
      useToastStore.getState().addToast('error', '审核失败', (error as Error).message);
    }
  },

  rejectSkill: async (id, feedback) => {
    const { currentUser } = useAuthStore.getState();
    if (!currentUser) return;
    const snapshot = get().skills;

    set((state) => ({
      skills: state.skills.map((s) =>
        s.id === id
          ? {
              ...s,
              status: 'rejected' as const,
              auditResults: {
                ...s.auditResults,
                overallStatus: 'failed' as const,
                reviewedBy: currentUser.name,
                reviewedAt: new Date().toISOString(),
                adminFeedback: feedback,
              },
            }
          : s,
      ),
    }));

    try {
      const updated = await api.rejectSkill(id, feedback);
      get().mergeSkillFromServer(mapApiSkill(updated));
      useToastStore.getState().addToast('info', '已驳回', `已通知开发者整改：${updated.name}`);
    } catch (error) {
      set({ skills: snapshot });
      useToastStore.getState().addToast('error', '驳回失败', (error as Error).message);
    }
  },

  delistSkill: async (id) => {
    if (!isPrivilegedUser()) return;
    const snapshot = get().skills;

    set((state) => ({
      skills: state.skills.map((s) =>
        s.id === id ? { ...s, status: 'offline' as const, updatedAt: new Date().toISOString() } : s,
      ),
      selectedSkill:
        state.selectedSkill && state.selectedSkill.id === id
          ? { ...state.selectedSkill, status: 'offline' as const }
          : state.selectedSkill,
    }));

    try {
      const updated = await api.delistSkill(id);
      get().mergeSkillFromServer(mapApiSkill(updated));
      useToastStore
        .getState()
        .addToast('warning', '技能已下架', `${updated.name} 已从 Git 市场索引移除`);
    } catch (error) {
      set({ skills: snapshot });
      useToastStore.getState().addToast('error', '下架失败', (error as Error).message);
    }
  },

  relistSkill: async (id) => {
    if (!isPrivilegedUser()) return;
    const snapshot = get().skills;

    set((state) => ({
      skills: state.skills.map((s) =>
        s.id === id
          ? { ...s, status: 'approved' as const, updatedAt: new Date().toISOString() }
          : s,
      ),
      selectedSkill:
        state.selectedSkill && state.selectedSkill.id === id
          ? { ...state.selectedSkill, status: 'approved' as const }
          : state.selectedSkill,
    }));

    try {
      const updated = await api.relistSkill(id);
      get().mergeSkillFromServer(mapApiSkill(updated));
      useToastStore
        .getState()
        .addToast('success', '技能已恢复上线', `${updated.name} 已重新同步至 Git 市场`);
    } catch (error) {
      set({ skills: snapshot });
      useToastStore.getState().addToast('error', '恢复上线失败', (error as Error).message);
    }
  },

  deleteSkill: async (id) => {
    if (!isPrivilegedUser()) return;
    const snapshot = get().skills;
    const target = get().skills.find((s) => s.id === id);

    set((state) => ({ skills: state.skills.filter((s) => s.id !== id) }));
    if (get().selectedSkill?.id === id) {
      set({ selectedSkill: null });
      useRouterStore.getState().navigate('market');
    }

    try {
      await api.deleteSkill(id);
      useToastStore
        .getState()
        .addToast('success', '技能已删除', `${target?.name || id} 已彻底移除并重建市场索引`);
    } catch (error) {
      set({ skills: snapshot });
      useToastStore.getState().addToast('error', '删除失败', (error as Error).message);
    }
  },

  deleteSkillVersion: async (id) => {
    const snapshot = get().skills;
    const target = get().skills.find((s) => s.id === id);

    set((state) => ({ skills: state.skills.filter((s) => s.id !== id) }));
    if (get().selectedSkill?.id === id) {
      set({ selectedSkill: null });
      useRouterStore.getState().navigate('market');
    }

    try {
      await api.deleteSkill(id);
      useToastStore
        .getState()
        .addToast(
          'success',
          '版本已删除',
          `${target?.name || id} v${target?.version ?? ''} 已彻底移除`,
        );
    } catch (error) {
      set({ skills: snapshot });
      useToastStore.getState().addToast('error', '删除失败', (error as Error).message);
    }
  },

  updateSkillAudit: (id, summary) => {
    set((state) => ({
      skills: state.skills.map((s) => (s.id === id ? { ...s, auditResults: summary } : s)),
    }));
  },
}));
