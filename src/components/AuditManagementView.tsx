import React, { useState } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Sparkles, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Loader2, 
  Search, 
  Filter, 
  Eye, 
  Check, 
  X, 
  Layers, 
  FileText
} from 'lucide-react';
import { AuditExecutionSummary, AuditRule, DeepSeekConfig, SkillItem, UserAccount } from '../types';
import { executeDualEngineAudit } from '../utils/auditRunner';
import { AuditReportInspector } from './AuditReportInspector';
import { FileTreeViewer } from './FileTreeViewer';

interface AuditManagementViewProps {
  currentUser: UserAccount;
  skills: SkillItem[];
  rules: AuditRule[];
  deepseekConfig?: DeepSeekConfig;
  onApproveSkill: (id: string, feedback?: string) => void;
  onRejectSkill: (id: string, feedback: string) => void;
  onUpdateSkillAudit: (id: string, summary: AuditExecutionSummary) => void;
  onToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, message: string) => void;
}

export const AuditManagementView: React.FC<AuditManagementViewProps> = ({
  currentUser,
  skills,
  rules,
  deepseekConfig,
  onApproveSkill,
  onRejectSkill,
  onUpdateSkillAudit,
  onToast
}) => {
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'warning' | 'rejected' | 'approved'>('all');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [inspectingSkill, setInspectingSkill] = useState<SkillItem | null>(null);
  const [isScanningId, setIsScanningId] = useState<string | null>(null);
  const [scanProgressText, setScanProgressText] = useState('');

  // Rejection feedback state in modal
  const [rejectFeedback, setRejectFeedback] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  // Inspector modal tab
  const [modalTab, setModalTab] = useState<'audit' | 'files' | 'readme'>('audit');

  const filteredSkills = skills.filter(skill => {
    if (filterStatus === 'pending' && skill.status !== 'pending') return false;
    if (filterStatus === 'rejected' && skill.status !== 'rejected') return false;
    if (filterStatus === 'approved' && skill.status !== 'approved') return false;
    if (filterStatus === 'warning' && skill.auditResults.overallStatus !== 'warning') return false;

    if (searchKeyword.trim()) {
      const kw = searchKeyword.toLowerCase();
      return (
        skill.name.toLowerCase().includes(kw) ||
        skill.slug.toLowerCase().includes(kw) ||
        skill.author.name.toLowerCase().includes(kw) ||
        skill.category.toLowerCase().includes(kw)
      );
    }
    return true;
  });

  const pendingCount = skills.filter(s => s.status === 'pending').length;
  const warningCount = skills.filter(s => s.auditResults.overallStatus === 'warning').length;
  const approvedCount = skills.filter(s => s.status === 'approved').length;
  const rejectedCount = skills.filter(s => s.status === 'rejected').length;

  const handleRunScan = async (skill: SkillItem) => {
    setIsScanningId(skill.id);
    try {
      const summary = await executeDualEngineAudit(
        skill,
        rules,
        (progress) => {
          setScanProgressText(progress);
        },
        deepseekConfig
      );
      onUpdateSkillAudit(skill.id, summary);
      if (inspectingSkill && inspectingSkill.id === skill.id) {
        setInspectingSkill({
          ...inspectingSkill,
          auditResults: summary
        });
      }
      onToast('success', '双引擎扫描完成', `${skill.name} 安全得分: ${summary.score} 分`);
    } catch (err) {
      console.error(err);
      onToast('error', '扫描失败', '执行扫描时发生异常');
    } finally {
      setIsScanningId(null);
      setScanProgressText('');
    }
  };

  const handleApprove = (skillId: string) => {
    onApproveSkill(skillId, '符合内网安全与架构质量规范，予以放行上线。');
    onToast('success', '审核通过', '技能已成功批准并上线至 SkillHub 市场');
    if (inspectingSkill?.id === skillId) {
      setInspectingSkill(null);
    }
  };

  const handleReject = (skillId: string) => {
    if (!rejectFeedback.trim()) {
      onToast('warning', '请填写驳回原因', '请给开发者说明具体的整改要求与安全违规原因');
      return;
    }
    onRejectSkill(skillId, rejectFeedback.trim());
    onToast('info', '已驳回申请', '已将驳回意见同步至提交者进度页');
    setShowRejectInput(false);
    setRejectFeedback('');
    if (inspectingSkill?.id === skillId) {
      setInspectingSkill(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header Card */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200/90 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-purple-50 via-indigo-50 to-transparent rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                <ShieldCheck className="w-5 h-5" />
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                审核管理中心 (超级管理员)
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
              支持对用户提交的 AI 技能开展「正则特征引擎」与「LLM 语义安全引擎」双轨深度扫描，精准定位高危指令、凭据泄露与提示词越狱隐患。
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-4 py-2.5 rounded-2xl bg-amber-50 border border-amber-200 text-center min-w-[90px]">
              <span className="text-[11px] text-amber-800 block font-semibold">待审队列</span>
              <span className="text-xl font-black text-amber-900">{pendingCount}</span>
            </div>
            <div className="px-4 py-2.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-center min-w-[90px]">
              <span className="text-[11px] text-emerald-800 block font-semibold">已上线</span>
              <span className="text-xl font-black text-emerald-900">{approvedCount}</span>
            </div>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-6 pt-4 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-colors ${
                filterStatus === 'all' ? 'bg-indigo-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              全部 ({skills.length})
            </button>
            <button
              onClick={() => setFilterStatus('pending')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-colors ${
                filterStatus === 'pending' ? 'bg-amber-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              待审核 ({pendingCount})
            </button>
            <button
              onClick={() => setFilterStatus('warning')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-colors ${
                filterStatus === 'warning' ? 'bg-orange-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              存在告警 ({warningCount})
            </button>
            <button
              onClick={() => setFilterStatus('approved')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-colors ${
                filterStatus === 'approved' ? 'bg-emerald-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              已通过 ({approvedCount})
            </button>
            <button
              onClick={() => setFilterStatus('rejected')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-colors ${
                filterStatus === 'rejected' ? 'bg-rose-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              已驳回 ({rejectedCount})
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchKeyword}
              onChange={e => setSearchKeyword(e.target.value)}
              placeholder="搜索技能名称/作者/标识..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Review Queue Cards */}
      <div className="space-y-3">
        {filteredSkills.length === 0 ? (
          <div className="p-12 text-center rounded-3xl bg-white border border-slate-200 text-slate-400 text-xs">
            当前筛选条件下暂无需要处理的审核项
          </div>
        ) : (
          filteredSkills.map(skill => {
            const isScanning = isScanningId === skill.id;
            const isPending = skill.status === 'pending';
            const isApproved = skill.status === 'approved';
            const isRejected = skill.status === 'rejected';

            return (
              <div
                key={skill.id}
                id={`audit-queue-card-${skill.id}`}
                className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm hover:border-indigo-200 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                {/* Left info */}
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 uppercase">
                      {skill.category}
                    </span>
                    <span className="text-[11px] font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                      {skill.version}
                    </span>

                    {/* Status marker */}
                    {isPending && (
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>待终审</span>
                      </span>
                    )}
                    {isApproved && (
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>已放行上线</span>
                      </span>
                    )}
                    {isRejected && (
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200 flex items-center gap-1">
                        <XCircle className="w-3 h-3" />
                        <span>已驳回</span>
                      </span>
                    )}

                    <div className="text-[11px] text-slate-500">
                      提交人: <strong className="text-slate-800">{skill.author.name}</strong> ({skill.author.department})
                    </div>
                  </div>

                  <h3 className="text-base font-bold text-slate-900">
                    {skill.name}
                  </h3>
                  <div className="text-xs font-mono text-indigo-600 font-semibold">
                    {skill.slug}
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-1">
                    {skill.description}
                  </p>
                </div>

                {/* Score & Dual-engine badges */}
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-center px-3.5 py-2 rounded-2xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] text-slate-500 block font-semibold">双引擎得分</span>
                    <span className={`text-base font-extrabold ${
                      skill.auditResults.score >= 90 ? 'text-emerald-600' :
                      skill.auditResults.score >= 60 ? 'text-amber-600' : 'text-rose-600'
                    }`}>
                      {skill.auditResults.score} 分
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => handleRunScan(skill)}
                      disabled={isScanning}
                      className="px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50 border border-indigo-200/80"
                      title="重新执行双引擎扫描"
                    >
                      {isScanning ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>扫描中...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>双引擎重扫</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => {
                        setInspectingSkill(skill);
                        setShowRejectInput(false);
                      }}
                      className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold flex items-center gap-1.5 hover:bg-slate-800 transition-colors shadow-2xs active:scale-95"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>审核工作台</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Review & Inspection Modal Workspace */}
      {inspectingSkill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/75 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
          <div className="relative w-full max-w-5xl bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 uppercase">
                    {inspectingSkill.category}
                  </span>
                  <h3 className="text-lg font-bold text-slate-900">
                    {inspectingSkill.name} - 终审工作台
                  </h3>
                </div>
                <div className="text-xs font-mono text-slate-500">
                  {inspectingSkill.slug} · 作者: {inspectingSkill.author.name}
                </div>
              </div>

              <button
                onClick={() => setInspectingSkill(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex items-center gap-2 px-5 border-b border-slate-200 bg-white shrink-0">
              <button
                onClick={() => setModalTab('audit')}
                className={`py-3 px-3 border-b-2 text-xs font-bold flex items-center gap-1.5 transition-colors ${
                  modalTab === 'audit'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>双引擎安全体检报告 ({inspectingSkill.auditResults.score}分)</span>
              </button>

              <button
                onClick={() => setModalTab('files')}
                className={`py-3 px-3 border-b-2 text-xs font-bold flex items-center gap-1.5 transition-colors ${
                  modalTab === 'files'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>ZIP 包源码与目录树 ({inspectingSkill.fileTree.length})</span>
              </button>

              <button
                onClick={() => setModalTab('readme')}
                className={`py-3 px-3 border-b-2 text-xs font-bold flex items-center gap-1.5 transition-colors ${
                  modalTab === 'readme'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>使用文档 (README)</span>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50">
              {modalTab === 'audit' && (
                <AuditReportInspector
                  summary={inspectingSkill.auditResults}
                  onReScan={() => handleRunScan(inspectingSkill)}
                  isScanning={isScanningId === inspectingSkill.id}
                  onViewFileInTree={() => setModalTab('files')}
                />
              )}

              {modalTab === 'files' && (
                <div className="space-y-3">
                  <div className="text-xs text-slate-500 font-semibold">
                    正在核验提交的 ZIP 源码包结构：
                  </div>
                  <FileTreeViewer tree={inspectingSkill.fileTree} />
                </div>
              )}

              {modalTab === 'readme' && (
                <div className="p-6 rounded-2xl bg-white border border-slate-200 text-xs sm:text-sm whitespace-pre-wrap leading-relaxed text-slate-800">
                  {inspectingSkill.readme}
                </div>
              )}
            </div>

            {/* Rejection input drawer */}
            {showRejectInput && (
              <div className="p-4 bg-rose-50 border-t border-rose-200 space-y-2 animate-in slide-in-from-bottom-2 duration-150">
                <div className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>请输入驳回原因与整改意见（将通知作者并显示在个人进度页）：</span>
                </div>
                <textarea
                  rows={3}
                  value={rejectFeedback}
                  onChange={e => setRejectFeedback(e.target.value)}
                  placeholder="例如：发现包含未授权的敏感外部网络调用与硬编码凭据，请遵循最小特权原则修改后重新提交..."
                  className="w-full p-2.5 rounded-xl border border-rose-300 bg-white text-slate-900 text-xs focus:ring-2 focus:ring-rose-500 outline-none"
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => setShowRejectInput(false)}
                    className="px-3 py-1.5 rounded-lg border border-rose-300 text-rose-700 text-xs font-semibold"
                  >
                    取消
                  </button>
                  <button
                    onClick={() => handleReject(inspectingSkill.id)}
                    className="px-4 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-500"
                  >
                    确认驳回
                  </button>
                </div>
              </div>
            )}

            {/* Modal Bottom Actions */}
            <div className="p-4 border-t border-slate-200 bg-white flex items-center justify-between shrink-0">
              <div className="text-xs text-slate-500 font-medium">
                当前状态: <strong className="text-slate-800 font-bold uppercase">{inspectingSkill.status}</strong>
              </div>

              <div className="flex items-center gap-2">
                {!showRejectInput && (
                  <button
                    onClick={() => setShowRejectInput(true)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-colors"
                  >
                    <X className="w-4 h-4" />
                    <span>驳回修改</span>
                  </button>
                )}

                <button
                  onClick={() => handleApprove(inspectingSkill.id)}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md active:scale-95"
                >
                  <Check className="w-4 h-4" />
                  <span>批准上线</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
