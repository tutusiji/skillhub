import { CenteredNotice } from './CenteredNotice';

/**
 * 权限不足 / 未登录占位卡：审核管理、风控中心、权限设置、分类专家组管理等
 * 受保护页在无权限时的统一兜底（返回集市 + 可选登录引导）。
 *
 * 基于 CenteredNotice 拼装（图标 + 标题 + 描述 + 操作按钮），
 * 守卫卡与详情兜底/登录占位等空态卡片样式一致。
 */
interface PermissionDeniedProps {
  /** 图标底色/文字色（tailwind 类，默认琥珀色） */
  iconClass?: string;
  title: string;
  description: string;
  /** 「返回技能集市」回调 */
  onBack: () => void;
  /** 登录按钮文案；不传则不渲染登录按钮（仅返回） */
  loginText?: string;
  /** 登录引导回调（openLoginModal） */
  onLogin?: () => void;
}
export function PermissionDenied({
  iconClass = 'bg-amber-100 text-amber-800',
  title,
  description,
  onBack,
  loginText,
  onLogin,
}: PermissionDeniedProps) {
  return (
    <CenteredNotice
      iconClass={iconClass}
      title={title}
      description={description}
      actions={
        <>
          <button
            onClick={onBack}
            className="px-5 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200"
          >
            返回技能集市
          </button>
          {loginText && onLogin && (
            <button
              onClick={onLogin}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-sm hover:bg-indigo-700"
            >
              {loginText}
            </button>
          )}
        </>
      }
    />
  );
}

