import React, { useState } from 'react';
import { 
  X, 
  LogIn, 
  ShieldCheck, 
  Code2, 
  Database, 
  UserCheck, 
  Sparkles, 
  ArrowRight,
  Info,
  Check
} from 'lucide-react';
import { UserAccount, UserRole } from '../types';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  allUsers: UserAccount[];
  onLogin?: (user: UserAccount) => void;
  onSelectUser?: (user: UserAccount) => void;
  onCustomLogin?: (user: UserAccount) => void;
  actionHint?: string;
  pendingActionTitle?: string;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  allUsers,
  onLogin,
  onSelectUser,
  onCustomLogin,
  actionHint,
  pendingActionTitle
}) => {
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customEmail, setCustomEmail] = useState('');
  const [customDept, setCustomDept] = useState('企业应用研发部');
  const [customRole, setCustomRole] = useState<UserRole>('developer');

  const handleSelect = (user: UserAccount) => {
    if (onLogin) onLogin(user);
    else if (onSelectUser) onSelectUser(user);
  };

  const displayActionTitle = actionHint || pendingActionTitle;

  if (!isOpen) return null;

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;

    const newUser: UserAccount = {
      id: `custom-user-${Date.now()}`,
      name: customName.trim(),
      email: customEmail.trim() || `${customName.trim().toLowerCase()}@intranet.corp`,
      role: customRole,
      avatar: customRole === 'admin' 
        ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
        : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      department: customDept.trim() || '技术研发中心',
      joinedAt: new Date().toISOString().split('T')[0]
    };

    if (onCustomLogin) {
      onCustomLogin(newUser);
    } else {
      handleSelect(newUser);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        id="login-auth-modal"
        className="relative w-full max-w-lg bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
              <LogIn className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {displayActionTitle ? `请先登录以${displayActionTitle}` : '登录 SkillHub 企业账号'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                企业内网统一身份认证与权限协同平台
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors"
            title="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Informational Policy Notice */}
        <div className="px-6 pt-5">
          <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200/80 text-xs text-amber-900 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-bold">访客权限说明：</span>
              未登录状态下允许<strong className="text-indigo-800">自由打包下载源码 ZIP</strong> 与 <strong className="text-indigo-800">复制多端安装指令</strong>；
              <strong className="text-amber-900 font-semibold">收藏、点赞、全站反馈、发布新技能及重新体检</strong>均需要登录企业账号。
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          {!isCustomMode ? (
            <div className="space-y-3">
              <div className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center justify-between">
                <span>快速一键登录企业身份</span>
                <span className="text-[11px] font-normal text-slate-400">点击即刻登录</span>
              </div>

              <div className="space-y-2.5">
                {allUsers.map((user) => {
                  const isAdmin = user.role === 'admin';
                  return (
                    <button
                      key={user.id}
                      onClick={() => {
                        handleSelect(user);
                        onClose();
                      }}
                      className="w-full p-3.5 rounded-2xl border border-slate-200 hover:border-indigo-500 bg-white hover:bg-indigo-50/30 transition-all text-left flex items-center justify-between group shadow-2xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={user.avatar}
                          alt={user.name}
                          className="w-11 h-11 rounded-xl object-cover border border-slate-200 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                              {user.name}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              isAdmin 
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}>
                              {isAdmin ? '超级管理员' : '研发工程师'}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 truncate mt-0.5">
                            {user.department} · <span className="font-mono text-[11px]">{user.email}</span>
                          </div>
                        </div>
                      </div>

                      <div className="w-8 h-8 rounded-xl bg-slate-100 group-hover:bg-indigo-600 group-hover:text-white text-slate-400 flex items-center justify-center shrink-0 transition-colors">
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 text-center">
                <button
                  onClick={() => setIsCustomMode(true)}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:underline"
                >
                  自定义企业身份登录 &gt;
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleCustomSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">姓名 / 员工昵称</label>
                <input
                  type="text"
                  required
                  placeholder="例如：王浩 (架构组)"
                  value={customName}
                  onChange={e => setCustomName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">企业工作邮箱</label>
                <input
                  type="email"
                  placeholder="wanghao@intranet.corp"
                  value={customEmail}
                  onChange={e => setCustomEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">所属研发部门</label>
                  <input
                    type="text"
                    placeholder="业务架构平台"
                    value={customDept}
                    onChange={e => setCustomDept(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">系统操作角色</label>
                  <select
                    value={customRole}
                    onChange={e => setCustomRole(e.target.value as UserRole)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
                  >
                    <option value="developer">普通开发者 (developer)</option>
                    <option value="admin">超级管理员 (admin)</option>
                    <option value="security_officer">安全审计官 (security)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCustomMode(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  返回预设身份
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-md shadow-indigo-500/20"
                >
                  确认登录
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
