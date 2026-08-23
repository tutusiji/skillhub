import React, { useState, useRef, useEffect } from 'react';
import { AlertTriangle, Trash2, ArrowDownCircle, Info, HelpCircle } from 'lucide-react';

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
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleTriggerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    setIsOpen(prev => !prev);
  };

  const handleConfirm = (e: React.MouseEvent) => {
    e.stopPropagation();
    onConfirm();
    setIsOpen(false);
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
  };

  const isDanger = type === 'danger';
  const isWarning = type === 'warning';

  // Placement class map
  const placementClasses = {
    'top-right': 'bottom-full right-0 mb-2',
    'top-left': 'bottom-full left-0 mb-2',
    'bottom-right': 'top-full right-0 mt-2',
    'bottom-left': 'top-full left-0 mt-2'
  };

  return (
    <div className="relative inline-block" ref={containerRef}>
      {trigger({ onClick: handleTriggerClick, isOpen })}

      {isOpen && (
        <div 
          onClick={e => e.stopPropagation()}
          className={`absolute z-50 w-72 sm:w-80 p-4 rounded-2xl bg-white border shadow-xl text-left animate-in fade-in zoom-in-95 duration-150 ${placementClasses[placement]} ${
            isDanger ? 'border-rose-200 shadow-rose-500/10' :
            isWarning ? 'border-amber-200 shadow-amber-500/10' :
            'border-slate-200 shadow-slate-500/10'
          }`}
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
      )}
    </div>
  );
};
