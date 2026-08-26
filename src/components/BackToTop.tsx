import React, { useState, useEffect } from 'react';
import { ChevronUp, MessageSquare } from 'lucide-react';

interface BackToTopProps {
  onOpenFeedback: () => void;
  /** 建议中心按钮是否可见（仅管理员） */
  showSuggestionButton?: boolean;
}

export const BackToTop: React.FC<BackToTopProps> = ({ onOpenFeedback, showSuggestionButton = true }) => {
  const [visible, setVisible] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (totalHeight > 0) {
        const currentProgress = (window.scrollY / totalHeight) * 100;
        setScrollProgress(currentProgress);
      }
      if (window.scrollY > 260) {
        setVisible(true);
      } else {
        setVisible(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  return (
    // 全局悬浮：固定在主内容右侧（右下角偏上），所有页面始终存在、不随内容滚动
    <div className="fixed bottom-24 right-6 z-40 flex flex-col gap-2.5 items-center">
      {/* 建议反馈悬浮按钮（全员可见）——竖向文字样式 */}
      {showSuggestionButton && (
        <button
          onClick={onOpenFeedback}
          id="btn-floating-feedback"
          className="flex flex-col items-center gap-2 px-2.5 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl hover:shadow-2xl hover:border-indigo-400 dark:hover:border-indigo-600 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-all active:scale-95 group"
          title="建议与反馈"
        >
          <MessageSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform" />
          <span className="[writing-mode:vertical-rl] tracking-widest leading-none">
            建议反馈
          </span>
        </button>
      )}

      {/* Back to top with progress ring */}
      {visible && (
        <button
          onClick={scrollToTop}
          id="btn-back-to-top"
          className="relative flex items-center justify-center w-11 h-11 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xl hover:shadow-2xl transition-all active:scale-90 animate-in fade-in slide-in-from-bottom-2 duration-200"
          title="返回顶部"
        >
          <ChevronUp className="w-5 h-5" />
          <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none p-0.5">
            <circle
              cx="20"
              cy="20"
              r="17"
              className="text-transparent"
              strokeWidth="2"
              fill="none"
            />
            <circle
              cx="20"
              cy="20"
              r="17"
              className="text-indigo-500 transition-all duration-75"
              stroke="currentColor"
              strokeWidth="2"
              strokeDasharray={106}
              strokeDashoffset={106 - (106 * scrollProgress) / 100}
              fill="none"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}
    </div>
  );
};
