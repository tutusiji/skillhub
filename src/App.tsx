import React, { useState, useEffect } from 'react';
import {
  INITIAL_AUDIT_RULES,
  INITIAL_DEEPSEEK_CONFIG,
  INITIAL_FEEDBACK,
  INITIAL_USERS,
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
import { api, mapApiDemand, mapApiFeedback, mapApiSkill, mapApiUser, mapAuditRule, syncToBackend } from './services/api';
import { FeedbackAdminView } from './components/FeedbackAdminView';
import { CategoryAndDomainView } from './components/CategoryAndDomainView';

/** 普通 tab → 路径映射（不含 detail，detail 走 /skill/:slug） */
const TAB_PATHS: Record<string, string> = {
  market: '/',
  demands: '/demands',
  personal: '/personal',
  audit: '/audit',
  rules: '/rules',
  settings: '/settings',
  feedback: '/feedback',
  manage: '/manage',
};

/**
 * 解析浏览器路径为页面 tab
 * 支持 /skill/:slugOrId 详情路径，未知路径回落到 market
 * @param pathname 当前路径
 */
function parseLocation(pathname: string): { tab: NavigationTab | 'detail'; skillSlug: string | null } {
  const skillMatch = pathname.match(/^\/skill\/([^/]+)/);
  if (skillMatch) {
    return { tab: 'detail', skillSlug: decodeURIComponent(skillMatch[1]) };
  }
  for (const [tab, path] of Object.entries(TAB_PATHS)) {
    if (path === pathname) return { tab: tab as NavigationTab, skillSlug: null };
  }
  return { tab: 'market', skillSlug: null };
}

export default function App() {
  // 业务数据一律以数据库/后端为权威，本地仅用编译期 mock 常量作为离线演示兜底，
  // 不再读写 localStorage（认证令牌除外）——见下方各 state 初始化与登录后的后端拉取

  // 组织用户名单（登录后由 /auth/users 覆盖）
  const [allUsers, setAllUsers] = useState<UserAccount[]>(INITIAL_USERS);

  // 技能列表：以数据库为唯一数据源，初值必须为空数组。
  // 若用 INITIAL_SKILLS 打底，首屏会先渲染一批库里并不存在的演示技能，
  // 待 /skills 返回后被整体替换 —— 用户看到的就是「技能闪现一下又消失」。
  const [skills, setSkills] = useState<SkillItem[]>([]);

  // 技能列表是否已完成首次后端拉取（用于区分「加载中」与「真的没有技能」）
  const [skillsLoaded, setSkillsLoaded] = useState(false);

  // 征集需求（启动后由 /demands 覆盖，同样不用 mock 打底）
  const [demands, setDemands] = useState<SkillDemand[]>([]);

  const [rules, setRules] = useState<AuditRule[]>(INITIAL_AUDIT_RULES);

  // 建议列表：后端为数据源（登录后拉取）
  const [feedbackList, setFeedbackList] = useState<FeedbackItem[]>(INITIAL_FEEDBACK);

  // LLM 网关展示配置：真实凭据由后端持久化，展示态由风控中心从 /audit/llm-config 拉取
  const [deepseekConfig, setDeepseekConfig] = useState<DeepSeekConfig>(INITIAL_DEEPSEEK_CONFIG);

  // 当前登录用户（null = 未登录/访客）。启动时若有有效令牌，由 /auth/me 回源最新身份
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);

  // Backend integration status (null = checking, false = offline demo fallback)
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  
  // Navigation / Routing State with history-path + SessionStorage memory
  const [currentTab, setCurrentTab] = useState<NavigationTab | 'detail'>(() => {
    try {
      // 兼容旧 hash 链接（/#tab=xxx / #skill=xxx）
      const hash = window.location.hash.replace('#', '');
      if (hash.startsWith('tab=')) {
        const tabVal = hash.split('tab=')[1] as any;
        if (TAB_PATHS[tabVal]) return tabVal;
      }
      if (hash.startsWith('skill=')) return 'detail';

      // 路径型路由解析
      const parsed = parseLocation(window.location.pathname);
      if (parsed.tab === 'detail' || TAB_PATHS[parsed.tab]) return parsed.tab;

      const savedTab = sessionStorage.getItem('skillhub_active_tab') as any;
      if (savedTab && TAB_PATHS[savedTab]) return savedTab;
    } catch (e) {}
    return 'market';
  });

  const [previousTab, setPreviousTab] = useState<NavigationTab>('market');

  // 当前查看的技能详情。
  // 初值恒为 null：技能一律以数据库为准，直达 /skill/:slug 时由下方 effect
  // 调 /skills/:slug 拉取真实详情（期间显示加载态），不再用 mock 常量顶替，
  // 否则会出现「详情页先显示一个库里不存在的技能、随后被替换」的错乱。
  const [selectedSkill, setSelectedSkill] = useState<SkillItem | null>(null);

  // Selected demand for detail modal
  const [selectedDemand, setSelectedDemand] = useState<SkillDemand | null>(null);

  /**
   * 统一的页面跳转入口：更新 URL（pushState）并切换页面状态
   * 所有 tab 切换都应走这里，保证 URL 与页面一致
   * @param tab 目标页面
   * @param skill 进入详情页时传入的技能对象
   */
  const navigate = (tab: NavigationTab | 'detail', skill?: SkillItem | null) => {
    let path = '/';
    if (tab === 'detail') {
      if (!skill) return;
      path = `/skill/${encodeURIComponent(skill.slug || skill.id)}`;
    } else {
      path = TAB_PATHS[tab] || '/';
    }
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
    if (tab === 'detail' && skill) setSelectedSkill(skill);
    setCurrentTab(tab);
  };

  // 兼容旧 hash 链接：把 /#tab=xxx / /#skill=xxx 一次性迁移为路径型 URL
  useEffect(() => {
    try {
      const hash = window.location.hash.replace('#', '');
      if (!hash || window.location.pathname !== '/') return;
      let path = '/';
      if (hash.startsWith('skill=')) {
        path = `/skill/${encodeURIComponent(hash.split('skill=')[1])}`;
      } else if (hash.startsWith('tab=')) {
        path = TAB_PATHS[hash.split('tab=')[1]] || '/';
      }
      if (path !== '/') {
        window.history.replaceState({}, '', path);
      }
    } catch (e) {}
  }, []);

  // 记忆当前 tab（刷新兜底；URL path 始终是主来源）。
  // 详情页不再记忆技能 id：/skill/:slug 已经能唯一还原，
  // 且技能必须从后端回源，本地记忆只会带来过期数据。
  useEffect(() => {
    try {
      sessionStorage.setItem('skillhub_active_tab', currentTab);
    } catch (e) {}
  }, [currentTab]);

  // 刷新直达详情页：/skill/:slug 对应的技能不在本地时，从后端拉取，避免白屏
  useEffect(() => {
    if (currentTab !== 'detail' || selectedSkill) return;
    const m = window.location.pathname.match(/^\/skill\/([^/]+)/);
    const slug = m ? decodeURIComponent(m[1]) : null;
    if (!slug) return;

    let cancelled = false;
    setDetailLoading(true);
    api
      .getSkill(slug)
      .then(detail => {
        if (cancelled) return;
        const full = mapApiSkill(detail);
        setSkills(prev => (prev.some(s => s.id === full.id) ? prev : [full, ...prev]));
        setSelectedSkill(full);
      })
      .catch(() => {
        /* 技能不存在或后端不可用：渲染「未找到」占位 */
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTab, selectedSkill]);

  // Handle browser back / forward navigation via popstate
  useEffect(() => {
    const handlePopState = () => {
      const { tab, skillSlug } = parseLocation(window.location.pathname);
      if (tab === 'detail' && skillSlug) {
        const target = skills.find(s => s.id === skillSlug || s.slug === skillSlug);
        if (target) {
          setSelectedSkill(target);
          setCurrentTab('detail');
        } else {
          // 技能已被删除等情况下回落到技能集市
          setCurrentTab('market');
        }
      } else {
        setCurrentTab(tab);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [skills]);

  // Modals
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showCreateDemandModal, setShowCreateDemandModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginActionHint, setLoginActionHint] = useState<string | undefined>(undefined);

  // Scanning indicator
  const [isScanningDetail, setIsScanningDetail] = useState(false);

  // 详情页直达加载态：刷新访问 /skill/:slug 时技能不在本地，需从后端异步拉取
  const [detailLoading, setDetailLoading] = useState(false);

  // Toast Notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // 业务数据全部以数据库/后端为权威，不再回写 localStorage。
  // （会话令牌 skillhub_token 由 api.ts / LoginModal 管理，属浏览器认证必需项）

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

  /**
   * 从后端拉取集市主数据（技能 / 规则 / 征集需求）
   *
   * 技能列表以数据库为唯一权威：审核通过、下架、删除等变更都只有重新拉取才能看到，
   * 因此这里既用于首屏启动，也用于「进入技能集市」时的重新校准。
   * 本地交互态（收藏/点赞标记）在合并时保留，避免刷新数据把用户的星标视觉重置。
   * @returns 是否成功拉到技能列表
   */
  const fetchMarketData = React.useCallback(async (): Promise<boolean> => {
    const [skillsResult, rulesResult, demandsResult] = await Promise.allSettled([
      api.listSkills(),
      api.listAuditRules(),
      api.listDemands(),
    ]);

    if (skillsResult.status === 'fulfilled') {
      const fresh = skillsResult.value.map(mapApiSkill);
      setSkills(prev => {
        // 保留本地收藏/点赞标记（后端未持久化「谁点过」，只存计数）
        const localFlags = new Map(prev.map(s => [s.id, { isStarred: s.isStarred, isLiked: s.isLiked }]));
        return fresh.map(s => {
          const flags = localFlags.get(s.id);
          return flags ? { ...s, isStarred: flags.isStarred, isLiked: flags.isLiked } : s;
        });
      });
      setBackendOnline(true);
      setSkillsLoaded(true);
    }
    if (rulesResult.status === 'fulfilled') {
      setRules(rulesResult.value.map(mapAuditRule));
    }
    if (demandsResult.status === 'fulfilled') {
      setDemands(demandsResult.value.map(mapApiDemand));
    }

    if (
      skillsResult.status === 'rejected' &&
      rulesResult.status === 'rejected' &&
      demandsResult.status === 'rejected'
    ) {
      setBackendOnline(false);
      // 标记为已加载：否则后端不可用时集市会永远停在骨架加载态
      setSkillsLoaded(true);
      console.warn('SkillHub backend unavailable.', skillsResult.reason);
    }

    return skillsResult.status === 'fulfilled';
  }, []);

  /** 首屏是否已发起过主数据拉取（避免「启动」与「进入集市」重复请求同一份数据） */
  const bootstrappedRef = React.useRef(false);

  // 首屏启动 + 每次进入数据驱动页面时拉取主数据。
  // 关键点：管理员审核通过一个技能后回到集市，必须重新请求才能看到它，
  // 否则页面用的还是进入时的旧快照（这正是「审核通过后首页看不到新技能」的原因）。
  // 组织用户名单 (allUsers) 要求登录态，不在此处拉取，由下方登录后的 effect 负责。
  useEffect(() => {
    const isDataTab =
      currentTab === 'market' || currentTab === 'personal' || currentTab === 'audit';
    if (!bootstrappedRef.current || isDataTab) {
      bootstrappedRef.current = true;
      void fetchMarketData();
    }
  }, [currentTab, fetchMarketData]);

  // 启动时用持久化的 JWT 恢复登录态。
  // 注意不能加 `if (!currentUser) return`：刷新后 currentUser 恒为 null，
  // 那样写会让令牌永远不被校验，用户每次刷新都被打回访客态
  // （表现为「刷新后我提交/收藏的东西都不见了」）。
  useEffect(() => {
    const token = localStorage.getItem('skillhub_token');
    if (!token) return;

    let cancelled = false;
    (async () => {
      try {
        const profile = await api.profile();
        if (!cancelled) {
          setCurrentUser(prev => ({
            ...mapApiUser(profile),
            avatar: profile.avatar || prev?.avatar || '',
            joinedAt: prev?.joinedAt || new Date().toISOString().split('T')[0],
            points: profile.points ?? prev?.points ?? 10000,
            title: prev?.title,
          }));
        }
      } catch {
        // 令牌失效（过期/被撤销）：清理掉，回到访客态，避免后续请求持续 401
        localStorage.removeItem('skillhub_token');
        localStorage.removeItem('skillhub_user');
        return;
      }

      // 登录态下同步拉取组织用户名单（账号切换器与权限设置页依赖）
      try {
        const users = await api.listUsers();
        if (!cancelled) {
          setAllUsers(users.map(mapApiUser));
        }
      } catch {
        // 名单拉取失败不影响主流程
      }

      // 登录态下同步拉取建议列表（建议管理页数据源）
      try {
        const feedback = await api.listFeedback();
        if (!cancelled) {
          setFeedbackList(feedback.map(mapApiFeedback));
        }
      } catch {
        // 建议列表拉取失败不影响主流程
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

    // 登录成功后再拉取组织用户名单（/auth/users 要求登录态）
    api
      .listUsers()
      .then(users => setAllUsers(users.map(mapApiUser)))
      .catch(() => {
        /* 名单拉取失败不阻塞登录 */
      });

    // 登录后拉取建议列表（管理员看全部、普通用户看自己的）
    api
      .listFeedback()
      .then(feedback => setFeedbackList(feedback.map(mapApiFeedback)))
      .catch(() => {
        /* 建议列表拉取失败不阻塞登录 */
      });
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('skillhub_user');
    localStorage.removeItem('skillhub_token');
    if (currentTab === 'audit' || currentTab === 'rules' || currentTab === 'settings' || currentTab === 'feedback' || currentTab === 'personal') {
      navigate('market');
    }
    addToast('info', '已退出登录', '当前处于访客模式，仍可自由下载和复制安装指令');
  };

  // Navigate to Skill Detail Page
  const handleOpenSkillDetail = (skill: SkillItem) => {
    if (currentTab !== 'detail') {
      setPreviousTab(currentTab as NavigationTab);
    }
    navigate('detail', skill);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // 业务数据全部以数据库为准，文件源码内容无需本地持久化；
    // 在线时从后端详情接口补全，保证详情页源码预览可用
    const hasContent = (skill.fileTree || []).some(n => n.content);
    if (!hasContent && skill.slug) {
      api
        .getSkill(skill.slug)
        .then(detail => {
          const full = mapApiSkill(detail);
          setSkills(prev => prev.map(s => (s.id === skill.id ? full : s)));
          setSelectedSkill(full);
        })
        .catch(() => {
          /* 离线或后端不可用时保留本地精简数据 */
        });
    }
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
      // 优先下载用户上传时的原始 ZIP（文件名、大小、二进制内容与上传完全一致）
      const original = await api.downloadOriginalZip(skill.id);
      if (original) {
        addToast('success', '下载已就绪', `已下载原始插件包 ${original.fileName}`);
      } else {
        // 兜底：从文件树重建（旧数据或未保留原始 ZIP 的技能），沿用上传时的原始文件名（如有）
        addToast('info', '正在打包源码', `正在生成 ${skill.slug} 的 ZIP 文件结构...`);
        await downloadSkillAsZip(skill.name, skill.slug, skill.version, skill.fileTree, skill.zipFileName);
        addToast('success', '下载已就绪', `已成功打包下载 ${skill.zipFileName || skill.slug}`);
      }

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
    navigate('personal');

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
   * 超级管理员勾选/取消某管理员的菜单权限（审核管理、风控中心）
   * 乐观更新 allUsers 与 currentUser，失败回滚
   * @param userId 目标用户 ID
   * @param permissions 新的菜单权限清单
   */
  const handleUpdateMenuPermissions = async (userId: string, permissions: string[]) => {
    if (!currentUser || currentUser.role !== 'super_admin') {
      addToast('error', '越权操作', '仅超级管理员有权调整菜单权限！');
      return;
    }

    const snapshot = allUsers;

    // 乐观更新组织成员列表
    setAllUsers(prev =>
      prev.map(u => (u.id === userId ? { ...u, menuPermissions: permissions } : u))
    );
    if (currentUser.id === userId) {
      setCurrentUser(prev => prev ? { ...prev, menuPermissions: permissions } : null);
    }

    try {
      const updated = await api.updateUserMenuPermissions(userId, permissions);
      const mapped = mapApiUser(updated);
      setAllUsers(prev =>
        prev.map(u => (u.id === userId ? { ...u, menuPermissions: mapped.menuPermissions } : u))
      );
      addToast('success', '菜单权限已更新', `${mapped.name} 的菜单权限已保存`);
    } catch (error) {
      setAllUsers(snapshot);
      addToast('error', '菜单权限更新失败', (error as Error).message);
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
      navigate('market');
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

  // 提交建议：调后端持久化，成功后刷新列表
  const handleCreateFeedback = async (payload: { title: string; content: string; category: string; rating: number }) => {
    try {
      const created = await api.createFeedback(payload);
      setFeedbackList(prev => [mapApiFeedback(created), ...prev]);
      addToast('success', '感谢您的建议', '您的建议已提交至建议中心，管理员会持续跟进！');
    } catch (error) {
      addToast('error', '提交失败', (error as Error).message);
    }
  };

  // 删除建议：管理员可删任意建议，普通用户只能删自己的
  const handleDeleteFeedback = async (id: string) => {
    try {
      await api.deleteFeedback(id);
      setFeedbackList(prev => prev.filter(f => f.id !== id));
      addToast('success', '建议已删除', '该建议已从建议中心移除');
    } catch (error) {
      addToast('error', '删除失败', (error as Error).message);
    }
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
  // 菜单级权限：超管恒拥有全部；管理员按 menuPermissions 清单控制「审核管理/风控中心」菜单可见性
  const menuPermissions = currentUser?.menuPermissions ?? [];
  const canAccessAudit =
    isSuperAdmin || (currentUser?.role === 'admin' && menuPermissions.includes('audit'));
  const canAccessRules =
    isSuperAdmin || (currentUser?.role === 'admin' && menuPermissions.includes('rules'));

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
            if (!canAccessRules) {
              addToast('warning', '权限不足', '您未被授予风控中心访问权限');
              return;
            }
            navigate('rules');
          } else if (tab === 'audit') {
            if (!currentUser) {
              requireAuth('访问审核管理中心');
              return;
            }
            if (!canAccessAudit) {
              addToast('warning', '权限不足', '您未被授予审核管理访问权限');
              return;
            }
            navigate('audit');
          } else if (tab === 'settings') {
            if (!currentUser) {
              requireAuth('访问权限设置中心');
              return;
            }
            if (!isSuperAdmin) {
              addToast('error', '权限不足', '权限设置中心仅限超级管理员访问');
              return;
            }
            navigate('settings');
          } else if (tab === 'manage') {
            if (!currentUser) {
              requireAuth('进入分类和专家组管理');
              return;
            }
            if (!isAdmin) {
              addToast('warning', '权限不足', '分类和专家组管理仅限管理员访问');
              return;
            }
            navigate('manage');
          } else {
            navigate(tab);
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
            navigate('market');
          }
          if (user.role === 'user' && (currentTab === 'audit' || currentTab === 'rules')) {
            navigate('market');
          }
          addToast('info', '身份预览已切换', `当前预览身份：${user.name} (${user.role === 'super_admin' ? '超级管理员' : user.role === 'admin' ? '管理员' : '普通用户'})。写操作仍以登录账号身份提交，如需真实切换请退出后重新登录。`);
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
            isLoading={!skillsLoaded}
            onSelectSkill={handleOpenSkillDetail}
            onOpenUpload={() => {
              if (requireAuth('发布新技能')) {
                setShowUploadModal(true);
              }
            }}
            onOpenDemands={() => navigate('demands')}
            onToggleStar={handleToggleStar}
            onToggleLike={handleToggleLike}
            onDownloadZip={handleDownloadZip}
            onCopyInstallCmd={handleCopyCommand}
            currentUser={currentUser}
            onToast={addToast}
            onOpenManage={() => navigate('manage')}
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
        {currentTab === 'detail' && (
          selectedSkill ? (
            <SkillDetailPage
              skill={selectedSkill}
              onBack={() => navigate(previousTab)}
              onToggleStar={handleToggleStar}
              onToggleLike={handleToggleLike}
              onDownloadZip={handleDownloadZip}
              onReScanSkill={handleReScanDetailSkill}
              isScanning={isScanningDetail}
              onCopySuccess={(msg) => addToast('success', '已复制', msg)}
            />
          ) : (
            /* 详情页兜底：刷新直达 /skill/:slug 时技能从后端异步拉取，未找到时给出占位 */
            <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 space-y-4 max-w-lg mx-auto my-8">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-bold mx-auto">
                !
              </div>
              <h2 className="text-lg font-bold text-slate-900">
                {detailLoading ? '正在加载技能详情...' : '未找到该技能'}
              </h2>
              <p className="text-xs text-slate-500">
                {detailLoading
                  ? '正在从服务器拉取技能信息，请稍候。'
                  : '该技能可能已被删除或下架，请返回技能集市重新选择。'}
              </p>
              <button
                onClick={() => navigate('market')}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-sm hover:bg-indigo-700"
              >
                返回技能集市
              </button>
            </div>
          )
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
          canAccessAudit ? (
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
                  onClick={() => navigate('market')}
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
          canAccessRules ? (
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
                  onClick={() => navigate('market')}
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
              onUpdateMenuPermissions={handleUpdateMenuPermissions}
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
                  onClick={() => navigate('market')}
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

        {/* VIEW 8: SUGGESTION CENTER (建议管理，仅管理员) */}
        {/* VIEW 8: SUGGESTION CENTER (建议反馈，全员可用：管理员管理，普通用户看自己的+提交) */}
        {currentTab === 'feedback' && (
          currentUser ? (
            <FeedbackAdminView
              currentUser={currentUser}
              feedbackList={feedbackList}
              onDeleteFeedback={handleDeleteFeedback}
              onOpenCreateFeedback={() => {
                setShowFeedbackModal(true);
              }}
              onToast={addToast}
            />
          ) : (
            <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 space-y-4 max-w-lg mx-auto">
              <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold mx-auto">
                !
              </div>
              <h2 className="text-lg font-bold text-slate-900">登录后使用建议反馈</h2>
              <p className="text-xs text-slate-500">
                登录企业账号后即可提交建议：管理员可查看并管理全部建议，普通用户可查看自己的建议并提交新建议。
              </p>
              <button
                onClick={() => {
                  setLoginActionHint('提交建议');
                  setShowLoginModal(true);
                }}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-sm hover:bg-indigo-700"
              >
                登录账号
              </button>
            </div>
          )
        )}

        {/* VIEW 9: 分类和专家组管理（仅管理员） */}
        {currentTab === 'manage' && (
          isAdmin && currentUser ? (
            <CategoryAndDomainView
              currentUser={currentUser}
              skills={skills}
              onRefreshSkills={setSkills}
              onToast={addToast}
            />
          ) : (
            <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 space-y-4 max-w-lg mx-auto">
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-800 flex items-center justify-center font-bold mx-auto">
                !
              </div>
              <h2 className="text-lg font-bold text-slate-900">分类和专家组管理仅限管理员</h2>
              <p className="text-xs text-slate-500">
                分类与专家组管理属于企业管理员专属模块，普通用户无此入口。
              </p>
              <button
                onClick={() => navigate('market')}
                className="px-5 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200"
              >
                返回技能集市
              </button>
            </div>
          )
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-8 px-4 text-xs text-slate-500 text-center">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">SkillHub 企业内网 AI 技能市场</span>
            {/* 后端连接状态点：绿=已连接 / 琥珀=离线（演示数据） / 灰色闪烁=连接中 */}
            <span
              className={`w-1.5 h-1.5 rounded-full ${backendOnline === false ? 'bg-amber-400' : backendOnline ? 'bg-emerald-500' : 'bg-slate-300 animate-pulse'}`}
              title={backendOnline === false ? '后端离线：当前使用本地演示数据' : backendOnline ? '企业后端已连接' : '正在连接企业后端'}
            />
            <span>风控中心 v3.4 (驱动: {deepseekConfig.modelName})</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('demands')}
              className="hover:text-indigo-600 transition-colors font-medium"
            >
              征集广场
            </button>
            <span>·</span>
            {canAccessRules && (
              <>
                <button
                  onClick={() => navigate('rules')}
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
                  onClick={() => navigate('personal')}
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
          actionHint={loginActionHint}
        />
      )}

      {/* 2. Upload Skill Modal */}
      {showUploadModal && currentUser && (
        <UploadSkillModal
          currentUser={currentUser}
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
            if (canAccessRules) navigate('rules');
            else addToast('warning', '权限不足', '风控中心仅限管理员访问');
          }
          if (tab === 'audit') {
            if (!currentUser) {
              requireAuth('访问审核管理中心');
              return;
            }
            if (canAccessAudit) navigate('audit');
            else addToast('warning', '权限不足', '审核管理中心仅限管理员访问');
          }
        }}
      />

      {/* 8. Floating Back to Top and Feedback Widget */}
      <BackToTop
        showSuggestionButton
        onOpenFeedback={() => {
          if (requireAuth('查看建议中心')) {
            navigate('feedback');
          }
        }}
      />

      {/* 9. Toast Alerts */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
