import React, { useState, useMemo } from 'react';
import {
  Shield,
  ShieldCheck,
  UserCheck,
  UserX,
  Search,
  KeyRound,
  Users,
  Lock,
  Sparkles,
  Building,
  Coins,
  Check,
  ShieldAlert,
  ListChecks,
  Sliders,
  ClipboardCheck,
} from 'lucide-react';
import { UserAccount, UserRole } from '../types';
import { PopconfirmBubble } from './PopconfirmBubble';
import { Avatar } from './Avatar';

interface AdminSettingsViewProps {
  currentUser: UserAccount | null;
  users: UserAccount[];
  onUpdateUserRole: (userId: string, newRole: UserRole) => void;
  onUpdateMenuPermissions: (userId: string, permissions: string[]) => void;
  onToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, message: string) => void;
}

/** 可勾选的菜单权限定义 */
const MENU_PERMISSION_OPTIONS: Array<{
  key: 'audit' | 'rules';
  label: string;
  desc: string;
  icon: React.ReactNode;
}> = [
  {
    key: 'audit',
    label: '审核管理',
    desc: '技能审核、上下架与删除',
    icon: <ClipboardCheck className="w-4 h-4" />,
  },
  {
    key: 'rules',
    label: '风控中心',
    desc: '风控规则与大模型网关配置',
    icon: <Sliders className="w-4 h-4" />,
  },
];

export const AdminSettingsView: React.FC<AdminSettingsViewProps> = ({
  currentUser,
  users,
  onUpdateUserRole,
  onUpdateMenuPermissions,
  onToast
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  // 默认选中「管理员」角色筛选
  const [roleFilter, setRoleFilter] = useState<'all' | 'super_admin' | 'admin' | 'user'>('admin');

  const isSuperAdmin = currentUser?.role === 'super_admin';

  // 当前所有管理员用户（左栏菜单权限的全局配置对象）
  const adminUsers = users.filter(u => u.role === 'admin');

  /**
   * 左栏复选框勾选状态 = 所有管理员都已具备的菜单权限（交集）
   * 没有管理员时默认全勾（新委任的管理员默认获得全部菜单）
   */
  const globalMenuPermissions = useMemo(() => {
    if (adminUsers.length === 0) return ['audit', 'rules'];
    return MENU_PERMISSION_OPTIONS.filter(opt =>
      adminUsers.every(u => (u.menuPermissions || []).includes(opt.key)),
    ).map(opt => opt.key);
  }, [users, adminUsers]);

  // 默认只展示已有权限的用户（管理员 + 超管）；输入搜索词时可匹配到普通用户，便于直接委任
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      if (roleFilter !== 'all' && user.role !== roleFilter) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesId = user.id.toLowerCase().includes(q);
        const matchesName = user.name.toLowerCase().includes(q);
        const matchesEmail = user.email.toLowerCase().includes(q);
        const matchesDept = user.department.toLowerCase().includes(q);
        const matchesEmp = (user.employeeId || '').toLowerCase().includes(q);
        if (!matchesId && !matchesName && !matchesEmail && !matchesDept && !matchesEmp) return false;
      } else if (roleFilter === 'all' && user.role !== 'admin' && user.role !== 'super_admin') {
        // 无任何筛选时只列出已有权限的用户
        return false;
      }

      return true;
    });
  }, [users, searchQuery, roleFilter]);

  /**
   * 左栏全局菜单权限开关：勾选/取消对所有管理员生效
   * @param key 菜单权限键
   * @param checked 是否勾选
   */
  const handleToggleGlobalMenuPermission = (key: 'audit' | 'rules', checked: boolean) => {
    if (!isSuperAdmin) {
      onToast('error', '权限不足', '仅超级管理员具备调整菜单权限的能力');
      return;
    }
    if (adminUsers.length === 0) {
      onToast('warning', '暂无管理员', '当前没有管理员，委任管理员后该菜单权限将自动生效');
      return;
    }
    // 批量应用到所有管理员（超管恒全量，不受影响）
    for (const admin of adminUsers) {
      const current = Array.isArray(admin.menuPermissions) ? admin.menuPermissions : [];
      const next = checked
        ? [...new Set([...current, key])]
        : current.filter(p => p !== key);
      onUpdateMenuPermissions(admin.id, next);
    }
    onToast(
      checked ? 'success' : 'info',
      checked ? '菜单权限已授予' : '菜单权限已收回',
      `${MENU_PERMISSION_OPTIONS.find(o => o.key === key)?.label} 已${checked ? '对所有管理员开放' : '从所有管理员移除'}`
    );
  };

  /**
   * 委任管理员的前置检查：超管权限 + 目标非超管。
   * 返回 true 表示可继续，false 表示已 toast 拒绝、不应再开气泡。
   */
  const canPromoteToAdmin = (targetUser: UserAccount): boolean => {
    if (!isSuperAdmin) {
      onToast('error', '权限不足', '仅超级管理员具备委任新管理员的权限');
      return false;
    }
    if (targetUser.role === 'super_admin') {
      onToast('warning', '不可更改', '该用户为超级管理员，不可降级或更改');
      return false;
    }
    return true;
  };

  /**
   * 撤销管理员的前置检查：超管权限 + 目标非超管。
   */
  const canDemoteAdmin = (targetUser: UserAccount): boolean => {
    if (!isSuperAdmin) {
      onToast('error', '权限不足', '仅超级管理员具备撤销管理员权限的能力');
      return false;
    }
    if (targetUser.role === 'super_admin') {
      onToast('error', '禁止操作', '超级管理员是系统的根本权限，不可撤销自身');
      return false;
    }
    return true;
  };

  // If not super admin, show access denied
  if (!isSuperAdmin) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 rounded-3xl bg-white border border-rose-200 text-center space-y-4 shadow-xl">
        <div className="w-16 h-16 rounded-3xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-black text-slate-900">访问被拒绝：需要超级管理员权限</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            该设置页面仅限系统的 <strong className="text-rose-600">超级管理员 (Super Admin)</strong> 访问。普通管理员虽然拥有风控和审核权限，但根据企业安全基线规范，无权授权其他管理员。
          </p>
        </div>
      </div>
    );
  }

  const superAdminCount = users.filter(u => u.role === 'super_admin').length;
  const adminCount = users.filter(u => u.role === 'admin').length;
  const userCount = users.filter(u => u.role === 'user').length;

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200 text-left">
      {/* Top Banner Header */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white shadow-xl border border-indigo-900/40 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-bold shadow-2xs">
              <KeyRound className="w-3.5 h-3.5" />
              <span>RBAC 角色权限与管理员委派中心</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              系统设置与管理员权限管理
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              作为超级管理员，你可按用户 ID 或姓名精准搜索企业员工，并授权其为管理员。普通管理员拥有同等业务审核与风控权限，但受安全最小特权原则约束，不可二次赋权。
            </p>
          </div>

          {/* Role Summary Stats */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 p-3 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 text-center shrink-0 w-full md:w-auto">
            <div className="px-3 py-1">
              <div className="text-[10px] text-indigo-200">超级管理员</div>
              <div className="text-lg font-black text-amber-400">{superAdminCount}</div>
            </div>
            <div className="px-3 py-1 border-x border-white/10">
              <div className="text-[10px] text-indigo-200">委任管理员</div>
              <div className="text-lg font-black text-indigo-300">{adminCount}</div>
            </div>
            <div className="px-3 py-1">
              <div className="text-[10px] text-indigo-200">普通用户</div>
              <div className="text-lg font-black text-white">{userCount}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Principle & Security Rule Card */}
      <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200 flex items-start gap-3.5">
        <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <div className="font-bold text-indigo-950">权限分级机制说明 (Permission Tiering Policy)</div>
          <p className="text-slate-600 leading-relaxed">
            • <strong>超级管理员 (Super Admin)</strong>：系统最高决策者，唯一具备委任/撤销系统管理员权限的主体，同时具备风控配置与全库审查能力。<br />
            • <strong>管理员 (Admin)</strong>：拥有全部技能发布审核、风控中心规则管理与征集需求审批权限，但<strong>不能设置或授权他人</strong>。<br />
            • <strong>普通用户 (User)</strong>：享有技能检索、发布征集需求、揭榜响应、插件安装等基础业务功能。
          </p>
        </div>
      </div>

      {/* 左右分栏：左栏管理员菜单列表，右栏用户列表 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT: 管理员菜单列表 */}
        <div className="lg:col-span-3 bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900">管理员菜单</h3>
          </div>
          <div className="p-3 space-y-2">
            {MENU_PERMISSION_OPTIONS.map(opt => {
              const checked = globalMenuPermissions.includes(opt.key);
              return (
                <label
                  key={opt.key}
                  className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-all select-none ${
                    checked
                      ? 'bg-indigo-50 border-indigo-200'
                      : 'bg-slate-50 border-slate-200 hover:border-indigo-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={e => handleToggleGlobalMenuPermission(opt.key, e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-indigo-600 shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <span className="text-indigo-600">{opt.icon}</span>
                      {opt.label}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{opt.desc}</div>
                  </div>
                </label>
              );
            })}

            <div className="pt-2 px-1 text-[11px] text-slate-400 leading-relaxed">
              勾选的菜单对全体管理员可见；取消勾选后，管理员登录时将看不到该菜单。
            </div>
          </div>
        </div>

        {/* RIGHT: 用户列表 */}
        <div className="lg:col-span-9 space-y-4">
          {/* Filter and User Search Toolbar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
            {/* Search by User ID or Name */}
            <div className="relative w-full sm:w-96">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="搜索工号、姓名、邮箱、部门..."
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs text-slate-800"
              />
            </div>

            {/* Role Filter Tabs */}
            <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
              <span className="text-xs text-slate-400 mr-1">角色筛选：</span>
              {[
                { id: 'all', label: '全部用户' },
                { id: 'admin', label: '管理员' },
                { id: 'user', label: '普通用户' },
                { id: 'super_admin', label: '超级管理员' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setRoleFilter(tab.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    roleFilter === tab.id
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/80'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Users Table / List */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">企业用户权限列表</h3>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-bold">
              {filteredUsers.length} 位
            </span>
          </div>
          <span className="text-xs text-slate-400">支持直接根据员工工号搜索并授权，已注册与 IAM 登录开号的用户均可检索</span>
        </div>

        <div className="divide-y divide-slate-100">
          {filteredUsers.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400 space-y-2">
              <Search className="w-8 h-8 text-slate-300 mx-auto" />
              <div>未找到匹配的用户，请尝试更换搜索关键字或用户 ID。</div>
            </div>
          ) : (
            filteredUsers.map(user => {
              const isSelf = user.id === currentUser?.id;
              const isSuper = user.role === 'super_admin';
              const isAdminUser = user.role === 'admin';

              return (
                <div
                  key={user.id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors"
                >
                  {/* User Profile */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <Avatar
                      src={user.avatar}
                      name={user.name}
                      className="w-11 h-11 rounded-2xl border border-slate-200 shrink-0"
                    />
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-900">{user.name}</span>
                        
                        {/* User ID Pill */}
                        <code className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono text-[11px] border border-slate-200">
                          工号: {user.employeeId || '—'}
                        </code>

                        {/* Role Badge */}
                        {isSuper && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300 text-[11px] font-black flex items-center gap-1">
                            <Shield className="w-3 h-3 text-amber-600" />
                            超级管理员
                          </span>
                        )}
                        {isAdminUser && (
                          <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200 text-[11px] font-bold flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-indigo-600" />
                            系统管理员
                          </span>
                        )}
                        {user.role === 'user' && (
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-medium">
                            普通用户
                          </span>
                        )}

                        {/* Auth Provider Badge */}
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          user.authProvider === 'oss'
                            ? 'bg-teal-50 text-teal-700 border border-teal-200'
                            : 'bg-violet-50 text-violet-700 border border-violet-200'
                        }`}>
                          {user.authProvider === 'oss' ? 'IAM 登录' : '密码账号'}
                        </span>

                        {isSelf && (
                          <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 text-[10px] font-bold">
                            当前登录账户
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Building className="w-3 h-3 text-slate-400" />
                          {user.department} {user.title ? `· ${user.title}` : ''}
                        </span>
                        <span>{user.email}</span>
                        <span className="text-amber-600 font-bold flex items-center gap-1">
                          <Coins className="w-3 h-3" />
                          {user.points?.toLocaleString() || 10000} 积分
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Column：管理员显示「解除管理员」，非管理员显示「设为管理员」 */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {isSuper ? (
                      <div className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-400 text-xs font-bold flex items-center gap-1.5 cursor-not-allowed">
                        <Lock className="w-3.5 h-3.5" />
                        <span>超管固有保护</span>
                      </div>
                    ) : isAdminUser ? (
                      <PopconfirmBubble
                        title={`确定撤销用户「${user.name}」的管理员权限？`}
                        description={`工号：${user.employeeId || '-'}。撤销后其角色将被重置为普通用户，可随时再次委任。`}
                        type="warning"
                        confirmText="确认撤销"
                        cancelText="取消"
                        placement="top-left"
                        onConfirm={() => {
                          onUpdateUserRole(user.id, 'user');
                          onToast('info', '权限已撤销', `已将「${user.name}」的管理员权限收回并重置为普通用户`);
                        }}
                        trigger={({ onClick }) => (
                          <button
                            onClick={(e) => {
                              if (!canDemoteAdmin(user)) {
                                e.stopPropagation();
                                return;
                              }
                              onClick(e);
                            }}
                            className="px-3.5 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-all flex items-center gap-1.5"
                          >
                            <UserX className="w-3.5 h-3.5" />
                            <span>解除管理员</span>
                          </button>
                        )}
                      />
                    ) : (
                      <PopconfirmBubble
                        title={`确定将用户「${user.name}」设为管理员？`}
                        description={`工号：${user.employeeId || '-'}。该用户将获得技能审核、安全风控和需求审批等全部管理权限（但无法继续设置其他管理员）。`}
                        type="warning"
                        confirmText="确认委任"
                        cancelText="取消"
                        placement="top-left"
                        onConfirm={() => {
                          onUpdateUserRole(user.id, 'admin');
                          onToast('success', '管理员委任成功', `已成功将「${user.name}」设为管理员`);
                        }}
                        trigger={({ onClick }) => (
                          <button
                            onClick={(e) => {
                              if (!canPromoteToAdmin(user)) {
                                e.stopPropagation();
                                return;
                              }
                              onClick(e);
                            }}
                            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 active:scale-95"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>设为管理员</span>
                          </button>
                        )}
                      />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
        </div>
        </div>
      </div>
    </div>
  );
};
