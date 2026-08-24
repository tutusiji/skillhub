import React, { useState } from 'react';
import { 
  X, 
  LogIn, 
  UserPlus, 
  Users, 
  ShieldCheck, 
  ArrowRight,
  Info,
  Check,
  AlertCircle,
  Lock,
  Mail,
  Building,
  User
} from 'lucide-react';
import { UserAccount, UserRole } from '../types';
import { api, mapApiUser } from '../services/api';

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

type AuthTab = 'preset' | 'login' | 'register';

/**
 * 企业级用户登录与注册认证弹窗组件
 * 支持「预设身份一键切换」、「企业密码登录」与「新员工账号自主注册」三种模式
 */
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
  // 当前激活的认证标签页
  const [activeTab, setActiveTab] = useState<AuthTab>('preset');

  // 登录表单状态
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // 注册表单状态
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regDept, setRegDept] = useState('企业应用研发部');
  const [regRole, setRegRole] = useState<UserRole>('developer');
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [regSuccessMsg, setRegSuccessMsg] = useState<string | null>(null);

  /**
   * 处理选择预设身份登录
   * @param user 用户对象
   */
  const handleSelect = (user: UserAccount) => {
    if (onLogin) onLogin(user);
    else if (onSelectUser) onSelectUser(user);
    onClose();
  };

  /**
   * 提交企业账号密码登录
   * @param e 表单提交事件
   */
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);

    try {
      const data = await api.login(loginEmail.trim(), loginPassword);

      // 保存 JWT Token 至本地存储
      if (data.token) {
        localStorage.setItem('skillhub_token', data.token);
      }

      const loggedUser: UserAccount = mapApiUser(data.user);

      if (onCustomLogin) onCustomLogin(loggedUser);
      else if (onLogin) onLogin(loggedUser);
      onClose();
    } catch (err: any) {
      setLoginError(err.message || '登录网络异常，请重试');
    } finally {
      setLoginLoading(false);
    }
  };

  /**
   * 提交新员工/开发者账号注册
   * @param e 表单提交事件
   */
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);
    setRegSuccessMsg(null);
    setRegLoading(true);

    try {
      const data = await api.register({
        name: regName.trim(),
        email: regEmail.trim(),
        password: regPassword,
        department: regDept.trim(),
        role: regRole,
      });

      if (data.token) {
        localStorage.setItem('skillhub_token', data.token);
      }

      const newUser: UserAccount = mapApiUser(data.user);

      setRegSuccessMsg('注册成功！已自动完成企业身份登录');
      setTimeout(() => {
        if (onCustomLogin) onCustomLogin(newUser);
        else if (onLogin) onLogin(newUser);
        onClose();
      }, 1000);
    } catch (err: any) {
      setRegError(err.message || '注册接口请求失败');
    } finally {
      setRegLoading(false);
    }
  };

  const displayActionTitle = actionHint || pendingActionTitle;

  if (!isOpen) return null;

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
              {activeTab === 'register' ? <UserPlus className="w-5 h-5" /> : <LogIn className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {displayActionTitle ? `请先登录以${displayActionTitle}` : 'SkillHub 企业统一身份认证'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                支持企业密码登录、快捷身份切换与新员工自助注册
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

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-100 bg-slate-50/50 px-6">
          <button
            onClick={() => { setActiveTab('preset'); setLoginError(null); setRegError(null); }}
            className={`py-3 px-3 border-b-2 text-xs font-bold flex items-center gap-1.5 transition-colors ${
              activeTab === 'preset'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>预设快捷身份</span>
          </button>

          <button
            onClick={() => { setActiveTab('login'); setLoginError(null); setRegError(null); }}
            className={`py-3 px-3 border-b-2 text-xs font-bold flex items-center gap-1.5 transition-colors ${
              activeTab === 'login'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <LogIn className="w-4 h-4" />
            <span>账号密码登录</span>
          </button>

          <button
            onClick={() => { setActiveTab('register'); setLoginError(null); setRegError(null); }}
            className={`py-3 px-3 border-b-2 text-xs font-bold flex items-center gap-1.5 transition-colors ${
              activeTab === 'register'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>新账号注册</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* TAB 1: 预设快捷身份 */}
          {activeTab === 'preset' && (
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
                      onClick={() => handleSelect(user)}
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
                  onClick={() => setActiveTab('register')}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:underline"
                >
                  新加入企业？点此注册账号 &gt;
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: 企业账号密码登录 */}
          {activeTab === 'login' && (
            <form onSubmit={handlePasswordLogin} className="space-y-4 text-xs">
              {loginError && (
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{loginError}</span>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">企业工作邮箱</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="email"
                    required
                    placeholder="admin@skillhub.corp"
                    value={loginEmail}
                    onChange={e => setLoginEmail(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">预设账号默认密码均为：<code className="text-indigo-600 font-mono">Password123!</code></p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">登录密码</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="password"
                    required
                    placeholder="请输入密码"
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveTab('register')}
                  className="text-xs text-indigo-600 font-semibold hover:underline"
                >
                  没有账号？立即注册
                </button>
                <button
                  type="submit"
                  disabled={loginLoading}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-md shadow-indigo-500/20 disabled:opacity-50 flex items-center gap-2"
                >
                  {loginLoading ? '登录中...' : '登录账号'}
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: 新员工账号注册 */}
          {activeTab === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5 text-xs">
              {regError && (
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{regError}</span>
                </div>
              )}

              {regSuccessMsg && (
                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>{regSuccessMsg}</span>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">员工姓名 / 业务花名</label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="例如：林悦 (AI安全组)"
                    value={regName}
                    onChange={e => setRegName(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">企业工作邮箱</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="email"
                    required
                    placeholder="linyue@skillhub.corp"
                    value={regEmail}
                    onChange={e => setRegEmail(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">设置登录密码 (最少 6 位)</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="设置安全密码"
                    value={regPassword}
                    onChange={e => setRegPassword(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">所属研发部门</label>
                  <div className="relative">
                    <Building className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      placeholder="基础架构平台"
                      value={regDept}
                      onChange={e => setRegDept(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">系统操作权限</label>
                  <select
                    value={regRole}
                    onChange={e => setRegRole(e.target.value as UserRole)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-medium"
                  >
                    <option value="developer">研发工程师 (developer)</option>
                    <option value="admin">超级管理员 (admin)</option>
                    <option value="security_officer">安全审计官 (security)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveTab('login')}
                  className="text-xs text-slate-500 hover:text-slate-800 font-semibold"
                >
                  已有账号？直接登录
                </button>
                <button
                  type="submit"
                  disabled={regLoading}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-md shadow-indigo-500/20 disabled:opacity-50 flex items-center gap-2"
                >
                  {regLoading ? '正在注册...' : '立即完成注册'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
