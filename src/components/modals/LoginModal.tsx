import React, { useState } from 'react';
import {
  LogIn,
  UserPlus,
  ShieldCheck,
  Info,
  Check,
  AlertCircle,
  Lock,
  Mail,
  Building,
  User,
  IdCard,
  Fingerprint
} from 'lucide-react';
import { UserAccount } from '../../types';
import { api, mapApiUser } from '../../services/api';
import { Modal } from '../ui/Modal';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin?: (user: UserAccount) => void;
  onCustomLogin?: (user: UserAccount) => void;
  actionHint?: string;
  pendingActionTitle?: string;
}

type AuthTab = 'login' | 'oss' | 'register';

/**
 * 企业统一身份认证弹窗
 *
 * 三种登录方式：
 * 1. 账号密码：超级管理员用登录名 admin，普通员工用工号
 * 2. 内部 OSS 单点登录：凭工号免密登录，首次登录自动开号
 * 3. 自助注册：工号 + 姓名 + 密码，角色固定为普通用户（管理员只能由超管委任）
 */
export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onLogin,
  onCustomLogin,
  actionHint,
  pendingActionTitle
}) => {
  // 当前激活的认证标签页
  const [activeTab, setActiveTab] = useState<AuthTab>('login');

  // 账号密码登录表单状态
  const [loginAccount, setLoginAccount] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // OSS 单点登录表单状态
  const [ossEmployeeId, setOssEmployeeId] = useState('');
  const [ossLoading, setOssLoading] = useState(false);
  const [ossError, setOssError] = useState<string | null>(null);

  // 注册表单状态
  const [regEmployeeId, setRegEmployeeId] = useState('');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regDept, setRegDept] = useState('企业应用研发部');
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [regSuccessMsg, setRegSuccessMsg] = useState<string | null>(null);

  /**
   * 登录成功后的统一收尾：写入令牌并回调上层
   * @param data 后端返回的令牌与用户信息
   */
  const finishLogin = (data: { token: string; user: Parameters<typeof mapApiUser>[0] }) => {
    if (data.token) {
      localStorage.setItem('skillhub_token', data.token);
    }
    const loggedUser: UserAccount = mapApiUser(data.user);
    if (onCustomLogin) onCustomLogin(loggedUser);
    else if (onLogin) onLogin(loggedUser);
    onClose();
  };

  /**
   * 切换标签页并清空各表单的错误提示
   * @param tab 目标标签页
   */
  const switchTab = (tab: AuthTab) => {
    setActiveTab(tab);
    setLoginError(null);
    setOssError(null);
    setRegError(null);
  };

  /**
   * 提交账号密码登录
   * @param e 表单提交事件
   */
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);

    try {
      const data = await api.login(loginAccount.trim(), loginPassword);
      finishLogin(data);
    } catch (err: any) {
      setLoginError(err.message || '登录网络异常，请重试');
    } finally {
      setLoginLoading(false);
    }
  };

  /**
   * 提交内部 IAM 单点登录
   * @param e 表单提交事件
   */
  const handleOssLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setOssError(null);
    setOssLoading(true);

    try {
      const data = await api.ossLogin(ossEmployeeId.trim());
      finishLogin(data);
    } catch (err: any) {
      setOssError(err.message || '内部 IAM 校验失败，请确认工号');
    } finally {
      setOssLoading(false);
    }
  };

  /**
   * 提交新员工账号注册
   * @param e 表单提交事件
   */
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);
    setRegSuccessMsg(null);
    setRegLoading(true);

    try {
      const data = await api.register({
        employeeId: regEmployeeId.trim(),
        name: regName.trim(),
        password: regPassword,
        department: regDept.trim(),
        email: regEmail.trim() || undefined,
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

  const tabs: Array<{ id: AuthTab; label: string; icon: React.ReactNode }> = [
    { id: 'login', label: '账号密码登录', icon: <LogIn className="w-4 h-4" /> },
    { id: 'oss', label: '内部 OSS 登录', icon: <Fingerprint className="w-4 h-4" /> },
    { id: 'register', label: '新账号注册', icon: <UserPlus className="w-4 h-4" /> },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      panelClassName="!overflow-hidden"
      header={
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
            {activeTab === 'register' ? <UserPlus className="w-5 h-5" /> : <LogIn className="w-5 h-5" />}
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-900 truncate">
              {displayActionTitle ? `请先登录以${displayActionTitle}` : 'SkillHub 企业统一身份认证'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              支持工号密码登录、内部 IAM 单点登录与新员工自助注册
            </p>
          </div>
        </div>
      }
    >
      <div id="login-auth-modal">
        {/* Tab Navigation */}
        <div className="flex border-b border-slate-100 bg-slate-50/50 px-6">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => switchTab(tab.id)}
              className={`py-3 px-3 border-b-2 text-xs font-bold flex items-center gap-1.5 transition-colors ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          {/* TAB 1: 账号密码登录 */}
          {activeTab === 'login' && (
            <form onSubmit={handlePasswordLogin} className="space-y-4 text-xs">
              {loginError && (
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{loginError}</span>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">员工工号 / 管理员账号</label>
                <div className="relative">
                  <IdCard className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="例如：7462200"
                    value={loginAccount}
                    onChange={e => setLoginAccount(e.target.value)}
                    data-testid="login-account"
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  普通员工填工号；超级管理员账号为 <code className="text-indigo-600 font-mono">admin</code>
                </p>
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
                    data-testid="login-password"
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => switchTab('oss')}
                  className="text-xs text-indigo-600 font-semibold hover:underline"
                >
                  用内部 OSS 免密登录
                </button>
                <button
                  type="submit"
                  disabled={loginLoading}
                  data-testid="login-submit"
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-md shadow-indigo-500/20 disabled:opacity-50 flex items-center gap-2"
                >
                  {loginLoading ? '登录中...' : '登录账号'}
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: 内部 IAM 单点登录 */}
          {activeTab === 'oss' && (
            <form onSubmit={handleOssLogin} className="space-y-4 text-xs">
              <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-900 flex items-start gap-2">
                <Info className="w-4 h-4 shrink-0 text-indigo-600 mt-0.5" />
                <span className="leading-relaxed">
                  通过公司内部 IAM 体系校验在职身份，无需密码。首次登录会自动为你开通 SkillHub 账号。
                </span>
              </div>

              {ossError && (
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{ossError}</span>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">员工工号</label>
                <div className="relative">
                  <Fingerprint className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    required
                    inputMode="numeric"
                    placeholder="例如：7462200"
                    value={ossEmployeeId}
                    onChange={e => setOssEmployeeId(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => switchTab('login')}
                  className="text-xs text-slate-500 hover:text-slate-800 font-semibold"
                >
                  改用账号密码登录
                </button>
                <button
                  type="submit"
                  disabled={ossLoading}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-md shadow-indigo-500/20 disabled:opacity-50 flex items-center gap-2"
                >
                  <ShieldCheck className="w-4 h-4" />
                  {ossLoading ? '校验中...' : 'OSS 免密登录'}
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
                <label className="block font-bold text-slate-700 mb-1">员工工号 (登录标识)</label>
                <div className="relative">
                  <IdCard className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    required
                    inputMode="numeric"
                    pattern="\d{6,12}"
                    placeholder="例如：7462200"
                    value={regEmployeeId}
                    onChange={e => setRegEmployeeId(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-mono"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">6-12 位数字，注册后作为登录账号</p>
              </div>

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
                  <label className="block font-bold text-slate-700 mb-1">企业邮箱 (可选)</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="email"
                      placeholder="留空则按工号生成"
                      value={regEmail}
                      onChange={e => setRegEmail(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
                    />
                  </div>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-500 leading-relaxed">
                新账号统一为<strong className="text-slate-700">普通用户</strong>权限。管理员权限须由超级管理员在「权限设置」中委任。
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => switchTab('login')}
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
    </Modal>
  );
};
