import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft,
  Download, 
  Star, 
  Heart, 
  Terminal, 
  Copy, 
  Check, 
  ShieldCheck, 
  ShieldAlert, 
  FileText, 
  FolderTree, 
  Shield, 
  Lock, 
  Calendar, 
  Sparkles, 
  ExternalLink,
  Layers,
  Code2,
  ChevronRight,
  Share2,
  Cpu,
  UserCheck,
  ArrowDownCircle,
  GitBranch,
  Loader2
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { SkillItem, AuditExecutionSummary } from '../../types';
import { api, mapApiSkill } from '../../services/api';
import { FileTreeViewer } from '../ui/FileTreeViewer';
import { AuditReportInspector } from '../modals/AuditReportInspector';
import { getMarketplaceAddCommand, getMarketplaceUpdateCommand } from '../../utils/marketplace';
import { Avatar } from '../ui/Avatar';
import { Select } from '../ui/Select';

interface SkillDetailPageProps {
  skill: SkillItem;
  onBack: () => void;
  onToggleStar: (id: string) => boolean | void;
  onToggleLike: (id: string) => boolean | void;
  onDownloadZip: (skill: SkillItem) => void;
  onReScanSkill?: (skill: SkillItem) => void;
  isScanning?: boolean;
  onCopySuccess: (msg: string) => void;
  /**
   * 当前登录用户：用于判定是否显示版本选择器
   * 公开用户不显示，只有 owner 或 admin 看到 picker
   */
  currentUser?: { id: string; role: string } | null;
  /**
   * 切换到指定历史版本（owner / admin 用）
   * 不传则禁用 picker 交互
   */
  onSelectVersion?: (skill: SkillItem) => void;
  /**
   * 源码文件树是否仍在后台加载（大插件详情不阻塞整页，文件树区域单独转圈）
   * 列表/详情接口都不含大源码时置 true，到货后 App 回填 skill.fileTree 再转 false
   */
  fileTreeLoading?: boolean;
}

type TabKey = 'readme' | 'files' | 'audit' | 'install' | 'permissions';

export const SkillDetailPage: React.FC<SkillDetailPageProps> = ({
  skill,
  onBack,
  onToggleStar,
  onToggleLike,
  onDownloadZip,
  onReScanSkill,
  isScanning = false,
  onCopySuccess,
  currentUser,
  onSelectVersion,
  fileTreeLoading = false,
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>('readme');
  const [activeCliTab, setActiveCliTab] = useState<'claude' | 'cursor' | 'mcp' | 'cli'>('claude');
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [copiedMarketCmd, setCopiedMarketCmd] = useState(false);
  const [copiedMarketUpdateCmd, setCopiedMarketUpdateCmd] = useState(false);
  const [highlightedFileInTree, setHighlightedFileInTree] = useState<string | undefined>(undefined);

  // 多版本发布：版本选择器状态（仅 owner / admin 可见）
  // 通过 api.getSkillVersions 拉取完整版本链，archived 仅 owner/admin 可见由后端收敛
  const [versions, setVersions] = useState<SkillItem[] | null>(null);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const isOwnerOrAdmin =
    !!currentUser &&
    (currentUser.role === 'admin' ||
      currentUser.role === 'super_admin' ||
      currentUser.id === skill.submitterId);

  useEffect(() => {
    if (!isOwnerOrAdmin) {
      setVersions(null);
      return;
    }
    // 只有当技能在版本链上（parentSkillId 存在，或者有 sibling）才拉取
    // 简化：只要不是单版本（链长 1），就拉一次
    let cancelled = false;
    setVersionsLoading(true);
    api
      .getSkillVersions(skill.id)
      .then(list => {
        if (cancelled) return;
        const mapped = (list as any[]).map(mapApiSkill);
        setVersions(mapped.length > 1 ? mapped : null);
      })
      .catch(() => {
        if (!cancelled) setVersions(null);
      })
      .finally(() => {
        if (!cancelled) setVersionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skill.id, isOwnerOrAdmin]);

  // —— 双引擎审计报告明细：独立接口按需拉取，不阻塞整页 ——
  // 列表/详情接口只带分数（auditScore），正则命中与 LLM 语义研判明细在
  // audit_reports 表里，通过 /skills/:id/audit-report 单独取数。打开审计 tab
  // 时才请求，加载完成前该区域显示遮罩，其余内容（README/安装/权限）先行展示。
  const [auditSummary, setAuditSummary] = useState<AuditExecutionSummary>(
    skill.auditResults,
  );
  const [auditLoading, setAuditLoading] = useState(false);
  // 记录已拉取报告明细的技能 ID，避免同技能重复请求；切换技能后自动失效
  const auditFetchedFor = useRef<string | null>(null);

  // 技能切换 / 外部重新体检后，审计摘要以当前 skill.auditResults 为准
  // （重新体检会拿到完整明细，直接展示无需再请求）
  useEffect(() => {
    setAuditSummary(skill.auditResults);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skill.id, skill.auditResults]);

  useEffect(() => {
    if (activeTab !== 'audit') return;
    if (auditFetchedFor.current === skill.id) return;

    let cancelled = false;
    setAuditLoading(true);
    api
      .getSkillAuditReport(skill.slug || skill.id)
      .then(summary => {
        if (cancelled) return;
        auditFetchedFor.current = skill.id;
        setAuditSummary(prev => ({
          ...prev,
          ...summary,
          // 保留本地已有的管理员反馈（驳回/下架原因），避免被服务端摘要覆盖
          adminFeedback: summary.adminFeedback ?? prev.adminFeedback,
        }));
      })
      .catch(() => {
        // 拉取失败保留分数视图，不中断页面
        if (!cancelled) auditFetchedFor.current = skill.id;
      })
      .finally(() => {
        if (!cancelled) setAuditLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, skill.id]);

  // 首次接入企业市场的前置注册命令 (Claude Code 必须先 add 市场才能 install 插件)
  const marketplaceAddCommand = getMarketplaceAddCommand();
  // 市场新增/更新插件后需执行的市场仓库同步命令
  const marketplaceUpdateCommand = getMarketplaceUpdateCommand();

  const currentCommand = 
    activeCliTab === 'claude' ? skill.installCommands.claude :
    activeCliTab === 'cursor' ? skill.installCommands.cursor :
    activeCliTab === 'mcp' ? skill.installCommands.mcp :
    skill.installCommands.cli;

  const handleCopyCommand = () => {
    navigator.clipboard.writeText(currentCommand);
    setCopiedCmd(true);
    onCopySuccess(`已复制 ${activeCliTab.toUpperCase()} 安装指令至剪贴板`);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  /**
   * 复制企业市场注册命令，供首次接入的同学一键完成 marketplace add
   */
  const handleCopyMarketCommand = () => {
    navigator.clipboard.writeText(marketplaceAddCommand);
    setCopiedMarketCmd(true);
    onCopySuccess('已复制企业市场注册命令至剪贴板');
    setTimeout(() => setCopiedMarketCmd(false), 2000);
  };

  /**
   * 复制市场仓库升级命令，供市场新增插件后客户端拉取最新清单
   */
  const handleCopyMarketUpdateCommand = () => {
    navigator.clipboard.writeText(marketplaceUpdateCommand);
    setCopiedMarketUpdateCmd(true);
    onCopySuccess('已复制市场仓库升级命令至剪贴板');
    setTimeout(() => setCopiedMarketUpdateCmd(false), 2000);
  };

  const handleLike = () => {
    const result = onToggleLike(skill.id);
    if (result !== false && !skill.isLiked) {
      confetti({
        particleCount: 35,
        spread: 60,
        origin: { y: 0.7 }
      });
    }
  };

  const handleViewFileFromAudit = (filePath: string) => {
    setHighlightedFileInTree(filePath);
    setActiveTab('files');
  };

  const isApproved = skill.status === 'approved';
  const isPending = skill.status === 'pending';
  const isRejected = skill.status === 'rejected';
  const isOffline = skill.status === 'offline';

  return (
    <div className="space-y-6 animate-in fade-in duration-200 pb-12">
      {/* Top Breadcrumb & Return navigation */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={onBack}
          id="btn-back-to-market"
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50/40 text-xs font-semibold shadow-sm transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>返回技能集市</span>
        </button>

        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
          <span>技能集市</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="capitalize">{skill.category}</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-900 font-mono font-semibold truncate max-w-xs">{skill.slug}</span>
        </div>
      </div>

      {/* Main Header Hero Card */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200/90 shadow-sm relative overflow-hidden">
        {/* Subtle background decoration */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-indigo-50/80 via-sky-50/50 to-transparent rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 space-y-5">
          {/* Tags & Badges */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold px-3 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200/80 uppercase">
                {skill.category}
              </span>
              <span className="text-xs font-mono font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                {skill.version}
              </span>

              {/* 多版本发布：版本选择器（仅 owner / admin 可见且链长 ≥ 2） */}
              {isOwnerOrAdmin && versions && versions.length > 1 && onSelectVersion && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-indigo-50 border border-indigo-200">
                  <GitBranch className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="text-[11px] font-bold text-indigo-700">版本</span>
                  <Select
                    size="sm"
                    variant="ghost"
                    value={skill.id}
                    onChange={e => {
                      const next = versions.find(v => v.id === e.target.value);
                      if (next) {
                        // 同步 URL：?v=<versionId> 便于分享
                        const u = new URL(window.location.href);
                        u.searchParams.set('v', next.id);
                        window.history.replaceState({}, '', u.toString());
                        onSelectVersion(next);
                      }
                    }}
                    className="font-mono font-semibold text-slate-800"
                    title="切换到该技能链上的其他历史版本"
                  >
                    {versions.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.version}
                        {v.id === skill.id ? ' (当前)' : ''}
                        {v.status === 'archived' ? ' · 已归档' : ''}
                        {v.status === 'pending' ? ' · 审核中' : ''}
                      </option>
                    ))}
                  </Select>
                </div>
              )}

              {isOwnerOrAdmin && versionsLoading && (
                <span className="text-[11px] text-slate-400">加载版本中…</span>
              )}
              {isApproved && (
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 flex items-center gap-1.5 shadow-2xs">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>双引擎安全审计通过 ({skill.auditResults.score != null ? `${skill.auditResults.score}分` : '未体检'})</span>
                </span>
              )}
              {isOffline && (
                <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-3 py-1 rounded-full border border-slate-300 flex items-center gap-1.5 shadow-2xs">
                  <ArrowDownCircle className="w-3.5 h-3.5 text-slate-500" />
                  <span>已下架维护 (仅管理员/作者可见)</span>
                </span>
              )}
              {isPending && (
                <span className="text-xs font-semibold text-amber-800 bg-amber-50 px-3 py-1 rounded-full border border-amber-200 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>{skill.auditResults.score != null ? `等待管理员终审 (${skill.auditResults.score}分)` : '等待管理员体检'}</span>
                </span>
              )}
              {isRejected && (
                <span className="text-xs font-semibold text-rose-800 bg-rose-50 px-3 py-1 rounded-full border border-rose-200 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                  <span>已驳回</span>
                </span>
              )}
            </div>

            {/* 管理员驳回意见：驳回理由展示给作者整改（mapApiSkill 映射到 auditResults.adminFeedback） */}
            {isRejected && skill.auditResults?.adminFeedback && (
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <strong>管理员驳回意见：</strong>
                  <span>{skill.auditResults.adminFeedback}</span>
                </div>
              </div>
            )}

            <div className="text-xs text-slate-500 font-mono">
              发布于 {new Date(skill.createdAt).toLocaleDateString('zh-CN')} · 最近更新 {new Date(skill.updatedAt).toLocaleDateString('zh-CN')}
            </div>
          </div>

          {/* Title & Slug */}
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {skill.name}
            </h1>
            <div className="font-mono text-sm text-indigo-600 font-semibold flex items-center gap-2">
              <span>{skill.slug}</span>
            </div>
          </div>

          {/* Description */}
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-4xl">
            {skill.description}
          </p>

          {/* Author & Stats Row */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-100 text-xs">
            <div className="flex items-center gap-3">
              <Avatar
                src={skill.author.avatar}
                name={skill.author.name}
                className="w-9 h-9 rounded-full border border-slate-200 shadow-2xs"
              />
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-800 text-sm">{skill.author.name}</span>
                  {skill.author.verified && (
                    <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.2 rounded font-medium border border-indigo-100">
                      官方认证
                    </span>
                  )}
                </div>
                <div className="text-slate-500">{skill.author.department}</div>
              </div>
            </div>

            <div className="flex items-center gap-5 text-slate-600 font-medium">
              <span className="flex items-center gap-1.5">
                <Download className="w-4 h-4 text-slate-400" />
                <span>{skill.downloads} 次下载</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                <span>{skill.stars} 收藏</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
                <span>{skill.likes} 点赞</span>
              </span>
            </div>
          </div>

          {/* Action Row: Download ZIP, Star, Like, Quick Command Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                onClick={() => onDownloadZip(skill)}
                id="btn-detail-download-zip"
                className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-indigo-600 text-white hover:bg-indigo-500 text-xs font-bold transition-all shadow-md shadow-indigo-500/20 active:scale-95"
              >
                <Download className="w-4 h-4" />
                <span>打包下载 ZIP 源码包</span>
              </button>

              <button
                onClick={() => onToggleStar(skill.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border text-xs font-semibold transition-all active:scale-95 ${
                  skill.isStarred
                    ? 'bg-amber-50 border-amber-300 text-amber-800 shadow-2xs font-bold'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                <Star className={`w-4 h-4 ${skill.isStarred ? 'fill-amber-500 text-amber-500' : 'text-slate-400'}`} />
                <span>{skill.isStarred ? '已收藏' : '收藏'}</span>
              </button>

              <button
                onClick={handleLike}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border text-xs font-semibold transition-all active:scale-95 ${
                  skill.isLiked
                    ? 'bg-rose-50 border-rose-300 text-rose-800 shadow-2xs font-bold'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                <Heart className={`w-4 h-4 ${skill.isLiked ? 'fill-rose-500 text-rose-500' : 'text-slate-400'}`} />
                <span>{skill.isLiked ? '已点赞' : '点赞'}</span>
              </button>

              {/* 分享按钮：复制当前详情页 URL 至剪贴板（不可用时降级为提示）
                  注：重新体检按钮已移除——该能力属管理员审核工作台，公开详情页不宜暴露 */}
              <button
                onClick={async () => {
                  try {
                    if (navigator.clipboard?.writeText) {
                      await navigator.clipboard.writeText(window.location.href);
                      onCopySuccess('已复制当前页面 URL，快粘贴给同事安装吧～');
                    } else {
                      onCopySuccess(window.location.href);
                    }
                  } catch {
                    onCopySuccess(window.location.href);
                  }
                }}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all active:scale-95"
                title="复制当前页面链接，分享给同事一键安装"
              >
                <Share2 className="w-3.5 h-3.5 text-slate-500" />
                <span>分享</span>
              </button>
            </div>

            {/* Quick CLI copy in Header */}
            <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-200 w-full sm:w-auto">
              <span className="text-[11px] font-mono font-bold text-slate-500 px-2 uppercase">
                {activeCliTab}:
              </span>
              <code className="text-xs font-mono text-slate-800 px-2.5 py-1 bg-white rounded-xl border border-slate-200 max-w-xs truncate">
                {currentCommand}
              </code>
              <button
                onClick={handleCopyCommand}
                className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors shrink-0 shadow-2xs"
                title="复制命令行安装语句"
              >
                {copiedCmd ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation Menu */}
      <div className="flex items-center gap-2 border-b border-slate-200 bg-white rounded-2xl px-4 shadow-2xs overflow-x-auto">
        <button
          onClick={() => setActiveTab('readme')}
          className={`flex items-center gap-2 py-4 px-4 border-b-2 text-xs sm:text-sm font-bold transition-colors whitespace-nowrap ${
            activeTab === 'readme'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>使用说明 (README)</span>
        </button>

        <button
          onClick={() => setActiveTab('files')}
          className={`flex items-center gap-2 py-4 px-4 border-b-2 text-xs sm:text-sm font-bold transition-colors whitespace-nowrap ${
            activeTab === 'files'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <FolderTree className="w-4 h-4" />
          <span>ZIP 源码文件树 ({skill.fileTree.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-2 py-4 px-4 border-b-2 text-xs sm:text-sm font-bold transition-colors whitespace-nowrap ${
            activeTab === 'audit'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>双引擎安全审计报告</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${
            skill.auditResults.overallStatus === 'pending'
              ? 'bg-slate-100 text-slate-600'
              : skill.auditResults.overallStatus === 'failed'
                ? 'bg-rose-100 text-rose-800'
                : skill.auditResults.overallStatus === 'warning'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-emerald-100 text-emerald-800'
          }`}>
            {skill.auditResults.score != null ? `${skill.auditResults.score}分` : '未体检'}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('install')}
          className={`flex items-center gap-2 py-4 px-4 border-b-2 text-xs sm:text-sm font-bold transition-colors whitespace-nowrap ${
            activeTab === 'install'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Terminal className="w-4 h-4" />
          <span>多端安装指令</span>
        </button>

        <button
          onClick={() => setActiveTab('permissions')}
          className={`flex items-center gap-2 py-4 px-4 border-b-2 text-xs sm:text-sm font-bold transition-colors whitespace-nowrap ${
            activeTab === 'permissions'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>权限声明与沙箱</span>
        </button>
      </div>

      {/* Main Tab Content View */}
      <div className="bg-transparent">
        {/* 1. README TAB */}
        {activeTab === 'readme' && (
          <div className="space-y-6">
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/90 shadow-sm leading-relaxed">
              <div className="whitespace-pre-wrap font-sans text-slate-800 text-sm leading-relaxed">
                {skill.readme}
              </div>
            </div>
          </div>
        )}

        {/* 2. FILE TREE TAB */}
        {activeTab === 'files' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-600 bg-white p-4 rounded-2xl border border-slate-200">
              <span>ZIP 包内源码文件树：</span>
              <button
                onClick={() => onDownloadZip(skill)}
                className="text-indigo-600 hover:underline flex items-center gap-1.5 font-bold"
              >
                <Download className="w-4 h-4" /> 打包导出 ZIP
              </button>
            </div>
            {(skill.fileTree || []).length === 0 && fileTreeLoading ? (
              /* 大插件源码仍在前台/后台加载：该区域单独遮罩，不阻塞整页 */
              <div className="rounded-3xl bg-white border border-slate-200 shadow-sm p-12 flex flex-col items-center justify-center gap-3 text-xs text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>源码体积较大，正在加载文件树…</span>
              </div>
            ) : (
              <FileTreeViewer
                tree={skill.fileTree}
                defaultSelectedPath={highlightedFileInTree}
                onCopyFile={filename => onCopySuccess(`已复制文件 ${filename} 源码`)}
              />
            )}
          </div>
        )}

        {/* 3. DUAL-ENGINE AUDIT REPORT TAB */}
        {activeTab === 'audit' && (
          <div>
            {auditLoading ? (
              /* 报告明细独立接口按需拉取：加载中给遮罩，其余 tab 数据不受影响 */
              <div className="rounded-3xl bg-white border border-slate-200 shadow-sm p-12 flex flex-col items-center justify-center gap-3 text-xs text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>正在加载安全审计报告明细…</span>
              </div>
            ) : (
              <AuditReportInspector
                summary={auditSummary}
                onReScan={onReScanSkill ? () => onReScanSkill(skill) : undefined}
                isScanning={isScanning}
                onViewFileInTree={handleViewFileFromAudit}
                // 详情页面向普通用户，不展示「管理员终审反馈」：
                // 已上架时它是「审核通过」之类的泛化文案，驳回理由上方已有独立块
                showAdminFeedback={false}
              />
            )}
          </div>
        )}

        {/* 4. MULTI-CLI INSTALL TAB */}
        {activeTab === 'install' && (
          <div className="space-y-6">
            <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-6">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  选择客户端进行一键安装配置
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  可在 Claude Code、Cursor 智能补全、MCP 服务协议与 SkillHub 私有 CLI 中随时集成。
                </p>
              </div>

              {/* Client selectors */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <button
                  onClick={() => setActiveCliTab('claude')}
                  className={`p-4 rounded-2xl border text-center transition-all ${
                    activeCliTab === 'claude'
                      ? 'border-indigo-600 bg-indigo-50/70 text-indigo-700 font-bold ring-2 ring-indigo-500/20'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="text-sm font-bold">Claude Code</div>
                  <div className="text-xs text-slate-500 mt-0.5">CLI / Native Agent</div>
                </button>

                <button
                  onClick={() => setActiveCliTab('cursor')}
                  className={`p-4 rounded-2xl border text-center transition-all ${
                    activeCliTab === 'cursor'
                      ? 'border-indigo-600 bg-indigo-50/70 text-indigo-700 font-bold ring-2 ring-indigo-500/20'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="text-sm font-bold">Cursor</div>
                  <div className="text-xs text-slate-500 mt-0.5">Composer / Extension</div>
                </button>

                <button
                  onClick={() => setActiveCliTab('mcp')}
                  className={`p-4 rounded-2xl border text-center transition-all ${
                    activeCliTab === 'mcp'
                      ? 'border-indigo-600 bg-indigo-50/70 text-indigo-700 font-bold ring-2 ring-indigo-500/20'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="text-sm font-bold">MCP Server</div>
                  <div className="text-xs text-slate-500 mt-0.5">claude_desktop_config</div>
                </button>

                <button
                  onClick={() => setActiveCliTab('cli')}
                  className={`p-4 rounded-2xl border text-center transition-all ${
                    activeCliTab === 'cli'
                      ? 'border-indigo-600 bg-indigo-50/70 text-indigo-700 font-bold ring-2 ring-indigo-500/20'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="text-sm font-bold">SkillHub CLI</div>
                  <div className="text-xs text-slate-500 mt-0.5">NPX / Private Registry</div>
                </button>
              </div>

              {/* Claude Code 首次接入必须先注册企业市场，否则 /plugin install 会报市场不存在 */}
              {activeCliTab === 'claude' && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-2.5">
                  <p className="text-xs font-bold text-amber-900">
                    步骤 1 · 首次接入需先注册企业插件市场（仅需执行一次）
                  </p>
                  <div className="scrollbar-on-dark relative rounded-xl bg-slate-950 text-slate-100 p-3 font-mono text-[11px] sm:text-xs overflow-x-auto flex items-center justify-between gap-3 border border-slate-800">
                    <span className="text-emerald-400 select-none font-bold">$</span>
                    <span className="flex-1 font-mono text-slate-200 whitespace-nowrap">
                      {marketplaceAddCommand}
                    </span>
                    <button
                      onClick={handleCopyMarketCommand}
                      className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-sans text-[11px] font-semibold flex items-center gap-1.5 shrink-0 transition-colors"
                    >
                      {copiedMarketCmd ? <Check className="w-3 h-3 text-emerald-300" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedMarketCmd ? '已复制' : '复制'}</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-amber-800">
                    已注册过市场的同学可直接执行下方步骤 2 的安装命令。
                  </p>

                  {/* 市场仓库升级：后续新增/更新插件后需执行，否则安装不到新插件 */}
                  <div className="pt-2 border-t border-amber-300/50 mt-1">
                    <p className="text-xs font-bold text-amber-900">
                      市场仓库升级 · 新插件发布后执行一次即可同步
                    </p>
                    <div className="scrollbar-on-dark relative rounded-xl bg-slate-950 text-slate-100 p-3 font-mono text-[11px] sm:text-xs overflow-x-auto flex items-center justify-between gap-3 border border-slate-800 mt-2">
                      <span className="text-emerald-400 select-none font-bold">$</span>
                      <span className="flex-1 font-mono text-slate-200 whitespace-nowrap">
                        {marketplaceUpdateCommand}
                      </span>
                      <button
                        onClick={handleCopyMarketUpdateCommand}
                        className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-sans text-[11px] font-semibold flex items-center gap-1.5 shrink-0 transition-colors"
                      >
                        {copiedMarketUpdateCmd ? <Check className="w-3 h-3 text-emerald-300" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedMarketUpdateCmd ? '已复制' : '复制'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeCliTab === 'claude' && (
                <p className="text-xs font-bold text-slate-800">步骤 2 · 安装本技能插件</p>
              )}

              {/* Command box */}
              <div className="scrollbar-on-dark relative rounded-2xl bg-slate-950 text-slate-100 p-4 font-mono text-xs sm:text-sm overflow-x-auto flex items-center justify-between gap-3 border border-slate-800 shadow-md">
                <span className="text-emerald-400 select-none font-bold">$</span>
                <span className="flex-1 font-mono text-slate-200">{currentCommand}</span>
                <button
                  onClick={handleCopyCommand}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-sans text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors shadow-sm"
                >
                  {copiedCmd ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCmd ? '已复制' : '复制命令'}</span>
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1.5">
                <p className="font-semibold text-slate-800">💡 内网私有化环境使用提示：</p>
                <p>如终端运行在内网隔离机房，请先配置环境变量 <code className="bg-white border border-slate-200 px-1.5 py-0.5 rounded text-indigo-700 font-mono">SKILLHUB_REGISTRY=http://skillhub.corp</code> 以直连内网镜像源。</p>
              </div>
            </div>
          </div>
        )}

        {/* 5. PERMISSIONS TAB */}
        {activeTab === 'permissions' && (
          <div className="space-y-4">
            <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Lock className="w-4 h-4 text-indigo-600" />
                <span>已声明系统权限与沙箱隔离范围</span>
              </h3>
              <p className="text-xs text-slate-500">
                该技能受 SkillHub 容器与安全沙箱约束，仅限访问已声明的权限资源：
              </p>
              <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden">
                {skill.permissions.map((perm, idx) => (
                  <div key={idx} className="p-4 flex items-center justify-between text-xs sm:text-sm bg-white">
                    <span className="font-semibold text-slate-800">{perm}</span>
                    <span className="text-xs bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-200 font-medium">
                      安全沙箱已授权
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
