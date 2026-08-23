import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, 
  Search, 
  Upload, 
  ShieldCheck, 
  Sliders, 
  User, 
  ChevronDown, 
  Check, 
  LogOut, 
  LogIn,
  MessageSquare,
  Star,
  Clock,
  Shield,
  Layers,
  ArrowRight
} from 'lucide-react';
import { UserAccount } from '../types';

interface HeaderProps {
  currentTab: 'market' | 'personal' | 'audit' | 'rules' | 'detail';
  onSelectTab: (tab: 'market' | 'personal' | 'audit' | 'rules') => void;
  onOpenUpload: () => void;
  onOpenCommandPalette: () => void;
  onOpenFeedback: () => void;
  onOpenLogin: () => void;
  currentUser: UserAccount | null;
  allUsers: UserAccount[];
  onSwitchUser: (user: UserAccount) => void;
  onLogout: () => void;
  pendingReviewsCount: number;
  starredCount?: number;
  mySubmissionsCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  onOpenUpload,
  onOpenCommandPalette,
  onOpenFeedback,
  onOpenLogin,
  currentUser,
  allUsers,
  onSwitchUser,
  onLogout,
  pendingReviewsCount,
  starredCount = 0,
  mySubmissionsCount = 0
}) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isAdmin = currentUser?.role === 'admin';

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-30 w-full border-b border-slate-200/90 bg-white/95 backdrop-blur-md shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Left: Brand Logo & Role-based Navigation */}
        <div className="flex items-center gap-8">
          <div 
            onClick={() => onSelectTab('market')}
            className="flex items-center gap-2.5 cursor-pointer select-none group"
            id="brand-logo"
          >
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-sky-400 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-black tracking-tight bg-gradient-to-r from-slate-900 via-indigo-950 to-indigo-700 bg-clip-text text-transparent">
                  SkillHub
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                  企业内网
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono hidden sm:block">
                AI 技能与 MCP 插件市场
              </div>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="hidden md:flex items-center gap-1 text-xs font-semibold">
            {/* Marketplace is visible to EVERYONE */}
            <button
              onClick={() => onSelectTab('market')}
              id="nav-market"
              className={`px-3.5 py-2 rounded-xl transition-all ${
                currentTab === 'market'
                  ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200/70 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              技能集市
            </button>

            {/* Admin ONLY Tabs */}
            {isAdmin && (
              <>
                <button
                  onClick={() => onSelectTab('audit')}
                  id="nav-audit"
                  className={`relative px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
                    currentTab === 'audit'
                      ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200/70 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  <span>审核管理中心</span>
                  {pendingReviewsCount > 0 && (
                    <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                      {pendingReviewsCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => onSelectTab('rules')}
                  id="nav-rules"
                  className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
                    currentTab === 'rules'
                      ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200/70 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Sliders className="w-4 h-4 text-indigo-600" />
                  <span>风控中心</span>
                </button>
              </>
            )}
          </nav>
        </div>

        {/* Right: Search, Publish & User Profile Dropdown / Login */}
        <div className="flex items-center gap-3">
          {/* Quick Search trigger */}
          <button
            onClick={onOpenCommandPalette}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100/80 hover:bg-slate-100 text-slate-500 hover:text-slate-800 text-xs transition-colors border border-slate-200"
            title="快捷搜索 (⌘K)"
            id="btn-nav-search"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">搜索技能或 CLI...</span>
            <kbd className="hidden sm:inline-block font-mono text-[10px] bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-500">
              ⌘K
            </kbd>
          </button>

          {/* Upload Button */}
          <button
            onClick={onOpenUpload}
            id="btn-nav-upload"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-bold transition-all shadow-md shadow-indigo-500/20"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">发布技能</span>
          </button>

          {/* Personal Center Quick Tab Button */}
          <button
            onClick={() => onSelectTab('personal')}
            id="nav-personal-btn"
            className={`hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
              currentTab === 'personal'
                ? 'bg-amber-50 text-amber-900 border-amber-300 shadow-2xs'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
            title="个人中心 (收藏 & 上传进度)"
          >
            <User className="w-3.5 h-3.5 text-indigo-600" />
            <span>个人中心</span>
            {currentUser && (starredCount > 0 || mySubmissionsCount > 0) && (
              <span className="px-1.5 py-0.2 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-mono">
                {starredCount + mySubmissionsCount}
              </span>
            )}
          </button>

          {/* User Profile Dropdown OR Login Button */}
          {currentUser ? (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                id="btn-user-profile-menu"
                className="flex items-center gap-2 p-1.5 rounded-2xl hover:bg-slate-100 transition-colors border border-transparent hover:border-slate-200"
              >
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  className="w-8 h-8 rounded-xl object-cover border border-slate-200 shadow-2xs"
                />
                <div className="hidden lg:block text-left">
                  <div className="text-xs font-bold text-slate-900 truncate max-w-[110px]">
                    {currentUser.name}
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium">
                    {currentUser.role === 'admin' ? '🛡️ 超级管理员' : '💻 开发者'}
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {/* Dropdown Popover */}
              {showUserMenu && (
                <div 
                  className="absolute right-0 mt-2 w-72 p-2 bg-white rounded-3xl shadow-xl border border-slate-200 z-50 text-xs animate-in fade-in zoom-in-95 duration-100 space-y-1.5"
                >
                  {/* User Card Header */}
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-3">
                      <img
                        src={currentUser.avatar}
                        alt={currentUser.name}
                        className="w-10 h-10 rounded-xl object-cover border border-slate-200"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-slate-900 truncate">{currentUser.name}</div>
                        <div className="text-[11px] text-slate-500 truncate font-mono">{currentUser.email}</div>
                        <div className="mt-1">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                            currentUser.role === 'admin' 
                              ? 'bg-purple-50 text-purple-700 border-purple-200' 
                              : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                          }`}>
                            {currentUser.role === 'admin' ? '超级管理员 (安全架构)' : '普通开发者 (研发部)'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Personal Center Link */}
                  <button
                    onClick={() => {
                      onSelectTab('personal');
                      setShowUserMenu(false);
                    }}
                    id="menu-item-personal-center"
                    className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 font-semibold transition-colors text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <User className="w-4 h-4 text-indigo-600" />
                      <span>个人中心 (收藏 & 上传进度)</span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                  </button>

                  {/* Feedback Link */}
                  <button
                    onClick={() => {
                      onOpenFeedback();
                      setShowUserMenu(false);
                    }}
                    id="menu-item-feedback"
                    className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 text-slate-700 font-semibold transition-colors text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <MessageSquare className="w-4 h-4 text-indigo-600" />
                      <span>全站建议与体验反馈</span>
                    </div>
                    <span className="text-[10px] text-slate-400">意见箱</span>
                  </button>

                  {/* Role Switcher Section */}
                  <div className="pt-2 border-t border-slate-100">
                    <div className="px-2 pb-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      切换登录身份模拟体验
                    </div>

                    <div className="space-y-1">
                      {allUsers.map(user => {
                        const isSelected = user.id === currentUser.id;
                        return (
                          <div
                            key={user.id}
                            onClick={() => {
                              onSwitchUser(user);
                              setShowUserMenu(false);
                            }}
                            className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-indigo-50 text-indigo-900 font-bold border border-indigo-200/80'
                                : 'hover:bg-slate-100 text-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <img
                                src={user.avatar}
                                alt={user.name}
                                className="w-6 h-6 rounded-lg object-cover"
                              />
                              <div className="min-w-0">
                                <div className="truncate text-xs font-semibold">{user.name}</div>
                                <div className="text-[10px] text-slate-400 truncate">
                                  {user.role === 'admin' ? '超级管理员' : '普通用户'} · {user.department}
                                </div>
                              </div>
                            </div>
                            {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Logout Button */}
                  <div className="pt-2 border-t border-slate-100">
                    <button
                      onClick={() => {
                        onLogout();
                        setShowUserMenu(false);
                      }}
                      id="menu-item-logout"
                      className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-rose-50 text-rose-600 font-semibold transition-colors text-left"
                    >
                      <div className="flex items-center gap-2.5">
                        <LogOut className="w-4 h-4 text-rose-500" />
                        <span>退出当前登录</span>
                      </div>
                      <span className="text-[10px] text-rose-400">切换至访客</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={onOpenLogin}
              id="btn-nav-login"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-95 text-white text-xs font-bold transition-all shadow-sm"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>登录账号</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile Nav Bar */}
      <div className="flex md:hidden items-center justify-around px-2 py-2 border-t border-slate-200 bg-slate-50 text-xs font-semibold">
        <button
          onClick={() => onSelectTab('market')}
          className={`px-3 py-1 rounded-lg ${currentTab === 'market' ? 'bg-indigo-600 text-white' : 'text-slate-600'}`}
        >
          集市
        </button>
        <button
          onClick={() => onSelectTab('personal')}
          className={`px-3 py-1 rounded-lg ${currentTab === 'personal' ? 'bg-indigo-600 text-white' : 'text-slate-600'}`}
        >
          个人中心
        </button>
        {isAdmin && (
          <>
            <button
              onClick={() => onSelectTab('audit')}
              className={`px-3 py-1 rounded-lg ${currentTab === 'audit' ? 'bg-indigo-600 text-white' : 'text-slate-600'}`}
            >
              审核 ({pendingReviewsCount})
            </button>
            <button
              onClick={() => onSelectTab('rules')}
              className={`px-3 py-1 rounded-lg ${currentTab === 'rules' ? 'bg-indigo-600 text-white' : 'text-slate-600'}`}
            >
              风控中心
            </button>
          </>
        )}
      </div>
    </header>
  );
};

