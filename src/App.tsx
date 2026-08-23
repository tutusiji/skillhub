import React, { useState, useEffect } from 'react';
import { 
  INITIAL_AUDIT_RULES, 
  INITIAL_DEEPSEEK_CONFIG,
  INITIAL_FEEDBACK, 
  INITIAL_SKILLS, 
  INITIAL_USERS 
} from './mock/initialData';
import { 
  AuditExecutionSummary, 
  AuditRule, 
  DeepSeekConfig,
  FeedbackItem, 
  SkillItem, 
  ToastMessage, 
  UserAccount 
} from './types';
import { Header } from './components/Header';
import { MarketplaceView } from './components/MarketplaceView';
import { SkillDetailPage } from './components/SkillDetailPage';
import { PersonalCenterView } from './components/PersonalCenterView';
import { UploadSkillModal } from './components/UploadSkillModal';
import { AuditManagementView } from './components/AuditManagementView';
import { RuleManagementView } from './components/RuleManagementView';
import { RuleManagementModal } from './components/RuleManagementModal';
import { FeedbackModal } from './components/FeedbackModal';
import { CommandPaletteModal } from './components/CommandPaletteModal';
import { LoginModal } from './components/LoginModal';
import { BackToTop } from './components/BackToTop';
import { ToastContainer } from './components/Toast';
import { downloadSkillAsZip } from './utils/zipHelper';
import { executeDualEngineAudit } from './utils/auditRunner';

export default function App() {
  // Main State with LocalStorage persistence
  const [skills, setSkills] = useState<SkillItem[]>(() => {
    const saved = localStorage.getItem('skillhub_skills');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return INITIAL_SKILLS;
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

  // Current logged in user (null = unauthenticated / guest)
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    const saved = localStorage.getItem('skillhub_user');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return null; // Default to guest as per user requirement
  });

  // Save current user to LocalStorage
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('skillhub_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('skillhub_user');
    }
  }, [currentUser]);
  
  // Navigation / Routing State with Hash & SessionStorage memory
  const [currentTab, setCurrentTab] = useState<'market' | 'personal' | 'audit' | 'rules' | 'detail'>(() => {
    try {
      const hash = window.location.hash.replace('#', '');
      if (hash.startsWith('tab=')) {
        const tabVal = hash.split('tab=')[1] as any;
        if (['market', 'personal', 'audit', 'rules', 'detail'].includes(tabVal)) return tabVal;
      } else if (hash.startsWith('skill=')) {
        return 'detail';
      }
      const savedTab = sessionStorage.getItem('skillhub_active_tab') as any;
      if (savedTab && ['market', 'personal', 'audit', 'rules', 'detail'].includes(savedTab)) {
        return savedTab;
      }
    } catch (e) {}
    return 'market';
  });

  const [previousTab, setPreviousTab] = useState<'market' | 'personal' | 'audit'>('market');

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
        if (['market', 'personal', 'audit', 'rules'].includes(tabVal)) {
          setCurrentTab(tabVal);
        }
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [skills]);

  // Modals
  const [showUploadModal, setShowUploadModal] = useState(false);
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
    localStorage.setItem('skillhub_skills', JSON.stringify(skills));
  }, [skills]);

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
    if (currentTab === 'audit') {
      setCurrentTab('market');
    }
    addToast('info', '已退出登录', '当前处于访客模式，仍可自由下载和复制安装指令');
  };

  // Navigate to Skill Detail Page
  const handleOpenSkillDetail = (skill: SkillItem) => {
    if (currentTab !== 'detail') {
      setPreviousTab(currentTab === 'rules' ? 'market' : (currentTab as any));
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
    setSkills(prev =>
      prev.map(s => {
        if (s.id === skillId) {
          const nextStarred = !s.isStarred;
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
    setSkills(prev =>
      prev.map(s => {
        if (s.id === skillId) {
          const nextLiked = !s.isLiked;
          const likes = nextLiked ? s.likes + 1 : Math.max(0, s.likes - 1);
          if (nextLiked) {
            addToast('success', '点赞成功', `感谢您对 ${s.name} 的认可与支持！`);
          }
          return { ...s, isLiked: nextLiked, likes };
        }
        return s;
      })
    );
    if (selectedSkill && selectedSkill.id === skillId) {
      setSelectedSkill(prev => prev ? {
        ...prev,
        isLiked: !prev.isLiked,
        likes: !prev.isLiked ? prev.likes + 1 : Math.max(0, prev.likes - 1)
      } : null);
    }
    return true;
  };

  // Download & Install Commands (Allowed for Everyone, Unlogged & Logged In)
  const handleDownloadZip = async (skill: SkillItem) => {
    try {
      addToast('info', '正在打包源码', `正在生成 ${skill.slug} 的 ZIP 文件结构...`);
      await downloadSkillAsZip(skill.name, skill.slug, skill.fileTree);
      
      // Increment download counter
      setSkills(prev =>
        prev.map(s => (s.id === skill.id ? { ...s, downloads: s.downloads + 1 } : s))
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

  const handleCopyCommand = (cmd: string, clientName: string) => {
    addToast('success', '指令已复制', `已复制 ${clientName} 安装命令至剪贴板`);
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

  // Upload new skill handler (Guarded)
  const handleCreateSkill = (newSkill: SkillItem) => {
    setSkills(prev => [newSkill, ...prev]);
    setCurrentTab('personal');
  };

  // Admin audit handlers
  const handleApproveSkill = (id: string, feedback?: string) => {
    if (!currentUser) return;
    setSkills(prev =>
      prev.map(s => {
        if (s.id === id) {
          return {
            ...s,
            status: 'approved',
            auditResults: {
              ...s.auditResults,
              overallStatus: 'passed',
              reviewedBy: currentUser.name,
              reviewedAt: new Date().toISOString(),
              adminFeedback: feedback || '审核通过，准予在内网市场公开。'
            }
          };
        }
        return s;
      })
    );
  };

  const handleRejectSkill = (id: string, feedback: string) => {
    if (!currentUser) return;
    setSkills(prev =>
      prev.map(s => {
        if (s.id === id) {
          return {
            ...s,
            status: 'rejected',
            auditResults: {
              ...s.auditResults,
              overallStatus: 'failed',
              reviewedBy: currentUser.name,
              reviewedAt: new Date().toISOString(),
              adminFeedback: feedback
            }
          };
        }
        return s;
      })
    );
  };

  const handleDelistSkill = (id: string) => {
    if (!currentUser || currentUser.role !== 'admin') return;
    setSkills(prev =>
      prev.map(s => {
        if (s.id === id) {
          return {
            ...s,
            status: 'offline' as const,
            updatedAt: new Date().toISOString()
          };
        }
        return s;
      })
    );
    if (selectedSkill && selectedSkill.id === id) {
      setSelectedSkill(prev => prev ? { ...prev, status: 'offline' } : null);
    }
  };

  const handleRelistSkill = (id: string) => {
    if (!currentUser || currentUser.role !== 'admin') return;
    setSkills(prev =>
      prev.map(s => {
        if (s.id === id) {
          return {
            ...s,
            status: 'approved' as const,
            updatedAt: new Date().toISOString()
          };
        }
        return s;
      })
    );
    if (selectedSkill && selectedSkill.id === id) {
      setSelectedSkill(prev => prev ? { ...prev, status: 'approved' } : null);
    }
  };

  const handleDeleteSkill = (id: string) => {
    if (!currentUser || currentUser.role !== 'admin') return;
    setSkills(prev => prev.filter(s => s.id !== id));
    if (selectedSkill && selectedSkill.id === id) {
      setSelectedSkill(null);
      setCurrentTab('market');
    }
  };

  const handleUpdateSkillAudit = (id: string, summary: AuditExecutionSummary) => {
    setSkills(prev =>
      prev.map(s => (s.id === id ? { ...s, auditResults: summary } : s))
    );
  };

  // Rule management handlers
  const handleSaveRule = (rule: AuditRule) => {
    setRules(prev => {
      const exists = prev.some(r => r.id === rule.id);
      if (exists) {
        return prev.map(r => (r.id === rule.id ? rule : r));
      }
      return [...prev, rule];
    });
  };

  const handleDeleteRule = (id: string) => {
    setRules(prev => prev.filter(r => r.id !== id));
    addToast('info', '规则已删除', '已将该项规则从检测引擎中移除');
  };

  const handleToggleRule = (id: string) => {
    setRules(prev =>
      prev.map(r => (r.id === id ? { ...r, isEnabled: !r.isEnabled } : r))
    );
  };

  // Feedback handler (Guarded)
  const handleCreateFeedback = (fb: FeedbackItem) => {
    setFeedbackList(prev => [fb, ...prev]);
  };

  const pendingReviewsCount = skills.filter(s => s.status === 'pending').length;
  const starredCount = skills.filter(s => s.isStarred).length;
  const mySubmissionsCount = currentUser ? skills.filter(s => 
    s.author.name === currentUser.name || s.author.name === 'Alex Chen' || s.author.name === '林晨 (开发架构组)'
  ).length : 0;

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
            if (currentUser.role !== 'admin') {
              addToast('warning', '权限不足', '风控中心仅限超级管理员配置');
              return;
            }
            setCurrentTab('rules');
          } else if (tab === 'audit') {
            if (!currentUser) {
              requireAuth('访问审核管理中心');
              return;
            }
            if (currentUser.role !== 'admin') {
              addToast('warning', '权限不足', '审核管理中心仅限超级管理员访问');
              return;
            }
            setCurrentTab('audit');
          } else {
            setCurrentTab(tab);
          }
        }}
        onOpenUpload={() => {
          if (requireAuth('发布新技能')) {
            setShowUploadModal(true);
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
        allUsers={INITIAL_USERS}
        onSwitchUser={(user) => {
          setCurrentUser(user);
          // If switching to non-admin while on admin pages, redirect to market
          if (user.role !== 'admin' && (currentTab === 'audit' || currentTab === 'rules')) {
            setCurrentTab('market');
          }
          addToast('info', '身份已切换', `当前操作身份：${user.name} (${user.role === 'admin' ? '超级管理员' : '普通用户'})`);
        }}
        onLogout={handleLogout}
        pendingReviewsCount={pendingReviewsCount}
        starredCount={starredCount}
        mySubmissionsCount={mySubmissionsCount}
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
            onToggleStar={handleToggleStar}
            onToggleLike={handleToggleLike}
            onDownloadZip={handleDownloadZip}
            onCopyInstallCmd={handleCopyCommand}
          />
        )}

        {/* VIEW 2: SKILL DETAIL PAGE (FULL PAGE) */}
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

        {/* VIEW 3: PERSONAL CENTER (STARRED SKILLS & USER SUBMISSION TRACKER) */}
        {currentTab === 'personal' && (
          <PersonalCenterView
            currentUser={currentUser}
            allSkills={skills}
            onSelectSkill={handleOpenSkillDetail}
            onToggleStar={handleToggleStar}
            onToggleLike={handleToggleLike}
            onDownloadZip={handleDownloadZip}
            onOpenUploadModal={() => {
              if (requireAuth('发布新技能')) {
                setShowUploadModal(true);
              }
            }}
            onOpenLogin={() => {
              setLoginActionHint('查看个人中心数据');
              setShowLoginModal(true);
            }}
            onCopyInstallCmd={(cmd) => addToast('success', '安装命令已复制', cmd)}
            onToast={addToast}
          />
        )}

        {/* VIEW 4: ADMIN AUDIT MANAGEMENT (RBAC GUARDED) */}
        {currentTab === 'audit' && (
          currentUser && currentUser.role === 'admin' ? (
            <AuditManagementView
              currentUser={currentUser}
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
              <h2 className="text-lg font-bold text-slate-900">需要超级管理员权限</h2>
              <p className="text-xs text-slate-500">
                审核管理中心与双引擎风控核验属于企业超级管理员专属模块。请登录并切换为管理员身份体验。
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
        {/* VIEW 5: SUPER ADMIN RISK CONTROL CENTER & DEEPSEEK GATEWAY (FULL PAGE) */}
        {currentTab === 'rules' && (
          currentUser && currentUser.role === 'admin' ? (
            <RuleManagementView
              currentUser={currentUser}
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
              <h2 className="text-lg font-bold text-slate-900">需要超级管理员权限</h2>
              <p className="text-xs text-slate-500">
                风控中心属于超级管理员专属模块。请登录并切换为管理员身份配置。
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
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-8 px-4 text-xs text-slate-500 text-center">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">SkillHub 企业内网 AI 技能市场</span>
            <span>·</span>
            <span>双引擎安全风控引擎 v3.4 (驱动: {deepseekConfig.modelName})</span>
          </div>
          <div className="flex items-center gap-4">
            {currentUser?.role === 'admin' && (
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
            <button
              onClick={() => setCurrentTab('personal')}
              className="hover:text-indigo-600 transition-colors font-medium"
            >
              个人中心
            </button>
            <span>·</span>
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
          allUsers={INITIAL_USERS}
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

      {/* 3. Rule Management Modal (Admin) */}
      {showRuleModal && currentUser?.role === 'admin' && (
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

      {/* 4. Feedback Modal */}
      {showFeedbackModal && currentUser && (
        <FeedbackModal
          currentUser={currentUser}
          onClose={() => setShowFeedbackModal(false)}
          onSubmit={handleCreateFeedback}
          onToast={addToast}
        />
      )}

      {/* 5. Command Palette Modal (⌘K) */}
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
            if (currentUser.role === 'admin') setCurrentTab('rules');
            else addToast('warning', '权限不足', '风控中心仅限超级管理员配置');
          }
          if (tab === 'audit') {
            if (!currentUser) {
              requireAuth('访问审核管理中心');
              return;
            }
            if (currentUser.role === 'admin') setCurrentTab('audit');
            else addToast('warning', '权限不足', '审核管理中心仅限超级管理员访问');
          }
        }}
      />

      {/* 6. Floating Back to Top and Feedback Widget */}
      <BackToTop onOpenFeedback={() => {
        if (requireAuth('提交全站反馈')) {
          setShowFeedbackModal(true);
        }
      }} />

      {/* 7. Toast Alerts */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
