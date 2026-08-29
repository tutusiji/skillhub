import React, { useState } from 'react';
import { 
  User, 
  Star, 
  Upload, 
  Heart, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  ShieldCheck, 
  Download, 
  Terminal, 
  ArrowRight, 
  Plus, 
  Eye, 
  FileText, 
  Sparkles,
  Bot,
  Search,
  Filter,
  Check,
  ChevronRight,
  ShieldAlert,
  Coins,
  PlusCircle,
  Trash2,
  Settings,
  MessageSquare,
  Shield,
  RefreshCw,
  GitBranch
} from 'lucide-react';
import { SkillItem, UserAccount, SkillDemand } from '../types';
import { SkillCard } from './SkillCard';
import { getExpertDomainMeta } from '../data/expertDomains';
import { isOwnSubmission } from '../utils/skillOwnership';
import { useExpertDomains } from '../hooks/useExpertDomains';
import { PopconfirmBubble } from './PopconfirmBubble';
import { Avatar } from './Avatar';
import { SkillPreviewModal } from './SkillPreviewModal';
import { SkillVersionManagerModal } from './SkillVersionManagerModal';

interface PersonalCenterViewProps {
  currentUser: UserAccount | null;
  allSkills: SkillItem[];
  allDemands: SkillDemand[];
  onSelectSkill: (skill: SkillItem) => void;
  onSelectDemand: (demand: SkillDemand) => void;
  onToggleStar: (id: string) => void;
  onToggleLike: (id: string) => void;
  onDownloadZip: (skill: SkillItem) => void;
  onOpenUploadModal: () => void;
  onOpenCreateDemand?: () => void;
  onOpenCreateDemandModal?: () => void;
  onDeleteDemand: (id: string) => void;
  onOpenSettings?: () => void;
  /** 随机切换头像（个人中心头像旁的切换按钮） */
  onShuffleAvatar?: () => Promise<void> | void;
  onOpenLogin: () => void;
  onCopyInstallCmd: (cmd: string) => void;
  /** 技能作者编辑元数据（白名单字段） */
  onEditSkillMeta?: (skill: SkillItem) => void;
  /** 技能作者发布新版本（带 parentSkillId 打开 UploadSkillModal） */
  onPublishNewVersion?: (skill: SkillItem) => void;
  /** 作者删除自己的驳回版本（版本记录弹窗）；返回 Promise 供弹窗成功后刷新版本链 */
  onDeleteVersion?: (id: string) => Promise<void>;
  onToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, message: string) => void;
}

type PersonalTab = 'starred' | 'submissions' | 'demands' | 'liked';

/**
 * 把「我的提交」按版本链根节点分组 → 插件卡片（一个插件一行）。
 * 列表接口不含 archived 版本（完整版本链由版本记录弹窗实时拉取），
 * 这里只负责把可见的待审/驳回/上架版本归并到同一插件下。
 */
function groupSubmissionsByPlugin(skills: SkillItem[]): SkillItem[][] {
  const byId = new Map(skills.map((s) => [s.id, s]));
  const rootOf = new Map<string, string>();
  const resolveRoot = (s: SkillItem): string => {
    const memo = rootOf.get(s.id);
    if (memo) return memo;
    let cur = s;
    const visited = new Set<string>();
    while (cur.parentSkillId) {
      if (visited.has(cur.id)) break;
      visited.add(cur.id);
      const parent = byId.get(cur.parentSkillId);
      if (!parent) break;
      cur = parent;
    }
    rootOf.set(s.id, cur.id);
    return cur.id;
  };
  const groups = new Map<string, SkillItem[]>();
  for (const s of skills) {
    const rootId = resolveRoot(s);
    const list = groups.get(rootId) ?? [];
    list.push(s);
    groups.set(rootId, list);
  }
  return [...groups.values()];
}

/**
 * 插件卡片代表行：优先「当前对外版本」(approved)，其次待审/下架/驳回的最新一条。
 * 卡片展示插件当前状态；完整版本记录由版本记录弹窗实时拉取。
 */
function pickPluginRepresentative(versions: SkillItem[]): SkillItem {
  const weight = (s: SkillItem) =>
    s.status === 'approved'
      ? 3
      : s.status === 'pending'
        ? 2
        : s.status === 'offline'
          ? 1
          : 0;
  return [...versions].sort(
    (a, b) =>
      weight(b) - weight(a) ||
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )[0];
}

export const PersonalCenterView: React.FC<PersonalCenterViewProps> = ({
  currentUser,
  allSkills,
  allDemands,
  onSelectSkill,
  onSelectDemand,
  onToggleStar,
  onToggleLike,
  onDownloadZip,
  onOpenUploadModal,
  onOpenCreateDemand,
  onOpenCreateDemandModal,
  onDeleteDemand,
  onOpenSettings,
  onOpenLogin,
  onCopyInstallCmd,
  onShuffleAvatar,
  onEditSkillMeta,
  onPublishNewVersion,
  onDeleteVersion,
  onToast
}) => {
  // 默认 tab = 排在第一位的那个（手动调整 tab 按钮顺序时记得同步这里）
  const [activeTab, setActiveTab] = useState<PersonalTab>('submissions');
  const [searchQuery, setSearchQuery] = useState('');
  // 头像切换中：用于禁用按钮 + 转圈，避免连点产生多次请求（每次都会写库）
  const [avatarSwitching, setAvatarSwitching] = useState(false);
  // 未发布技能（pending/rejected）的只读预览弹窗；已发布技能仍走详情页
  const [previewSkill, setPreviewSkill] = useState<SkillItem | null>(null);
  // 版本记录管理弹窗：当前查看的插件（代表行）
  const [managePlugin, setManagePlugin] = useState<SkillItem | null>(null);
  // 专家组数据走 hook（与首页/管理端/征集广场保持同一份），徽章名称才跟随后端修改
  const { domains: expertDomains } = useExpertDomains();

  // Unauthenticated Guard
  if (!currentUser) {
    return (
      <div className="p-8 sm:p-16 rounded-3xl bg-white border border-slate-200 shadow-sm text-center max-w-2xl mx-auto space-y-6 animate-in fade-in duration-200">
        <div className="w-16 h-16 rounded-3xl bg-indigo-50 text-indigo-600 border border-indigo-200/80 flex items-center justify-center mx-auto shadow-sm">
          <User className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl sm:text-2xl font-black text-slate-900">
            登录后查看个人中心
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
            您当前处于未登录状态。登录企业账号后即可使用您的 <strong className="text-indigo-600 font-bold">10,000 奖励积分</strong> 发起技能征集、管理发布的技能插件以及查看收藏夹。
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-xs text-slate-600 max-w-md mx-auto text-left space-y-2">
          <div className="font-bold text-slate-800 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span>登录后尊享以下功能：</span>
          </div>
          <ul className="space-y-1.5 list-disc list-inside text-slate-600 pl-1 text-[11px]">
            <li>获得 <strong>10,000 奖励积分</strong>，随时发起业务痛点技能征集需求</li>
            <li>一键收藏心仪技能并在个人中心快速检索</li>
            <li>发布个人/团队的 MCP Server 与 Agent 技能</li>
            <li>提交全站产品建议与使用反馈</li>
          </ul>
        </div>

        <div className="pt-2">
          <button
            onClick={onOpenLogin}
            id="btn-personal-login-cta"
            className="px-8 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition-all shadow-md shadow-indigo-500/25 active:scale-95 inline-flex items-center gap-2"
          >
            <User className="w-4 h-4" />
            <span>立即登录企业账号</span>
          </button>
        </div>
      </div>
    );
  }

  const isSuperAdmin = currentUser.role === 'super_admin';
  const isAdmin = currentUser.role === 'admin' || isSuperAdmin;

  // Derived data
  const starredSkills = allSkills.filter(s => s.isStarred);
  const likedSkills = allSkills.filter(s => s.isLiked);
  // "我的提交"只认当前登录者本人。
  // 此前这里硬编码了两个演示作者名（'Alex Chen' / '林晨 (开发架构组)'），
  // 任何用户都会把这些演示技能当成自己的提交，并看到不属于自己的审核状态。
  const mySubmissions = allSkills.filter(s => isOwnSubmission(s, currentUser));
  
  // My Demands
  const myDemands = allDemands.filter(d => d.author.id === currentUser.id);

  const filteredStarred = starredSkills.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredLiked = likedSkills.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 我的技能插件：先展示插件卡片（按版本链根分组，一组一行），
  // 点击卡片再进入版本记录弹窗查看该插件的全部历史版本。
  // versionCountOf 记录每组可见版本数（archived 版本由版本记录弹窗实时拉全量）。
  const pluginGroups = groupSubmissionsByPlugin(mySubmissions);
  const versionCountOf = new Map(
    pluginGroups.map(g => [pickPluginRepresentative(g).id, g.length]),
  );
  const pluginCards = pluginGroups
    .map(pickPluginRepresentative)
    .filter(s =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.slug.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const filteredDemands = myDemands.filter(d =>
    d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 「查看技能详情与文件树」：统一走只读预览弹窗，不离开个人中心；
  // 已发布/下架/归档技能在弹窗底部提供「打开完整详情页」入口，
  // 收藏/点赞/下载/安装等完整功能仍在详情页进行
  const handleViewDetail = (skill: SkillItem) => {
    setPreviewSkill(skill);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200 pb-12 text-left">
      {/* Profile Overview Card */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200/90 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-amber-50/60 via-indigo-50/40 to-transparent rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="relative group">
              <Avatar
                src={currentUser.avatar}
                name={currentUser.name}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border-2 border-indigo-100 shadow-md bg-white"
              />
              <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 border-2 border-white rounded-full flex items-center justify-center" title="在线">
                <span className="w-1.5 h-1.5 bg-white rounded-full" />
              </span>
              {/* 换一个头像：头像按 seed 生成，这里让后端换个随机 seed 重新生成 */}
              {onShuffleAvatar && (
                <button
                  type="button"
                  disabled={avatarSwitching}
                  onClick={async () => {
                    if (avatarSwitching) return;
                    setAvatarSwitching(true);
                    try {
                      await onShuffleAvatar();
                    } finally {
                      setAvatarSwitching(false);
                    }
                  }}
                  title="换一个头像"
                  aria-label="换一个头像"
                  className="absolute -top-1.5 -right-1.5 w-7 h-7 rounded-full bg-white border border-slate-200 text-slate-500 shadow-md flex items-center justify-center transition hover:text-indigo-600 hover:border-indigo-300 hover:shadow-lg active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${avatarSwitching ? 'animate-spin' : ''}`} />
                </button>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                  {currentUser.name}
                </h1>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${
                  isSuperAdmin
                    ? 'bg-amber-50 text-amber-800 border-amber-300'
                    : isAdmin
                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                    : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                }`}>
                  {isSuperAdmin ? '🛡️ 超级管理员' : isAdmin ? '⚙️ 系统管理员' : '💻 研发工程师 / 创作者'}
                </span>
              </div>

              <div className="text-xs text-slate-500 font-medium flex items-center gap-3 flex-wrap">
                <span>{currentUser.department} {currentUser.title ? `(${currentUser.title})` : ''}</span>
                <span>•</span>
                <span className="font-mono">{currentUser.email}</span>
                <span>•</span>
                <span>工号 #{currentUser.id}</span>
              </div>
            </div>
          </div>

          {/* Points Card and Action CTAs */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Points Badge Card */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/90 text-amber-950 flex items-center gap-3 shadow-2xs">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-base shadow-sm">
                <Coins className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[11px] text-amber-800 font-medium">我的技能积分</div>
                <div className="text-lg font-black text-slate-900 leading-tight">
                  {currentUser.points.toLocaleString()} <span className="text-xs font-normal text-slate-500">积分</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Post Skill Demand Button */}
              <button
                onClick={onOpenCreateDemand || onOpenCreateDemandModal}
                id="btn-personal-create-demand"
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition-all shadow-md shadow-amber-500/20 active:scale-95 shrink-0"
              >
                <Coins className="w-4 h-4 text-slate-950" />
                <span>发布技能征集</span>
              </button>

              {/* Upload Skill Button */}
              <button
                onClick={onOpenUploadModal}
                id="btn-personal-upload-skill"
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-indigo-500/20 active:scale-95 shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>发布新技能</span>
              </button>

              {/* Super Admin Settings Shortcut */}
              {isSuperAdmin && onOpenSettings && (
                <button
                  onClick={onOpenSettings}
                  className="p-2.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-2xs"
                  title="超级管理员系统权限设置"
                >
                  <Settings className="w-4 h-4 text-indigo-600" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tabs Menu & Search Filter Bar — 整合进个人面板，去掉外边框 */}
        <div className="relative z-10 -mx-6 sm:-mx-8 mt-6 px-6 sm:px-8 pt-5 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          
          <button
            onClick={() => setActiveTab('submissions')}
            id="tab-personal-submissions"
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap border border-transparent focus-visible:ring-2 focus-visible:ring-indigo-300 ${
              activeTab === 'submissions'
                ? 'bg-indigo-50 text-indigo-900 border-indigo-200 shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Upload className="w-3.5 h-3.5 text-indigo-600" />
            <span>我的技能插件 ({mySubmissions.length})</span>
          </button>
          
          <button
            onClick={() => setActiveTab('demands')}
            id="tab-personal-demands"
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap border border-transparent focus-visible:ring-2 focus-visible:ring-amber-300 ${
              activeTab === 'demands'
                ? 'bg-amber-50 text-amber-900 border-amber-300 shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Coins className="w-3.5 h-3.5 text-amber-500" />
            <span>我的技能征集 ({myDemands.length})</span>
          </button>

          

          <button
            onClick={() => setActiveTab('starred')}
            id="tab-personal-starred"
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap border border-transparent focus-visible:ring-2 focus-visible:ring-amber-300 ${
              activeTab === 'starred'
                ? 'bg-amber-50 text-amber-900 border-amber-200 shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
            <span>我的收藏 ({starredSkills.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('liked')}
            id="tab-personal-liked"
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap border border-transparent focus-visible:ring-2 focus-visible:ring-rose-300 ${
              activeTab === 'liked'
                ? 'bg-rose-50 text-rose-900 border-rose-200 shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
            <span>点赞技能 ({likedSkills.length})</span>
          </button>
        </div>

        {/* Search input inside personal center */}
        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="搜索个人需求、技能或提交..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
          />
        </div>
        </div>
        </div>

      {/* TAB: MY DEMANDS */}
      {activeTab === 'demands' && (
        <div className="space-y-4">
          {filteredDemands.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 text-slate-400 space-y-3 shadow-2xs">
              <Coins className="w-12 h-12 text-amber-400 mx-auto" />
              <div className="text-base font-bold text-slate-700">暂无发布的技能征集需求</div>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                遇到业务研发痛点？立即使用您的 10,000 积分设定奖励，发起技能征集让团队专家为你量身定制！
              </p>
              <button
                onClick={onOpenCreateDemand}
                className="px-5 py-2.5 rounded-xl bg-amber-500 text-slate-950 text-xs font-black shadow-md hover:bg-amber-400 transition-all inline-flex items-center gap-1.5"
              >
                <PlusCircle className="w-4 h-4" />
                <span>立即发布首个技能征集需求</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3.5">
              {filteredDemands.map(demand => {
                const domainMeta = getExpertDomainMeta(demand.targetDomain, expertDomains);
                return (
                  <div
                    key={demand.id}
                    className="p-5 rounded-3xl bg-white border border-slate-200 shadow-2xs space-y-4 hover:border-amber-300 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${domainMeta.badgeBg} ${domainMeta.badgeText} ${domainMeta.border}`}>
                            {domainMeta.shortLabel}
                          </span>
                          <h3 
                            onClick={() => onSelectDemand(demand)}
                            className="text-base font-bold text-slate-900 hover:text-indigo-600 cursor-pointer transition-colors"
                          >
                            {demand.title}
                          </h3>
                        </div>
                        <div className="text-xs text-slate-500 line-clamp-2">
                          {demand.description}
                        </div>
                      </div>

                      {/* Status & Bounty */}
                      <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-center">
                        <div className="px-3 py-1 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 font-black text-xs flex items-center gap-1">
                          <Coins className="w-3.5 h-3.5 text-amber-700" />
                          <span>{demand.bountyPoints.toLocaleString()} 积分</span>
                        </div>

                        {(demand.status === 'open' || demand.status === 'approved') && (
                          <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            征集中
                          </span>
                        )}
                        {demand.status === 'pending' && (
                          <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            待管理员审核
                          </span>
                        )}
                        {demand.status === 'rejected' && (
                          <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5" />
                            已被驳回
                          </span>
                        )}
                        {demand.status === 'fulfilled' && (
                          <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            已完结
                          </span>
                        )}
                      </div>
                    </div>

                    {/* If rejected, show reason */}
                    {demand.status === 'rejected' && demand.rejectReason && (
                      <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
                        <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <strong>驳回理由反馈：</strong>
                          <span>{demand.rejectReason}</span>
                        </div>
                      </div>
                    )}

                    {/* Footer with Actions */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500 flex-wrap gap-2">
                      <div className="flex items-center gap-3">
                        <span>发布时间：{new Date(demand.createdAt).toLocaleDateString()}</span>
                        <span>•</span>
                        <span>有效周期：{demand.deadlineText || '永久有效'}</span>
                        <span>•</span>
                        <span className="text-indigo-600 font-bold">{demand.submissionsCount || 0} 个揭榜方案</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <PopconfirmBubble
                          title="确定撤回并删除此需求吗？"
                          description="奖励的积分将立即全额原路退回您的账户，此操作不可撤销。"
                          type="danger"
                          confirmText="确认撤销"
                          cancelText="取消"
                          placement="top-right"
                          onConfirm={() => {
                            onDeleteDemand(demand.id);
                            onToast('info', '需求已撤销', '奖励积分已退回您的账户');
                          }}
                          trigger={({ onClick }) => (
                            <button
                              onClick={onClick}
                              className="px-3 py-1.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 font-semibold flex items-center gap-1 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>撤销需求 (退积分)</span>
                            </button>
                          )}
                        />

                        <button
                          onClick={() => onSelectDemand(demand)}
                          className="px-3.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold flex items-center gap-1 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>查看详情与揭榜方案</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB: MY STARRED SKILLS */}
      {activeTab === 'starred' && (
        <div className="space-y-4">
          {filteredStarred.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 text-slate-400 space-y-3">
              <Star className="w-12 h-12 text-slate-200 mx-auto" />
              <div className="text-base font-bold text-slate-700">暂无收藏的技能</div>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                在技能集市中点击插件卡片右上角的星标 ⭐ 即可将常用技能加入个人收藏夹。
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredStarred.map(skill => (
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
      )}

      {/* TAB: MY SUBMISSIONS — 插件卡片列表（一个插件一行，点进卡片看版本记录） */}
      {activeTab === 'submissions' && (
        <div className="space-y-4">
          {pluginCards.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 text-slate-400 space-y-3">
              <Upload className="w-12 h-12 text-slate-200 mx-auto" />
              <div className="text-base font-bold text-slate-700">暂无上传记录</div>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                点击右上角的「发布新技能」按钮，将团队自研的 Claude / Cursor / MCP 技能分享到内网市场。
              </p>
              <button
                onClick={onOpenUploadModal}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold shadow-sm hover:bg-indigo-500"
              >
                立即发布首个插件
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pluginCards.map(skill => {
                const isApproved = skill.status === 'approved';
                const isPending = skill.status === 'pending';
                const isRejected = skill.status === 'rejected';
                const versionCount = versionCountOf.get(skill.id) ?? 1;
                const badge = isApproved
                  ? { text: '已上架', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
                  : isPending
                    ? { text: '审核中', cls: 'bg-amber-50 text-amber-800 border-amber-200' }
                    : isRejected
                      ? { text: '已驳回', cls: 'bg-rose-50 text-rose-700 border-rose-200' }
                      : { text: '已下架', cls: 'bg-slate-100 text-slate-700 border-slate-300' };

                return (
                  <div
                    key={skill.id}
                    className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4 hover:border-indigo-200 transition-colors flex flex-col"
                  >
                    {/* 插件身份：分类 + 状态徽章 + 名称 + 规范 slug + 版本数 */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 uppercase">
                          {skill.category}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border flex items-center gap-1 ${badge.cls}`}>
                          {isApproved && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                          {isPending && <Clock className="w-3 h-3 text-amber-600" />}
                          {isRejected && <XCircle className="w-3 h-3 text-rose-600" />}
                          {badge.text}
                        </span>
                      </div>
                      <h3
                        onClick={() => setManagePlugin(skill)}
                        className="text-base font-bold text-slate-900 hover:text-indigo-600 cursor-pointer transition-colors"
                        title="点击查看该插件的全部版本记录"
                      >
                        {skill.name}
                      </h3>
                      <div className="font-mono text-xs text-indigo-600 flex items-center gap-2 flex-wrap">
                        <span>{skill.slug}</span>
                        <span className="text-slate-400">·</span>
                        <span>v{skill.version}</span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 text-[10px]">
                          {versionCount} 个版本
                        </span>
                      </div>
                    </div>

                    {/* 驳回意见：管理员驳回时必须填写理由，展示给作者整改 */}
                    {isRejected && skill.auditResults?.adminFeedback && (
                      <div className="p-2.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
                        <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <strong>管理员驳回意见：</strong>
                          <span>{skill.auditResults.adminFeedback}</span>
                        </div>
                      </div>
                    )}

                    {/* 摘要：双引擎得分 + 提交时间 */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span className="flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
                        双引擎得分：
                        <b className="text-slate-900">
                          {skill.auditResults?.score != null ? `${skill.auditResults.score} 分` : '未体检'}
                        </b>
                      </span>
                      <span className="font-mono">
                        提交于 {new Date(skill.createdAt).toLocaleDateString('zh-CN')}
                      </span>
                    </div>

                    {/* 操作栏 */}
                    <div className="flex flex-wrap items-center gap-2 pt-1 text-xs mt-auto">
                      <button
                        onClick={() => setManagePlugin(skill)}
                        className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-1.5 transition-colors"
                      >
                        <GitBranch className="w-3.5 h-3.5" />
                        <span>查看版本记录</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleViewDetail(skill)}
                        className="px-3.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold flex items-center gap-1.5 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>查看详情预览</span>
                      </button>
                      <button
                        onClick={() => onDownloadZip(skill)}
                        className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold flex items-center gap-1.5 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>下载 ZIP</span>
                      </button>
                      {onPublishNewVersion && skill.status !== 'archived' && (
                        <button
                          onClick={() => onPublishNewVersion(skill)}
                          disabled={isPending}
                          className="px-3.5 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50/60 hover:bg-indigo-50 text-indigo-700 font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          title={isPending ? '已有待审核的新版本，请等待审核' : '上传新版本 ZIP，进入审核队列'}
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>发布新版本</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB: MY LIKED SKILLS */}
      {activeTab === 'liked' && (
        <div className="space-y-4">
          {filteredLiked.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 text-slate-400 space-y-3">
              <Heart className="w-12 h-12 text-slate-200 mx-auto" />
              <div className="text-base font-bold text-slate-700">暂无点赞的技能</div>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                遇到优质实用的内网 AI 插件，可以在集市或详情页中点击点赞 ❤️。
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredLiked.map(skill => (
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
      )}

      {/* 未发布技能预览弹窗 */}
      {previewSkill && (
        <SkillPreviewModal
          skill={previewSkill}
          onClose={() => setPreviewSkill(null)}
          onOpenDetail={() => {
            const s = previewSkill;
            setPreviewSkill(null);
            onSelectSkill(s);
          }}
        />
      )}

      {/* 插件版本记录弹窗：个人中心「我的技能插件」的二层入口 */}
      {managePlugin && (
        <SkillVersionManagerModal
          plugin={managePlugin}
          onClose={() => setManagePlugin(null)}
          onPreview={(v) => setPreviewSkill(v)}
          onDownloadZip={onDownloadZip}
          onEditMeta={onEditSkillMeta}
          onPublishNewVersion={onPublishNewVersion}
          onDeleteVersion={onDeleteVersion}
          onToast={onToast}
        />
      )}
    </div>
  );
};
