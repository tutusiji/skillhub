import React, { useState } from 'react';
import { 
  Download, 
  Star, 
  Heart, 
  Terminal, 
  Copy, 
  Check, 
  ShieldCheck, 
  ShieldAlert, 
  Sparkles,
  ArrowRight
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { SkillItem } from '../../types';
import { getExpertDomainMeta } from '../../data/expertDomains';
import { useExpertDomains } from '../../hooks/useExpertDomains';
import { Avatar } from './Avatar';

interface SkillCardProps {
  skill: SkillItem;
  onSelectSkill: (skill: SkillItem) => void;
  onToggleStar: (id: string) => boolean | void;
  onToggleLike: (id: string) => boolean | void;
  onDownloadZip: (skill: SkillItem) => void;
  onCopyInstallCmd: (cmd: string, clientName?: string) => void;
}

const CATEGORY_NAMES: Record<string, { label: string; color: string }> = {
  database: { label: '数据库/SQL', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  devops: { label: 'DevOps/CI/CD', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  mcp: { label: 'MCP Server', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  security: { label: '安全与合规', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  coding: { label: '编程提效', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  productivity: { label: '生产力/知识库', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  data: { label: '数据分析', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  agent: { label: '自主智能体', color: 'bg-violet-50 text-violet-700 border-violet-200' }
};

export const SkillCard: React.FC<SkillCardProps> = ({
  skill,
  onSelectSkill,
  onToggleStar,
  onToggleLike,
  onDownloadZip,
  onCopyInstallCmd
}) => {
  const [showCliDropdown, setShowCliDropdown] = useState(false);
  const { domains: expertDomains } = useExpertDomains();

  const categoryMeta = CATEGORY_NAMES[skill.category] || {
    label: skill.category,
    color: 'bg-slate-100 text-slate-700 border-slate-200'
  };

  const domainMeta = getExpertDomainMeta(skill.expertDomain, expertDomains);

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    const result = onToggleLike(skill.id);
    if (result !== false && !skill.isLiked) {
      confetti({
        particleCount: 25,
        spread: 40,
        origin: { y: 0.8 }
      });
    }
  };

  const handleStar = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleStar(skill.id);
  };

  const handleQuickCopy = (e: React.MouseEvent, cmd: string, clientName: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(cmd);
    onCopyInstallCmd(cmd, clientName);
    setShowCliDropdown(false);
  };

  const handleZipDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDownloadZip(skill);
  };

  const isApproved = skill.status === 'approved';
  const isPending = skill.status === 'pending';
  const isRejected = skill.status === 'rejected';

  return (
    <div
      id={`skill-card-${skill.id}`}
      onClick={() => onSelectSkill(skill)}
      className="group relative flex flex-col justify-between rounded-3xl border border-slate-200/90 bg-white p-5 shadow-sm hover:shadow-md hover:border-indigo-400 transition-all duration-200 cursor-pointer"
    >
      {/* Top Meta Bar */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Expert Domain Badge */}
            {skill.expertDomain && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${domainMeta.badgeBg} ${domainMeta.badgeText} ${domainMeta.badgeBorder || domainMeta.border || 'border-slate-200'}`}>
                {domainMeta.shortLabel}
              </span>
            )}
            <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-lg border ${categoryMeta.color}`}>
              {categoryMeta.label}
            </span>
            <span className="text-[11px] font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
              {skill.version}
            </span>
          </div>

          {/* Audit Badge */}
          {isApproved && (
            <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{skill.auditResults.score != null ? `${skill.auditResults.score}分` : '未体检'} · 通过</span>
            </div>
          )}
          {isPending && (
            <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{skill.auditResults.score != null ? `待审 (${skill.auditResults.score}分)` : '待审 (未体检)'}</span>
            </div>
          )}
          {isRejected && (
            <div className="flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>已驳回</span>
            </div>
          )}
        </div>

        {/* Title and Slug */}
        <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
          {skill.name}
        </h3>
        <div className="font-mono text-xs text-indigo-600 mt-0.5 truncate font-medium">
          {skill.slug}
        </div>

        {/* Description */}
        <p className="text-xs text-slate-600 mt-2.5 line-clamp-2 leading-relaxed h-8">
          {skill.description}
        </p>

        {/* Client Tags */}
        <div className="flex items-center gap-1.5 mt-3 flex-wrap">
          {skill.clients.map(client => (
            <span
              key={client}
              className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-md bg-slate-50 text-slate-600 border border-slate-200"
            >
              {client}
            </span>
          ))}
        </div>
      </div>

      {/* Bottom Footer */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col gap-3">
        {/* Author and stats */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <Avatar
              src={skill.author.avatar}
              name={skill.author.name}
              className="w-6 h-6 rounded-full border border-slate-200"
            />
            <div className="text-xs text-slate-700 font-medium truncate">
              {skill.author.name.split(' ')[0]}
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
            <span className="flex items-center gap-1">
              <Download className="w-3.5 h-3.5 text-slate-400" />
              <span>{skill.downloads}</span>
            </span>
            <button
              onClick={handleStar}
              className={`flex items-center gap-1 hover:text-amber-500 transition-colors ${
                skill.isStarred ? 'text-amber-500 font-bold' : ''
              }`}
              title="收藏技能"
            >
              <Star className={`w-3.5 h-3.5 ${skill.isStarred ? 'fill-amber-500 text-amber-500' : ''}`} />
              <span>{skill.stars}</span>
            </button>
            <button
              onClick={handleLike}
              className={`flex items-center gap-1 hover:text-rose-500 transition-colors ${
                skill.isLiked ? 'text-rose-500 font-bold' : ''
              }`}
              title="点赞"
            >
              <Heart className={`w-3.5 h-3.5 ${skill.isLiked ? 'fill-rose-500 text-rose-500' : ''}`} />
              <span>{skill.likes}</span>
            </button>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleZipDownload}
            className="flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold transition-colors"
            title="打包下载 ZIP"
          >
            <Download className="w-3.5 h-3.5" />
            <span>打包下载</span>
          </button>

          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowCliDropdown(!showCliDropdown);
              }}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 text-xs font-semibold transition-colors"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>安装指令</span>
            </button>

            {/* Dropdown for CLI commands */}
            {showCliDropdown && (
              <div 
                onClick={(e) => e.stopPropagation()}
                className="absolute bottom-full right-0 mb-2 w-64 p-2 bg-white rounded-2xl shadow-xl border border-slate-200 z-30 text-xs space-y-1.5"
              >
                <div className="font-bold text-slate-800 px-2 py-1 text-[11px] border-b border-slate-100">
                  选择客户端快速复制：
                </div>
                {skill.installCommands.claude && (
                  <button
                    onClick={(e) => handleQuickCopy(e, skill.installCommands.claude, 'Claude Code')}
                    className="w-full text-left p-2 rounded-xl hover:bg-slate-50 flex items-center justify-between group/cmd"
                  >
                    <span className="font-semibold text-slate-800">Claude Code</span>
                    <Copy className="w-3.5 h-3.5 text-slate-400 group-hover/cmd:text-indigo-600" />
                  </button>
                )}
                {skill.installCommands.cursor && (
                  <button
                    onClick={(e) => handleQuickCopy(e, skill.installCommands.cursor, 'Cursor')}
                    className="w-full text-left p-2 rounded-xl hover:bg-slate-50 flex items-center justify-between group/cmd"
                  >
                    <span className="font-semibold text-slate-800">Cursor</span>
                    <Copy className="w-3.5 h-3.5 text-slate-400 group-hover/cmd:text-indigo-600" />
                  </button>
                )}
                {skill.installCommands.mcp && (
                  <button
                    onClick={(e) => handleQuickCopy(e, skill.installCommands.mcp, 'MCP Server')}
                    className="w-full text-left p-2 rounded-xl hover:bg-slate-50 flex items-center justify-between group/cmd"
                  >
                    <span className="font-semibold text-slate-800">MCP Server</span>
                    <Copy className="w-3.5 h-3.5 text-slate-400 group-hover/cmd:text-indigo-600" />
                  </button>
                )}
                {skill.installCommands.cli && (
                  <button
                    onClick={(e) => handleQuickCopy(e, skill.installCommands.cli, 'SkillHub CLI')}
                    className="w-full text-left p-2 rounded-xl hover:bg-slate-50 flex items-center justify-between group/cmd"
                  >
                    <span className="font-semibold text-slate-800">SkillHub CLI (npx)</span>
                    <Copy className="w-3.5 h-3.5 text-slate-400 group-hover/cmd:text-indigo-600" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
