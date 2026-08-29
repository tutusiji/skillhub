import React, { useState, useEffect } from 'react';
import { Search, ArrowRight } from 'lucide-react';
import { SkillItem } from '../types';
import { Modal } from './Modal';

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  skills: SkillItem[];
  onSelectSkill: (skill: SkillItem) => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  skills,
  onSelectSkill,
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

  // 全局搜索只展示已审核通过的技能，待审核/驳回/下架技能不出现在搜索结果
  const searchable = skills.filter(s => s.status === 'approved');

  const filtered = query.trim()
    ? searchable.filter(
        s =>
          s.name.toLowerCase().includes(query.toLowerCase()) ||
          s.slug.toLowerCase().includes(query.toLowerCase()) ||
          s.category.toLowerCase().includes(query.toLowerCase()) ||
          s.description.toLowerCase().includes(query.toLowerCase())
      )
    : searchable.slice(0, 6);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="2xl"
      align="top"
      containerClassName="pt-16 sm:pt-24"
      showCloseButton={false}
      panelClassName="!overflow-hidden"
    >
      <div id="command-palette-dialog">
        {/* Search input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200">
          <Search className="w-5 h-5 text-indigo-500 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="搜索技能名称、包标识 (@skillhub/...) 或作者..."
            className="w-full bg-transparent text-sm text-slate-900 placeholder-slate-400 outline-none"
          />
        </div>

        {/* Results */}
        <div className="p-3 max-h-96 overflow-y-auto space-y-1 text-xs">
          <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            {query.trim() ? `搜索匹配 (${filtered.length})` : '热门技能推荐'}
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
                  {skill.auditResults.score != null ? `${skill.auditResults.score}分` : '未体检'}
                </span>
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
};
