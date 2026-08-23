import React, { useState, useMemo } from 'react';
import { 
  Coins, 
  Sparkles, 
  Search, 
  Filter, 
  PlusCircle, 
  Clock, 
  User, 
  ChevronRight, 
  Flame, 
  Award, 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Layers,
  ArrowUpDown,
  ArrowRight,
  Shield,
  MessageSquare,
  Trash2
} from 'lucide-react';
import { SkillDemand, UserAccount, ExpertDomain, SkillItem } from '../types';
import { EXPERT_DOMAINS, getExpertDomainMeta } from '../data/expertDomains';

interface SkillDemandMarketViewProps {
  demands: SkillDemand[];
  currentUser: UserAccount | null;
  availableSkills: SkillItem[];
  onOpenCreateDemand: () => void;
  onSelectDemand: (demand: SkillDemand) => void;
  onApproveDemand: (id: string) => void;
  onRejectDemand: (id: string, reason: string) => void;
  onDeleteDemand: (id: string) => void;
  onOpenLogin: () => void;
  onToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, message: string) => void;
}

export const SkillDemandMarketView: React.FC<SkillDemandMarketViewProps> = ({
  demands,
  currentUser,
  availableSkills,
  onOpenCreateDemand,
  onSelectDemand,
  onApproveDemand,
  onRejectDemand,
  onDeleteDemand,
  onOpenLogin,
  onToast
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDomain, setSelectedDomain] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'bounty_desc' | 'latest'>('bounty_desc');

  const isSuperAdmin = currentUser?.role === 'super_admin';
  const isAdmin = currentUser?.role === 'admin' || isSuperAdmin;

  // Filter demands
  const filteredDemands = useMemo(() => {
    return demands.filter(d => {
      // Visibility rule:
      // Regular users only see 'open' and 'fulfilled' demands, PLUS their own pending/rejected demands.
      // Admins see all demands.
      if (!isAdmin) {
        const isMine = currentUser && d.author.id === currentUser.id;
        if (!isMine && d.status !== 'open' && d.status !== 'approved' && d.status !== 'fulfilled') {
          return false;
        }
      }

      // Domain filter
      if (selectedDomain !== 'all' && d.targetDomain !== selectedDomain) {
        return false;
      }

      // Status filter
      if (selectedStatus !== 'all' && d.status !== selectedStatus) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = d.title.toLowerCase().includes(q);
        const matchesDesc = d.description.toLowerCase().includes(q);
        const matchesAuthor = d.author.name.toLowerCase().includes(q) || d.author.department.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesAuthor) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'bounty_desc') {
        return b.bountyPoints - a.bountyPoints;
      } else {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });
  }, [demands, selectedDomain, selectedStatus, searchQuery, sortBy, isAdmin, currentUser]);

  // Statistics
  const totalBountyPool = useMemo(() => {
    return demands.reduce((acc, curr) => acc + (curr.status === 'open' || curr.status === 'approved' ? curr.bountyPoints : 0), 0);
  }, [demands]);

  const openDemandsCount = useMemo(() => {
    return demands.filter(d => d.status === 'open' || d.status === 'approved').length;
  }, [demands]);

  const pendingDemandsCount = useMemo(() => {
    return demands.filter(d => d.status === 'pending').length;
  }, [demands]);

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Top Atmosphere Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 shadow-xl border border-indigo-900/40">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-300 text-xs font-bold shadow-2xs">
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              <span>企业 AI 技能征集广场</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white">
              发布业务痛点与诉求，征集定制 AI 技能与插件
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              汇聚企业全栈、算法、UI设计、测试与运维工程师力量。每位员工均有 <strong className="text-amber-300 font-bold">10,000 奖励积分</strong>，设定积分奖励让专家为你打造专属工作流 Agent。
            </p>
          </div>

          {/* Stats and CTA Card */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
            {/* Stat Counters */}
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 text-center">
              <div className="px-3 py-1">
                <div className="text-[11px] text-slate-400 font-medium">进行中征集</div>
                <div className="text-lg font-black text-amber-400 mt-0.5">
                  {openDemandsCount} <span className="text-[10px] text-slate-400 font-normal">个</span>
                </div>
              </div>
              <div className="px-3 py-1 border-l border-white/10">
                <div className="text-[11px] text-slate-400 font-medium">总征集积分池</div>
                <div className="text-lg font-black text-white mt-0.5">
                  {totalBountyPool.toLocaleString()} <span className="text-[10px] text-amber-300 font-normal">pts</span>
                </div>
              </div>
            </div>

            {/* Post CTA button */}
            <button
              onClick={() => {
                if (!currentUser) {
                  onOpenLogin();
                } else {
                  onOpenCreateDemand();
                }
              }}
              className="px-6 py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-sm transition-all shadow-lg shadow-amber-500/25 active:scale-95 flex items-center justify-center gap-2 group whitespace-nowrap"
            >
              <PlusCircle className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
              <span>发布征集需求</span>
            </button>
          </div>
        </div>

        {/* User Balance Strip if logged in */}
        {currentUser && (
          <div className="relative z-10 mt-6 pt-4 border-t border-white/10 flex items-center justify-between flex-wrap gap-3 text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <span className="text-amber-400 font-bold">🪙 我的奖励积分余额：</span>
              <span className="text-sm font-black text-white">{currentUser.points.toLocaleString()} 积分</span>
              <span className="text-slate-400 text-[11px]">(最低 100 积分即可发起征集)</span>
            </div>
            {isAdmin && pendingDemandsCount > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 font-bold text-xs border border-amber-400/30">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>管理员提醒：有 {pendingDemandsCount} 条新需求等待审核</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Expert Domains Categories Tab */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-indigo-600" />
            <span>按专家组 / 岗位角色筛选</span>
          </h2>
          <span className="text-xs text-slate-400">共 {filteredDemands.length} 个相关需求</span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {EXPERT_DOMAINS.map(domain => {
            const isSelected = selectedDomain === domain.id;
            return (
              <button
                key={domain.id}
                onClick={() => setSelectedDomain(domain.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 border ${
                  isSelected
                    ? `${domain.badgeBg} ${domain.badgeText} ${domain.badgeBorder || domain.border || 'border-indigo-300'} ring-2 ring-indigo-400/20 shadow-2xs`
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span>{domain.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Search and Secondary Filter Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="搜索需求标题、痛点描述、发起人..."
            className="w-full pl-9 pr-4 py-1.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs text-slate-800"
          />
        </div>

        {/* Filters and Sort */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="all">全部状态</option>
            <option value="open">🔥 征集中</option>
            <option value="fulfilled">✅ 已完结</option>
            {isAdmin && <option value="pending">⏳ 待管理员审核</option>}
            {isAdmin && <option value="rejected">❌ 已驳回</option>}
          </select>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="bounty_desc">🪙 奖励积分从高到低</option>
            <option value="latest">⏱️ 最新发布时间</option>
          </select>
        </div>
      </div>

      {/* Demands Grid */}
      {filteredDemands.length === 0 ? (
        <div className="p-12 rounded-3xl bg-white border border-slate-200 text-center space-y-4 shadow-2xs">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-500 border border-amber-200 flex items-center justify-center mx-auto">
            <Coins className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-800">暂无匹配的技能征集需求</h3>
            <p className="text-xs text-slate-400">
              您可以切换分类筛选，或者立即使用您的积分发起第一个技能征集需求！
            </p>
          </div>
          <button
            onClick={() => {
              if (!currentUser) onOpenLogin();
              else onOpenCreateDemand();
            }}
            className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-md shadow-amber-500/20"
          >
            立即发布征集需求
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDemands.map(demand => {
            const domainMeta = getExpertDomainMeta(demand.targetDomain);
            const isAuthor = currentUser?.id === demand.author.id;

            return (
              <div
                key={demand.id}
                onClick={() => onSelectDemand(demand)}
                className="group relative flex flex-col justify-between p-5 rounded-2xl bg-white border border-slate-200 hover:border-indigo-400/80 hover:shadow-lg transition-all duration-200 cursor-pointer text-left shadow-2xs"
              >
                <div>
                  {/* Top Bar: Domain badge & Bounty */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${domainMeta.badgeBg} ${domainMeta.badgeText} ${domainMeta.border}`}>
                      {domainMeta.shortLabel}
                    </span>

                    <div className="px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200/90 text-amber-800 font-black text-xs flex items-center gap-1 shadow-2xs">
                      <span>🪙</span>
                      <span>{demand.bountyPoints.toLocaleString()} 积分</span>
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="text-sm font-black text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-2 leading-snug mb-2">
                    {demand.title}
                  </h3>

                  {/* Description preview */}
                  <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed mb-4">
                    {demand.description}
                  </p>
                </div>

                <div className="space-y-3 pt-3 border-t border-slate-100">
                  {/* Status & Submissions */}
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5">
                      {(demand.status === 'open' || demand.status === 'approved') && (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          征集中
                        </span>
                      )}
                      {demand.status === 'pending' && (
                        <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 font-bold border border-amber-200 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          待审核
                        </span>
                      )}
                      {demand.status === 'rejected' && (
                        <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 font-bold border border-rose-200 flex items-center gap-1">
                          <XCircle className="w-3 h-3" />
                          已驳回
                        </span>
                      )}
                      {demand.status === 'fulfilled' && (
                        <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-bold border border-blue-200 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          已完结
                        </span>
                      )}
                    </div>

                    <div className="text-slate-400 flex items-center gap-1">
                      <MessageSquare className="w-3 h-3 text-slate-400" />
                      <span>{demand.submissionsCount || 0} 个方案响应</span>
                    </div>
                  </div>

                  {/* Rejection note inline preview */}
                  {demand.status === 'rejected' && demand.rejectReason && (
                    <div className="p-2 rounded-xl bg-rose-50 border border-rose-100 text-[10px] text-rose-700 truncate">
                      <strong>驳回原因：</strong>{demand.rejectReason}
                    </div>
                  )}

                  {/* Author & Footer Actions */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <img
                        src={demand.author.avatar}
                        alt={demand.author.name}
                        className="w-6 h-6 rounded-full object-cover border border-slate-200 shrink-0"
                      />
                      <div className="truncate">
                        <span className="text-xs font-bold text-slate-700 truncate block">
                          {demand.author.name}
                        </span>
                        <span className="text-[10px] text-slate-400 truncate block">
                          {demand.author.department}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {/* Admin inline approve/reject buttons for pending */}
                      {isAdmin && demand.status === 'pending' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onApproveDemand(demand.id);
                            onToast('success', '已通过审核', '该需求已在广场公开展示！');
                          }}
                          className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold shadow-2xs"
                        >
                          审核通过
                        </button>
                      )}

                      <span className="text-indigo-600 text-xs font-bold group-hover:translate-x-0.5 transition-transform flex items-center">
                        详情
                        <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
