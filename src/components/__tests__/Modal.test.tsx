import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Modal } from '../ui/Modal';

/**
 * Modal 组件单测：进入/退场动画 + 滚动锁定 + ESC / 背景点击关闭。
 *
 * 关键行为（Modal.tsx 实现契约）：
 *  - isOpen=false 时不立即卸载，等 200ms 退场动画播完才真正卸载；
 *  - ESC 只对最顶层弹窗生效（modalStack 判定），回调同步触发；
 *  - 背景点击可关（closeOnBackdrop 默认 true）。
 *
 * 退场用真实计时器 + waitFor（计划约定：不用 fake timers）。
 */
const content = <div>弹窗内容</div>;
describe('Modal', () => {
  it('isOpen=true 时渲染对话框与内容', () => {
    render(
      <Modal isOpen onClose={() => {}}>
        {content}
      </Modal>
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('弹窗内容')).toBeInTheDocument();
  });

  it('isOpen=false 时不渲染', () => {
    render(
      <Modal isOpen={false} onClose={() => {}}>
        {content}
      </Modal>
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('关闭时先播退场动画再卸载（200ms 后从 DOM 移除）', async () => {
    const { rerender } = render(
      <Modal isOpen onClose={() => {}}>
        {content}
      </Modal>
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    rerender(
      <Modal isOpen={false} onClose={() => {}}>
        {content}
      </Modal>
    );
    // 退场动画期间仍然挂载（不立即消失）
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('按 Escape 触发 onClose', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose}>
        {content}
      </Modal>
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closeOnEscape=false 时不响应 Escape', async () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} closeOnEscape={false}>
        {content}
      </Modal>
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    await new Promise((r) => setTimeout(r, 260));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('点击背景触发 onClose（默认 closeOnBackdrop=true）', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose}>
        {content}
      </Modal>
    );
    // backdrop 是 dialog 容器的第一个子元素（fixed inset-0，aria-hidden）
    const dialog = screen.getByRole('dialog');
    const backdrop = dialog.firstChild as Element;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('点击面板本身不触发关闭（stopPropagation）', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose}>
        {content}
      </Modal>
    );
    fireEvent.click(screen.getByText('弹窗内容'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closeOnBackdrop=false 时点背景不关闭', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} closeOnBackdrop={false}>
        {content}
      </Modal>
    );
    const dialog = screen.getByRole('dialog');
    const backdrop = dialog.firstChild as Element;
    fireEvent.click(backdrop);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('渲染 header 插槽时提供关闭按钮', () => {
    render(
      <Modal isOpen onClose={() => {}} header={<span>标题栏</span>}>
        {content}
      </Modal>
    );
    expect(screen.getByText('标题栏')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '关闭' })).toBeInTheDocument();
  });

  it('点击标题栏关闭按钮触发 onClose', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} header={<span>标题栏</span>}>
        {content}
      </Modal>
    );
    fireEvent.click(screen.getByRole('button', { name: '关闭' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

