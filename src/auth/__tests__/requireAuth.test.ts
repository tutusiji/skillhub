import { beforeEach, describe, expect, it } from 'vitest';
import { requireAuth } from '../requireAuth';
import { useAuthStore } from '../../stores/authStore';
import { useUiStore } from '../../stores/uiStore';
import { useToastStore } from '../../stores/toastStore';
import { makeUser } from '../../test/factories';

/**
 * 登录守卫单测：未登录 → 打开登录弹窗（带引导文案）+ warning toast + 返回 false；
 * 已登录 → 返回 true 且不弹窗不 toast。跨 store 联动（auth/ui/toast）一并断言。
 */

const RESET_UI = {
  showUploadModal: false,
  showCreateDemandModal: false,
  showFeedbackModal: false,
  newVersionContext: null,
  editingSkill: null,
  showCommandPalette: false,
  showLoginModal: false,
  loginActionHint: undefined,
  detailLoading: false,
};

beforeEach(() => {
  useAuthStore.setState({ currentUser: null });
  useUiStore.setState(RESET_UI);
  useToastStore.setState({ toasts: [] });
});

describe('requireAuth', () => {
  it('未登录：打开登录弹窗并写入引导文案，返回 false', () => {
    const ok = requireAuth('发布新技能');
    expect(ok).toBe(false);
    expect(useUiStore.getState().showLoginModal).toBe(true);
    expect(useUiStore.getState().loginActionHint).toBe('发布新技能');
  });

  it('未登录：弹 warning toast 说明需要登录', () => {
    requireAuth('收藏技能');
    const toast = useToastStore.getState().toasts[0];
    expect(toast.type).toBe('warning');
    expect(toast.message).toContain('收藏技能');
  });

  it('已登录：返回 true 且不弹窗不 toast', () => {
    useAuthStore.setState({ currentUser: makeUser({ id: 'u1' }) });
    const ok = requireAuth('发布新技能');
    expect(ok).toBe(true);
    expect(useUiStore.getState().showLoginModal).toBe(false);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });
});
