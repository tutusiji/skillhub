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
  Bot, 
  Coins, 
  Palette, 
  KanbanSquare, 
  Cpu, 
  HardDrive, 
  CheckCheck, 
  BarChart3, 
  LayoutGrid,
  List,
  Flame,
  Star,
  ThumbsUp,
  Copy,
  Check,
  ExternalLink,
  Filter,
  ArrowUpRight,
  TrendingUp,
  FolderGit2
} from 'lucide-react';
import { ClientPlatform, SkillCategory, SkillItem, ExpertDomain } from '../types';
import { SkillCard } from './SkillCard';
import { EXPERT_DOMAINS, getExpertDomainMeta } from '../data/expertDomains';

interface MarketplaceViewProps {
  skills: SkillItem[];
  onSelectSkill: (skill: SkillItem) => void;
  onOpenUpload: () => void;
  onOpenDemands?: () => void;
  onToggleStar: (id: string) => boolean | void;
  onToggleLike: (id: string) => boolean | void;
  onDownloadZip: (skill: SkillItem) => void;
  onCopyInstallCmd: (cmd: string, clientName?: string) => void;
}

const CATEGORIES: { id: 'all' | SkillCategory; label: string }[] = [
  { id: 'all', label: '全部类别' },
  { id: 'database', label: '数据库与 SQL' },
  { id: 'devops', label: 'DevOps / CI/CD' },
  { id: 'mcp', label: 'MCP Server 协议' },
  { id: 'security', label: '安全与合规' },
  { id: 'coding', label: '编程提效与脚手架' },
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

// Helper to render domain icon
const DomainIcon: React.FC<{ iconName: string; className?: string }> = ({ iconName, className = 'w-4 h-4' }) => {
  switch (iconName) {
    case 'Code2': return <Code2 className={className} />;
    case 'Palette': return <Palette className={className} />;
    case 'KanbanSquare': return <KanbanSquare className={className} />;
    case 'Cpu': return <Cpu className={className} />;
    case 'HardDrive': return <HardDrive className={className} />;
    case 'CheckCheck': return <CheckCheck className={className} />;
    case 'Server': return <Server className={className} />;
    case 'BarChart3': return <BarChart3 className={className} />;
    case 'Sparkles': return <Sparkles className={className} />;
    default: return <LayoutGrid className={className} />;
  }
};

export const MarketplaceView: React.FC<MarketplaceViewProps> = ({
  skills,
  onSelectSkill,
  onOpenUpload,
  onOpenDemands,
  onToggleStar,
  onToggleLike,
  onDownloadZip,
  onCopyInstallCmd
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDomain, setSelectedDomain] = useState<ExpertDomain | 'all'>('all');
  const [selectedCategory, setSelectedCategory] = useState<'all' | SkillCategory>('all');
  const [selectedClients, setSelectedClients] = useState<ClientPlatform[]>([]);
  const [sortBy, setSortBy] = useState<'popular' | 'stars' | 'newest' | 'score'>('popular');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid'); // Default to Card view
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const toggleClientFilter = (client: ClientPlatform) => {
    setSelectedClients(prev =>
      prev.includes(client) ? prev.filter(c => c !== client) : [...prev, client]
    );
  };

  const handleCopyCmd = (e: React.MouseEvent, skill: SkillItem) => {
    e.stopPropagation();
    const cmd = skill.installCommands?.claude || `claude mcp add ${skill.slug}`;
    onCopyInstallCmd(cmd, 'Claude Code');
    setCopiedId(skill.id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  // Approved skills
  const approvedSkills = useMemo(() => {
    return skills.filter(s => s.status !== 'offline' && s.status !== 'rejected');
  }, [skills]);

  // Featured Top Skills for the Home Featured Carousel
  const featuredSkills = useMemo(() => {
    return [...approvedSkills]
      .sort((a, b) => b.downloads * 2 + b.stars * 3 - (a.downloads * 2 + a.stars * 3))
      .slice(0, 3);
  }, [approvedSkills]);

  // Filtered skills for the main catalog
  const filteredSkills = useMemo(() => {
    return approvedSkills.filter(skill => {
      if (selectedDomain !== 'all' && skill.expertDomain !== selectedDomain) return false;
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
  }, [approvedSkills, selectedDomain, selectedCategory, selectedClients, searchQuery, sortBy]);

  // Domain count mapping
  const domainSkillCounts = useMemo(() => {
    const counts: Record<string, number> = { all: approvedSkills.length };
    approvedSkills.forEach(s => {
      if (s.expertDomain) {
        counts[s.expertDomain] = (counts[s.expertDomain] || 0) + 1;
      }
    });
    return counts;
  }, [approvedSkills]);

  const totalDownloads = useMemo(() => {
    return approvedSkills.reduce((acc, s) => acc + (s.downloads || 0), 0);
  }, [approvedSkills]);

  return (
    <div className="space-y-10 animate-in fade-in duration-200 text-left pb-16">
      {/* 1. Light-Themed Enterprise Home Hero Portal */}
      <div className="relative rounded-3xl overflow-hidden border border-indigo-100 bg-gradient-to-br from-indigo-50/90 via-white to-sky-50/80 p-6 sm:p-10 shadow-sm">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-200/25 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-amber-200/20 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 max-w-4xl space-y-5">
          {/* Top Banner Tag & Quick Jump to Demands Square */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-100/90 text-indigo-800 border border-indigo-200 text-xs font-bold shadow-2xs">
              <Zap className="w-3.5 h-3.5 text-indigo-600" />
              <span>企业内网 AI 技能与 MCP 插件市场</span>
            </span>

            {onOpenDemands && (
              <button
                onClick={onOpenDemands}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 text-xs font-bold transition-all shadow-2xs group"
              >
                <Coins className="w-3.5 h-3.5 text-amber-600 group-hover:rotate-12 transition-transform" />
                <span>进入技能征集广场 · 积分激励与方案揭榜 →</span>
              </button>
            )}
          </div>

          {/* Main Hero Headline */}
          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight text-slate-900">
            赋能业务专家，连接智能体生态
          </h1>

          <p className="text-xs sm:text-base text-slate-600 leading-relaxed max-w-2xl font-normal">
            汇聚面向 <strong className="text-slate-900 font-bold">全栈开发、产品经理、UI设计、算法、测试、DevOps 与数据分析</strong> 等 8 大岗位的自研 AI 插件与 Prompt 智能体，全量兼容 Claude Code、Cursor 与 MCP Server 协议。
          </p>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-200/80 text-xs">
            <div className="p-3.5 rounded-2xl bg-white/95 border border-slate-200/80 shadow-2xs">
              <span className="text-slate-400 block text-[11px] font-medium">已认证上架</span>
              <span className="text-xl font-black text-slate-900 mt-0.5 block">{approvedSkills.length} 款插件</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-white/95 border border-slate-200/80 shadow-2xs">
              <span className="text-slate-400 block text-[11px] font-medium">业务专家组</span>
              <span className="text-xl font-black text-indigo-600 mt-0.5 block">8 大核心岗位</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-white/95 border border-slate-200/80 shadow-2xs">
              <span className="text-slate-400 block text-[11px] font-medium">双引擎体检通过率</span>
              <span className="text-xl font-black text-emerald-600 mt-0.5 block">99.4%</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-white/95 border border-slate-200/80 shadow-2xs">
              <span className="text-slate-400 block text-[11px] font-medium">客户端生态兼容</span>
              <span className="text-xl font-black text-amber-700 mt-0.5 block">Claude / Cursor</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Featured / Trending Spotlight Section (今日精选与热门榜首) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
              <Flame className="w-4 h-4 text-amber-500" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900">
                精选与热门技能推荐
              </h2>
              <p className="text-[11px] text-slate-400">
                本周内网调用频次最高、双引擎安全评分卓越的生产力工具
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {featuredSkills.map((skill, index) => {
            const domainMeta = getExpertDomainMeta(skill.expertDomain);
            return (
              <div
                key={skill.id}
                onClick={() => onSelectSkill(skill)}
                className="relative group p-5 rounded-3xl bg-white border border-slate-200 hover:border-indigo-400 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-md bg-amber-500 text-slate-950 font-black text-[10px] flex items-center gap-0.5 shadow-2xs">
                        <Flame className="w-3 h-3 text-slate-950 fill-current" />
                        TOP {index + 1}
                      </span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${domainMeta.badgeBg} ${domainMeta.badgeText} ${domainMeta.badgeBorder || 'border-slate-200'}`}>
                        {domainMeta.shortLabel}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      <ShieldCheck className="w-3 h-3" />
                      <span>{skill.auditResults.score}分</span>
                    </div>
                  </div>

                  <h3 className="text-sm font-black text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
                    {skill.name}
                  </h3>
                  <div className="text-[11px] font-mono text-slate-400 truncate mt-0.5">
                    {skill.slug}
                  </div>

                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mt-2">
                    {skill.description}
                  </p>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3 text-slate-400 text-[11px]">
                    <span>🔥 {skill.downloads.toLocaleString()}</span>
                    <span>⭐ {skill.stars}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => handleCopyCmd(e, skill)}
                      className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 text-[11px] font-bold transition-all flex items-center gap-1"
                      title="复制 Claude 安装命令"
                    >
                      {copiedId === skill.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedId === skill.id ? '已复制' : '复制命令'}</span>
                    </button>
                    <span className="text-indigo-600 group-hover:translate-x-0.5 transition-transform font-bold text-xs flex items-center">
                      详情 →
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Expert Domain Matrix Navigation (按岗位专家组快速直达) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-bold text-slate-900 px-1">
          <div className="flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-indigo-600" />
            <span className="text-sm">岗位专家组矩阵直达</span>
          </div>
          {selectedDomain !== 'all' && (
            <button 
              onClick={() => setSelectedDomain('all')}
              className="text-indigo-600 hover:underline text-xs font-semibold"
            >
              重置（查看全部专家组）
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-2">
          {EXPERT_DOMAINS.map(domain => {
            const isSelected = selectedDomain === domain.id;
            const count = domainSkillCounts[domain.id] || 0;
            return (
              <button
                key={domain.id}
                onClick={() => setSelectedDomain(domain.id as any)}
                className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20 ring-2 ring-indigo-300'
                    : 'bg-white border-slate-200 hover:border-indigo-300 hover:bg-slate-50/80 text-slate-700 shadow-2xs'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <DomainIcon iconName={domain.iconName} className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-indigo-600'}`} />
                  <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {count}
                  </span>
                </div>
                <div>
                  <div className="text-xs font-bold truncate">{domain.shortLabel}</div>
                  <div className={`text-[10px] truncate mt-0.5 ${isSelected ? 'text-indigo-100' : 'text-slate-400'}`}>
                    {domain.name.split('与')[0]}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Full Skill & Plugin Catalog (技能集市：卡片 / 列表切换，默认卡片) */}
      <div className="space-y-5 pt-4 border-t border-slate-200/80">
        {/* Section Title & View Switcher Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <FolderGit2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <span>技能与 MCP 插件全量集市</span>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono text-xs font-bold">
                  {filteredSkills.length} 款
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                支持多维度检索、客户端协议筛选以及一键安装配置
              </p>
            </div>
          </div>

          {/* View Switcher Controls (Card / List Toggle, defaults to Card) */}
          <div className="flex items-center gap-2 self-start sm:self-center">
            <span className="text-xs text-slate-400 font-medium mr-1 hidden sm:inline">视图模式:</span>
            <div className="flex items-center p-1 bg-slate-100 rounded-2xl border border-slate-200/80">
              <button
                onClick={() => setViewMode('grid')}
                id="btn-view-mode-grid"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  viewMode === 'grid'
                    ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="卡片网格视图（默认）"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>卡片视图</span>
              </button>
              <button
                onClick={() => setViewMode('table')}
                id="btn-view-mode-table"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  viewMode === 'table'
                    ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="紧凑表格列表视图"
              >
                <List className="w-3.5 h-3.5" />
                <span>列表视图</span>
              </button>
            </div>
          </div>
        </div>

        {/* Technical Category horizontal scroll tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 select-none no-scrollbar">
          {CATEGORIES.map(cat => {
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-50 shadow-2xs'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Filter Bar: Search, Client compatibility, Sort */}
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
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-300 shadow-2xs font-bold'
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
              className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 font-bold outline-none cursor-pointer"
            >
              <option value="popular">🔥 按热门下载排序</option>
              <option value="stars">⭐ 按最多收藏排序</option>
              <option value="score">🛡️ 按安全体检得分排序</option>
              <option value="newest">🕒 按最新发布排序</option>
            </select>
          </div>
        </div>

        {/* Empty State */}
        {filteredSkills.length === 0 ? (
          <div className="p-16 text-center rounded-3xl bg-white border border-slate-200 space-y-3">
            <Layers className="w-10 h-10 text-slate-300 mx-auto" />
            <div className="text-sm font-bold text-slate-700">
              未找到匹配的技能或插件
            </div>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              尝试清除筛选条件，或作为开发者将您团队内部沉淀的工作流智能体提交发布！
            </p>
            <div className="pt-2">
              <button
                onClick={() => {
                  setSelectedDomain('all');
                  setSelectedCategory('all');
                  setSelectedClients([]);
                  setSearchQuery('');
                }}
                className="px-4 py-2 rounded-xl bg-slate-100 text-xs font-bold text-slate-700 hover:bg-slate-200"
              >
                重置所有筛选
              </button>
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          /* Card View (Default) */
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
        ) : (
          /* Table / List View */
          <div className="overflow-hidden rounded-3xl bg-white border border-slate-200/90 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold">
                    <th className="py-3.5 px-4">技能 / 插件名称</th>
                    <th className="py-3.5 px-4">岗位专家组</th>
                    <th className="py-3.5 px-4">安全体检</th>
                    <th className="py-3.5 px-4">支持客户端</th>
                    <th className="py-3.5 px-4">调用 / 收藏</th>
                    <th className="py-3.5 px-4">贡献者</th>
                    <th className="py-3.5 px-4 text-right">快捷操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSkills.map(skill => {
                    const domainMeta = getExpertDomainMeta(skill.expertDomain);
                    return (
                      <tr 
                        key={skill.id}
                        onClick={() => onSelectSkill(skill)}
                        className="hover:bg-indigo-50/40 transition-colors cursor-pointer group"
                      >
                        {/* Name, Slug, Version */}
                        <td className="py-3.5 px-4 max-w-xs">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleStar(skill.id);
                              }}
                              className={`p-1 rounded-md transition-colors ${
                                skill.isStarred 
                                  ? 'text-amber-500 hover:text-amber-600' 
                                  : 'text-slate-300 hover:text-amber-500'
                              }`}
                              title={skill.isStarred ? '取消收藏' : '收藏技能'}
                            >
                              <Star className={`w-3.5 h-3.5 ${skill.isStarred ? 'fill-current' : ''}`} />
                            </button>
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
                                {skill.name}
                              </div>
                              <div className="font-mono text-[10px] text-slate-400 truncate">
                                {skill.slug} <span className="text-slate-300">· v{skill.version}</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Expert Domain */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${domainMeta.badgeBg} ${domainMeta.badgeText} ${domainMeta.badgeBorder || 'border-slate-200'}`}>
                            {domainMeta.shortLabel}
                          </span>
                        </td>

                        {/* Audit Score */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                            <span>{skill.auditResults.score}分 通过</span>
                          </div>
                        </td>

                        {/* Supported Clients */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1 flex-wrap max-w-xs">
                            {skill.clients.slice(0, 3).map(c => (
                              <span key={c} className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-mono text-[10px]">
                                {c}
                              </span>
                            ))}
                            {skill.clients.length > 3 && (
                              <span className="text-[10px] text-slate-400">+{skill.clients.length - 3}</span>
                            )}
                          </div>
                        </td>

                        {/* Stats */}
                        <td className="py-3.5 px-4 whitespace-nowrap font-mono text-slate-600">
                          <div className="flex items-center gap-2">
                            <span>🔥 {skill.downloads.toLocaleString()}</span>
                            <span>⭐ {skill.stars}</span>
                          </div>
                        </td>

                        {/* Author */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <img
                              src={skill.author.avatar}
                              alt={skill.author.name}
                              className="w-5 h-5 rounded-full object-cover border border-slate-200"
                            />
                            <span className="text-slate-700 text-xs truncate max-w-[100px]">{skill.author.name}</span>
                          </div>
                        </td>

                        {/* Action Buttons */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={(e) => handleCopyCmd(e, skill)}
                              className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 text-[11px] font-bold transition-colors flex items-center gap-1"
                              title="复制安装命令"
                            >
                              {copiedId === skill.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                              <span>{copiedId === skill.id ? '已复制' : '复制命令'}</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDownloadZip(skill);
                              }}
                              className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                              title="下载 ZIP 源码"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
