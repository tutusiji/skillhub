import { create } from 'zustand';
import type { ToastMessage } from '../types';

/**
 * 全局 Toast 通知 store。
 * 依赖 DAG 最底层（无任何上游依赖），被几乎所有业务 store 与 App 层引用。
 * addToast 自带 4500ms 自动移除（与原 App.tsx 实现一致）；
 * 由于 setTimeout 在组件外触发 set，需由调用方保证组件已卸载时更新无副作用
 * （zustand 的 set 对未挂载组件无影响，仅更新全局状态）。
 */
const TOAST_AUTO_DISMISS_MS = 4500;

interface ToastState {
  toasts: ToastMessage[];
  /** 追加一条通知并排定自动移除（4.5s） */
  addToast: (type: ToastMessage['type'], title: string, message: string) => void;
  /** 立即移除指定 id 的通知（Toast 关闭按钮使用） */
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (type, title, message) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    const newToast: ToastMessage = { id, type, title, message };
    set((state) => ({ toasts: [...state.toasts, newToast] }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, TOAST_AUTO_DISMISS_MS);
  },
  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },
}));
