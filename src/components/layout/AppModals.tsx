import { useUiStore } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
import { useSkillsStore } from '../../stores/skillsStore';
import { useDemandsStore } from '../../stores/demandsStore';
import { useFeedbackStore } from '../../stores/feedbackStore';
import { useToastStore } from '../../stores/toastStore';
import { LoginModal } from '../modals/LoginModal';
import { UploadSkillModal } from '../modals/UploadSkillModal';
import { EditSkillMetaModal } from '../modals/EditSkillMetaModal';
import { CreateSkillDemandModal } from '../modals/CreateSkillDemandModal';
import { SkillDemandDetailModal } from '../modals/SkillDemandDetailModal';
import { FeedbackModal } from '../modals/FeedbackModal';
import { CommandPaletteModal } from '../modals/CommandPaletteModal';

/**
 * 全局弹窗挂载点：登录 / 上传技能（含多版本发布）/ 编辑元数据 / 发布征集 /
 * 征集详情 / 建议反馈 / ⌘K 命令面板。
 *
 * 全部可见性与上下文收敛在 uiStore，动作收敛在各业务 store——这里自读 store，
 * App 层不再为弹窗逐项透传 props（与 Header / Footer 的 store 直读策略一致）。
 * 依赖 DAG：uiStore / authStore / skillsStore / demandsStore / feedbackStore / toastStore 均无环。
 */
export function AppModals() {
  // 弹窗可见性 + 上下文（uiStore）
  const showLoginModal = useUiStore((s) => s.showLoginModal);
  const loginActionHint = useUiStore((s) => s.loginActionHint);
  const showUploadModal = useUiStore((s) => s.showUploadModal);
  const newVersionContext = useUiStore((s) => s.newVersionContext);
  const editingSkill = useUiStore((s) => s.editingSkill);
  const showCreateDemandModal = useUiStore((s) => s.showCreateDemandModal);
  const showFeedbackModal = useUiStore((s) => s.showFeedbackModal);
  const showCommandPalette = useUiStore((s) => s.showCommandPalette);
  const closeLoginModal = useUiStore((s) => s.closeLoginModal);
  const closeUploadModal = useUiStore((s) => s.closeUploadModal);
  const setNewVersionContext = useUiStore((s) => s.setNewVersionContext);
  const setEditingSkill = useUiStore((s) => s.setEditingSkill);
  const closeCreateDemandModal = useUiStore((s) => s.closeCreateDemandModal);
  const closeFeedbackModal = useUiStore((s) => s.closeFeedbackModal);
  const closeCommandPalette = useUiStore((s) => s.closeCommandPalette);
  const openLoginModal = useUiStore((s) => s.openLoginModal);

  // 登录态（authStore）
  const currentUser = useAuthStore((s) => s.currentUser);
  const handleLogin = useAuthStore((s) => s.handleLogin);

  // 技能域（skillsStore）
  const skills = useSkillsStore((s) => s.skills);
  const createSkill = useSkillsStore((s) => s.createSkill);
  const updateSkillMeta = useSkillsStore((s) => s.updateSkillMeta);
  const openSkillDetail = useSkillsStore((s) => s.openSkillDetail);

  // 需求域（demandsStore）
  const selectedDemand = useDemandsStore((s) => s.selectedDemand);
  const setSelectedDemand = useDemandsStore((s) => s.setSelectedDemand);
  const createDemand = useDemandsStore((s) => s.createDemand);
  const approveDemand = useDemandsStore((s) => s.approveDemand);
  const rejectDemand = useDemandsStore((s) => s.rejectDemand);
  const deleteDemand = useDemandsStore((s) => s.deleteDemand);
  const submitSolution = useDemandsStore((s) => s.submitSolution);
  const acceptCandidate = useDemandsStore((s) => s.acceptCandidate);

  // 建议域（feedbackStore）
  const createFeedback = useFeedbackStore((s) => s.createFeedback);

  // Toast（toastStore）
  const addToast = useToastStore((s) => s.addToast);

  return (
    <>
      {/* 1. Login Modal */}
      {showLoginModal && (
        <LoginModal
          isOpen={showLoginModal}
          onClose={closeLoginModal}
          onLogin={handleLogin}
          actionHint={loginActionHint}
        />
      )}

      {/* 2. Upload Skill Modal（含多版本发布：personal 走 newVersionContext 路径） */}
      {showUploadModal && currentUser && (
        <UploadSkillModal
          currentUser={currentUser}
          onClose={() => {
            closeUploadModal();
            setNewVersionContext(null);
          }}
          onSubmit={(s) => {
            createSkill(s);
            setNewVersionContext(null);
          }}
          onToast={addToast}
          parentSkillId={newVersionContext?.parentSkillId}
          parentSkillName={newVersionContext?.parentSkillName}
        />
      )}

      {/* 2b. 编辑技能元数据弹窗 */}
      {editingSkill && currentUser && (
        <EditSkillMetaModal
          skill={editingSkill}
          onClose={() => setEditingSkill(null)}
          onSuccess={updateSkillMeta}
          onToast={addToast}
        />
      )}

      {/* 3. Create Skill Demand Modal */}
      {showCreateDemandModal && (
        <CreateSkillDemandModal
          isOpen={showCreateDemandModal}
          currentUser={currentUser}
          onClose={closeCreateDemandModal}
          onSubmitDemand={createDemand}
          onOpenLogin={() => openLoginModal('发布技能征集')}
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
          onApproveDemand={approveDemand}
          onRejectDemand={rejectDemand}
          onDeleteDemand={deleteDemand}
          onSubmitResponse={submitSolution}
          onAcceptCandidate={acceptCandidate}
          onToast={addToast}
        />
      )}

      {/* 6. Feedback Modal */}
      {showFeedbackModal && currentUser && (
        <FeedbackModal
          currentUser={currentUser}
          onClose={closeFeedbackModal}
          onSubmit={createFeedback}
          onToast={addToast}
        />
      )}

      {/* 7. Command Palette Modal (⌘K) */}
      <CommandPaletteModal
        isOpen={showCommandPalette}
        onClose={closeCommandPalette}
        skills={skills}
        onSelectSkill={(skill) => openSkillDetail(skill)}
      />
    </>
  );
}

