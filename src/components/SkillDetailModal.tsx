import React, { useState } from 'react';
import { 
  X, 
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
  Key, 
  Clock, 
  Share2, 
  Sparkles, 
  ExternalLink,
  Layers,
  Code2,
  Lock,
  Calendar,
  UserCheck
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { AuditExecutionSummary, SkillItem } from '../types';
import { FileTreeViewer } from './FileTreeViewer';
import { AuditReportInspector } from './AuditReportInspector';
import { getMarketplaceAddCommand } from '../utils/marketplace';

interface SkillDetailModalProps {
  skill: SkillItem | null;
  onClose: () => void;
  onToggleStar: (id: string) => void;
  onToggleLike: (id: string) => void;
  onDownloadZip: (skill: SkillItem) => void;
  onReScanSkill?: (skill: SkillItem) => void;
  isScanning?: boolean;
  onCopySuccess: (msg: string) => void;
}

type TabKey = 'readme' | 'files' | 'audit' | 'permissions' | 'install';

export const SkillDetailModal: React.FC<SkillDetailModalProps> = ({
  skill,
  onClose,
  onToggleStar,
  onToggleLike,
  onDownloadZip,
  onReScanSkill,
  isScanning = false,
  onCopySuccess
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>('readme');
  const [activeCliTab, setActiveCliTab] = useState<'claude' | 'cursor' | 'mcp' | 'cli'>('claude');

  // 首次接入企业市场的前置注册命令 (Claude Code 必须先 add 市场才能 install 插件)
  const marketplaceAddCommand = getMarketplaceAddCommand();
  const [copiedMarketCmd, setCopiedMarketCmd] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [highlightedFileInTree, setHighlightedFileInTree] = useState<string | undefined>(undefined);

  if (!skill) return null;

  const currentCommand = 
    activeCliTab === 'claude' ? skill.installCommands.claude :
    activeCliTab === 'cursor' ? skill.installCommands.cursor :
    activeCliTab === 'mcp' ? skill.installCommands.mcp :
    skill.installCommands.cli;

  /**
   * 复制企业市场注册命令，供首次接入的同学一键完成 marketplace add
   */
  const handleCopyMarketCommand = () => {
    navigator.clipboard.writeText(marketplaceAddCommand);
    setCopiedMarketCmd(true);
    onCopySuccess('已复制企业市场注册命令至剪贴板');
    setTimeout(() => setCopiedMarketCmd(false), 2000);
  };

  const handleCopyCommand = () => {
    navigator.clipboard.writeText(currentCommand);
    setCopiedCmd(true);
    onCopySuccess(`已复制 ${activeCliTab.toUpperCase()} 安装指令至剪贴板`);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  const handleLike = () => {
    onToggleLike(skill.id);
    if (!skill.isLiked) {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/70 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div 
        id="skill-detail-modal"
        className="relative w-full max-w-5xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header Bar */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  {skill.category.toUpperCase()}
                </span>
                <span className="text-xs font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                  {skill.version}
                </span>
                {skill.status === 'approved' && (
                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>双引擎安全审计通过 ({skill.auditResults.score}分)</span>
                  </span>
                )}
                {skill.status === 'pending' && (
                  <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>等待管理员终审</span>
                  </span>
                )}
              </div>

              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                {skill.name}
              </h2>
              <div className="font-mono text-xs text-indigo-600 dark:text-indigo-400">
                {skill.slug}
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="关闭详情"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-2.5 leading-relaxed max-w-3xl">
            {skill.description}
          </p>

          {/* Author info & stats bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-3">
              <img
                src={skill.author.avatar}
                alt={skill.author.name}
                className="w-7 h-7 rounded-full object-cover border border-slate-200 dark:border-slate-700"
              />
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{skill.author.name}</span>
                <span className="text-slate-400 ml-1.5">({skill.author.department})</span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>更新于 {new Date(skill.updatedAt).toLocaleDateString('zh-CN')}</span>
              </span>
              <span className="flex items-center gap-1">
                <Download className="w-3.5 h-3.5" />
                <span>{skill.downloads} 次下载</span>
              </span>
              <span className="flex items-center gap-1">
                <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                <span>{skill.stars} 收藏</span>
              </span>
              <span className="flex items-center gap-1">
                <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                <span>{skill.likes} 赞</span>
              </span>
            </div>
          </div>

          {/* Action Row: Download ZIP, Install Command, Like, Star */}
          <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => onDownloadZip(skill)}
                id="btn-modal-download-zip"
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white text-xs font-semibold transition-all shadow-sm active:scale-95"
              >
                <Download className="w-4 h-4" />
                <span>打包下载 ZIP 源码包</span>
              </button>

              <button
                onClick={() => onToggleStar(skill.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all active:scale-95 ${
                  skill.isStarred
                    ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                }`}
              >
                <Star className={`w-4 h-4 ${skill.isStarred ? 'fill-amber-500 text-amber-500' : ''}`} />
                <span>{skill.isStarred ? '已收藏' : '收藏'}</span>
              </button>

              <button
                onClick={handleLike}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all active:scale-95 ${
                  skill.isLiked
                    ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-300'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                }`}
              >
                <Heart className={`w-4 h-4 ${skill.isLiked ? 'fill-rose-500 text-rose-500' : ''}`} />
                <span>{skill.isLiked ? '已点赞' : '点赞'}</span>
              </button>
            </div>

            {/* Quick CLI copy in Header */}
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="text-[11px] font-mono text-slate-500 px-2 font-medium">
                {activeCliTab.toUpperCase()}:
              </span>
              <code className="text-xs font-mono text-slate-800 dark:text-slate-200 px-2 py-0.5 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700 max-w-xs truncate">
                {currentCommand}
              </code>
              <button
                onClick={handleCopyCommand}
                className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors flex items-center gap-1"
                title="复制命令行安装语句"
              >
                {copiedCmd ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto shrink-0">
          <button
            onClick={() => setActiveTab('readme')}
            className={`flex items-center gap-2 py-3 px-3 border-b-2 text-xs font-semibold transition-colors whitespace-nowrap ${
              activeTab === 'readme'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>使用说明 (README)</span>
          </button>

          <button
            onClick={() => setActiveTab('files')}
            className={`flex items-center gap-2 py-3 px-3 border-b-2 text-xs font-semibold transition-colors whitespace-nowrap ${
              activeTab === 'files'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <FolderTree className="w-4 h-4" />
            <span>ZIP 文件树与源码 ({skill.fileTree.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`flex items-center gap-2 py-3 px-3 border-b-2 text-xs font-semibold transition-colors whitespace-nowrap ${
              activeTab === 'audit'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>双引擎安全审计报告</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              skill.auditResults.score >= 90 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
            }`}>
              {skill.auditResults.score}分
            </span>
          </button>

          <button
            onClick={() => setActiveTab('install')}
            className={`flex items-center gap-2 py-3 px-3 border-b-2 text-xs font-semibold transition-colors whitespace-nowrap ${
              activeTab === 'install'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>多端安装指令</span>
          </button>

          <button
            onClick={() => setActiveTab('permissions')}
            className={`flex items-center gap-2 py-3 px-3 border-b-2 text-xs font-semibold transition-colors whitespace-nowrap ${
              activeTab === 'permissions'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Lock className="w-4 h-4" />
            <span>权限声明与沙箱</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50 dark:bg-slate-950/20">
          {/* 1. README TAB */}
          {activeTab === 'readme' && (
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm prose dark:prose-invert max-w-none text-xs sm:text-sm leading-relaxed">
                <div className="whitespace-pre-wrap font-sans text-slate-800 dark:text-slate-200">
                  {skill.readme}
                </div>
              </div>
            </div>
          )}

          {/* 2. FILE TREE TAB */}
          {activeTab === 'files' && (
            <div className="max-w-5xl mx-auto space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>ZIP 包内源码文件树（点击左侧文件查看代码，点击右上角复制）：</span>
                <button
                  onClick={() => onDownloadZip(skill)}
                  className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-medium"
                >
                  <Download className="w-3.5 h-3.5" /> 打包导出 ZIP
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
            <div className="max-w-4xl mx-auto">
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
            <div className="max-w-3xl mx-auto space-y-5">
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  选择客户端进行一键安装配置
                </div>

                {/* Client selectors */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    onClick={() => setActiveCliTab('claude')}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      activeCliTab === 'claude'
                        ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold ring-1 ring-indigo-500'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="text-xs font-bold">Claude Code</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">CLI / Native Agent</div>
                  </button>

                  <button
                    onClick={() => setActiveCliTab('cursor')}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      activeCliTab === 'cursor'
                        ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold ring-1 ring-indigo-500'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="text-xs font-bold">Cursor</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Composer / Extension</div>
                  </button>

                  <button
                    onClick={() => setActiveCliTab('mcp')}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      activeCliTab === 'mcp'
                        ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold ring-1 ring-indigo-500'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="text-xs font-bold">MCP Server</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">claude_desktop_config</div>
                  </button>

                  <button
                    onClick={() => setActiveCliTab('cli')}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      activeCliTab === 'cli'
                        ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold ring-1 ring-indigo-500'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="text-xs font-bold">SkillHub CLI</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">NPX / Private Registry</div>
                  </button>
                </div>

                {/* Claude Code 首次接入必须先注册企业市场，否则 /plugin install 会报市场不存在 */}
                {activeCliTab === 'claude' && (
                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
                    <p className="text-[11px] font-bold text-amber-900">
                      步骤 1 · 首次接入需先注册企业插件市场（仅需执行一次）
                    </p>
                    <div className="relative rounded-lg bg-slate-950 text-slate-100 p-2.5 font-mono text-[10px] overflow-x-auto flex items-center justify-between gap-2 border border-slate-800">
                      <span className="text-emerald-400 select-none">$</span>
                      <span className="flex-1 font-mono whitespace-nowrap">{marketplaceAddCommand}</span>
                      <button
                        onClick={handleCopyMarketCommand}
                        className="px-2.5 py-1 rounded-md bg-amber-600 hover:bg-amber-500 text-white font-sans text-[10px] font-semibold flex items-center gap-1 shrink-0 transition-colors"
                      >
                        {copiedMarketCmd ? <Check className="w-3 h-3 text-emerald-300" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedMarketCmd ? '已复制' : '复制'}</span>
                      </button>
                    </div>
                  </div>
                )}

                {activeCliTab === 'claude' && (
                  <p className="text-[11px] font-bold text-slate-800">步骤 2 · 安装本技能插件</p>
                )}

                {/* Command box */}
                <div className="relative rounded-xl bg-slate-950 text-slate-100 p-4 font-mono text-xs overflow-x-auto flex items-center justify-between gap-3 border border-slate-800">
                  <span className="text-emerald-400 select-none">$</span>
                  <span className="flex-1 font-mono">{currentCommand}</span>
                  <button
                    onClick={handleCopyCommand}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-sans text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors"
                  >
                    {copiedCmd ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCmd ? '已复制' : '复制命令'}</span>
                  </button>
                </div>

                <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
                  <p>💡 内网说明：如果终端无法直连外网，请确保终端已配置环境变量 <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-indigo-600 dark:text-indigo-400">SKILLHUB_REGISTRY=http://skillhub.corp</code>。</p>
                </div>
              </div>
            </div>
          )}

          {/* 5. PERMISSIONS TAB */}
          {activeTab === 'permissions' && (
            <div className="max-w-3xl mx-auto space-y-4">
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-indigo-600" />
                  <span>已声明系统权限清单</span>
                </h3>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {skill.permissions.map((perm, idx) => (
                    <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-800 dark:text-slate-200">{perm}</span>
                      <span className="text-[11px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
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
    </div>
  );
};
