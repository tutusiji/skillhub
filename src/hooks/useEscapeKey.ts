import { useEffect } from 'react';

/**
 * 监听全局 Escape 按键，并在按下时调用 onClose。
 *
 * - 仅在 active 为 true 时挂载监听，避免无谓触发。
 * - 依赖 onClose；当调用方每次渲染都返回新函数时会重复挂载，使用方应自行 memo。
 * - 与 src/components/Modal.tsx 中的 ESC 行为保持一致（防重复触发留给 onClose 内部去抖）。
 */
export function useEscapeKey(onClose: () => void, active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, onClose]);
}
