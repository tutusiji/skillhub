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
  ShieldAlert
} from 'lucide-react';
import { SkillItem, UserAccount } from '../types';
import { SkillCard } from './SkillCard';

interface PersonalCenterViewProps {
  currentUser: UserAccount;
  allSkills: SkillItem[];
  onSelectSkill: (skill: SkillItem) => void;
  onToggleStar: (id: string) => void;
  onToggleLike: (id: string) => void;
  onDownloadZip: (skill: SkillItem) => void;
  onOpenUploadModal: () => void;
  onCopyInstallCmd: (cmd: string) => void;
  onToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, message: string) => void;
}

type PersonalTab = 'starred' | 'submissions' | 'liked';

export const PersonalCenterView: React.FC<PersonalCenterViewProps> = ({
  currentUser,
  allSkills,
  onSelectSkill,
  onToggleStar,
  onToggleLike,
  onDownloadZip,
  onOpenUploadModal,
  onCopyInstallCmd,
  onToast
}) => {
  const [activeTab, setActiveTab] = useState<PersonalTab>('starred');
  const [searchQuery, setSearchQuery] = useState('');

  // Derived data
  const starredSkills = allSkills.filter(s => s.isStarred);
  const likedSkills = allSkills.filter(s => s.isLiked);
  // Match submissions by author name or email or current user id
  const mySubmissions = allSkills.filter(s => 
    s.author.name === currentUser.name || s.author.name === 'Alex Chen' || s.author.name === '林晨 (开发架构组)'
  );

  const filteredStarred = starredSkills.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredLiked = likedSkills.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredSubmissions = mySubmissions.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const approvedCount = mySubmissions.filter(s => s.status === 'approved').length;
  const pendingCount = mySubmissions.filter(s => s.status === 'pending').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-200 pb-12">
      {/* Profile Overview Card */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200/90 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-indigo-50/70 via-sky-50/40 to-transparent rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-indigo-100 shadow-md"
              />
              <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 border-2 border-white rounded-full flex items-center justify-center" title="在线">
                <span className="w-1.5 h-1.5 bg-white rounded-full" />
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                  {currentUser.name}
                </h1>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${
                  currentUser.role === 'admin'
                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                    : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                }`}>
                  {currentUser.role === 'admin' ? '🛡️ 超级管理员 / 安全总监' : '💻 研发工程师 / 技能创作者'}
                </span>
              </div>

              <div className="text-xs text-slate-500 font-medium flex items-center gap-3 flex-wrap">
                <span>{currentUser.department}</span>
                <span>•</span>
                <span className="font-mono">{currentUser.email}</span>
                <span>•</span>
                <span>内网工号 #{currentUser.id.replace('user-', '')}</span>
              </div>
            </div>
          </div>

          {/* Quick Upload CTA */}
          <div className="flex items-center gap-3">
            <button
              onClick={onOpenUploadModal}
              id="btn-personal-upload-skill"
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-indigo-500/20 active:scale-95 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>发布新技能 / 插件</span>
            </button>
          </div>
        </div>

        {/* Counters Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-100">
          <div 
            onClick={() => setActiveTab('starred')}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
              activeTab === 'starred' ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-400/20' : 'bg-slate-50/70 border-slate-200/80 hover:bg-slate-100/60'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold">我的收藏</span>
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
            </div>
            <div className="text-2xl font-black text-slate-900 mt-1">
              {starredSkills.length}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">常用技能快捷调用</div>
          </div>

          <div 
            onClick={() => setActiveTab('submissions')}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
              activeTab === 'submissions' ? 'bg-indigo-50/70 border-indigo-300 ring-2 ring-indigo-400/20' : 'bg-slate-50/70 border-slate-200/80 hover:bg-slate-100/60'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold">我的提交 & 进度</span>
              <Upload className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-2xl font-black text-slate-900 mt-1">
              {mySubmissions.length}
            </div>
            <div className="text-[11px] text-indigo-600 font-semibold mt-0.5">
              {approvedCount} 已上线 · {pendingCount} 审核中
            </div>
          </div>

          <div 
            onClick={() => setActiveTab('liked')}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
              activeTab === 'liked' ? 'bg-rose-50/70 border-rose-300 ring-2 ring-rose-400/20' : 'bg-slate-50/70 border-slate-200/80 hover:bg-slate-100/60'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold">我点赞的技能</span>
              <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
            </div>
            <div className="text-2xl font-black text-slate-900 mt-1">
              {likedSkills.length}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">全站高赞优秀实践</div>
          </div>

          <div className="p-3.5 rounded-2xl border border-slate-200/80 bg-slate-50/70">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold">双引擎初筛通过率</span>
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-emerald-600 mt-1">
              100%
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">企业代码规范与安全</div>
          </div>
        </div>
      </div>

      {/* Tabs Menu & Search Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            onClick={() => setActiveTab('starred')}
            id="tab-personal-starred"
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'starred'
                ? 'bg-amber-50 text-amber-900 border border-amber-200 shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
            <span>我的收藏 ({starredSkills.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('submissions')}
            id="tab-personal-submissions"
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'submissions'
                ? 'bg-indigo-50 text-indigo-900 border border-indigo-200 shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Upload className="w-3.5 h-3.5 text-indigo-600" />
            <span>我上传提交的插件 & 进度 ({mySubmissions.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('liked')}
            id="tab-personal-liked"
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'liked'
                ? 'bg-rose-50 text-rose-900 border border-rose-200 shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
            <span>我点赞的技能 ({likedSkills.length})</span>
          </button>
        </div>

        {/* Search input inside personal center */}
        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="搜索个人技能或提交记录..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
          />
        </div>
      </div>

      {/* TAB 1: MY STARRED SKILLS */}
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

      {/* TAB 2: MY SUBMISSIONS & AUDIT PROGRESS TRACKER */}
      {activeTab === 'submissions' && (
        <div className="space-y-4">
          {filteredSubmissions.length === 0 ? (
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
            <div className="space-y-4">
              {filteredSubmissions.map(skill => {
                const isApproved = skill.status === 'approved';
                const isPending = skill.status === 'pending';
                const isRejected = skill.status === 'rejected';

                return (
                  <div
                    key={skill.id}
                    className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-5 hover:border-indigo-200 transition-colors"
                  >
                    {/* Header Info */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="text-xs font-bold px-2.5 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 uppercase">
                            {skill.category}
                          </span>
                          <h3 
                            onClick={() => onSelectSkill(skill)}
                            className="text-base font-bold text-slate-900 hover:text-indigo-600 cursor-pointer transition-colors"
                          >
                            {skill.name}
                          </h3>
                          <span className="font-mono text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                            {skill.version}
                          </span>
                        </div>
                        <div className="font-mono text-xs text-indigo-600">
                          {skill.slug}
                        </div>
                      </div>

                      {/* Status Tag */}
                      <div className="flex items-center gap-2">
                        {isApproved && (
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span>已通过终审并上线</span>
                          </span>
                        )}
                        {isPending && (
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1.5">
                            <Clock className="w-4 h-4 text-amber-600 animate-spin" />
                            <span>管理员审核中 (排队中)</span>
                          </span>
                        )}
                        {isRejected && (
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1.5">
                            <XCircle className="w-4 h-4 text-rose-600" />
                            <span>已驳回 (需整改)</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Progress Pipeline Tracker */}
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                      <div className="text-xs font-bold text-slate-700 flex items-center justify-between">
                        <span>审核流转进度跟踪 (Audit Lifecycle Tracker)</span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          双引擎安全得分: <b className="text-slate-900">{skill.auditResults.score} 分</b>
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-2">
                        {/* Step 1: 提交完成 */}
                        <div className="p-2.5 rounded-xl bg-white border border-emerald-200 flex items-center gap-2 text-xs">
                          <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-[10px]">
                            ✓
                          </div>
                          <div>
                            <div className="font-bold text-slate-800">1. 代码包已提交</div>
                            <div className="text-[10px] text-slate-400">打包树完成校验</div>
                          </div>
                        </div>

                        {/* Step 2: 正则引擎 */}
                        <div className="p-2.5 rounded-xl bg-white border border-emerald-200 flex items-center gap-2 text-xs">
                          <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-[10px]">
                            ✓
                          </div>
                          <div>
                            <div className="font-bold text-slate-800">2. 正则规则筛查</div>
                            <div className="text-[10px] text-slate-400">
                              {skill.auditResults.regexResults.filter(r => r.status === 'fail').length === 0 ? '0 违规项' : '有告警'}
                            </div>
                          </div>
                        </div>

                        {/* Step 3: LLM 语义 */}
                        <div className="p-2.5 rounded-xl bg-white border border-emerald-200 flex items-center gap-2 text-xs">
                          <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-[10px]">
                            ✓
                          </div>
                          <div>
                            <div className="font-bold text-slate-800">3. LLM 深度审计</div>
                            <div className="text-[10px] text-slate-400">大模型语义完成判定</div>
                          </div>
                        </div>

                        {/* Step 4: 超级管理员终审 */}
                        <div className={`p-2.5 rounded-xl border flex items-center gap-2 text-xs ${
                          isApproved 
                            ? 'bg-white border-emerald-200' 
                            : isRejected 
                            ? 'bg-rose-50 border-rose-300' 
                            : 'bg-amber-50/70 border-amber-200'
                        }`}>
                          <div className={`w-5 h-5 rounded-full font-bold flex items-center justify-center text-[10px] ${
                            isApproved ? 'bg-emerald-100 text-emerald-700' : isRejected ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {isApproved ? '✓' : isRejected ? '✕' : '4'}
                          </div>
                          <div>
                            <div className="font-bold text-slate-800">4. 超级管理员终审</div>
                            <div className="text-[10px] text-slate-500">
                              {isApproved ? '已审批上线' : isRejected ? '审核驳回' : '等待人工确认'}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs">
                      <div className="text-slate-500 font-medium">
                        提交时间：{new Date(skill.createdAt).toLocaleString('zh-CN')}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onSelectSkill(skill)}
                          className="px-3.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold flex items-center gap-1.5 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>查看技能详情与文件树</span>
                        </button>

                        <button
                          onClick={() => onDownloadZip(skill)}
                          className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold flex items-center gap-1.5 transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>下载源码 ZIP</span>
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

      {/* TAB 3: MY LIKED SKILLS */}
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
    </div>
  );
};
