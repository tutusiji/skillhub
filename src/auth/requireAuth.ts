import { useAuthStore } from '../stores/authStore';
import { useUiStore } from '../stores/uiStore';
import { useToastStore } from '../stores/toastStore';

/**
 * 登录守卫：未登录时打开登录弹窗（带操作引导文案）并 toast 提示，返回 false；
 * 已登录返回 true。供视图与 App 层的「需要登录才能进行」的操作前置判断复用
 * （迁移自 App.tsx 的 requireAuth 局部函数）。
 * 依赖 DAG：→ authStore, uiStore, toastStore（均为叶子或低层 store，无环）。
 */
export function requireAuth(actionName: string): boolean {
  const { currentUser } = useAuthStore.getState();
  if (!currentUser) {
    useUiStore.getState().openLoginModal(actionName);
    useToastStore
      .getState()
      .addToast(
        'warning',
        '请先登录',
        `未登录状态下仅支持下载源码和复制安装指令，${actionName}需要登录企业账号`,
      );
    return false;
  }
  return true;
}
