import React, { useState, useEffect } from 'react';
import { Search, Terminal, ShieldCheck, ArrowRight, X } from 'lucide-react';
import { SkillItem } from '../types';

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  skills: SkillItem[];
  onSelectSkill: (skill: SkillItem) => void;
  onNavigateTab: (tab: any) => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  skills,
  onSelectSkill,
  onNavigateTab
}) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filtered = query.trim()
    ? skills.filter(
        s =>
          s.name.toLowerCase().includes(query.toLowerCase()) ||
          s.slug.toLowerCase().includes(query.toLowerCase()) ||
          s.category.toLowerCase().includes(query.toLowerCase()) ||
          s.description.toLowerCase().includes(query.toLowerCase())
      )
    : skills.slice(0, 6);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        id="command-palette-dialog"
        className="w-full max-w-2xl bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden"
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200">
          <Search className="w-5 h-5 text-indigo-500 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="快速搜索插件、MCP 服务、CLI 命令或业务分类 (输入 @ 查看标识)..."
            className="w-full bg-transparent text-sm text-slate-900 placeholder-slate-400 outline-none"
          />
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results */}
        <div className="p-3 max-h-96 overflow-y-auto space-y-1 text-xs">
          <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            {query.trim() ? `搜索匹配 (${filtered.length})` : '热门内网技能推荐'}
          </div>

          {filtered.map(skill => (
            <div
              key={skill.id}
              onClick={() => {
                onSelectSkill(skill);
                onClose();
              }}
              className="flex items-center justify-between p-3 rounded-2xl hover:bg-indigo-50/70 cursor-pointer transition-colors group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-indigo-600 font-bold shrink-0">
                  {skill.category[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-slate-900 group-hover:text-indigo-600 truncate">
                    {skill.name}
                  </div>
                  <div className="font-mono text-[11px] text-slate-400 truncate">
                    {skill.slug} · {skill.author.name}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono font-semibold">
                  {skill.auditResults.score}分
                </span>
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors" />
              </div>
            </div>
          ))}

          {/* Quick shortcuts */}
          <div className="pt-2 mt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-slate-600 text-[11px]">
            <button
              onClick={() => { onNavigateTab('upload'); onClose(); }}
              className="p-2 rounded-xl hover:bg-slate-100 text-left flex items-center gap-2 font-medium"
            >
              <Terminal className="w-3.5 h-3.5 text-indigo-600" />
              <span>快速发布新技能</span>
            </button>
            <button
              onClick={() => { onNavigateTab('rules'); onClose(); }}
              className="p-2 rounded-xl hover:bg-slate-100 text-left flex items-center gap-2 font-medium"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>双引擎规则管理库</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
