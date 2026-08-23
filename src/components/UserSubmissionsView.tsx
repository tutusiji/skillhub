import React, { useState } from 'react';
import { 
  FolderPlus, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Eye, 
  RotateCcw, 
  Star, 
  Heart, 
  Download, 
  ShieldCheck, 
  Terminal,
  Layers,
  ArrowRight
} from 'lucide-react';
import { SkillItem, UserAccount } from '../types';
import { SkillCard } from './SkillCard';

interface UserSubmissionsViewProps {
  currentUser: UserAccount;
  skills: SkillItem[];
  onOpenDetail: (skill: SkillItem) => void;
  onOpenUpload: () => void;
  onToggleStar: (id: string) => void;
  onToggleLike: (id: string) => void;
  onDownloadZip: (skill: SkillItem) => void;
  onCopyCommand: (cmd: string, clientName: string) => void;
}

export const UserSubmissionsView: React.FC<UserSubmissionsViewProps> = ({
  currentUser,
  skills,
  onOpenDetail,
  onOpenUpload,
  onToggleStar,
  onToggleLike,
  onDownloadZip,
  onCopyCommand
}) => {
  const [subTab, setSubTab] = useState<'my-uploads' | 'my-starred' | 'my-likes'>('my-uploads');

  // Filter skills by author name matching current user
  const myUploads = skills.filter(s => s.author.name.includes(currentUser.name.split(' ')[0]) || s.author.name.includes('陈思宇') || s.author.name.includes('黄雅婷'));
  const myStarred = skills.filter(s => s.isStarred);
  const myLikes = skills.filter(s => s.isLiked);

  return (
    <div className="space-y-6">
      {/* Header Profile Card */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white border border-slate-800 shadow-md">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className="w-16 h-16 rounded-2xl object-cover border-2 border-indigo-400/50 shadow-inner"
            />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold">{currentUser.name}</h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 uppercase font-mono">
                  {currentUser.role}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                {currentUser.department} · {currentUser.email}
              </p>
            </div>
          </div>

          <button
            onClick={onOpenUpload}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-lg active:scale-95"
          >
            <FolderPlus className="w-4 h-4" />
            <span>发布新插件</span>
          </button>
        </div>

        {/* Tab switchers */}
        <div className="flex items-center gap-2 mt-6 pt-4 border-t border-slate-800 text-xs">
          <button
            onClick={() => setSubTab('my-uploads')}
            className={`px-3.5 py-1.5 rounded-xl font-semibold transition-colors ${
              subTab === 'my-uploads'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            我发布的插件与审核进度 ({myUploads.length})
          </button>
          <button
            onClick={() => setSubTab('my-starred')}
            className={`px-3.5 py-1.5 rounded-xl font-semibold transition-colors ${
              subTab === 'my-starred'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            我的收藏 ({myStarred.length})
          </button>
          <button
            onClick={() => setSubTab('my-likes')}
            className={`px-3.5 py-1.5 rounded-xl font-semibold transition-colors ${
              subTab === 'my-likes'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            点赞记录 ({myLikes.length})
          </button>
        </div>
      </div>

      {/* SUB TAB 1: My Uploads with Progress Tracking */}
      {subTab === 'my-uploads' && (
        <div className="space-y-4">
          <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
            <span>我的提交清单与全流程审批进度追踪：</span>
            <span className="text-slate-400">双引擎合规扫描与终审状态实时同步</span>
          </div>

          {myUploads.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
              您尚未提交过任何技能或插件。点击右上角“发布新插件”开始构建！
            </div>
          ) : (
            myUploads.map(skill => {
              const isApproved = skill.status === 'approved';
              const isPending = skill.status === 'pending';
              const isRejected = skill.status === 'rejected';

              return (
                <div
                  key={skill.id}
                  id={`my-upload-card-${skill.id}`}
                  className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4"
                >
                  {/* Top info */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                          {skill.category.toUpperCase()}
                        </span>
                        <span className="text-xs font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                          {skill.version}
                        </span>
                        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                          {skill.name}
                        </h3>
                      </div>
                      <div className="text-xs font-mono text-indigo-600 dark:text-indigo-400 mt-0.5">
                        {skill.slug}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onOpenDetail(skill)}
                        className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>查看详情与文件树</span>
                      </button>
                    </div>
                  </div>

                  {/* Visual Progress Steps Bar */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-3">
                      审核进度流程：
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                      {/* Step 1 */}
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <div>
                          <div className="font-bold">1. 提交完成</div>
                          <div className="text-[10px] opacity-80">{new Date(skill.createdAt).toLocaleDateString('zh-CN')}</div>
                        </div>
                      </div>

                      {/* Step 2 */}
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <div>
                          <div className="font-bold">2. 正则特征初筛</div>
                          <div className="text-[10px] opacity-80">通过 {skill.auditResults.regexResults?.filter(r=>r.status==='pass').length || 4} 项规则</div>
                        </div>
                      </div>

                      {/* Step 3 */}
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <div>
                          <div className="font-bold">3. LLM 语义安全评估</div>
                          <div className="text-[10px] opacity-80">模型评语完成 ({skill.auditResults.score}分)</div>
                        </div>
                      </div>

                      {/* Step 4: Final Admin Decision */}
                      {isApproved && (
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <div>
                            <div className="font-bold">4. 终审已上线</div>
                            <div className="text-[10px] opacity-80">已在内网集市公开</div>
                          </div>
                        </div>
                      )}

                      {isPending && (
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800 animate-pulse">
                          <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                          <div>
                            <div className="font-bold">4. 管理员终审中</div>
                            <div className="text-[10px] opacity-80">排队处理中</div>
                          </div>
                        </div>
                      )}

                      {isRejected && (
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-rose-50 text-rose-900 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                          <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                          <div>
                            <div className="font-bold">4. 审核未通过</div>
                            <div className="text-[10px] opacity-80">需整改后重提</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Feedback Banner if Rejected */}
                  {skill.auditResults.adminFeedback && (
                    <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold">审核员反馈整改意见：</div>
                        <div className="mt-0.5 leading-relaxed">{skill.auditResults.adminFeedback}</div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* SUB TAB 2: Starred Skills */}
      {subTab === 'my-starred' && (
        <div>
          {myStarred.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
              暂无收藏的技能，在市场中点击卡片上的星星即可收藏
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {myStarred.map(skill => (
                <SkillCard
                  key={skill.id}
                  skill={skill}
                  onSelectSkill={onOpenDetail}
                  onToggleStar={onToggleStar}
                  onToggleLike={onToggleLike}
                  onDownloadZip={onDownloadZip}
                  onCopyInstallCmd={onCopyCommand}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB TAB 3: Liked Skills */}
      {subTab === 'my-likes' && (
        <div>
          {myLikes.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
              暂无点赞的技能
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {myLikes.map(skill => (
                <SkillCard
                  key={skill.id}
                  skill={skill}
                  onSelectSkill={onOpenDetail}
                  onToggleStar={onToggleStar}
                  onToggleLike={onToggleLike}
                  onDownloadZip={onDownloadZip}
                  onCopyInstallCmd={onCopyCommand}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
