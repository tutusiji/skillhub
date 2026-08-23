import React, { useState } from 'react';
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
  RefreshCw,
  Cpu,
  UserCheck,
  ArrowDownCircle
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { SkillItem } from '../types';
import { FileTreeViewer } from './FileTreeViewer';
import { AuditReportInspector } from './AuditReportInspector';

interface SkillDetailPageProps {
  skill: SkillItem;
  onBack: () => void;
  onToggleStar: (id: string) => boolean | void;
  onToggleLike: (id: string) => boolean | void;
  onDownloadZip: (skill: SkillItem) => void;
  onReScanSkill?: (skill: SkillItem) => void;
  isScanning?: boolean;
  onCopySuccess: (msg: string) => void;
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
  onCopySuccess
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>('readme');
  const [activeCliTab, setActiveCliTab] = useState<'claude' | 'cursor' | 'mcp' | 'cli'>('claude');
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [highlightedFileInTree, setHighlightedFileInTree] = useState<string | undefined>(undefined);

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
              {isApproved && (
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 flex items-center gap-1.5 shadow-2xs">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>双引擎安全审计通过 ({skill.auditResults.score}分)</span>
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
                  <span>等待管理员终审 ({skill.auditResults.score}分)</span>
                </span>
              )}
              {isRejected && (
                <span className="text-xs font-semibold text-rose-800 bg-rose-50 px-3 py-1 rounded-full border border-rose-200 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                  <span>已驳回</span>
                </span>
              )}
            </div>

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
              <img
                src={skill.author.avatar}
                alt={skill.author.name}
                className="w-9 h-9 rounded-full object-cover border border-slate-200 shadow-2xs"
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

              {onReScanSkill && (
                <button
                  onClick={() => onReScanSkill(skill)}
                  disabled={isScanning}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all active:scale-95 disabled:opacity-50"
                  title="重新执行双引擎体检"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin text-indigo-600' : 'text-slate-500'}`} />
                  <span>{isScanning ? '体检中...' : '重新体检'}</span>
                </button>
              )}
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
            skill.auditResults.score >= 90 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
          }`}>
            {skill.auditResults.score}分
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
              <span>ZIP 包内源码文件树（点击左侧文件查看代码，点击右上角复制）：</span>
              <button
                onClick={() => onDownloadZip(skill)}
                className="text-indigo-600 hover:underline flex items-center gap-1.5 font-bold"
              >
                <Download className="w-4 h-4" /> 打包导出 ZIP
              </button>
            </div>
            <FileTreeViewer 
              tree={skill.fileTree} 
              defaultSelectedPath={highlightedFileInTree}
              onCopyFile={(filename) => onCopySuccess(`已复制文件 ${filename} 源码`)}
            />
          </div>
        )}

        {/* 3. DUAL-ENGINE AUDIT REPORT TAB */}
        {activeTab === 'audit' && (
          <div>
            <AuditReportInspector 
              summary={skill.auditResults}
              onReScan={onReScanSkill ? () => onReScanSkill(skill) : undefined}
              isScanning={isScanning}
              onViewFileInTree={handleViewFileFromAudit}
            />
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

              {/* Command box */}
              <div className="relative rounded-2xl bg-slate-950 text-slate-100 p-4 font-mono text-xs sm:text-sm overflow-x-auto flex items-center justify-between gap-3 border border-slate-800 shadow-md">
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
