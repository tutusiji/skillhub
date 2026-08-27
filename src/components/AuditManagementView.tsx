import React, { useEffect, useState } from 'react';
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
  FileText,
  ArrowDownCircle,
  ArrowUpCircle,
  Trash2,
  PackageCheck,
  PackageX
} from 'lucide-react';
import { AuditExecutionSummary, AuditRule, DeepSeekConfig, SkillItem, UserAccount } from '../types';
import { executeDualEngineAudit } from '../utils/auditRunner';
import { api, mapApiSkill } from '../services/api';
import { AuditReportInspector } from './AuditReportInspector';
import { FileTreeViewer } from './FileTreeViewer';
import { PopconfirmBubble } from './PopconfirmBubble';

interface AuditManagementViewProps {
  currentUser: UserAccount;
  skills: SkillItem[];
  rules: AuditRule[];
  deepseekConfig?: DeepSeekConfig;
  onApproveSkill: (id: string, feedback?: string) => void;
  onRejectSkill: (id: string, feedback: string) => void;
  onDelistSkill?: (id: string) => void;
  onRelistSkill?: (id: string) => void;
  onDeleteSkill?: (id: string) => void;
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
  onDelistSkill,
  onRelistSkill,
  onDeleteSkill,
  onUpdateSkillAudit,
  onToast
}) => {
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'warning' | 'rejected' | 'approved' | 'offline'>('all');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [inspectingSkill, setInspectingSkill] = useState<SkillItem | null>(null);
  const [isScanningId, setIsScanningId] = useState<string | null>(null);
  const [scanProgressText, setScanProgressText] = useState('');

  // Rejection feedback state in modal
  const [rejectFeedback, setRejectFeedback] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  // Inspector modal tab
  const [modalTab, setModalTab] = useState<'audit' | 'files' | 'readme'>('audit');

  /**
   * 详情补全状态：列表接口 (LIST_SKILL_COLUMNS) 显式不返回 fileTree，
   * 审核工作台需要源码预览，必须按需请求 /api/v1/skills/:slug 详情接口。
   * 用 id 记录正在补全的技能，避免并发切换时把上一次响应回写到当前技能。
   */
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);

  // 打开审核工作台时，如果 fileTree 没内容，主动拉一次详情补全
  useEffect(() => {
    if (!inspectingSkill) return;
    const hasContent = (inspectingSkill.fileTree || []).some(
      (n) => n.content || (n.children && n.children.some((c) => c.content))
    );
    if (hasContent) return;
    const skillId = inspectingSkill.id;
    const slugOrId = inspectingSkill.slug || inspectingSkill.id;
    let cancelled = false;
    setDetailLoadingId(skillId);
    api
      .getSkill(slugOrId)
      .then((detail) => {
        if (cancelled) return;
        const full = mapApiSkill(detail);
        setInspectingSkill((prev) =>
          prev && prev.id === skillId
            ? {
                ...prev,
                fileTree: full.fileTree,
                readme: full.readme || prev.readme,
                installCommands: full.installCommands || prev.installCommands,
              }
            : prev
        );
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn('拉取审核工作台详情失败:', err);
        onToast('warning', '源码加载失败', '后端详情接口异常，源码树暂不可预览（不影响其他审核操作）');
      })
      .finally(() => {
        if (!cancelled) setDetailLoadingId((cur) => (cur === skillId ? null : cur));
      });
    return () => {
      cancelled = true;
    };
  }, [inspectingSkill?.id]);

  const filteredSkills = skills.filter(skill => {
    if (filterStatus === 'pending' && skill.status !== 'pending') return false;
    if (filterStatus === 'rejected' && skill.status !== 'rejected') return false;
    if (filterStatus === 'approved' && skill.status !== 'approved') return false;
    if (filterStatus === 'offline' && skill.status !== 'offline') return false;
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
  const offlineCount = skills.filter(s => s.status === 'offline').length;
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
      setInspectingSkill(prev => prev ? { ...prev, status: 'approved' } : null);
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
      setInspectingSkill(prev => prev ? { ...prev, status: 'rejected' } : null);
    }
  };

  const handleDelist = (skill: SkillItem) => {
    if (onDelistSkill) {
      onDelistSkill(skill.id);
    }
    if (inspectingSkill && inspectingSkill.id === skill.id) {
      setInspectingSkill(prev => prev ? { ...prev, status: 'offline' } : null);
    }
    onToast('warning', '插件已下架', `《${skill.name}》已下架并在集市隐藏，转为下架维护状态`);
  };

  const handleRelist = (skill: SkillItem) => {
    if (onRelistSkill) {
      onRelistSkill(skill.id);
    }
    if (inspectingSkill && inspectingSkill.id === skill.id) {
      setInspectingSkill(prev => prev ? { ...prev, status: 'approved' } : null);
    }
    onToast('success', '插件已上架', `《${skill.name}》已重新在企业集市公开并开放安装`);
  };

  const handleDelete = (skill: SkillItem) => {
    if (onDeleteSkill) {
      onDeleteSkill(skill.id);
    }
    if (inspectingSkill && inspectingSkill.id === skill.id) {
      setInspectingSkill(null);
      setDetailLoadingId(null);
    }
    onToast('info', '插件已删除', `已彻底移除插件《${skill.name}》`);
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
              支持对用户提交的 AI 技能开展「正则特征引擎」与「LLM 语义安全引擎」双轨深度扫描，支持对已过审插件进行一键上架、下架管控与安全生命周期管理。
            </p>
          </div>

          {/* Metric Status Badges */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="px-3.5 py-2 rounded-2xl bg-amber-50 border border-amber-200 text-center min-w-[76px]">
              <span className="text-[10px] text-amber-800 block font-semibold">待审队列</span>
              <span className="text-lg font-black text-amber-900">{pendingCount}</span>
            </div>
            <div className="px-3.5 py-2 rounded-2xl bg-emerald-50 border border-emerald-200 text-center min-w-[76px]">
              <span className="text-[10px] text-emerald-800 block font-semibold">已上架</span>
              <span className="text-lg font-black text-emerald-900">{approvedCount}</span>
            </div>
            <div className="px-3.5 py-2 rounded-2xl bg-slate-100 border border-slate-200 text-center min-w-[76px]">
              <span className="text-[10px] text-slate-600 block font-semibold">已下架</span>
              <span className="text-lg font-black text-slate-800">{offlineCount}</span>
            </div>
            <div className="px-3.5 py-2 rounded-2xl bg-rose-50 border border-rose-200 text-center min-w-[76px]">
              <span className="text-[10px] text-rose-800 block font-semibold">已驳回</span>
              <span className="text-lg font-black text-rose-900">{rejectedCount}</span>
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
              onClick={() => setFilterStatus('approved')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-colors ${
                filterStatus === 'approved' ? 'bg-emerald-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              已上架 ({approvedCount})
            </button>
            <button
              onClick={() => setFilterStatus('offline')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-colors ${
                filterStatus === 'offline' ? 'bg-slate-700 text-white shadow-2xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              已下架 ({offlineCount})
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
            const isOffline = skill.status === 'offline';
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
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>已上架 (集市公开)</span>
                      </span>
                    )}
                    {isOffline && (
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-300 flex items-center gap-1">
                        <ArrowDownCircle className="w-3 h-3 text-slate-500" />
                        <span>已下架 (集市隐藏)</span>
                      </span>
                    )}
                    {isRejected && (
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200 flex items-center gap-1">
                        <XCircle className="w-3 h-3 text-rose-600" />
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
                <div className="flex items-center gap-3 shrink-0 flex-wrap sm:flex-nowrap">
                  <div className="text-center px-3.5 py-2 rounded-2xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] text-slate-500 block font-semibold">双引擎得分</span>
                    <span className={`text-base font-extrabold ${
                      skill.auditResults.score >= 90 ? 'text-emerald-600' :
                      skill.auditResults.score >= 60 ? 'text-amber-600' : 'text-rose-600'
                    }`}>
                      {skill.auditResults.score} 分
                    </span>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Dual Engine Re-Scan */}
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
                          <span>重扫</span>
                        </>
                      )}
                    </button>

                    {/* Published / Approved Status Controls: Delist & Relist */}
                    {isApproved && (
                      <PopconfirmBubble
                        title="确定下架该插件吗？"
                        description={`下架后《${skill.name}》将从企业集市中对普通开发者隐藏，无法被检索与下载。已安装使用的环境不受影响。`}
                        confirmText="确认下架"
                        cancelText="取消"
                        type="warning"
                        placement="bottom-right"
                        onConfirm={() => handleDelist(skill)}
                        trigger={({ onClick }) => (
                          <button
                            onClick={onClick}
                            id={`btn-delist-${skill.id}`}
                            className="px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold flex items-center gap-1.5 transition-colors border border-amber-200"
                            title="从集市下架该插件"
                          >
                            <ArrowDownCircle className="w-3.5 h-3.5 text-amber-600" />
                            <span>下架</span>
                          </button>
                        )}
                      />
                    )}

                    {isOffline && (
                      <button
                        onClick={() => handleRelist(skill)}
                        id={`btn-relist-${skill.id}`}
                        className="px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center gap-1.5 transition-colors border border-emerald-200"
                        title="重新上架至企业集市"
                      >
                        <ArrowUpCircle className="w-3.5 h-3.5 text-emerald-600" />
                        <span>重新上架</span>
                      </button>
                    )}

                    {/* Delete Skill Button with Popconfirm */}
                    <PopconfirmBubble
                      title="确定彻底删除该插件？"
                      description={`确定要永久删除《${skill.name}》吗？此操作不可撤销，该技能的所有版本文件、源码树及安全体检记录将被永久清除。`}
                      confirmText="彻底删除"
                      cancelText="取消"
                      type="danger"
                      placement="bottom-right"
                      onConfirm={() => handleDelete(skill)}
                      trigger={({ onClick }) => (
                        <button
                          onClick={onClick}
                          id={`btn-delete-${skill.id}`}
                          className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors"
                          title="彻底删除插件"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    />

                    {/* Audit Workspace Modal Trigger */}
                    <button
                      onClick={() => {
                        setInspectingSkill(skill);
                        setShowRejectInput(false);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold flex items-center gap-1.5 hover:bg-slate-800 transition-colors shadow-2xs active:scale-95"
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
          <div className="relative w-full max-w-5xl bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col h-[min(820px,92vh)]">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 uppercase">
                    {inspectingSkill.category}
                  </span>
                  <h3 className="text-lg font-bold text-slate-900">
                    {inspectingSkill.name} - 终审与生命周期管理
                  </h3>
                </div>
                <div className="text-xs font-mono text-slate-500">
                  {inspectingSkill.slug} · 作者: {inspectingSkill.author.name}
                </div>
              </div>

              <button
                onClick={() => {
                  setInspectingSkill(null);
                  setDetailLoadingId(null);
                }}
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
            <div className="p-6 overflow-y-auto flex-1 min-h-0 bg-slate-50/50">
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
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-slate-500 font-semibold">
                      正在核验提交的 ZIP 源码包结构：
                    </div>
                    {detailLoadingId === inspectingSkill.id && (
                      <span className="inline-flex items-center gap-1.5 text-[11px] text-indigo-700 font-semibold">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>正在补全源码...</span>
                      </span>
                    )}
                  </div>
                  {inspectingSkill.fileTree.length === 0 ? (
                    detailLoadingId === inspectingSkill.id ? (
                      <div className="h-[460px] flex items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white text-xs text-slate-500">
                        正在从后端详情接口拉取文件树，请稍候...
                      </div>
                    ) : (
                      <div className="h-[460px] flex items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white text-xs text-slate-500">
                        该技能未提供源码文件树（可能上传时未解析 ZIP）
                      </div>
                    )
                  ) : (
                    <FileTreeViewer tree={inspectingSkill.fileTree} />
                  )}
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
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500 font-medium">当前生命周期状态:</span>
                {inspectingSkill.status === 'approved' && (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>已上架 (公开)</span>
                  </span>
                )}
                {inspectingSkill.status === 'offline' && (
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold border border-slate-300 flex items-center gap-1">
                    <ArrowDownCircle className="w-3 h-3" />
                    <span>已下架 (维护隐藏)</span>
                  </span>
                )}
                {inspectingSkill.status === 'pending' && (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 font-bold border border-amber-200 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>待终审</span>
                  </span>
                )}
                {inspectingSkill.status === 'rejected' && (
                  <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-800 font-bold border border-rose-200 flex items-center gap-1">
                    <XCircle className="w-3 h-3" />
                    <span>已驳回</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Delete button inside modal */}
                <PopconfirmBubble
                  title="确定彻底删除该插件？"
                  description={`永久移除《${inspectingSkill.name}》的所有文件和体检数据。此操作不可逆。`}
                  confirmText="彻底删除"
                  cancelText="取消"
                  type="danger"
                  placement="top-right"
                  onConfirm={() => handleDelete(inspectingSkill)}
                  trigger={({ onClick }) => (
                    <button
                      onClick={onClick}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 border border-rose-200 text-xs font-bold transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>删除插件</span>
                    </button>
                  )}
                />

                {/* If approved: Delist option */}
                {inspectingSkill.status === 'approved' && (
                  <PopconfirmBubble
                    title="确定下架该插件？"
                    description={`下架后《${inspectingSkill.name}》将从企业集市中隐藏，普通开发者将无法检索。`}
                    confirmText="确认下架"
                    cancelText="取消"
                    type="warning"
                    placement="top-right"
                    onConfirm={() => handleDelist(inspectingSkill)}
                    trigger={({ onClick }) => (
                      <button
                        onClick={onClick}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold transition-colors"
                      >
                        <ArrowDownCircle className="w-4 h-4 text-amber-600" />
                        <span>下架插件</span>
                      </button>
                    )}
                  />
                )}

                {/* If offline: Relist option */}
                {inspectingSkill.status === 'offline' && (
                  <button
                    onClick={() => handleRelist(inspectingSkill)}
                    className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md active:scale-95"
                  >
                    <ArrowUpCircle className="w-4 h-4" />
                    <span>重新上架至集市</span>
                  </button>
                )}

                {/* If pending or rejected: Reject & Approve buttons */}
                {(inspectingSkill.status === 'pending' || inspectingSkill.status === 'rejected') && (
                  <>
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
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
