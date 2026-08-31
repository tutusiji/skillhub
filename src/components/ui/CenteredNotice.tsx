import React from 'react';

/**
 * 居中提示卡：登录回源占位 / 详情兜底 / 未登录建议页 / 权限不足 等
 * 「图标 + 标题 + 描述 + 操作按钮」整页空态的共享骨架。
 *
 * 此前这些卡片在 App.tsx 内联了 4 份几乎相同的结构（仅图标、文案、按钮不同），
 * 收敛到本组件；PermissionDenied 也基于它拼装，守卫卡与空态卡样式保持一致。
 */
interface CenteredNoticeProps {
  /** 图标内容；默认感叹号「!」 */
  icon?: React.ReactNode;
  /** 图标圆形底/文字色（tailwind 类，默认 slate） */
  iconClass?: string;
  title: string;
  description?: string;
  /** 底部操作按钮区（不传则无） */
  actions?: React.ReactNode;
  /** 额外容器 class（如改变最大宽度），默认 max-w-lg 居中 */
  containerClass?: string;
}

export function CenteredNotice({
  icon,
  iconClass = 'bg-slate-100 text-slate-500',
  title,
  description,
  actions,
  containerClass = 'max-w-lg',
}: CenteredNoticeProps) {
  return (
    <div
      className={`p-12 text-center bg-white rounded-3xl border border-slate-200 space-y-4 ${containerClass} mx-auto my-8`}
    >
      <div
        className={`w-12 h-12 rounded-full flex items-center justify-center font-bold mx-auto ${iconClass}`}
      >
        {icon ?? '!'}
      </div>
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      {description && <p className="text-xs text-slate-500">{description}</p>}
      {actions && (
        <div className="flex items-center justify-center gap-3 pt-2">{actions}</div>
      )}
    </div>
  );
}
