import React from 'react';
import {
  MessageSquarePlus,
  Trash2,
  Inbox,
  Star,
  Building,
  IdCard,
  Tag,
} from 'lucide-react';
import { FeedbackItem, UserAccount } from '../types';

interface FeedbackAdminViewProps {
  currentUser: UserAccount;
  feedbackList: FeedbackItem[];
  onDeleteFeedback: (id: string) => void;
  onOpenCreateFeedback: () => void;
  onToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, message: string) => void;
}

/** 建议分类徽章文案与配色 */
const CATEGORY_META: Record<string, { label: string; cls: string }> = {
  feature: { label: '功能需求', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  bug: { label: '缺陷报告', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  security: { label: '安全规则', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  experience: { label: '交互体验', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  other: { label: '其他建议', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
};

/**
 * 建议管理页面
 * 管理员：查看全部建议并可删除（无回复流转）；普通用户：查看自己的建议并提交新建议
 */
export const FeedbackAdminView: React.FC<FeedbackAdminViewProps> = ({
  currentUser,
  feedbackList,
  onDeleteFeedback,
  onOpenCreateFeedback,
  onToast,
}) => {
  const isPrivileged = currentUser.role === 'admin' || currentUser.role === 'super_admin';

  const handleDelete = (item: FeedbackItem) => {
    if (window.confirm(`确定删除建议「${item.title}」吗？删除后不可恢复。`)) {
      onDeleteFeedback(item.id);
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200 text-left">
      {/* Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white shadow-xl border border-indigo-900/40 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-bold shadow-2xs">
              <MessageSquarePlus className="w-3.5 h-3.5" />
              <span>全站建议中心</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              {isPrivileged ? '建议管理' : '我的建议'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-2xl">
              {isPrivileged
                ? '查看全体员工提交的功能与体验建议，可直接删除已处理或无效建议。'
                : '查看您提交过的建议，或提交新的功能与体验建议。'}
            </p>
          </div>

          <button
            onClick={onOpenCreateFeedback}
            className="px-5 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold flex items-center gap-1.5 shadow-md active:scale-95 transition-all self-start md:self-auto shrink-0"
          >
            <MessageSquarePlus className="w-4 h-4" />
            <span>提交新建议</span>
          </button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <div className="text-[11px] text-slate-500 font-semibold">全部建议</div>
          <div className="text-xl font-black text-slate-900 mt-0.5">{feedbackList.length}</div>
        </div>
        <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <div className="text-[11px] text-slate-500 font-semibold">功能需求</div>
          <div className="text-xl font-black text-indigo-700 mt-0.5">
            {feedbackList.filter(f => f.category === 'feature').length}
          </div>
        </div>
        <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <div className="text-[11px] text-slate-500 font-semibold">缺陷与安全问题</div>
          <div className="text-xl font-black text-rose-700 mt-0.5">
            {feedbackList.filter(f => f.category === 'bug' || f.category === 'security').length}
          </div>
        </div>
      </div>

      {/* 建议列表 */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Inbox className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900">
              {isPrivileged ? '全部员工建议' : '我提交的建议'}
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-bold">
              {feedbackList.length} 条
            </span>
          </div>
          <span className="text-xs text-slate-400">
            {isPrivileged ? '可删除，无需回复' : '提交人可见'}
          </span>
        </div>

        {feedbackList.length === 0 ? (
          <div className="p-16 text-center text-xs text-slate-400 space-y-2">
            <Inbox className="w-10 h-10 text-slate-300 mx-auto" />
            <div>{isPrivileged ? '暂无员工提交建议' : '您还没有提交过建议'}</div>
            <button
              onClick={onOpenCreateFeedback}
              className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold"
            >
              <MessageSquarePlus className="w-3.5 h-3.5" />
              提交第一条建议
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {feedbackList.map(item => {
              const meta = CATEGORY_META[item.category] || CATEGORY_META.other;
              return (
                <div key={item.id} className="p-4 sm:p-5 hover:bg-slate-50/80 transition-colors">
                  <div className="flex items-start gap-3.5">
                    <img
                      src={item.submitterAvatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80'}
                      alt={item.userName}
                      className="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-900">{item.title}</span>
                        <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${meta.cls}`}>
                          <Tag className="w-2.5 h-2.5 inline-block mr-0.5 -mt-0.5" />
                          {meta.label}
                        </span>
                        <span className="flex items-center gap-0.5 text-amber-500">
                          {Array.from({ length: item.rating }).map((_, i) => (
                            <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
                          ))}
                        </span>
                      </div>

                      {/* 提交者信息 */}
                      <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1 flex-wrap">
                        <span className="font-semibold text-slate-700">{item.userName}</span>
                        {item.submitterEmployeeId && (
                          <span className="flex items-center gap-1">
                            <IdCard className="w-3 h-3 text-slate-400" />
                            工号 {item.submitterEmployeeId}
                          </span>
                        )}
                        {item.submitterDepartment && (
                          <span className="flex items-center gap-1">
                            <Building className="w-3 h-3 text-slate-400" />
                            {item.submitterDepartment}
                          </span>
                        )}
                        <span className="text-slate-400">
                          {new Date(item.createdAt).toLocaleString('zh-CN')}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 leading-relaxed mt-2 whitespace-pre-wrap">
                        {item.content}
                      </p>
                    </div>

                    <button
                      onClick={() => handleDelete(item)}
                      className="shrink-0 p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="删除建议"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
