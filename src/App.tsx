import React, { useState, useEffect } from 'react';
import { 
  INITIAL_AUDIT_RULES, 
  INITIAL_DEEPSEEK_CONFIG,
  INITIAL_FEEDBACK, 
  INITIAL_SKILLS, 
  INITIAL_USERS,
  INITIAL_SKILL_DEMANDS 
} from './mock/initialData';
import { 
  AuditExecutionSummary, 
  AuditRule, 
  DeepSeekConfig,
  FeedbackItem, 
  SkillDemand,
  SkillItem, 
  ToastMessage, 
  UserAccount,
  UserRole 
} from './types';
import { Header, NavigationTab } from './components/Header';
import { MarketplaceView } from './components/MarketplaceView';
import { SkillDemandMarketView } from './components/SkillDemandMarketView';
import { SkillDetailPage } from './components/SkillDetailPage';
import { PersonalCenterView } from './components/PersonalCenterView';
import { UploadSkillModal } from './components/UploadSkillModal';
import { AuditManagementView } from './components/AuditManagementView';
import { RuleManagementView } from './components/RuleManagementView';
import { RuleManagementModal } from './components/RuleManagementModal';
import { AdminSettingsView } from './components/AdminSettingsView';
import { CreateSkillDemandModal } from './components/CreateSkillDemandModal';
import { SkillDemandDetailModal } from './components/SkillDemandDetailModal';
import { FeedbackModal } from './components/FeedbackModal';
import { CommandPaletteModal } from './components/CommandPaletteModal';
import { LoginModal } from './components/LoginModal';
import { BackToTop } from './components/BackToTop';
import { ToastContainer } from './components/Toast';
import { downloadSkillAsZip } from './utils/zipHelper';
import { executeDualEngineAudit } from './utils/auditRunner';
import { api, mapApiDemand, mapApiSkill, mapApiUser, mapAuditRule, syncToBackend } from './services/api';

export default function App() {
  // Users state with LocalStorage persistence
  const [allUsers, setAllUsers] = useState<UserAccount[]>(() => {
    const saved = localStorage.getItem('skillhub_all_users');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return INITIAL_USERS;
  });

  // Main Skills State with LocalStorage persistence
  const [skills, setSkills] = useState<SkillItem[]>(() => {
    const saved = localStorage.getItem('skillhub_skills');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return INITIAL_SKILLS;
  });

  // Skill Demands State with LocalStorage persistence
  const [demands, setDemands] = useState<SkillDemand[]>(() => {
    const saved = localStorage.getItem('skillhub_demands');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return INITIAL_SKILL_DEMANDS;
  });

  const [rules, setRules] = useState<AuditRule[]>(() => {
    const saved = localStorage.getItem('skillhub_rules');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return INITIAL_AUDIT_RULES;
  });

  const [feedbackList, setFeedbackList] = useState<FeedbackItem[]>(() => {
    const saved = localStorage.getItem('skillhub_feedback');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return INITIAL_FEEDBACK;
  });

  const [deepseekConfig, setDeepseekConfig] = useState<DeepSeekConfig>(() => {
    const saved = localStorage.getItem('skillhub_deepseek');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return INITIAL_DEEPSEEK_CONFIG;
  });

  // Current logged in user (null = unauthenticated / guest by default)
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    const saved = localStorage.getItem('skillhub_user');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return null; // Guest mode by default
  });

  // Backend integration status (null = checking, false = offline demo fallback)
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

  // Save current user to LocalStorage
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('skillhub_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('skillhub_user');
    }
  }, [currentUser]);
  
  // Navigation / Routing State with Hash & SessionStorage memory
  const [currentTab, setCurrentTab] = useState<NavigationTab | 'detail'>(() => {
    try {
      const hash = window.location.hash.replace('#', '');
      if (hash.startsWith('tab=')) {
        const tabVal = hash.split('tab=')[1] as any;
        if (['market', 'demands', 'personal', 'audit', 'rules', 'settings', 'detail'].includes(tabVal)) return tabVal;
      } else if (hash.startsWith('skill=')) {
        return 'detail';
      }
      const savedTab = sessionStorage.getItem('skillhub_active_tab') as any;
      if (savedTab && ['market', 'demands', 'personal', 'audit', 'rules', 'settings', 'detail'].includes(savedTab)) {
        return savedTab;
      }
    } catch (e) {}
    return 'market';
  });

  const [previousTab, setPreviousTab] = useState<NavigationTab>('market');

  // Currently inspected skill for full detail page
  const [selectedSkill, setSelectedSkill] = useState<SkillItem | null>(() => {
    try {
      const hash = window.location.hash.replace('#', '');
      let targetId: string | null = null;
      if (hash.startsWith('skill=')) {
        targetId = hash.split('skill=')[1];
      } else {
        targetId = sessionStorage.getItem('skillhub_selected_skill_id');
      }
      if (targetId) {
        const initialList = (() => {
          const saved = localStorage.getItem('skillhub_skills');
          if (saved) {
            try { return JSON.parse(saved); } catch (e) {}
          }
          return INITIAL_SKILLS;
        })();
        const found = initialList.find((s: SkillItem) => s.id === targetId || s.slug === targetId);
        if (found) return found;
      }
    } catch (e) {}
    return null;
  });

  // Selected demand for detail modal
  const [selectedDemand, setSelectedDemand] = useState<SkillDemand | null>(null);

  // Sync tab & route changes to sessionStorage and hash
  useEffect(() => {
    try {
      sessionStorage.setItem('skillhub_active_tab', currentTab);
      if (currentTab === 'detail' && selectedSkill) {
        sessionStorage.setItem('skillhub_selected_skill_id', selectedSkill.id);
        window.location.hash = `skill=${selectedSkill.id}`;
      } else {
        window.location.hash = `tab=${currentTab}`;
      }
    } catch (e) {}
  }, [currentTab, selectedSkill]);

  // Handle browser back / forward navigation via hashchange
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash.startsWith('skill=')) {
        const skillId = hash.split('skill=')[1];
        const target = skills.find(s => s.id === skillId || s.slug === skillId);
        if (target) {
          setSelectedSkill(target);
          setCurrentTab('detail');
        }
      } else if (hash.startsWith('tab=')) {
        const tabVal = hash.split('tab=')[1] as any;
        if (['market', 'demands', 'personal', 'audit', 'rules', 'settings'].includes(tabVal)) {
          setCurrentTab(tabVal);
        }
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [skills]);

  // Modals
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showCreateDemandModal, setShowCreateDemandModal] = useState(false);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginActionHint, setLoginActionHint] = useState<string | undefined>(undefined);

  // Scanning indicator
  const [isScanningDetail, setIsScanningDetail] = useState(false);

  // Toast Notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Sync to LocalStorage
  useEffect(() => {
    localStorage.setItem('skillhub_all_users', JSON.stringify(allUsers));
  }, [allUsers]);

  useEffect(() => {
    localStorage.setItem('skillhub_skills', JSON.stringify(skills));
  }, [skills]);

  useEffect(() => {
    localStorage.setItem('skillhub_demands', JSON.stringify(demands));
  }, [demands]);

  useEffect(() => {
    localStorage.setItem('skillhub_rules', JSON.stringify(rules));
  }, [rules]);

  useEffect(() => {
    localStorage.setItem('skillhub_feedback', JSON.stringify(feedbackList));
  }, [feedbackList]);

  useEffect(() => {
    localStorage.setItem('skillhub_deepseek', JSON.stringify(deepseekConfig));
  }, [deepseekConfig]);

  // Global Keyboard listener for Command+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowCommandPalette(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const addToast = (type: 'success' | 'error' | 'warning' | 'info', title: string, message: string) => {
    const newToast: ToastMessage = {
      id: `toast-${Date.now()}-${Math.random()}`,
      type,
      title,
      message
    };
    setToasts(prev => [...prev, newToast]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== newToast.id));
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Bootstrap read-only enterprise data from the NestJS backend. The local mock data
  // remains an explicit offline fallback so the demo still works without server setup.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [skillsResult, usersResult, rulesResult, demandsResult] = await Promise.allSettled([
        api.listSkills(),
        api.listUsers(),
        api.listAuditRules(),
        api.listDemands(),
      ]);

      if (cancelled) return;

      if (skillsResult.status === 'fulfilled') {
        setSkills(skillsResult.value.map(mapApiSkill));
        setBackendOnline(true);
      }
      if (usersResult.status === 'fulfilled') {
        setAllUsers(usersResult.value.map(mapApiUser));
      }
      if (rulesResult.status === 'fulfilled') {
        setRules(rulesResult.value.map(mapAuditRule));
      }
      if (demandsResult.status === 'fulfilled') {
        setDemands(demandsResult.value.map(mapApiDemand));
      }

      if (
        skillsResult.status === 'rejected' &&
        usersResult.status === 'rejected' &&
        rulesResult.status === 'rejected' &&
        demandsResult.status === 'rejected'
      ) {
        setBackendOnline(false);
        console.warn('SkillHub backend unavailable; using offline demo data.', skillsResult.reason);
      }
    })();

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Revalidate a persisted JWT on startup and refresh the profile from the backend.
  useEffect(() => {
    const token = localStorage.getItem('skillhub_token');
    if (!token || !currentUser) return;

    let cancelled = false;
    (async () => {
      try {
        const profile = await api.profile();
        if (!cancelled) {
          setCurrentUser(prev => ({
            ...mapApiUser(profile),
            avatar: profile.avatar || prev?.avatar || '',
            joinedAt: prev?.joinedAt || new Date().toISOString().split('T')[0],
            points: profile.points || prev?.points || 10000,
            title: prev?.title,
          }));
        }
      } catch {
        // Keep the cached demo identity if the server is temporarily unavailable.
      }
    })();

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auth Guard Helper
  const requireAuth = (actionName: string): boolean => {
    if (!currentUser) {
      setLoginActionHint(actionName);
      setShowLoginModal(true);
      addToast('warning', '请先登录', `未登录状态下仅支持下载源码和复制安装指令，${actionName}需要登录企业账号`);
      return false;
    }
    return true;
  };

  // Login & Logout Handlers
  const handleLogin = (user: UserAccount) => {
    setCurrentUser(user);
    setShowLoginModal(false);
    addToast('success', '登录成功', `欢迎回来，${user.name}！已为您开启全部操作权限`);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('skillhub_user');
    localStorage.removeItem('skillhub_token');
    if (currentTab === 'audit' || currentTab === 'rules' || currentTab === 'settings' || currentTab === 'personal') {
      setCurrentTab('market');
    }
    addToast('info', '已退出登录', '当前处于访客模式，仍可自由下载和复制安装指令');
  };

  // Navigate to Skill Detail Page
  const handleOpenSkillDetail = (skill: SkillItem) => {
    if (currentTab !== 'detail') {
      setPreviousTab(currentTab as NavigationTab);
    }
    setSelectedSkill(skill);
    setCurrentTab('detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Skill Interaction Handlers (Guarded)
  const handleToggleStar = (skillId: string): boolean => {
    if (!requireAuth('收藏技能')) {
      return false;
    }
    // 乐观更新本地计数，同时异步上报后端持久化收藏数
    let starDelta = 0;
    setSkills(prev =>
      prev.map(s => {
        if (s.id === skillId) {
          const nextStarred = !s.isStarred;
          starDelta = nextStarred ? 1 : -1;
          const stars = nextStarred ? s.stars + 1 : Math.max(0, s.stars - 1);
          if (nextStarred) {
            addToast('success', '已加入收藏', `已将 ${s.name} 收藏至您的个人中心`);
          } else {
            addToast('info', '已取消收藏', `已将 ${s.name} 移出个人收藏`);
          }
          return { ...s, isStarred: nextStarred, stars };
        }
        return s;
      })
    );
    if (starDelta !== 0) {
      void syncToBackend(
        () => api.incrementSkillMetric(skillId, 'stars', starDelta),
        '同步收藏计数'
      );
    }
    if (selectedSkill && selectedSkill.id === skillId) {
      setSelectedSkill(prev => prev ? {
        ...prev,
        isStarred: !prev.isStarred,
        stars: !prev.isStarred ? prev.stars + 1 : Math.max(0, prev.stars - 1)
      } : null);
    }
    return true;
  };

  const handleToggleLike = (skillId: string): boolean => {
    if (!requireAuth('点赞技能')) {
      return false;
    }
    // 乐观更新本地点赞数，同时异步上报后端持久化
    let likeDelta = 0;
    setSkills(prev =>
      prev.map(s => {
        if (s.id === skillId) {
          const nextLiked = !s.isLiked;
          likeDelta = nextLiked ? 1 : -1;
          const likes = nextLiked ? s.likes + 1 : Math.max(0, s.likes - 1);
          if (nextLiked) {
            addToast('success', '点赞成功', `感谢您对 ${s.name} 的认可与支持！`);
          }
          return { ...s, isLiked: nextLiked, likes };
        }
        return s;
      })
    );
    if (likeDelta !== 0) {
      void syncToBackend(
        () => api.incrementSkillMetric(skillId, 'likes', likeDelta),
        '同步点赞计数'
      );
    }
    if (selectedSkill && selectedSkill.id === skillId) {
      setSelectedSkill(prev => prev ? {
        ...prev,
        isLiked: !prev.isLiked,
        likes: !prev.isLiked ? prev.likes + 1 : Math.max(0, prev.likes - 1)
      } : null);
    }
    return true;
  };

  // Download & Install Commands (Allowed for Everyone)
  const handleDownloadZip = async (skill: SkillItem) => {
    try {
      addToast('info', '正在打包源码', `正在生成 ${skill.slug} 的 ZIP 文件结构...`);
      await downloadSkillAsZip(skill.name, skill.slug, skill.fileTree);
      
      // 累加下载计数并同步至后端统计
      setSkills(prev =>
        prev.map(s => (s.id === skill.id ? { ...s, downloads: s.downloads + 1 } : s))
      );
      void syncToBackend(
        () => api.incrementSkillMetric(skill.id, 'downloads', 1),
        '同步下载计数'
      );
      if (selectedSkill && selectedSkill.id === skill.id) {
        setSelectedSkill(prev => prev ? { ...prev, downloads: prev.downloads + 1 } : null);
      }
      addToast('success', '下载已就绪', `已成功打包下载 ${skill.slug}-v_package.zip`);
    } catch (err) {
      console.error(err);
      addToast('error', '下载失败', '生成 ZIP 压缩包时发生错误');
    }
  };

  const handleCopyCommand = (cmd: string, clientName?: string) => {
    addToast('success', '指令已复制', `已复制 ${clientName || '安装'} 命令至剪贴板`);
  };

  // Re-scan detail skill (Guarded)
  const handleReScanDetailSkill = async (skill: SkillItem) => {
    if (!requireAuth('重新体检')) {
      return;
    }
    setIsScanningDetail(true);
    try {
      const summary = await executeDualEngineAudit(skill, rules, undefined, deepseekConfig);
      setSkills(prev =>
        prev.map(s => (s.id === skill.id ? { ...s, auditResults: summary } : s))
      );
      if (selectedSkill?.id === skill.id) {
        setSelectedSkill({ ...selectedSkill, auditResults: summary });
      }
      addToast('success', '双引擎体检完成', `重新评估完成，最新得分: ${summary.score} 分`);
    } catch (err) {
      addToast('error', '体检失败', '执行扫描时发生异常');
    } finally {
      setIsScanningDetail(false);
    }
  };

  // Upload new skill handler (Guarded) —— 提交后端入库并触发服务端双引擎风控复检
  const handleCreateSkill = async (newSkill: SkillItem) => {
    // 1. 乐观插入本地列表，用户立即可在个人中心看到提交记录
    setSkills(prev => [newSkill, ...prev]);
    setCurrentTab('personal');

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
      });

      // 3. 用后端返回的权威记录（含真实 ID 与服务端扫描分）替换本地临时记录
      const mapped = mapApiSkill(created);
      setSkills(prev => prev.map(s => (s.id === newSkill.id ? mapped : s)));

      if (mapped.status === 'approved') {
        addToast(
          'success',
          '技能已直接上架',
          `${mapped.name} 通过服务端风控复检 (${mapped.auditResults.score} 分)，已发布至 Git 市场`
        );
      } else {
        addToast(
          'info',
          '已提交审核',
          `${mapped.name} 服务端复检得分 ${mapped.auditResults.score} 分，等待管理员人工审核`
        );
      }
    } catch (error) {
      // 后端不可用时保留本地记录，标注为离线草稿，避免用户填写内容丢失
      addToast(
        'warning',
        '已保存为本地草稿',
        `后端未接收该提交（${(error as Error).message}），恢复连接后请重新提交`
      );
    }
  };

  // ==========================================
  // SKILL DEMANDS CRUD & WORKFLOW HANDLERS
  // 需求与悬赏积分强依赖后端事务：积分扣减/退还/发放必须由服务端裁决，
  // 前端只负责回显结果，避免刷新后余额漂移或重复退款
  // ==========================================

  /**
   * 以后端返回结果为准回写单条需求，并同步详情弹窗
   * @param updated 后端返回的需求实体
   */
  const mergeDemandFromServer = (updated: SkillDemand) => {
    setDemands(prev => prev.map(d => (d.id === updated.id ? updated : d)));
    setSelectedDemand(prev => (prev && prev.id === updated.id ? updated : prev));
  };

  /**
   * 从后端刷新当前用户与组织成员的积分余额
   * 需求相关操作会改动积分，操作后统一回源，保证余额显示与服务端一致
   */
  const refreshPointsFromServer = async () => {
    const [profileResult, usersResult] = await Promise.allSettled([
      api.profile(),
      api.listUsers(),
    ]);

    if (profileResult.status === 'fulfilled') {
      const fresh = profileResult.value;
      setCurrentUser(prev =>
        prev
          ? { ...prev, points: fresh.points ?? prev.points, role: (fresh.role as UserRole) ?? prev.role }
          : prev
      );
    }
    if (usersResult.status === 'fulfilled') {
      setAllUsers(usersResult.value.map(mapApiUser));
    }
  };

  const handleCreateDemand = async (
    newDemandData: Omit<SkillDemand, 'id' | 'createdAt' | 'updatedAt' | 'submissionsCount'>
  ) => {
    if (!currentUser) return;

    // 由后端在同一事务内校验余额、扣减积分并落库需求
    try {
      const created = await api.createDemand({
        title: newDemandData.title,
        description: newDemandData.description,
        targetDomain: newDemandData.targetDomain,
        expectedOutput: newDemandData.expectedOutput,
        bountyPoints: newDemandData.bountyPoints,
        deadlineText: newDemandData.deadlineText,
      });

      setDemands(prev => [mapApiDemand(created), ...prev]);
      await refreshPointsFromServer();
      addToast(
        'success',
        '需求已提交审核',
        `已扣除 ${created.bountyPoints} 奖励积分，管理员审核通过后将在征集广场展示！`
      );
    } catch (error) {
      addToast('error', '需求发布失败', (error as Error).message);
    }
  };

  const handleApproveDemand = async (demandId: string) => {
    if (!isPrivilegedUser()) {
      addToast('warning', '权限不足', '仅管理员可审核征集需求');
      return;
    }

    try {
      const updated = await api.approveDemand(demandId);
      mergeDemandFromServer(mapApiDemand(updated));
      addToast('success', '需求审核通过', '该技能征集需求已在全站征集广场公开！');
    } catch (error) {
      addToast('error', '审核失败', (error as Error).message);
    }
  };

  const handleRejectDemand = async (demandId: string, reason: string) => {
    if (!isPrivilegedUser()) {
      addToast('warning', '权限不足', '仅管理员可驳回征集需求');
      return;
    }

    try {
      const updated = await api.rejectDemand(demandId, reason);
      mergeDemandFromServer(mapApiDemand(updated));
      await refreshPointsFromServer();
      addToast(
        'info',
        '需求已驳回并退还积分',
        `已将 ${updated.bountyPoints} 积分退回发布者账户`
      );
    } catch (error) {
      addToast('error', '驳回失败', (error as Error).message);
    }
  };

  const handleDeleteDemand = async (demandId: string) => {
    const targetDemand = demands.find(d => d.id === demandId);
    if (!targetDemand) return;

    const isAuthor = currentUser?.id === targetDemand.author.id;
    if (!isAuthor && !isPrivilegedUser()) {
      addToast('warning', '权限不足', '仅需求发布者或管理员有权删除该需求');
      return;
    }

    try {
      // 后端按需求状态决定是否退还积分（已交付的不再退还），并返回实际退款额
      const result = await api.deleteDemand(demandId);
      setDemands(prev => prev.filter(d => d.id !== demandId));
      if (selectedDemand?.id === demandId) {
        setSelectedDemand(null);
      }
      await refreshPointsFromServer();
      addToast(
        'success',
        '需求已删除',
        result.refunded > 0
          ? `已删除该需求并退还 ${result.refunded} 悬赏积分`
          : '已成功删除该技能征集需求记录'
      );
    } catch (error) {
      addToast('error', '删除失败', (error as Error).message);
    }
  };

  const handleSubmitDemandSolution = async (
    demandId: string,
    solutionNote: string,
    skillId?: string
  ) => {
    if (!requireAuth('提交技能方案')) return;
    if (!currentUser) return;

    const matchedSkill = skillId ? skills.find(s => s.id === skillId) : undefined;

    try {
      const updated = await api.submitDemandCandidate(demandId, {
        notes: solutionNote,
        skillId,
        skillName: matchedSkill?.name,
      });
      mergeDemandFromServer(mapApiDemand(updated));
      addToast('success', '方案提交成功', '需求发布者将收到通知并进行验收！');
    } catch (error) {
      addToast('error', '方案提交失败', (error as Error).message);
    }
  };

  /**
   * 需求发布者验收中选方案，后端在事务内把悬赏积分发放给方案提交者
   * @param demandId 需求 ID
   * @param candidateId 中选方案 ID
   */
  const handleAcceptDemandCandidate = async (demandId: string, candidateId: string) => {
    if (!requireAuth('验收技能方案')) return;

    try {
      const updated = await api.acceptDemandCandidate(demandId, candidateId);
      const mapped = mapApiDemand(updated);
      mergeDemandFromServer(mapped);
      await refreshPointsFromServer();

      const winner = mapped.candidates?.find(c => c.id === candidateId);
      addToast(
        'success',
        '方案验收完成',
        `已将 ${mapped.bountyPoints} 悬赏积分发放给 ${winner?.submitterName ?? '方案提交者'}`
      );
    } catch (error) {
      addToast('error', '验收失败', (error as Error).message);
    }
  };

  // ==========================================
  // SUPER ADMIN USER PROMOTION & PERMISSIONS
  // ==========================================
  const handleUpdateUserRole = async (userId: string, newRole: UserRole) => {
    if (!currentUser || currentUser.role !== 'super_admin') {
      addToast('error', '越权操作', '仅超级管理员有权分配或调整管理员权限！');
      return;
    }

    const snapshot = allUsers;
    const previousRole = allUsers.find(u => u.id === userId)?.role;

    // 乐观更新组织成员列表
    setAllUsers(prev =>
      prev.map(u => (u.id === userId ? { ...u, role: newRole } : u))
    );

    // If current logged-in user is updated
    if (currentUser.id === userId) {
      setCurrentUser(prev => prev ? { ...prev, role: newRole } : null);
    }

    // 持久化角色变更到后端，失败则回滚本地状态
    try {
      const updated = await api.updateUserRole(userId, newRole);
      const mapped = mapApiUser(updated);
      setAllUsers(prev =>
        prev.map(u => (u.id === userId ? { ...u, role: mapped.role } : u))
      );
      addToast('success', '权限已更新', `${mapped.name} 的角色已变更为 ${newRole}`);
    } catch (error) {
      setAllUsers(snapshot);
      if (currentUser.id === userId && previousRole) {
        setCurrentUser(prev => prev ? { ...prev, role: previousRole } : null);
      }
      addToast('error', '权限更新失败', (error as Error).message);
    }
  };

  /**
   * 判断当前用户是否具备管理员审核权限
   */
  const isPrivilegedUser = (): boolean =>
    !!currentUser && (currentUser.role === 'admin' || currentUser.role === 'super_admin');

  /**
   * 以后端返回结果为准回写单个技能，保留前端本地交互态 (点赞/收藏标记)
   * @param updated 后端返回的技能实体
   */
  const mergeSkillFromServer = (updated: SkillItem) => {
    setSkills(prev =>
      prev.map(s =>
        s.id === updated.id
          ? { ...updated, isLiked: s.isLiked, isStarred: s.isStarred }
          : s
      )
    );
    setSelectedSkill(prev =>
      prev && prev.id === updated.id
        ? { ...updated, isLiked: prev.isLiked, isStarred: prev.isStarred }
        : prev
    );
  };

  // Admin audit handlers —— 审核动作强依赖后端 (会触发 Git 市场同步)，失败需回滚
  const handleApproveSkill = async (id: string, feedback?: string) => {
    if (!currentUser) return;
    const snapshot = skills;

    // 1. 乐观更新，界面即时反馈
    setSkills(prev =>
      prev.map(s =>
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
          : s
      )
    );

    // 2. 请求后端落库并发布至 Git 市场
    try {
      const updated = await api.approveSkill(id, feedback);
      mergeSkillFromServer(mapApiSkill(updated));
      addToast('success', '审核通过', `${updated.name} 已发布至 Git 市场，可通过 /plugin install 安装`);
    } catch (error) {
      setSkills(snapshot);
      addToast('error', '审核失败', (error as Error).message);
    }
  };

  const handleRejectSkill = async (id: string, feedback: string) => {
    if (!currentUser) return;
    const snapshot = skills;

    setSkills(prev =>
      prev.map(s =>
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
          : s
      )
    );

    try {
      const updated = await api.rejectSkill(id, feedback);
      mergeSkillFromServer(mapApiSkill(updated));
      addToast('info', '已驳回', `已通知开发者整改：${updated.name}`);
    } catch (error) {
      setSkills(snapshot);
      addToast('error', '驳回失败', (error as Error).message);
    }
  };

  const handleDelistSkill = async (id: string) => {
    if (!isPrivilegedUser()) return;
    const snapshot = skills;

    setSkills(prev =>
      prev.map(s =>
        s.id === id
          ? { ...s, status: 'offline' as const, updatedAt: new Date().toISOString() }
          : s
      )
    );
    setSelectedSkill(prev => (prev && prev.id === id ? { ...prev, status: 'offline' } : prev));

    try {
      const updated = await api.delistSkill(id);
      mergeSkillFromServer(mapApiSkill(updated));
      addToast('warning', '技能已下架', `${updated.name} 已从 Git 市场索引移除`);
    } catch (error) {
      setSkills(snapshot);
      addToast('error', '下架失败', (error as Error).message);
    }
  };

  const handleRelistSkill = async (id: string) => {
    if (!isPrivilegedUser()) return;
    const snapshot = skills;

    setSkills(prev =>
      prev.map(s =>
        s.id === id
          ? { ...s, status: 'approved' as const, updatedAt: new Date().toISOString() }
          : s
      )
    );
    setSelectedSkill(prev => (prev && prev.id === id ? { ...prev, status: 'approved' } : prev));

    try {
      const updated = await api.relistSkill(id);
      mergeSkillFromServer(mapApiSkill(updated));
      addToast('success', '技能已恢复上线', `${updated.name} 已重新同步至 Git 市场`);
    } catch (error) {
      setSkills(snapshot);
      addToast('error', '恢复上线失败', (error as Error).message);
    }
  };

  const handleDeleteSkill = async (id: string) => {
    if (!isPrivilegedUser()) return;
    const snapshot = skills;
    const target = skills.find(s => s.id === id);

    setSkills(prev => prev.filter(s => s.id !== id));
    if (selectedSkill && selectedSkill.id === id) {
      setSelectedSkill(null);
      setCurrentTab('market');
    }

    try {
      await api.deleteSkill(id);
      addToast('success', '技能已删除', `${target?.name || id} 已彻底移除并重建市场索引`);
    } catch (error) {
      setSkills(snapshot);
      addToast('error', '删除失败', (error as Error).message);
    }
  };

  const handleUpdateSkillAudit = (id: string, summary: AuditExecutionSummary) => {
    setSkills(prev =>
      prev.map(s => (s.id === id ? { ...s, auditResults: summary } : s))
    );
    // 体检得分回写后端，保证多端一致
    void syncToBackend(
      () => api.updateSkillAuditScore(id, summary.score),
      '同步体检得分'
    );
  };

  // Rule management handlers —— 规则变更需持久化到后端风控引擎
  const handleSaveRule = async (rule: AuditRule) => {
    const snapshot = rules;

    setRules(prev => {
      const exists = prev.some(r => r.id === rule.id);
      if (exists) {
        return prev.map(r => (r.id === rule.id ? rule : r));
      }
      return [...prev, rule];
    });

    try {
      const saved = await api.saveAuditRule(rule);
      const mapped = mapAuditRule(saved);
      // 后端可能重新分配了规则 ID (新建场景)，需按新旧 ID 一并覆盖
      setRules(prev => {
        const merged = prev.map(r => (r.id === rule.id || r.id === mapped.id ? mapped : r));
        return merged.some(r => r.id === mapped.id) ? merged : [...merged, mapped];
      });
      addToast('success', '规则已保存', `${mapped.name} 已生效于双引擎风控`);
    } catch (error) {
      setRules(snapshot);
      addToast('error', '规则保存失败', (error as Error).message);
    }
  };

  const handleDeleteRule = async (id: string) => {
    const snapshot = rules;
    setRules(prev => prev.filter(r => r.id !== id));

    try {
      await api.deleteAuditRule(id);
      addToast('info', '规则已删除', '已将该项规则从检测引擎中移除');
    } catch (error) {
      setRules(snapshot);
      addToast('error', '规则删除失败', (error as Error).message);
    }
  };

  const handleToggleRule = async (id: string) => {
    const snapshot = rules;
    setRules(prev =>
      prev.map(r => (r.id === id ? { ...r, isEnabled: !r.isEnabled } : r))
    );

    try {
      const updated = await api.toggleAuditRule(id);
      setRules(prev => prev.map(r => (r.id === id ? mapAuditRule(updated) : r)));
    } catch (error) {
      setRules(snapshot);
      addToast('error', '规则状态切换失败', (error as Error).message);
    }
  };

  // Feedback handler (Guarded)
  const handleCreateFeedback = (fb: FeedbackItem) => {
    setFeedbackList(prev => [fb, ...prev]);
  };

  const pendingSkillReviewsCount = skills.filter(s => s.status === 'pending').length;
  const pendingDemandReviewsCount = demands.filter(d => d.status === 'pending').length;
  const totalPendingReviewsCount = pendingSkillReviewsCount + pendingDemandReviewsCount;
  
  const starredCount = skills.filter(s => s.isStarred).length;
  const mySubmissionsCount = currentUser ? skills.filter(s => 
    s.author.name === currentUser.name || s.author.name === 'Alex Chen' || s.author.name === '林晨 (开发架构组)'
  ).length : 0;

  const isSuperAdmin = currentUser?.role === 'super_admin';
  const isAdmin = currentUser?.role === 'admin' || isSuperAdmin;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Intranet Navbar with RBAC & Auth */}
      <Header
        currentTab={currentTab}
        onSelectTab={(tab) => {
          if (tab === 'rules') {
            if (!currentUser) {
              requireAuth('配置风控中心');
              return;
            }
            if (!isAdmin) {
              addToast('warning', '权限不足', '风控中心仅限超级管理员配置');
              return;
            }
            setCurrentTab('rules');
          } else if (tab === 'audit') {
            if (!currentUser) {
              requireAuth('访问审核管理中心');
              return;
            }
            if (!isAdmin) {
              addToast('warning', '权限不足', '审核管理中心仅限管理员访问');
              return;
            }
            setCurrentTab('audit');
          } else if (tab === 'settings') {
            if (!currentUser) {
              requireAuth('访问权限设置中心');
              return;
            }
            if (!isSuperAdmin) {
              addToast('error', '权限不足', '权限设置中心仅限超级管理员访问');
              return;
            }
            setCurrentTab('settings');
          } else {
            setCurrentTab(tab);
          }
        }}
        onOpenUpload={() => {
          if (requireAuth('发布新技能')) {
            setShowUploadModal(true);
          }
        }}
        onOpenCreateDemand={() => {
          if (requireAuth('发布技能征集')) {
            setShowCreateDemandModal(true);
          }
        }}
        onOpenCommandPalette={() => setShowCommandPalette(true)}
        onOpenFeedback={() => {
          if (requireAuth('提交全站反馈')) {
            setShowFeedbackModal(true);
          }
        }}
        onOpenLogin={() => {
          setLoginActionHint(undefined);
          setShowLoginModal(true);
        }}
        currentUser={currentUser}
        allUsers={allUsers}
        onSwitchUser={(user) => {
          setCurrentUser(user);
          // If switching to non-superadmin while on settings, redirect to market
          if (user.role !== 'super_admin' && currentTab === 'settings') {
            setCurrentTab('market');
          }
          if (user.role === 'developer' && (currentTab === 'audit' || currentTab === 'rules')) {
            setCurrentTab('market');
          }
          addToast('info', '身份已切换', `当前操作身份：${user.name} (${user.role === 'super_admin' ? '超级管理员' : user.role === 'admin' ? '管理员' : '普通开发者'})`);
        }}
        onLogout={handleLogout}
        pendingReviewsCount={totalPendingReviewsCount}
        starredCount={starredCount}
        mySubmissionsCount={mySubmissionsCount}
        isSuperAdmin={isSuperAdmin}
        backendOnline={backendOnline}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">
        {/* VIEW 1: MARKETPLACE */}
        {currentTab === 'market' && (
          <MarketplaceView
            skills={skills}
            onSelectSkill={handleOpenSkillDetail}
            onOpenUpload={() => {
              if (requireAuth('发布新技能')) {
                setShowUploadModal(true);
              }
            }}
            onOpenDemands={() => setCurrentTab('demands')}
            onToggleStar={handleToggleStar}
            onToggleLike={handleToggleLike}
            onDownloadZip={handleDownloadZip}
            onCopyInstallCmd={handleCopyCommand}
          />
        )}

        {/* VIEW 2: DEMANDS MARKET */}
        {currentTab === 'demands' && (
          <SkillDemandMarketView
            demands={demands}
            currentUser={currentUser}
            availableSkills={skills}
            onOpenCreateDemand={() => {
              if (requireAuth('发布技能征集')) {
                setShowCreateDemandModal(true);
              }
            }}
            onSelectDemand={(demand) => setSelectedDemand(demand)}
            onApproveDemand={handleApproveDemand}
            onRejectDemand={handleRejectDemand}
            onDeleteDemand={handleDeleteDemand}
            onOpenLogin={() => {
              setLoginActionHint('发布技能征集');
              setShowLoginModal(true);
            }}
            onToast={addToast}
          />
        )}

        {/* VIEW 3: SKILL DETAIL PAGE (FULL PAGE) */}
        {currentTab === 'detail' && selectedSkill && (
          <SkillDetailPage
            skill={selectedSkill}
            onBack={() => setCurrentTab(previousTab)}
            onToggleStar={handleToggleStar}
            onToggleLike={handleToggleLike}
            onDownloadZip={handleDownloadZip}
            onReScanSkill={handleReScanDetailSkill}
            isScanning={isScanningDetail}
            onCopySuccess={(msg) => addToast('success', '已复制', msg)}
          />
        )}

        {/* VIEW 4: PERSONAL CENTER (STARRED, MY SUBMISSIONS & MY DEMANDS) */}
        {currentTab === 'personal' && (
          <PersonalCenterView
            currentUser={currentUser}
            allSkills={skills}
            allDemands={demands}
            onSelectSkill={handleOpenSkillDetail}
            onSelectDemand={(demand) => setSelectedDemand(demand)}
            onToggleStar={handleToggleStar}
            onToggleLike={handleToggleLike}
            onDownloadZip={handleDownloadZip}
            onOpenUploadModal={() => {
              if (requireAuth('发布新技能')) {
                setShowUploadModal(true);
              }
            }}
            onOpenCreateDemandModal={() => {
              if (requireAuth('发布技能征集')) {
                setShowCreateDemandModal(true);
              }
            }}
            onOpenLogin={() => {
              setLoginActionHint('查看个人中心数据');
              setShowLoginModal(true);
            }}
            onCopyInstallCmd={(cmd) => addToast('success', '安装命令已复制', cmd)}
            onDeleteDemand={handleDeleteDemand}
            onToast={addToast}
          />
        )}

        {/* VIEW 5: ADMIN AUDIT MANAGEMENT */}
        {currentTab === 'audit' && (
          isAdmin ? (
            <AuditManagementView
              currentUser={currentUser!}
              skills={skills}
              rules={rules}
              deepseekConfig={deepseekConfig}
              onApproveSkill={handleApproveSkill}
              onRejectSkill={handleRejectSkill}
              onDelistSkill={handleDelistSkill}
              onRelistSkill={handleRelistSkill}
              onDeleteSkill={handleDeleteSkill}
              onUpdateSkillAudit={handleUpdateSkillAudit}
              onToast={addToast}
            />
          ) : (
            <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 space-y-4 max-w-lg mx-auto">
              <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-bold mx-auto">
                !
              </div>
              <h2 className="text-lg font-bold text-slate-900">需要管理员权限</h2>
              <p className="text-xs text-slate-500">
                审核管理中心属于企业管理员专属模块。请登录并切换为管理员或超级管理员身份体验。
              </p>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => setCurrentTab('market')}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200"
                >
                  返回技能集市
                </button>
                <button
                  onClick={() => {
                    setLoginActionHint('访问审核管理中心');
                    setShowLoginModal(true);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-sm hover:bg-indigo-700"
                >
                  登录管理员账号
                </button>
              </div>
            </div>
          )
        )}

        {/* VIEW 6: RISK CONTROL CENTER (风控中心) */}
        {currentTab === 'rules' && (
          isAdmin ? (
            <RuleManagementView
              currentUser={currentUser!}
              rules={rules}
              deepseekConfig={deepseekConfig}
              onSaveDeepSeekConfig={(cfg) => setDeepseekConfig(cfg)}
              onSaveRule={handleSaveRule}
              onDeleteRule={handleDeleteRule}
              onToggleRule={handleToggleRule}
              onToast={addToast}
            />
          ) : (
            <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 space-y-4 max-w-lg mx-auto">
              <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-bold mx-auto">
                !
              </div>
              <h2 className="text-lg font-bold text-slate-900">需要管理员权限</h2>
              <p className="text-xs text-slate-500">
                风控中心属于管理员专属模块。请登录并切换为管理员身份配置。
              </p>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => setCurrentTab('market')}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200"
                >
                  返回技能集市
                </button>
                <button
                  onClick={() => {
                    setLoginActionHint('访问风控中心');
                    setShowLoginModal(true);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-sm hover:bg-indigo-700"
                >
                  登录管理员账号
                </button>
              </div>
            </div>
          )
        )}

        {/* VIEW 7: SUPER ADMIN PERMISSIONS & USER ROLES SETTINGS */}
        {currentTab === 'settings' && (
          isSuperAdmin ? (
            <AdminSettingsView
              currentUser={currentUser}
              users={allUsers}
              onUpdateUserRole={handleUpdateUserRole}
              onToast={addToast}
            />
          ) : (
            <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 space-y-4 max-w-lg mx-auto">
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-800 flex items-center justify-center font-bold mx-auto">
                !
              </div>
              <h2 className="text-lg font-bold text-slate-900">仅限超级管理员访问</h2>
              <p className="text-xs text-slate-500">
                权限设置中心仅允许超级管理员（Super Admin）管理管理员席位与成员授权。
              </p>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => setCurrentTab('market')}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200"
                >
                  返回技能集市
                </button>
                <button
                  onClick={() => {
                    setLoginActionHint('访问权限设置中心');
                    setShowLoginModal(true);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-sm hover:bg-indigo-700"
                >
                  登录超级管理员
                </button>
              </div>
            </div>
          )
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-8 px-4 text-xs text-slate-500 text-center">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">SkillHub 企业内网 AI 技能市场</span>
            <span>·</span>
            <span>风控中心 v3.4 (驱动: {deepseekConfig.modelName})</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setCurrentTab('demands')}
              className="hover:text-indigo-600 transition-colors font-medium"
            >
              征集广场
            </button>
            <span>·</span>
            {isAdmin && (
              <>
                <button
                  onClick={() => setCurrentTab('rules')}
                  className="hover:text-indigo-600 transition-colors font-medium"
                >
                  风控中心
                </button>
                <span>·</span>
              </>
            )}
            {currentUser && (
              <>
                <button
                  onClick={() => setCurrentTab('personal')}
                  className="hover:text-indigo-600 transition-colors font-medium"
                >
                  个人中心
                </button>
                <span>·</span>
              </>
            )}
            <button
              onClick={() => {
                if (requireAuth('提交全站反馈')) {
                  setShowFeedbackModal(true);
                }
              }}
              className="hover:text-indigo-600 transition-colors font-medium"
            >
              全站建议与体验反馈
            </button>
          </div>
        </div>
      </footer>

      {/* MODALS */}
      {/* 1. Login Modal */}
      {showLoginModal && (
        <LoginModal
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
          onLogin={handleLogin}
          allUsers={allUsers}
          actionHint={loginActionHint}
        />
      )}

      {/* 2. Upload Skill Modal */}
      {showUploadModal && currentUser && (
        <UploadSkillModal
          currentUser={currentUser}
          rules={rules}
          deepseekConfig={deepseekConfig}
          onClose={() => setShowUploadModal(false)}
          onSubmit={handleCreateSkill}
          onToast={addToast}
        />
      )}

      {/* 3. Create Skill Demand Modal */}
      {showCreateDemandModal && (
        <CreateSkillDemandModal
          isOpen={showCreateDemandModal}
          currentUser={currentUser}
          onClose={() => setShowCreateDemandModal(false)}
          onSubmitDemand={handleCreateDemand}
          onOpenLogin={() => {
            setLoginActionHint('发布技能征集');
            setShowLoginModal(true);
          }}
          onToast={addToast}
        />
      )}

      {/* 4. Skill Demand Detail Modal */}
      {selectedDemand && (
        <SkillDemandDetailModal
          demand={selectedDemand}
          currentUser={currentUser}
          availableSkills={skills}
          isOpen={!!selectedDemand}
          onClose={() => setSelectedDemand(null)}
          onApproveDemand={handleApproveDemand}
          onRejectDemand={handleRejectDemand}
          onDeleteDemand={handleDeleteDemand}
          onSubmitResponse={handleSubmitDemandSolution}
          onAcceptCandidate={handleAcceptDemandCandidate}
          onToast={addToast}
        />
      )}

      {/* 5. Rule Management Modal (Admin) */}
      {showRuleModal && isAdmin && (
        <RuleManagementModal
          rules={rules}
          deepseekConfig={deepseekConfig}
          onSaveDeepSeekConfig={(cfg) => {
            setDeepseekConfig(cfg);
          }}
          onClose={() => setShowRuleModal(false)}
          onSaveRule={handleSaveRule}
          onDeleteRule={handleDeleteRule}
          onToggleRule={handleToggleRule}
          onToast={addToast}
        />
      )}

      {/* 6. Feedback Modal */}
      {showFeedbackModal && currentUser && (
        <FeedbackModal
          currentUser={currentUser}
          onClose={() => setShowFeedbackModal(false)}
          onSubmit={handleCreateFeedback}
          onToast={addToast}
        />
      )}

      {/* 7. Command Palette Modal (⌘K) */}
      <CommandPaletteModal
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        skills={skills}
        onSelectSkill={(skill) => handleOpenSkillDetail(skill)}
        onNavigateTab={(tab) => {
          if (tab === 'upload') {
            if (requireAuth('发布新技能')) {
              setShowUploadModal(true);
            }
          }
          if (tab === 'rules') {
            if (!currentUser) {
              requireAuth('配置风控中心');
              return;
            }
            if (isAdmin) setCurrentTab('rules');
            else addToast('warning', '权限不足', '风控中心仅限超级管理员配置');
          }
          if (tab === 'audit') {
            if (!currentUser) {
              requireAuth('访问审核管理中心');
              return;
            }
            if (isAdmin) setCurrentTab('audit');
            else addToast('warning', '权限不足', '审核管理中心仅限管理员访问');
          }
        }}
      />

      {/* 8. Floating Back to Top and Feedback Widget */}
      <BackToTop onOpenFeedback={() => {
        if (requireAuth('提交全站反馈')) {
          setShowFeedbackModal(true);
        }
      }} />

      {/* 9. Toast Alerts */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
