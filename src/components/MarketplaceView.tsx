import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Terminal, 
  Sparkles, 
  Download, 
  ShieldCheck, 
  Layers, 
  Zap, 
  ArrowRight,
  Code2,
  CheckCircle2,
  Server,
  Bot
} from 'lucide-react';
import { ClientPlatform, SkillCategory, SkillItem } from '../types';
import { SkillCard } from './SkillCard';

interface MarketplaceViewProps {
  skills: SkillItem[];
  onSelectSkill: (skill: SkillItem) => void;
  onOpenUpload: () => void;
  onToggleStar: (id: string) => void;
  onToggleLike: (id: string) => void;
  onDownloadZip: (skill: SkillItem) => void;
  onCopyInstallCmd: (cmd: string, clientName?: string) => void;
}

const CATEGORIES: { id: 'all' | SkillCategory; label: string }[] = [
  { id: 'all', label: '全部技能' },
  { id: 'database', label: '数据库与 SQL' },
  { id: 'devops', label: 'DevOps / CI/CD' },
  { id: 'mcp', label: 'MCP Server 协议' },
  { id: 'security', label: '安全与合规' },
  { id: 'coding', label: '编程与前端提效' },
  { id: 'productivity', label: '知识库与 DeepResearch' },
  { id: 'data', label: '大数据分析' },
  { id: 'agent', label: '自主智能体' }
];

const CLIENT_OPTIONS: { id: ClientPlatform; label: string }[] = [
  { id: 'claude', label: 'Claude Code' },
  { id: 'cursor', label: 'Cursor' },
  { id: 'mcp', label: 'MCP Server' },
  { id: 'open-webui', label: 'Open WebUI' },
  { id: 'chatgpt', label: 'ChatGPT' },
  { id: 'copilot', label: 'Copilot' }
];

export const MarketplaceView: React.FC<MarketplaceViewProps> = ({
  skills,
  onSelectSkill,
  onOpenUpload,
  onToggleStar,
  onToggleLike,
  onDownloadZip,
  onCopyInstallCmd
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | SkillCategory>('all');
  const [selectedClients, setSelectedClients] = useState<ClientPlatform[]>([]);
  const [sortBy, setSortBy] = useState<'popular' | 'stars' | 'newest' | 'score'>('popular');

  const toggleClientFilter = (client: ClientPlatform) => {
    setSelectedClients(prev =>
      prev.includes(client) ? prev.filter(c => c !== client) : [...prev, client]
    );
  };

  const filteredSkills = useMemo(() => {
    return skills.filter(skill => {
      // By default show approved or pending in market
      if (selectedCategory !== 'all' && skill.category !== selectedCategory) return false;

      if (selectedClients.length > 0) {
        const hasClient = selectedClients.some(c => skill.clients.includes(c));
        if (!hasClient) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inName = skill.name.toLowerCase().includes(q);
        const inSlug = skill.slug.toLowerCase().includes(q);
        const inDesc = skill.description.toLowerCase().includes(q);
        const inAuthor = skill.author.name.toLowerCase().includes(q);
        const inTags = skill.tags.some(t => t.toLowerCase().includes(q));
        if (!inName && !inSlug && !inDesc && !inAuthor && !inTags) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'popular') return b.downloads - a.downloads;
      if (sortBy === 'stars') return b.stars - a.stars;
      if (sortBy === 'score') return b.auditResults.score - a.auditResults.score;
      if (sortBy === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return 0;
    });
  }, [skills, selectedCategory, selectedClients, searchQuery, sortBy]);

  const totalDownloads = useMemo(() => {
    return skills.reduce((acc, s) => acc + (s.downloads || 0), 0);
  }, [skills]);

  return (
    <div className="space-y-8 animate-in fade-in duration-150">
      {/* Light-Themed Hero Atmosphere Banner */}
      <div className="relative rounded-3xl overflow-hidden border border-indigo-100 bg-gradient-to-br from-indigo-50/90 via-white to-sky-50/80 p-6 sm:p-10 shadow-sm">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-200/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-sky-200/20 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100/80 text-indigo-800 border border-indigo-200 text-xs font-bold">
            <Zap className="w-3.5 h-3.5 text-indigo-600" />
            <span>企业私有内网 AI 插件市场 · 双引擎安全合规治理</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight text-slate-900">
            连接大模型智能体与企业内网业务基础设施
          </h1>

          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
            提供经过<strong className="text-indigo-700 font-bold">正则特征规则与 LLM 语义大模型双引擎审核</strong>的官方与团队专属技能插件。
            支持一键打包下载源码 ZIP、查看在线文件树及全平台 CLI 命令行即时安装。
          </p>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-200/80 text-xs">
            <div className="p-3.5 rounded-2xl bg-white/90 border border-slate-200/80 shadow-2xs">
              <span className="text-slate-500 block text-[11px] font-medium">已上架技能</span>
              <span className="text-lg font-extrabold text-slate-900 mt-0.5 block">{skills.length} 个插件</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-white/90 border border-slate-200/80 shadow-2xs">
              <span className="text-slate-500 block text-[11px] font-medium">内网总调用/下载</span>
              <span className="text-lg font-extrabold text-emerald-600 mt-0.5 block">{totalDownloads.toLocaleString()} 次</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-white/90 border border-slate-200/80 shadow-2xs">
              <span className="text-slate-500 block text-[11px] font-medium">双引擎初筛通过率</span>
              <span className="text-lg font-extrabold text-indigo-600 mt-0.5 block">99.4%</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-white/90 border border-slate-200/80 shadow-2xs">
              <span className="text-slate-500 block text-[11px] font-medium">客户端全生态</span>
              <span className="text-lg font-extrabold text-amber-700 mt-0.5 block">Claude / Cursor / MCP</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Section */}
      <div className="space-y-4">
        {/* Category horizontal scroll bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 select-none">
          {CATEGORIES.map(cat => {
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                    : 'bg-white text-slate-700 hover:text-slate-900 border border-slate-200 hover:bg-slate-50 shadow-2xs'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Secondary controls: Search, Client filters, Sort */}
        <div className="p-4 rounded-3xl bg-white border border-slate-200/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Search box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="搜索技能名称、包标识 (@skillhub/...)、作者或关键词..."
              className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600 font-medium"
              >
                清空
              </button>
            )}
          </div>

          {/* Client compatibility pill filters */}
          <div className="flex items-center gap-1.5 flex-wrap text-xs">
            <span className="text-slate-400 text-[11px] font-semibold mr-1">支持生态:</span>
            {CLIENT_OPTIONS.map(client => {
              const isSelected = selectedClients.includes(client.id);
              return (
                <button
                  key={client.id}
                  onClick={() => toggleClientFilter(client.id)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all ${
                    isSelected
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-300 shadow-2xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {client.label}
                </button>
              );
            })}
          </div>

          {/* Sort selector */}
          <div className="flex items-center gap-2 shrink-0">
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 font-medium outline-none"
            >
              <option value="popular">🔥 按热门下载排序</option>
              <option value="stars">⭐ 按最多收藏排序</option>
              <option value="score">🛡️ 按安全体检得分排序</option>
              <option value="newest">🕒 按最新发布排序</option>
            </select>
          </div>
        </div>
      </div>

      {/* Skills Grid List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs text-slate-500 font-medium">
            共找到 <strong className="text-slate-900 font-bold">{filteredSkills.length}</strong> 个匹配的内网 AI 技能/插件
          </div>
        </div>

        {filteredSkills.length === 0 ? (
          <div className="p-16 text-center rounded-3xl bg-white border border-slate-200 space-y-3">
            <Layers className="w-10 h-10 text-slate-300 mx-auto" />
            <div className="text-sm font-bold text-slate-700">
              未找到匹配的插件
            </div>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              尝试清除筛选条件，或作为开发者将您团队的内部智能体封装并提交发布！
            </p>
            <div className="pt-2">
              <button
                onClick={() => {
                  setSelectedCategory('all');
                  setSelectedClients([]);
                  setSearchQuery('');
                }}
                className="px-4 py-2 rounded-xl bg-slate-100 text-xs font-semibold text-slate-700 hover:bg-slate-200"
              >
                重置所有筛选
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSkills.map(skill => (
              <SkillCard
                key={skill.id}
                skill={skill}
                onSelectSkill={onSelectSkill}
                onToggleStar={onToggleStar}
                onToggleLike={onToggleLike}
                onDownloadZip={onDownloadZip}
                onCopyInstallCmd={onCopyInstallCmd}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
