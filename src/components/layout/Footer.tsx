import { useRouterStore } from '../../stores/routerStore';
import { useAuthStore } from '../../stores/authStore';
import { useUiStore } from '../../stores/uiStore';
import { useSkillsStore } from '../../stores/skillsStore';
import { useRulesStore } from '../../stores/rulesStore';
import { usePermissions } from '../../auth/usePermissions';
import { requireAuth } from '../../auth/requireAuth';

/**
 * 站点页脚：后端连接状态点 + 风控驱动信息 + 快捷导航（征集广场 / 风控中心 /
 * 个人中心 / 全站建议反馈）。全部直读 store，App 层不再逐项透传
 * （与 Header 的 store 直读策略一致）。
 */
export function Footer() {
  const navigate = useRouterStore((s) => s.navigate);
  const currentUser = useAuthStore((s) => s.currentUser);
  const backendOnline = useSkillsStore((s) => s.backendOnline);
  const deepseekConfig = useRulesStore((s) => s.deepseekConfig);
  const openFeedbackModal = useUiStore((s) => s.openFeedbackModal);
  const { canAccessRules } = usePermissions();
  return (
    <footer className="border-t border-slate-200 bg-white py-8 px-4 text-xs text-slate-500 text-center">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-800">SkillHub 企业内网 AI 技能市场</span>
          {/* 后端连接状态点：绿=已连接 / 琥珀=离线（演示数据） / 灰色闪烁=连接中 */}
          <span
            className={`w-1.5 h-1.5 rounded-full ${backendOnline === false ? 'bg-amber-400' : backendOnline ? 'bg-emerald-500' : 'bg-slate-300 animate-pulse'}`}
            title={backendOnline === false ? '后端离线：当前使用本地演示数据' : backendOnline ? '企业后端已连接' : '正在连接企业后端'}
          />
          <span>风控中心 v3.4 (驱动: {deepseekConfig.modelName || '未配置'})</span>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('demands')}
            className="hover:text-indigo-600 transition-colors font-medium"
          >
            征集广场
          </button>
          <span>·</span>
          {canAccessRules && (
            <>
              <button
                onClick={() => navigate('rules')}
                className="hover:text-indigo-600 transition-colors font-medium"
              >
                风控中心
              </button>
              <span>·</span>
            </>
          )}
          {currentUser && (
            <>
              <button
                onClick={() => navigate('personal')}
                className="hover:text-indigo-600 transition-colors font-medium"
              >
                个人中心
              </button>
              <span>·</span>
            </>
          )}
          <button
            onClick={() => {
              if (requireAuth('提交全站反馈')) {
                openFeedbackModal();
              }
            }}
            className="hover:text-indigo-600 transition-colors font-medium"
          >
            全站建议与体验反馈
          </button>
        </div>
      </div>
    </footer>
  );
}

