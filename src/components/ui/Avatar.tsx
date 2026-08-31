import React from 'react';

export interface AvatarProps {
  /** 头像图片地址（DiceBear 按 seed 生成的 SVG） */
  src?: string;
  /** 用户名，用于 alt 与首字母兜底 */
  name?: string;
  /** 作用在外层容器上的类名：尺寸、圆角、边框、shrink-0 等都写这里 */
  className?: string;
  /** 原生 title 提示 */
  title?: string;
}

/**
 * 统一头像组件。
 *
 * 为什么需要包一层容器而不是直接用 `<img>`：
 * DiceBear 的 SVG 四周自带大量留白（实测上留白最少 6.8%、下最多 19.8%），
 * 直接铺进小方框里人物只占中间一小块，看着头像很小。
 * 解决办法是内层 `<img>` 用 `.avatar-fill`（CSS scale + 偏上的 transform-origin）
 * 放大，再由外层容器的 `overflow-hidden` 把溢出的留白裁掉——
 * 裁切必须由父元素承担，因为元素自身的 clip-path 会跟着 transform 一起被放大。
 *
 * 圆角写在外层容器上（`rounded-*`），配合 overflow-hidden 才能正确裁出圆形/圆角。
 */
export const Avatar: React.FC<AvatarProps> = ({ src, name, className = '', title }) => (
  <div className={`overflow-hidden ${className}`} title={title}>
    {src ? (
      <img src={src} alt={name || ''} className="avatar-fill" loading="lazy" />
    ) : (
      /* 无头像时用首字母兜底，背景写在这一层，避免和调用方传的 bg-* 打架 */
      <span className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400 font-bold select-none">
        {(name || '?').trim().charAt(0).toUpperCase()}
      </span>
    )}
  </div>
);

export default Avatar;
