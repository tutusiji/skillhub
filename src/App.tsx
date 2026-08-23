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
import { RuleManagementModal } from './components/RuleManagementModal';
import { FeedbackModal } from './components/FeedbackModal';
import { CommandPaletteModal } from './components/CommandPaletteModal';
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

  // Default active user is admin for full preview experience
  const [currentUser, setCurrentUser] = useState<UserAccount>(INITIAL_USERS[0]);
  
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

  // Navigate to Skill Detail Page
  const handleOpenSkillDetail = (skill: SkillItem) => {
    if (currentTab !== 'detail') {
      setPreviousTab(currentTab === 'rules' ? 'market' : (currentTab as any));
    }
    setSelectedSkill(skill);
    setCurrentTab('detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Skill Interaction Handlers
  const handleToggleStar = (skillId: string) => {
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
  };

  const handleToggleLike = (skillId: string) => {
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
  };

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

  const handleReScanDetailSkill = async (skill: SkillItem) => {
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

  // Upload new skill handler
  const handleCreateSkill = (newSkill: SkillItem) => {
    setSkills(prev => [newSkill, ...prev]);
    setCurrentTab('personal');
  };

  // Admin audit handlers
  const handleApproveSkill = (id: string, feedback?: string) => {
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

  // Feedback handler
  const handleCreateFeedback = (fb: FeedbackItem) => {
    setFeedbackList(prev => [fb, ...prev]);
  };

  const pendingReviewsCount = skills.filter(s => s.status === 'pending').length;
  const starredCount = skills.filter(s => s.isStarred).length;
  const mySubmissionsCount = skills.filter(s => 
    s.author.name === currentUser.name || s.author.name === 'Alex Chen' || s.author.name === '林晨 (开发架构组)'
  ).length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Intranet Navbar with RBAC */}
      <Header
        currentTab={currentTab}
        onSelectTab={(tab) => {
          if (tab === 'rules') {
            if (currentUser.role !== 'admin') {
              addToast('warning', '权限不足', '双引擎规则库仅限超级管理员配置');
              return;
            }
            setShowRuleModal(true);
          } else if (tab === 'audit') {
            if (currentUser.role !== 'admin') {
              addToast('warning', '权限不足', '审核管理中心仅限超级管理员访问');
              return;
            }
            setCurrentTab('audit');
          } else {
            setCurrentTab(tab);
          }
        }}
        onOpenUpload={() => setShowUploadModal(true)}
        onOpenCommandPalette={() => setShowCommandPalette(true)}
        onOpenFeedback={() => setShowFeedbackModal(true)}
        currentUser={currentUser}
        allUsers={INITIAL_USERS}
        onSwitchUser={(user) => {
          setCurrentUser(user);
          // If switching to non-admin while on admin page, redirect to market
          if (user.role !== 'admin' && currentTab === 'audit') {
            setCurrentTab('market');
          }
          addToast('info', '身份已切换', `当前操作身份：${user.name} (${user.role === 'admin' ? '超级管理员' : '普通用户'})`);
        }}
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
            onOpenUpload={() => setShowUploadModal(true)}
            onToggleStar={handleToggleStar}
            onToggleLike={handleToggleLike}
            onDownloadZip={handleDownloadZip}
            onCopyInstallCmd={handleCopyCommand}
          />
        )}

        {/* VIEW 2: SKILL DETAIL PAGE (FULL PAGE AS REQUESTED) */}
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
            onOpenUploadModal={() => setShowUploadModal(true)}
            onCopyInstallCmd={(cmd) => addToast('success', '安装命令已复制', cmd)}
            onToast={addToast}
          />
        )}

        {/* VIEW 4: ADMIN AUDIT MANAGEMENT (RBAC GUARDED) */}
        {currentTab === 'audit' && (
          currentUser.role === 'admin' ? (
            <AuditManagementView
              currentUser={currentUser}
              skills={skills}
              rules={rules}
              deepseekConfig={deepseekConfig}
              onApproveSkill={handleApproveSkill}
              onRejectSkill={handleRejectSkill}
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
                审核管理中心与双引擎风控核验属于企业超级管理员专属模块。您可以在顶部右上角头像处一键切换为管理员身份体验。
              </p>
              <button
                onClick={() => setCurrentTab('market')}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-sm hover:bg-indigo-700"
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
            <span>·</span>
            <span>双引擎安全风控引擎 v3.4 (驱动: {deepseekConfig.modelName})</span>
          </div>
          <div className="flex items-center gap-4">
            {currentUser.role === 'admin' && (
              <>
                <button
                  onClick={() => setShowRuleModal(true)}
                  className="hover:text-indigo-600 transition-colors font-medium"
                >
                  双引擎规则与 DeepSeek 网关
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
              onClick={() => setShowFeedbackModal(true)}
              className="hover:text-indigo-600 transition-colors font-medium"
            >
              全站建议与体验反馈
            </button>
          </div>
        </div>
      </footer>

      {/* MODALS */}
      {/* 1. Upload Skill Modal */}
      {showUploadModal && (
        <UploadSkillModal
          currentUser={currentUser}
          rules={rules}
          deepseekConfig={deepseekConfig}
          onClose={() => setShowUploadModal(false)}
          onSubmit={handleCreateSkill}
          onToast={addToast}
        />
      )}

      {/* 2. Rule Management Modal (Admin) */}
      {showRuleModal && (
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

      {/* 3. Feedback Modal */}
      {showFeedbackModal && (
        <FeedbackModal
          currentUser={currentUser}
          onClose={() => setShowFeedbackModal(false)}
          onSubmit={handleCreateFeedback}
          onToast={addToast}
        />
      )}

      {/* 4. Command Palette Modal (⌘K) */}
      <CommandPaletteModal
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        skills={skills}
        onSelectSkill={(skill) => handleOpenSkillDetail(skill)}
        onNavigateTab={(tab) => {
          if (tab === 'upload') setShowUploadModal(true);
          if (tab === 'rules') {
            if (currentUser.role === 'admin') setShowRuleModal(true);
            else addToast('warning', '权限不足', '双引擎规则库仅限超级管理员配置');
          }
          if (tab === 'audit') {
            if (currentUser.role === 'admin') setCurrentTab('audit');
            else addToast('warning', '权限不足', '审核管理中心仅限超级管理员访问');
          }
        }}
      />

      {/* 5. Floating Back to Top and Feedback Widget */}
      <BackToTop onOpenFeedback={() => setShowFeedbackModal(true)} />

      {/* 6. Toast Alerts */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
