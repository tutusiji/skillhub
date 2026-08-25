import * as React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('SkillHub uncaught error:', error, errorInfo);
  }

  handleReset = () => {
    // 业务数据以数据库为准，本地仅保留认证令牌；重置即清掉会话令牌回到访客态并刷新
    localStorage.removeItem('skillhub_token');
    localStorage.removeItem('skillhub_user');
    // 清理历史版本的业务数据缓存残留，避免旧数据干扰
    localStorage.removeItem('skillhub_skills');
    localStorage.removeItem('skillhub_rules');
    localStorage.removeItem('skillhub_feedback');
    localStorage.removeItem('skillhub_demands');
    localStorage.removeItem('skillhub_all_users');
    localStorage.removeItem('skillhub_deepseek');
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-slate-900 font-sans">
          <div className="max-w-md w-full bg-white p-8 rounded-3xl border border-slate-200 shadow-xl text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center font-bold text-lg mx-auto">
              !
            </div>
            <h1 className="text-lg font-bold text-slate-900">应用运行遇到轻微异常</h1>
            <p className="text-xs text-slate-500 leading-relaxed">
              可能是由于旧版本数据缓存冲突。您可以点击下方按钮重置并刷新应用。
            </p>
            {this.state.error && (
              <div className="p-3 rounded-xl bg-slate-100 text-left font-mono text-[11px] text-slate-700 overflow-x-auto">
                {this.state.error.message}
              </div>
            )}
            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
              >
                直接重载
              </button>
              <button
                onClick={this.handleReset}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-md active:scale-95"
              >
                重置缓存并恢复
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);



