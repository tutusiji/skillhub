import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { api } from '../../services/api';
import { AppModals } from '../layout/AppModals';
import { useUiStore } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
import { makeUser } from '../../test/factories';

/**
 * AppModals 单测：全局弹窗挂载点的「状态 → 弹窗」门控。
 *
 * 弹窗可见性/上下文收敛在 uiStore，登录态在 authStore；本组件自读 store 挂载各弹窗。
 * 断言：全关不渲染、登录弹窗/上传弹窗/⌘K 面板按状态正确挂载、上传弹窗受登录门控。
 * mock api（LoginModal/UploadSkillModal 等直接依赖 api）。
 */

vi.mock('../../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/api')>();
  const { createApiMock } = await import('../../test/helpers/mockApi');
  return { ...actual, api: createApiMock(actual.api) };
});

function resetUi() {
  useUiStore.setState({
    showLoginModal: false,
    showUploadModal: false,
    showCreateDemandModal: false,
    showFeedbackModal: false,
    showCommandPalette: false,
    editingSkill: null,
    newVersionContext: null,
  });
  useAuthStore.setState({ currentUser: null });
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  resetUi();
  // UploadSkillModal 打开时拉取分类；mock 成空走常量兜底
  vi.mocked(api.listSkillCategories).mockResolvedValue([]);
});

describe('AppModals 全局弹窗挂载点', () => {
  it('全部弹窗关闭时不渲染任何弹窗', () => {
    render(<AppModals />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('showLoginModal 打开时挂载登录弹窗', () => {
    useUiStore.setState({ showLoginModal: true });
    render(<AppModals />);
    expect(screen.getByPlaceholderText('例如：7462200')).toBeInTheDocument();
  });

  it('showUploadModal 未登录时不上传弹窗（登录门控）', () => {
    useUiStore.setState({ showUploadModal: true });
    render(<AppModals />);
    expect(screen.queryByText('点击选择或将 ZIP 拖拽到此处')).not.toBeInTheDocument();
  });

  it('showUploadModal + 登录态时挂载上传弹窗', () => {
    useAuthStore.setState({ currentUser: makeUser() });
    useUiStore.setState({ showUploadModal: true });
    render(<AppModals />);
    expect(screen.getByText('点击选择或将 ZIP 拖拽到此处')).toBeInTheDocument();
  });

  it('showCommandPalette 打开时挂载 ⌘K 命令面板', () => {
    useUiStore.setState({ showCommandPalette: true });
    render(<AppModals />);
    expect(
      screen.getByPlaceholderText('搜索技能名称、包标识 (@skillhub/...) 或作者...')
    ).toBeInTheDocument();
  });
});
