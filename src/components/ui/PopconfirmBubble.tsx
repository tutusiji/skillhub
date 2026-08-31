import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Trash2, HelpCircle } from 'lucide-react';

export interface PopconfirmBubbleProps {
  title: string;
  description?: string;
  onConfirm: () => void;
  confirmText?: string;
  cancelText?: string;
  type?: 'warning' | 'danger' | 'info';
  placement?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  trigger: (props: { onClick: (e: React.MouseEvent) => void; isOpen: boolean }) => React.ReactNode;
  disabled?: boolean;
}

type Coords = { top: number; left: number };

/**
 * 二次确认气泡。
 *
 * 关键实现：气泡本身通过 createPortal 渲染到 document.body，
 * 这样它能跳出所有 overflow:hidden / overflow-y-auto 的祖先容器
 * （包括通用 Modal 组件的弹窗体与外层容器）。
 * 触发器仍然保留在原位置，仅用一层 inline-block 包裹用来取坐标。
 */
export const PopconfirmBubble: React.FC<PopconfirmBubbleProps> = ({
  title,
  description,
  onConfirm,
  confirmText = '确定',
  cancelText = '取消',
  type = 'warning',
  placement = 'bottom-right',
  trigger,
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerWrapRef = useRef<HTMLSpanElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<Coords | null>(null);
  /** 暴露最近一次的定位函数，供气泡真正挂载后再量一次真实尺寸 */
  const computeRef = useRef<() => void>(() => {});

  // 计算气泡位置：用视口坐标 + position:fixed，门户到 body 之后 fixed 才稳定
  useLayoutEffect(() => {
    if (!isOpen) return;
    const POP_W_ESTIMATE = 320; // 与下方 sm:w-80 保持一致
    const POP_H_ESTIMATE = 200;
    const GAP = 8;
    const VIEWPORT_MARGIN = 8;

    const compute = () => {
      const triggerEl = triggerWrapRef.current;
      if (!triggerEl) return;
      const rect = triggerEl.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      // 真实尺寸优先，没量到时退回估算
      const popRect = popoverRef.current?.getBoundingClientRect();
      const popW = popRect?.width ?? POP_W_ESTIMATE;
      const popH = popRect?.height ?? POP_H_ESTIMATE;

      const wantTop = placement.startsWith('top');
      const wantRight = placement.endsWith('right');

      // 空间不足时翻转：上 → 下，下 → 上
      const fitsTop = rect.top - popH - GAP - VIEWPORT_MARGIN >= 0;
      const fitsBottom = rect.bottom + popH + GAP + VIEWPORT_MARGIN <= vh;
      const useTop = wantTop ? fitsTop : !fitsBottom;

      // 水平：以触发器哪一侧对齐
      let left: number;
      if (wantRight) {
        left = rect.right - popW;
        if (left < VIEWPORT_MARGIN) left = VIEWPORT_MARGIN;
        if (left + popW > vw - VIEWPORT_MARGIN) left = vw - popW - VIEWPORT_MARGIN;
      } else {
        left = rect.left;
        if (left + popW > vw - VIEWPORT_MARGIN) left = vw - popW - VIEWPORT_MARGIN;
        if (left < VIEWPORT_MARGIN) left = VIEWPORT_MARGIN;
      }

      const top = useTop
        ? rect.top - popH - GAP
        : rect.bottom + GAP;

      setCoords({ top, left });
    };

    computeRef.current = compute;
    compute();
    // 视口/任意祖先滚动都要重算：用 capture 监听到 document
    window.addEventListener('scroll', compute, true);
    window.addEventListener('resize', compute);
    return () => {
      window.removeEventListener('scroll', compute, true);
      window.removeEventListener('resize', compute);
    };
  }, [isOpen, placement]);

  /**
   * 气泡挂载后按真实尺寸复算一次。
   *
   * 首次 compute 时气泡还没渲染（coords 为 null 时不渲染），只能用估算宽高，
   * 而 placement=top 的 top 值等于 rect.top - popH，估算偏差会直接变成
   * 肉眼可见的错位（描述文案换行多一行就差十几像素）。这里等 DOM 真正挂上
   * 再量一次并纠正，同时用 ResizeObserver 跟住内容尺寸变化。
   */
  useLayoutEffect(() => {
    if (!isOpen || !coords) return;
    const el = popoverRef.current;
    if (!el) return;
    computeRef.current();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => computeRef.current());
    observer.observe(el);
    return () => observer.disconnect();
    // coords 变化不应重新订阅，只需在气泡从「未挂载」变为「已挂载」时执行一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, coords !== null]);

  // outside click + Escape：portal 之后事件路径分两段，分别判断
  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerWrapRef.current?.contains(t)) return;
      if (popoverRef.current?.contains(t)) return;
      setIsOpen(false);
      setCoords(null);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setIsOpen(false);
        setCoords(null);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen]);

  /** 统一关闭入口，确保坐标一起清空（含点击外部/Escape 之外的显式关闭） */
  const close = () => {
    setIsOpen(false);
    setCoords(null);
  };

  const handleTriggerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    if (isOpen) {
      close();
      return;
    }
    // 打开前先清空坐标：否则会先用上次的旧位置渲染一帧，看起来像气泡「跳」了一下
    setCoords(null);
    setIsOpen(true);
  };

  const handleConfirm = (e: React.MouseEvent) => {
    e.stopPropagation();
    onConfirm();
    close();
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    close();
  };

  const isDanger = type === 'danger';
  const isWarning = type === 'warning';

  const popoverNode = isOpen && coords ? (
    <div
      ref={popoverRef}
      onClick={e => e.stopPropagation()}
      className={`fixed z-[1000] w-72 sm:w-80 p-4 rounded-2xl bg-white border shadow-xl text-left animate-in fade-in zoom-in-95 duration-150 ${
        isDanger ? 'border-rose-200 shadow-rose-500/10' :
        isWarning ? 'border-amber-200 shadow-amber-500/10' :
        'border-slate-200 shadow-slate-500/10'
      }`}
      style={{ top: coords.top, left: coords.left }}
      role="alertdialog"
    >
      {/* Header & Icon */}
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center ${
          isDanger ? 'bg-rose-100 text-rose-600' :
          isWarning ? 'bg-amber-100 text-amber-600' :
          'bg-indigo-100 text-indigo-600'
        }`}>
          {isDanger ? (
            <Trash2 className="w-4 h-4" />
          ) : isWarning ? (
            <AlertTriangle className="w-4 h-4" />
          ) : (
            <HelpCircle className="w-4 h-4" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="text-xs font-bold text-slate-900 leading-tight">
            {title}
          </h4>
          {description && (
            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
              {description}
            </p>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-slate-100">
        <button
          type="button"
          onClick={handleCancel}
          className="px-3 py-1.5 rounded-xl text-[11px] font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
        >
          {cancelText}
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          className={`px-3.5 py-1.5 rounded-xl text-[11px] font-bold text-white transition-all shadow-xs active:scale-95 ${
            isDanger
              ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/20'
              : isWarning
              ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/20'
              : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20'
          }`}
        >
          {confirmText}
        </button>
      </div>
    </div>
  ) : null;

  return (
    <span className="relative inline-block" ref={triggerWrapRef}>
      {trigger({ onClick: handleTriggerClick, isOpen })}
      {typeof document !== 'undefined' && popoverNode
        ? createPortal(popoverNode, document.body)
        : null}
    </span>
  );
};
