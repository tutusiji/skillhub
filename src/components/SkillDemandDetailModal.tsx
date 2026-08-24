import React, { useState } from 'react';
import { 
  X, 
  Coins, 
  Clock, 
  User, 
  CheckCircle2, 
  XCircle, 
  Trash2, 
  AlertTriangle, 
  Share2, 
  Send, 
  MessageSquare, 
  Layers, 
  Building,
  Sparkles,
  ShieldAlert,
  Check,
  Tag,
  ExternalLink
} from 'lucide-react';
import { SkillDemand, UserAccount, SkillItem } from '../types';
import { getExpertDomainMeta } from '../data/expertDomains';

interface SkillDemandDetailModalProps {
  demand: SkillDemand | null;
  currentUser: UserAccount | null;
  availableSkills: SkillItem[];
  isOpen: boolean;
  onClose: () => void;
  onApproveDemand?: (id: string) => void;
  onRejectDemand?: (id: string, reason: string) => void;
  onDeleteDemand?: (id: string) => void;
  onSubmitResponse?: (demandId: string, solutionNote: string, skillId?: string) => void;
  onAcceptCandidate?: (demandId: string, candidateId: string) => void;
  onToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, message: string) => void;
}

export const SkillDemandDetailModal: React.FC<SkillDemandDetailModalProps> = ({
  demand,
  currentUser,
  availableSkills,
  isOpen,
  onClose,
  onApproveDemand,
  onRejectDemand,
  onDeleteDemand,
  onSubmitResponse,
  onAcceptCandidate,
  onToast
}) => {
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectBox, setShowRejectBox] = useState(false);
  const [solutionNote, setSolutionNote] = useState('');
  const [selectedSkillId, setSelectedSkillId] = useState<string>('');
  const [showRespondBox, setShowRespondBox] = useState(false);

  if (!isOpen || !demand) return null;

  const domainMeta = getExpertDomainMeta(demand.targetDomain);
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const isAdmin = currentUser?.role === 'admin' || isSuperAdmin;
  const isAuthor = currentUser?.id === demand.author.id;
  const candidates = demand.candidates ?? [];
  // 已完结需求不可再次验收，积分只能发放一次
  const canAcceptCandidates =
    (isAuthor || isAdmin) && demand.status !== 'fulfilled' && !!onAcceptCandidate;
  // 同一用户只能揭榜一次，已提交后隐藏入口
  const hasSubmitted = candidates.some(c => c.submitterId === currentUser?.id);

  // 审核/驳回/删除的结果提示由 App.tsx 依据后端响应统一发出，
  // 此处不再乐观提示，避免后端失败时仍显示"成功"
  const handleApprove = () => {
    if (onApproveDemand) {
      onApproveDemand(demand.id);
      onClose();
    }
  };

  const handleReject = () => {
    if (!rejectReason.trim()) {
      onToast('warning', '请填写驳回理由', '需要告知发布者具体驳回理由以便整改');
      return;
    }
    if (onRejectDemand) {
      onRejectDemand(demand.id, rejectReason.trim());
      setShowRejectBox(false);
      onClose();
    }
  };

  const handleDelete = () => {
    if (window.confirm('确定要删除此技能需求吗？如果是发布者删除，冻结的奖励积分将退回。')) {
      if (onDeleteDemand) {
        onDeleteDemand(demand.id);
        onClose();
      }
    }
  };

  /**
   * 采纳指定方案，二次确认后由后端发放悬赏积分
   * @param candidateId 方案 ID
   * @param submitterName 方案提交者姓名，用于确认文案
   */
  const handleAccept = (candidateId: string, submitterName: string) => {
    if (!onAcceptCandidate) return;
    if (
      window.confirm(
        `确认采纳 ${submitterName} 的方案吗？\n\n${demand.bountyPoints} 悬赏积分将发放给该开发者，需求随即标记为已完结，此操作不可撤销。`
      )
    ) {
      onAcceptCandidate(demand.id, candidateId);
    }
  };

  const handleRespond = (e: React.FormEvent) => {
    e.preventDefault();
    if (!solutionNote.trim() && !selectedSkillId) {
      onToast('warning', '内容未填写', '请填写响应说明或选择您已发布的技能');
      return;
    }
    if (onSubmitResponse) {
      onSubmitResponse(demand.id, solutionNote.trim(), selectedSkillId || undefined);
      setShowRespondBox(false);
      setSolutionNote('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 relative my-8 text-left space-y-6">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Top Badges */}
        <div className="flex items-center gap-2.5 flex-wrap pr-8">
          <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${domainMeta.badgeBg} ${domainMeta.badgeText} ${domainMeta.badgeBorder || domainMeta.border || 'border-slate-200'}`}>
            {domainMeta.shortLabel} · {domainMeta.name}
          </span>

          {(demand.status === 'open' || demand.status === 'approved') && (
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              火热征集中
            </span>
          )}

          {demand.status === 'pending' && (
            <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-bold border border-amber-200 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              待管理员审核
            </span>
          )}

          {demand.status === 'rejected' && (
            <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 text-xs font-bold border border-rose-200 flex items-center gap-1">
              <XCircle className="w-3.5 h-3.5" />
              已被驳回
            </span>
          )}

          {demand.status === 'fulfilled' && (
            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              已采纳完结
            </span>
          )}

          <div className="ml-auto px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-300 text-amber-900 font-black text-sm flex items-center gap-1.5 shadow-2xs">
            <span>🪙</span>
            <span>{demand.bountyPoints.toLocaleString()} 积分</span>
          </div>
        </div>

        {/* Title */}
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 leading-snug">
            {demand.title}
          </h2>
          <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              发布于 {new Date(demand.createdAt).toLocaleDateString()}
            </span>
            <span className="flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              周期：{demand.deadlineText || '永久有效'}
            </span>
          </div>
        </div>

        {/* Rejection notice if any */}
        {demand.status === 'rejected' && demand.rejectReason && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 space-y-1">
            <div className="flex items-center gap-2 font-bold text-xs">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              <span>管理员驳回理由</span>
            </div>
            <p className="text-xs text-rose-700 leading-relaxed font-medium">
              {demand.rejectReason}
            </p>
          </div>
        )}

        {/* Author info card */}
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <img
              src={demand.author.avatar}
              alt={demand.author.name}
              className="w-10 h-10 rounded-full object-cover border border-slate-200"
            />
            <div>
              <div className="text-xs font-bold text-slate-800">{demand.author.name}</div>
              <div className="text-[11px] text-slate-500">{demand.author.department}</div>
            </div>
          </div>
          <div className="text-right text-[11px] text-slate-400">
            {isAuthor && (
              <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-bold border border-indigo-200">
                我发起的需求
              </span>
            )}
          </div>
        </div>

        {/* Main Content Body */}
        <div className="space-y-4">
          <div>
            <h4 className="text-xs font-bold text-slate-900 mb-1.5 uppercase tracking-wider">
              业务场景与具体需求说明
            </h4>
            <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap font-mono">
              {demand.description}
            </div>
          </div>

          {demand.expectedOutput && (
            <div>
              <h4 className="text-xs font-bold text-slate-900 mb-1.5 uppercase tracking-wider">
                期望交付标准与协议规范
              </h4>
              <div className="p-3.5 rounded-2xl bg-indigo-50/40 border border-indigo-100 text-xs text-indigo-900">
                {demand.expectedOutput}
              </div>
            </div>
          )}
        </div>

        {/* Submissions Section */}
        <div className="pt-2 border-t border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-indigo-500" />
              <span>揭榜与技术方案响应 ({demand.submissionsCount || 0})</span>
            </h4>
            {currentUser && !isAuthor && !hasSubmitted && (demand.status === 'open' || demand.status === 'approved') && !showRespondBox && (
              <button
                onClick={() => setShowRespondBox(true)}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-sm"
              >
                我要揭榜响应
              </button>
            )}
          </div>

          {/* Respond Form */}
          {showRespondBox && (
            <form onSubmit={handleRespond} className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-200 space-y-3">
              <div className="text-xs font-bold text-indigo-950">提交我的 AI 技能方案</div>
              <div>
                <label className="block text-[11px] text-slate-600 mb-1">
                  关联我已发布的技能 (选填)
                </label>
                <select
                  value={selectedSkillId}
                  onChange={e => setSelectedSkillId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-800"
                >
                  <option value="">-- 选择现有技能或稍后上传 --</option>
                  {availableSkills.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.version})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-slate-600 mb-1">
                  方案思路与交付说明
                </label>
                <textarea
                  rows={2}
                  value={solutionNote}
                  onChange={e => setSolutionNote(e.target.value)}
                  placeholder="说明你的插件架构设计、如何解决提问者的业务痛点..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 resize-none"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRespondBox(false)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-600 hover:bg-white"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-500 flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  提交揭榜方案
                </button>
              </div>
            </form>
          )}

          {/* 应征方案清单：发布者可在此验收并发放悬赏积分 */}
          {candidates.length > 0 && (
            <div className="space-y-2.5">
              {candidates.map(candidate => (
                <div
                  key={candidate.id}
                  className={`p-3.5 rounded-2xl border space-y-2 ${
                    candidate.status === 'accepted'
                      ? 'bg-emerald-50/70 border-emerald-200'
                      : candidate.status === 'rejected'
                        ? 'bg-slate-50 border-slate-200 opacity-70'
                        : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <img
                      src={candidate.submitterAvatar}
                      alt={candidate.submitterName}
                      className="w-7 h-7 rounded-full object-cover border border-slate-200"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-800 truncate">
                        {candidate.submitterName}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {new Date(candidate.submittedAt).toLocaleString()}
                      </div>
                    </div>

                    {candidate.status === 'accepted' && (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-bold border border-emerald-300 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        已中选并发放积分
                      </span>
                    )}
                    {candidate.status === 'rejected' && (
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[11px] font-bold border border-slate-200">
                        未中选
                      </span>
                    )}

                    {/* 仅需求发布者/管理员可在未完结时验收方案 */}
                    {canAcceptCandidates && candidate.status === 'pending' && (
                      <button
                        onClick={() => handleAccept(candidate.id, candidate.submitterName)}
                        className="ml-auto px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                        title={`采纳该方案并发放 ${demand.bountyPoints} 积分`}
                      >
                        <Coins className="w-3.5 h-3.5" />
                        <span>采纳并发放积分</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] text-indigo-700 font-bold">
                    <Layers className="w-3.5 h-3.5" />
                    <span className="truncate">{candidate.skillName}</span>
                  </div>

                  {candidate.notes && (
                    <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                      {candidate.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {candidates.length === 0 && !showRespondBox && (
            <div className="p-6 rounded-2xl bg-slate-50 text-center text-xs text-slate-400">
              暂无揭榜方案，成为第一个响应并赢取 <strong>{demand.bountyPoints} 积分</strong> 的开发者吧！
            </div>
          )}
        </div>

        {/* Reject reason input box */}
        {showRejectBox && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 space-y-2.5">
            <div className="text-xs font-bold text-rose-900">请填写驳回理由并反馈给发布者：</div>
            <textarea
              rows={2}
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="例如：需求描述不够清晰 / 涉及非合规敏感业务数据调用 / 建议补充具体输入输出规范..."
              className="w-full px-3 py-2 rounded-xl border border-rose-300 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowRejectBox(false)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-600 hover:bg-white"
              >
                取消
              </button>
              <button
                onClick={handleReject}
                className="px-4 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-500"
              >
                确认驳回
              </button>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between flex-wrap gap-3 pt-3 border-t border-slate-100">
          <div>
            {/* Delete button for author or admin */}
            {(isAuthor || isAdmin) && (
              <button
                onClick={handleDelete}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isAuthor ? '撤销并退回积分' : '管理员删除'}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {/* Admin Audit Actions */}
            {isAdmin && demand.status === 'pending' && !showRejectBox && (
              <>
                <button
                  onClick={() => setShowRejectBox(true)}
                  className="px-4 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-bold transition-colors flex items-center gap-1.5"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>驳回</span>
                </button>
                <button
                  onClick={handleApprove}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-500/20 flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>审核通过并公开</span>
                </button>
              </>
            )}

            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
