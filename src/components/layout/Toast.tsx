import React from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { ToastMessage } from '../../types';

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2.5 max-w-md w-full pointer-events-none">
      {toasts.map((toast) => {
        let icon = <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />;
        let borderColor = 'border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/95 dark:bg-emerald-950/90 text-emerald-950 dark:text-emerald-100';

        if (toast.type === 'error') {
          icon = <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />;
          borderColor = 'border-rose-200 dark:border-rose-800/60 bg-rose-50/95 dark:bg-rose-950/90 text-rose-950 dark:text-rose-100';
        } else if (toast.type === 'warning') {
          icon = <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />;
          borderColor = 'border-amber-200 dark:border-amber-800/60 bg-amber-50/95 dark:bg-amber-950/90 text-amber-950 dark:text-amber-100';
        } else if (toast.type === 'info') {
          icon = <Info className="w-5 h-5 text-indigo-600 shrink-0" />;
          borderColor = 'border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/95 dark:bg-indigo-950/90 text-indigo-950 dark:text-indigo-100';
        }

        return (
          <div
            key={toast.id}
            id={`toast-${toast.id}`}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-lg backdrop-blur-md transition-all animate-in fade-in slide-in-from-bottom-3 duration-200 ${borderColor}`}
          >
            {icon}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold tracking-tight">{toast.title}</div>
              <div className="text-xs mt-0.5 opacity-90 leading-relaxed break-words">{toast.message}</div>
            </div>
            <button
              onClick={() => onDismiss(toast.id)}
              className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
              title="关闭通知"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
