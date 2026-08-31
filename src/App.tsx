import { Loader2 } from 'lucide-react';
import { SkillItem } from './types';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { CenteredNotice } from './components/ui/CenteredNotice';
import { MarketplaceView } from './components/views/MarketplaceView';
import { SkillDemandMarketView } from './components/views/SkillDemandMarketView';
import { SkillDetailPage } from './components/views/SkillDetailPage';
import { PersonalCenterView } from './components/views/PersonalCenterView';
import { AuditManagementView } from './components/views/AuditManagementView';
import { RuleManagementView } from './components/views/RuleManagementView';
import { AdminSettingsView } from './components/views/AdminSettingsView';
import { AppModals } from './components/layout/AppModals';
import { BackToTop } from './components/layout/BackToTop';
import { ToastContainer } from './components/layout/Toast';
import { FeedbackAdminView } from './components/views/FeedbackAdminView';
import { CategoryAndDomainView } from './components/views/CategoryAndDomainView';
import { PermissionDenied } from './components/ui/PermissionDenied';
import { ExpertDomainsProvider } from './contexts/ExpertDomainsContext';
import { useRouterStore } from './stores/routerStore';
import { useToastStore } from './stores/toastStore';
import { useUiStore } from './stores/uiStore';
import { useFeedbackStore } from './stores/feedbackStore';
import { useAuthStore } from './stores/authStore';
import { useSkillsStore } from './stores/skillsStore';
import { useDemandsStore } from './stores/demandsStore';
import { useRulesStore } from './stores/rulesStore';
import { shuffleAvatar as coordinatorShuffleAvatar } from './stores/coordinator';
import { requireAuth } from './auth/requireAuth';
import { usePermissions } from './auth/usePermissions';
import { useAppLifecycle } from './hooks/useAppLifecycle';
import { useRouteEffects } from './hooks/useRouteEffects';
import { useGuardedNavigate } from './hooks/useGuardedNavigate';

export default function App() {
  // 业务数据一律以数据库/后端为权威：所有列表初值必须为空，由后端接口填充。
  // 任何"编译期 mock 打底"都会让首屏渲染出库里不存在的数据（虚假信息），
  // 并在真实数据返回后被整体替换（表现为内容闪现即消失）。
  // 不再读写 localStorage（认证令牌除外）。

  // 组织成员名单（仅超管权限设置页需要）：登录后由 /auth/users 拉取，coordinator 内部维护
  const allUsers = useAuthStore((s) => s.allUsers);

  // 技能域：列表/详情/后端连接状态 + 全部交互动作收敛到 skillsStore
  // （乐观更新 + 失败快照回滚 + 删除选中技能回落集市；setSkillsFromServer 等由 coordinator 调用）
  const skills = useSkillsStore((s) => s.skills);
  const skillsLoaded = useSkillsStore((s) => s.skillsLoaded);
  const selectedSkill = useSkillsStore((s) => s.selectedSkill);
  const setSkillsRaw = useSkillsStore((s) => s.setSkillsRaw);
  const openSkillDetail = useSkillsStore((s) => s.openSkillDetail);
  const toggleStar = useSkillsStore((s) => s.toggleStar);
  const toggleLike = useSkillsStore((s) => s.toggleLike);
  const downloadZip = useSkillsStore((s) => s.downloadZip);
  const approveSkill = useSkillsStore((s) => s.approveSkill);
  const rejectSkill = useSkillsStore((s) => s.rejectSkill);
  const delistSkill = useSkillsStore((s) => s.delistSkill);
  const relistSkill = useSkillsStore((s) => s.relistSkill);
  const deleteSkill = useSkillsStore((s) => s.deleteSkill);
  const deleteSkillVersion = useSkillsStore((s) => s.deleteSkillVersion);
  const updateSkillAudit = useSkillsStore((s) => s.updateSkillAudit);

  // 需求域：列表/选中详情 + 全流程（发布/审核/驳回/删除/投稿/验收）收敛到 demandsStore。
  // 悬赏积分以后端事务为准，store 只在操作后回源积分。
  const demands = useDemandsStore((s) => s.demands);
  const selectedDemand = useDemandsStore((s) => s.selectedDemand);
  const setSelectedDemand = useDemandsStore((s) => s.setSelectedDemand);
  const approveDemand = useDemandsStore((s) => s.approveDemand);
  const rejectDemand = useDemandsStore((s) => s.rejectDemand);
  const deleteDemand = useDemandsStore((s) => s.deleteDemand);

  // 风控域：规则 + LLM 网关配置收敛到 rulesStore（规则以 /audit/rules 为唯一数据源）
  const rules = useRulesStore((s) => s.rules);
  const deepseekConfig = useRulesStore((s) => s.deepseekConfig);
  const setDeepseekConfig = useRulesStore((s) => s.setDeepseekConfig);
  const saveRule = useRulesStore((s) => s.saveRule);
  const deleteRule = useRulesStore((s) => s.deleteRule);
  const toggleRule = useRulesStore((s) => s.toggleRule);

  // 建议域：登录后由 authStore 回源拉取，状态收敛到 feedbackStore
  const feedbackList = useFeedbackStore((s) => s.feedbackList);
  const deleteFeedback = useFeedbackStore((s) => s.deleteFeedback);

  // 登录态：currentUser（null=访客）/ authResolved（/auth/me 回源完毕标记）。
  // 登录/登出/角色与菜单权限变更动作也收敛到 authStore。
  const currentUser = useAuthStore((s) => s.currentUser);
  const authResolved = useAuthStore((s) => s.authResolved);
  const handleLogout = useAuthStore((s) => s.handleLogout);
  const handleUpdateUserRole = useAuthStore((s) => s.updateUserRole);
  const handleUpdateMenuPermissions = useAuthStore((s) => s.updateMenuPermissions);

  // 路由态：收敛到 routerStore（初始 tab 由 readInitialTab 按 旧hash → 路径 → sessionStorage 推导）。
  // navigate 为纯路由跳转（pushState + 更新 state）；详情页 URL 由 openSkillDetail 以 pathOverride 给出。
  const currentTab = useRouterStore((s) => s.currentTab);
  const previousTab = useRouterStore((s) => s.previousTab);
  const navigate = useRouterStore((s) => s.navigate);

  // 生命周期（登录回源 / 主数据拉取 / 名单刷新）与路由副作用（hash 迁移 / 深链 / 前进后退 / ⌘K）
  // 收敛到独立 hook，App 只保留渲染职责。
  useAppLifecycle();
  useRouteEffects();

  // 全局弹窗可见性/上下文 + 详情直达加载态：收敛到 uiStore。
  // 弹窗的可见性/关闭/上下文全部由 <AppModals /> 自读，App 只保留视图仍需要的动作与 detailLoading。
  const detailLoading = useUiStore((s) => s.detailLoading);

  // uiStore 动作（弹窗侧动作在 AppModals 自取）
  const openUploadModal = useUiStore((s) => s.openUploadModal);
  const openCreateDemandModal = useUiStore((s) => s.openCreateDemandModal);
  const openFeedbackModal = useUiStore((s) => s.openFeedbackModal);
  const setNewVersionContext = useUiStore((s) => s.setNewVersionContext);
  const setEditingSkill = useUiStore((s) => s.setEditingSkill);
  const openCommandPalette = useUiStore((s) => s.openCommandPalette);
  const openLoginModal = useUiStore((s) => s.openLoginModal);

  // Toast：收敛到 toastStore
  const toasts = useToastStore((s) => s.toasts);
  const addToast = useToastStore((s) => s.addToast);
  const removeToast = useToastStore((s) => s.removeToast);

  const handleCopyCommand = (cmd: string, clientName?: string) => {
    addToast('success', '指令已复制', `已复制 ${clientName || '安装'} 命令至剪贴板`);
  };

  /**
   * 「发布新版本」入口：把父版本上下文带进 UploadSkillModal
   * @param parent 已存在的父版本 SkillItem
   */
  const openPublishNewVersion = (parent: SkillItem) => {
    setNewVersionContext({
      parentSkillId: parent.id,
      parentSkillName: parent.name,
    });
    openUploadModal();
  };

  // 菜单级权限派生（超管恒全部 / admin 按 menuPermissions 逐项 / 普通用户全不可见）：
  // 收敛到 usePermissions，Header 与各视图守卫共用同一份逻辑，避免两处推导漂移
  const {
    isSuperAdmin,
    canAccessAudit,
    canAccessRules,
    canAccessDemands,
    canAccessFeedback,
    canAccessManage,
  } = usePermissions();

  // 受保护 tab 的登录 + 权限守卫导航（Header 顶部导航调用）
  const guardedNavigate = useGuardedNavigate();

  // 会话回源期间的占位：刷新后若存有令牌，/auth/me 尚未返回前 currentUser 为 null，
  // 依赖登录态的页面直接渲染会闪「请先登录/需要管理员权限」。此占位替代这些状态，
  // 等 authResolved 翻转后再渲染真实内容。
  const authLoadingBlock = (
    <CenteredNotice
      icon={<Loader2 className="w-6 h-6 animate-spin" />}
      title="正在恢复登录状态…"
      description="正在从服务器校验登录会话，请稍候。"
    />
  );

  return (
    <ExpertDomainsProvider>
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Intranet Navbar with RBAC & Auth */}
      <Header
        onSelectTab={guardedNavigate}
        onOpenUpload={() => {
          if (requireAuth('发布新技能')) {
            openUploadModal();
          }
        }}
        onOpenCommandPalette={() => openCommandPalette()}
        onOpenLogin={() => openLoginModal(undefined)}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">
        {/* VIEW 1: MARKETPLACE */}
        {currentTab === 'market' && (
          <MarketplaceView
            skills={skills}
            isLoading={!skillsLoaded}
            onSelectSkill={openSkillDetail}
            onOpenUpload={() => {
              if (requireAuth('发布新技能')) {
                openUploadModal();
              }
            }}
            onOpenDemands={() => navigate('demands')}
            onToggleStar={toggleStar}
            onToggleLike={toggleLike}
            onDownloadZip={downloadZip}
            onCopyInstallCmd={handleCopyCommand}
            currentUser={currentUser}
            onToast={addToast}
            canAccessManage={canAccessManage}
            onOpenManage={() => navigate('manage')}
          />
        )}

        {/* VIEW 2: DEMANDS MARKET */}
        {currentTab === 'demands' && (
          <SkillDemandMarketView
            demands={demands}
            currentUser={currentUser}
            availableSkills={skills}
            canManageDemands={canAccessDemands}
            onOpenCreateDemand={() => {
              if (requireAuth('发布技能征集')) {
                openCreateDemandModal();
              }
            }}
            onSelectDemand={(demand) => setSelectedDemand(demand)}
            onApproveDemand={approveDemand}
            onRejectDemand={rejectDemand}
            onDeleteDemand={deleteDemand}
            onOpenLogin={() => openLoginModal('发布技能征集')}
            onToast={addToast}
          />
        )}

        {/* VIEW 3: SKILL DETAIL PAGE (FULL PAGE) */}
        {currentTab === 'detail' && (
          selectedSkill ? (
            <SkillDetailPage
              skill={selectedSkill}
              onBack={() => navigate(previousTab)}
              onToggleStar={toggleStar}
              onToggleLike={toggleLike}
              onDownloadZip={downloadZip}
              // 重新体检只在管理员的审核工作台进行（运行体检→保存扫描结果），公开详情页不再触发扫描
              onReScanSkill={undefined}
              isScanning={false}
              onCopySuccess={(msg) => addToast('success', '已复制', msg)}
              // 多版本发布：仅 owner/admin 显示版本选择器；切换版本复用详情拉取
              currentUser={currentUser}
              onSelectVersion={openSkillDetail}
              // 大插件源码后台加载中：文件树区域显示遮罩，不阻塞整页
              fileTreeLoading={detailLoading}
            />
          ) : (
            /* 详情页兜底：刷新直达 /skill/:slug 时技能从后端异步拉取，未找到时给出占位 */
            <CenteredNotice
              title={detailLoading ? '正在加载技能详情...' : '未找到该技能'}
              description={
                detailLoading
                  ? '正在从服务器拉取技能信息，请稍候。'
                  : '该技能可能已被删除或下架，请返回技能集市重新选择。'
              }
              actions={
                <button
                  onClick={() => navigate('market')}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-sm hover:bg-indigo-700"
                >
                  返回技能集市
                </button>
              }
            />
          )
        )}

        {/* VIEW 4: PERSONAL CENTER (STARRED, MY SUBMISSIONS & MY DEMANDS) */}
        {currentTab === 'personal' && (
          !authResolved ? (
            authLoadingBlock
          ) : (
          <PersonalCenterView
            currentUser={currentUser}
            allSkills={skills}
            allDemands={demands}
            onSelectSkill={openSkillDetail}
            onSelectDemand={(demand) => setSelectedDemand(demand)}
            onToggleStar={toggleStar}
            onToggleLike={toggleLike}
            onDownloadZip={downloadZip}
            onOpenUploadModal={() => {
              if (requireAuth('发布新技能')) {
                openUploadModal();
              }
            }}
            onOpenCreateDemandModal={() => {
              if (requireAuth('发布技能征集')) {
                openCreateDemandModal();
              }
            }}
            onEditSkillMeta={(skill) => {
              if (requireAuth('编辑元数据')) {
                setEditingSkill(skill);
              }
            }}
            onPublishNewVersion={(skill) => {
              if (requireAuth('发布新版本')) {
                openPublishNewVersion(skill);
              }
            }}
            onOpenLogin={() => openLoginModal('查看个人中心数据')}
            onCopyInstallCmd={(cmd) => addToast('success', '安装命令已复制', cmd)}
            onDeleteDemand={deleteDemand}
            onDeleteVersion={deleteSkillVersion}
            onShuffleAvatar={coordinatorShuffleAvatar}
            onToast={addToast}
          />
          )
        )}

        {/* VIEW 5: ADMIN AUDIT MANAGEMENT */}
        {currentTab === 'audit' && (
          !authResolved ? (
            authLoadingBlock
          ) : canAccessAudit ? (
            <AuditManagementView
              currentUser={currentUser!}
              skills={skills}
              onApproveSkill={approveSkill}
              onRejectSkill={rejectSkill}
              onDelistSkill={delistSkill}
              onRelistSkill={relistSkill}
              onDeleteSkill={deleteSkill}
              onUpdateSkillAudit={updateSkillAudit}
              onToast={addToast}
            />
          ) : (
            <PermissionDenied
              title="需要管理员权限"
              description="审核管理中心属于企业管理员专属模块。请登录并切换为管理员或超级管理员身份体验。"
              onBack={() => navigate('market')}
              loginText="登录管理员账号"
              onLogin={() => openLoginModal('访问审核管理中心')}
            />
          )
        )}

        {/* VIEW 6: RISK CONTROL CENTER (风控中心) */}
        {currentTab === 'rules' && (
          !authResolved ? (
            authLoadingBlock
          ) : canAccessRules ? (
            <RuleManagementView
              currentUser={currentUser!}
              rules={rules}
              deepseekConfig={deepseekConfig}
              onSaveDeepSeekConfig={(cfg) => setDeepseekConfig(cfg)}
              onSaveRule={saveRule}
              onDeleteRule={deleteRule}
              onToggleRule={toggleRule}
              onToast={addToast}
            />
          ) : (
            <PermissionDenied
              title="需要管理员权限"
              description="风控中心属于管理员专属模块。请登录并切换为管理员身份配置。"
              onBack={() => navigate('market')}
              loginText="登录管理员账号"
              onLogin={() => openLoginModal('访问风控中心')}
            />
          )
        )}

        {/* VIEW 7: SUPER ADMIN PERMISSIONS & USER ROLES SETTINGS */}
        {currentTab === 'settings' && (
          !authResolved ? (
            authLoadingBlock
          ) : isSuperAdmin ? (
            <AdminSettingsView
              currentUser={currentUser}
              users={allUsers}
              onUpdateUserRole={handleUpdateUserRole}
              onUpdateMenuPermissions={handleUpdateMenuPermissions}
              onToast={addToast}
            />
          ) : (
            <PermissionDenied
              iconClass="bg-rose-100 text-rose-800"
              title="仅限超级管理员访问"
              description="权限设置中心仅允许超级管理员（Super Admin）管理管理员席位与成员授权。"
              onBack={() => navigate('market')}
              loginText="登录超级管理员"
              onLogin={() => openLoginModal('访问权限设置中心')}
            />
          )
        )}

        {/* VIEW 8: SUGGESTION CENTER (建议反馈，全员可用：管理员管理，普通用户看自己的+提交) */}
        {currentTab === 'feedback' && (
          !authResolved ? (
            authLoadingBlock
          ) : currentUser ? (
            <FeedbackAdminView
              currentUser={currentUser}
              feedbackList={feedbackList}
              canManageFeedback={canAccessFeedback}
              onDeleteFeedback={deleteFeedback}
              onOpenCreateFeedback={openFeedbackModal}
              onToast={addToast}
            />
          ) : (
            <CenteredNotice
              iconClass="bg-indigo-100 text-indigo-700"
              title="登录后使用建议反馈"
              description="登录企业账号后即可提交建议：管理员可查看并管理全部建议，普通用户可查看自己的建议并提交新建议。"
              actions={
                <button
                  onClick={() => openLoginModal('提交建议')}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-sm hover:bg-indigo-700"
                >
                  登录账号
                </button>
              }
            />
          )
        )}

        {/* VIEW 9: 分类和专家组管理（按菜单权限授权） */}
        {currentTab === 'manage' && (
          !authResolved ? (
            authLoadingBlock
          ) : canAccessManage && currentUser ? (
            <CategoryAndDomainView
              currentUser={currentUser}
              skills={skills}
              onRefreshSkills={setSkillsRaw}
              onToast={addToast}
            />
          ) : (
            <PermissionDenied
              iconClass="bg-rose-100 text-rose-800"
              title="分类和专家组管理仅限管理员"
              description="分类与专家组管理属于企业管理员专属模块，请联系超级管理员授予「分类和专家组管理」菜单权限。"
              onBack={() => navigate('market')}
            />
          )
        )}
      </main>

      {/* Footer（直读 store：连接状态点 / 快捷导航 / 反馈入口） */}
      <Footer />

      {/* 全局弹窗挂载点：登录/上传/编辑元数据/发征集/征集详情/反馈/⌘K（AppModals 自读 store） */}
      <AppModals />

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
    </ExpertDomainsProvider>
  );
}
