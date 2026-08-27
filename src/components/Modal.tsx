import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X } from 'lucide-react';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | 'full';

interface ModalProps {
  /** 是否打开（受控） */
  isOpen: boolean;
  /** 关闭回调（点背景、Escape、右上角 X 都走这里） */
  onClose: () => void;
  /** 弹窗尺寸（max-w-*），默认 lg */
  size?: ModalSize;
  /** 标题栏右侧的关闭按钮是否显示，默认 true */
  showCloseButton?: boolean;
  /** 点击背景是否关闭，默认 true */
  closeOnBackdrop?: boolean;
  /** 按 Escape 是否关闭，默认 true */
  closeOnEscape?: boolean;
  /** 容器自定义类（覆盖默认 flex/padding 等） */
  containerClassName?: string;
  /** 面板自定义类（覆盖默认背景/圆角/阴影） */
  panelClassName?: string;
  /** 头部（可选）：传入后会渲染带标题的工具栏 + 关闭按钮 */
  header?: React.ReactNode;
  /** 底部（可选）：传入后会渲染带边框的工具栏 */
  footer?: React.ReactNode;
  /** 内容主体 */
  children: React.ReactNode;
  /**
   * 面板对齐方式：
   *   - 'center' 居中（默认）
   *   - 'top'    顶部对齐（适合大型表单/长内容，可滚动）
   */
  align?: 'center' | 'top';
}

const SIZE_CLASS: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
  full: 'max-w-[96vw]',
};

/** 进入 + 退场动画持续时间（ms），与下方 transition duration 保持一致 */
const ANIM_DURATION_MS = 200;

/**
 * 通用弹窗组件 —— 统一的进入 / 退场动画 + 滚动锁定 + ESC/背景点击关闭
 *
 * 实现要点：
 *  - 不在 isOpen=false 时直接 return null（那样退场动画来不及播）。
 *    改用「可见状态」visible 控制过渡类，等动画结束再真正卸载。
 *  - 用 transition-* 类（不是 animate-in），这样同一套类同时管进入和退场。
 *  - 打开时锁定 body 滚动，关闭后还原。
 */
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  size = 'lg',
  showCloseButton = true,
  closeOnBackdrop = true,
  closeOnEscape = true,
  containerClassName,
  panelClassName,
  header,
  footer,
  children,
  align = 'center',
}) => {
  // 真正的挂载状态：用于延后卸载，保证退场动画播完
  const [mounted, setMounted] = useState(isOpen);
  // 可见状态：驱动 transition class
  const [visible, setVisible] = useState(false);
  // 防止连续点击在动画期间误触关闭
  const closeGuardRef = useRef(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // 进入 / 退场：保持挂载直到退场动画结束
  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      // 下一帧再设 visible=true，触发 transition
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
      return () => cancelAnimationFrame(raf);
    } else {
      setVisible(false);
      const t = setTimeout(() => setMounted(false), ANIM_DURATION_MS);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  // body 滚动锁定（仅在挂载期间）
  useEffect(() => {
    if (!mounted) return;
    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;
    // 防止锁定滚动条导致页面宽度跳动
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
    };
  }, [mounted]);

  // ESC 关闭
  useEffect(() => {
    if (!mounted || !closeOnEscape) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (closeGuardRef.current) return;
        closeGuardRef.current = true;
        onClose();
        setTimeout(() => { closeGuardRef.current = false; }, ANIM_DURATION_MS);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mounted, closeOnEscape, onClose]);

  // 打开时把焦点移入弹窗，方便键盘用户
  useEffect(() => {
    if (!visible) return;
    const id = window.setTimeout(() => {
      const el = panelRef.current;
      if (!el) return;
      const focusable = el.querySelector<HTMLElement>(
        'input, select, textarea, button, [tabindex]:not([tabindex="-1"])',
      );
      (focusable ?? el).focus({ preventScroll: true });
    }, 50);
    return () => window.clearTimeout(id);
  }, [visible]);

  const handleBackdropClick = useCallback(() => {
    if (!closeOnBackdrop) return;
    if (closeGuardRef.current) return;
    closeGuardRef.current = true;
    onClose();
    setTimeout(() => { closeGuardRef.current = false; }, ANIM_DURATION_MS);
  }, [closeOnBackdrop, onClose]);

  if (!mounted) return null;

  const alignClass =
    align === 'top'
      ? 'items-start justify-center pt-10 sm:pt-16'
      : 'items-center justify-center';

  return (
    <div
      role="dialog"
      aria-modal="true"
      className={`fixed inset-0 z-50 flex p-4 sm:p-6 ${alignClass} ${containerClassName ?? ''}`}
      style={{ overflow: align === 'top' ? 'auto' : 'hidden' }}
    >
      {/* Backdrop */}
      <div
        onClick={handleBackdropClick}
        className={`fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-200 ease-out ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`relative w-full ${SIZE_CLASS[size]} flex flex-col bg-white rounded-3xl border border-slate-200 shadow-2xl outline-none transition-all duration-200 ease-out ${
          visible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-2'
        } ${panelClassName ?? ''}`}
        /*
          顶部对齐时容器自带 pt-10/pt-16，面板得再让出这段距离，
          否则面板底边正好顶到视口底部，看起来像被裁掉。
        */
        style={{ maxHeight: align === 'top' ? 'calc(100vh - 8rem)' : 'calc(100vh - 4rem)' }}
        onClick={e => e.stopPropagation()}
      >
        {header && (
          <div className="shrink-0 flex items-start justify-between gap-3 p-5 sm:p-6 border-b border-slate-100">
            <div className="min-w-0 flex-1">{header}</div>
            {showCloseButton && (
              <button
                onClick={onClose}
                className="shrink-0 w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors"
                title="关闭"
                aria-label="关闭"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/*
          Content body —— 高度由 flex 分配，不再硬编码 maxHeight。
          原来固定 calc(100vh - 12rem) 是按「有 header + 有 footer」估的，
          没传这两个插槽的弹窗会白扣 8rem 高度，内容被挤在一条窄缝里滚动。
        */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {children}
        </div>

        {footer && (
          <div className="shrink-0 px-5 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-3xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
