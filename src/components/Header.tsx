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
  ArrowRight,
  Coins,
  Settings,
  PlusCircle,
  Flame,
  Award,
  Tags
} from 'lucide-react';
import { UserAccount } from '../types';

export type NavigationTab = 'market' | 'demands' | 'personal' | 'audit' | 'rules' | 'settings' | 'feedback' | 'manage' | 'detail';

interface HeaderProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  onOpenUpload: () => void;
  onOpenCreateDemand: () => void;
  onOpenCommandPalette: () => void;
  onOpenLogin: () => void;
  currentUser: UserAccount | null;
  allUsers: UserAccount[];
  onSwitchUser: (user: UserAccount) => void;
  onLogout: () => void;
  pendingReviewsCount: number;
  openDemandsCount?: number;
  starredCount?: number;
  mySubmissionsCount?: number;
  isSuperAdmin?: boolean;
  backendOnline?: boolean | null;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  onOpenUpload,
  onOpenCreateDemand,
  onOpenCommandPalette,
  onOpenLogin,
  currentUser,
  allUsers,
  onSwitchUser,
  onLogout,
  pendingReviewsCount,
  openDemandsCount = 0,
  starredCount = 0,
  mySubmissionsCount = 0,
  backendOnline = null
}) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isSuperAdmin = currentUser?.role === 'super_admin';
  const isAdmin = currentUser?.role === 'admin' || isSuperAdmin;
  // 菜单级权限：超管恒全量；管理员按 menuPermissions 控制「审核管理/风控中心」入口
  const menuPermissions = currentUser?.menuPermissions ?? [];
  const canAccessAudit =
    isSuperAdmin || (currentUser?.role === 'admin' && menuPermissions.includes('audit'));
  const canAccessRules =
    isSuperAdmin || (currentUser?.role === 'admin' && menuPermissions.includes('rules'));

  // 演示账号切换列表：仅保留超级管理员 + 第一个普通用户
  // 不渲染全量员工名单，避免把组织人员结构暴露给当前登录者
  const demoSwitchUsers = React.useMemo(() => {
    const superAdmin = allUsers.find(u => u.role === 'super_admin');
    const normalUser = allUsers.find(u => u.role === 'user');
    return [superAdmin, normalUser].filter((u): u is UserAccount => Boolean(u));
  }, [allUsers]);

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
        {/* Left: Brand Logo & Navigation */}
        <div className="flex items-center gap-6 lg:gap-8">
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
                <span
                  className={`w-1.5 h-1.5 rounded-full ${backendOnline === false ? 'bg-amber-400' : backendOnline ? 'bg-emerald-500' : 'bg-slate-300 animate-pulse'}`}
                  title={backendOnline === false ? '后端离线：当前使用本地演示数据' : backendOnline ? '企业后端已连接' : '正在连接企业后端'}
                />
              </div>
              <div className="text-[10px] text-slate-400 font-mono hidden sm:block">
                AI 技能与 MCP 插件市场
              </div>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="hidden md:flex items-center gap-1 text-xs font-semibold">
            {/* Marketplace */}
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

            {/* Demands Market Tab */}
            <button
              onClick={() => onSelectTab('demands')}
              id="nav-demands"
              className={`relative px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
                currentTab === 'demands'
                  ? 'bg-amber-50 text-amber-900 font-bold border border-amber-300 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Coins className="w-3.5 h-3.5 text-amber-500" />
              <span>征集广场</span>
            </button>

            {/* Admin Tabs: 审核管理与风控中心按菜单权限独立控制 */}
            {canAccessAudit && (
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
                <span>审核管理</span>
                {pendingReviewsCount > 0 && (
                  <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                    {pendingReviewsCount}
                  </span>
                )}
              </button>
            )}

            {canAccessRules && (
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
            )}
          </nav>
        </div>

        {/* Right: Actions, Demand Button, Publish & User Menu */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick Search trigger */}
          <button
            onClick={onOpenCommandPalette}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100/80 hover:bg-slate-100 text-slate-500 hover:text-slate-800 text-xs transition-colors border border-slate-200"
            title="快捷搜索 (⌘K)"
            id="btn-nav-search"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">搜索技能...</span>
            <kbd className="hidden lg:inline-block font-mono text-[10px] bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-500">
              ⌘K
            </kbd>
          </button>

          {/* Upload / Publish Skill Button */}
          <button
            onClick={onOpenUpload}
            id="btn-nav-upload"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-bold transition-all shadow-md shadow-indigo-500/20"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">发布技能</span>
          </button>

          {/* Personal Center Button - ONLY SHOWN WHEN LOGGED IN */}
          {currentUser && (
            <button
              onClick={() => onSelectTab('personal')}
              id="nav-personal-btn"
              className={`hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                currentTab === 'personal'
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200 shadow-2xs'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
              title="个人中心 (我的需求 & 技能)"
            >
              <User className="w-3.5 h-3.5 text-indigo-600" />
              <span>个人中心</span>
              {(starredCount > 0 || mySubmissionsCount > 0) && (
                <span className="px-1.5 py-0.2 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-mono">
                  {starredCount + mySubmissionsCount}
                </span>
              )}
            </button>
          )}

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
                <div className="hidden xl:block text-left">
                  <div className="text-xs font-bold text-slate-900 truncate max-w-[110px]">
                    {currentUser.name}
                  </div>
                  <div className="text-[10px] text-amber-600 font-bold flex items-center gap-1">
                    <span>🪙 {currentUser.points?.toLocaleString() || 10000}</span>
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
                  <div className="p-3 bg-gradient-to-br from-slate-50 to-indigo-50/50 rounded-2xl border border-slate-100 space-y-2">
                    <div className="flex items-center gap-3">
                      <img
                        src={currentUser.avatar}
                        alt={currentUser.name}
                        className="w-10 h-10 rounded-xl object-cover border border-slate-200"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-slate-900 truncate">{currentUser.name}</div>
                        <div className="text-[11px] text-slate-500 truncate font-mono">{currentUser.email}</div>
                        <div className="mt-1 flex items-center gap-1">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                            currentUser.role === 'super_admin'
                              ? 'bg-amber-50 text-amber-800 border-amber-300'
                              : currentUser.role === 'admin'
                              ? 'bg-purple-50 text-purple-700 border-purple-200' 
                              : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                          }`}>
                            {currentUser.role === 'super_admin' 
                              ? '🛡️ 超级管理员' 
                              : currentUser.role === 'admin'
                              ? '⚙️ 系统管理员'
                              : '💻 普通用户'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Points Balance Pill */}
                    <div className="flex items-center justify-between p-2 rounded-xl bg-amber-500/10 border border-amber-200 text-amber-900 text-[11px]">
                      <span className="font-medium">奖励积分余额</span>
                      <span className="font-black text-xs">🪙 {currentUser.points?.toLocaleString() || 10000} pts</span>
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
                      <span>个人中心 (需求、收藏与作品)</span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                  </button>

                  {/* Demands Management Shortcut（仅管理员可见） */}
                  {isAdmin && (
                    <button
                      onClick={() => {
                        onSelectTab('demands');
                        setShowUserMenu(false);
                      }}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-amber-50 text-slate-700 hover:text-amber-900 font-semibold transition-colors text-left"
                    >
                      <div className="flex items-center gap-2.5">
                        <Coins className="w-4 h-4 text-amber-500" />
                        <span>技能征集管理</span>
                      </div>
                      <span className="text-[10px] text-amber-600 font-bold">管理</span>
                    </button>
                  )}

                  {/* Super Admin Settings Shortcut（仅存于用户下拉菜单） */}
                  {isSuperAdmin && (
                    <button
                      onClick={() => {
                        onSelectTab('settings');
                        setShowUserMenu(false);
                      }}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 font-semibold transition-colors text-left"
                    >
                      <div className="flex items-center gap-2.5">
                        <Settings className="w-4 h-4 text-indigo-600" />
                        <span>权限设置</span>
                      </div>
                      <Shield className="w-3.5 h-3.5 text-amber-600" />
                    </button>
                  )}

                  {/* 建议管理（仅管理员可见） */}
                  {isAdmin && (
                    <button
                      onClick={() => {
                        onSelectTab('feedback');
                        setShowUserMenu(false);
                      }}
                      id="menu-item-feedback"
                      className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 text-slate-700 font-semibold transition-colors text-left"
                    >
                      <div className="flex items-center gap-2.5">
                        <MessageSquare className="w-4 h-4 text-indigo-600" />
                        <span>建议管理</span>
                      </div>
                      <span className="text-[10px] text-slate-400">意见箱</span>
                    </button>
                  )}

                  {/* 分类和专家组管理（仅管理员可见） */}
                  {isAdmin && (
                    <button
                      onClick={() => {
                        onSelectTab('manage');
                        setShowUserMenu(false);
                      }}
                      id="menu-item-category-domain"
                      className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 text-slate-700 font-semibold transition-colors text-left"
                    >
                      <div className="flex items-center gap-2.5">
                        <Tags className="w-4 h-4 text-indigo-600" />
                        <span>分类和专家组管理</span>
                      </div>
                      <span className="text-[10px] text-slate-400">组织管理</span>
                    </button>
                  )}

                  {/* Role Switcher Section */}
                  <div className="pt-2 border-t border-slate-100">
                    <div className="px-2 pb-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      快速切换账号模拟体验
                    </div>

                    <div className="space-y-1">
                      {/* 仅展示超管 + 一个普通用户两个演示身份，避免全量员工名单泄漏 */}
                      {demoSwitchUsers.map(user => {
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
                                  {user.role === 'super_admin' ? '🛡️ 超级管理员' : '💻 普通用户'} · {user.department}
                                </div>
                              </div>
                            </div>
                            {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                          </div>
                        );
                      })}
                    </div>

                    <p className="px-2 pt-1.5 text-[10px] text-slate-400 leading-relaxed">
                      切换仅预览身份界面，写操作仍以登录账号提交；如需真实切换请退出后重新登录。
                    </p>
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
      <div className="flex md:hidden items-center justify-around px-2 py-2 border-t border-slate-200 bg-slate-50 text-xs font-semibold overflow-x-auto">
        <button
          onClick={() => onSelectTab('market')}
          className={`px-3 py-1 rounded-lg shrink-0 ${currentTab === 'market' ? 'bg-indigo-600 text-white' : 'text-slate-600'}`}
        >
          集市
        </button>
        <button
          onClick={() => onSelectTab('demands')}
          className={`px-3 py-1 rounded-lg shrink-0 flex items-center gap-1 ${currentTab === 'demands' ? 'bg-amber-600 text-white' : 'text-slate-600'}`}
        >
          <Coins className="w-3 h-3" />
          征集广场
        </button>
        {currentUser && (
          <button
            onClick={() => onSelectTab('personal')}
            className={`px-3 py-1 rounded-lg shrink-0 ${currentTab === 'personal' ? 'bg-indigo-600 text-white' : 'text-slate-600'}`}
          >
            个人中心
          </button>
        )}
        {canAccessAudit && (
          <button
            onClick={() => onSelectTab('audit')}
            className={`px-3 py-1 rounded-lg shrink-0 ${currentTab === 'audit' ? 'bg-indigo-600 text-white' : 'text-slate-600'}`}
          >
            审核 ({pendingReviewsCount})
          </button>
        )}
        {canAccessRules && (
          <button
            onClick={() => onSelectTab('rules')}
            className={`px-3 py-1 rounded-lg shrink-0 ${currentTab === 'rules' ? 'bg-indigo-600 text-white' : 'text-slate-600'}`}
          >
            风控
          </button>
        )}
      </div>
    </header>
  );
};
