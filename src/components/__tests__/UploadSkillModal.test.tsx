import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { api } from '../../services/api';
import { UploadSkillModal } from '../modals/UploadSkillModal';
import { makeUser } from '../../test/factories';

/**
 * UploadSkillModal 单测：表单校验 + 提交后回调 onSubmit。
 *
 * ZIP 解析走真实 JSZip（不在本用例范围：名称/简介手动填写即可触发提交）；
 * mock api（listSkillCategories → [] 走默认分类）、mock Select 为原生 <select>。
 */

vi.mock('../../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/api')>();
  const { createApiMock } = await import('../../test/helpers/mockApi');
  return { ...actual, api: createApiMock(actual.api) };
});

vi.mock('../ui/Select', async () => {
  const React = await import('react');
  return {
    Select: ({ size, variant, children, ...rest }: Record<string, unknown>) =>
      React.createElement('select', { ...rest } as Record<string, unknown>, children as React.ReactNode),
  };
});

function renderModal(
  props: Partial<React.ComponentProps<typeof UploadSkillModal>> = {},
) {
  const callbacks = {
    onSubmit: vi.fn(),
    onClose: vi.fn(),
    onToast: vi.fn(),
  };
  render(
    <UploadSkillModal
      currentUser={makeUser({ id: 'u1', name: '李测试' })}
      {...callbacks}
      {...props}
    />
  );
  return callbacks;
}

beforeEach(() => {
  vi.mocked(api.listSkillCategories).mockResolvedValue([]);
  vi.clearAllMocks();
});

describe('UploadSkillModal', () => {
  it('名称或简介为空时提交仅提示完善信息，不回调 onSubmit', () => {
    const { onSubmit, onToast } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: '提交发布申请' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onToast).toHaveBeenCalledWith('warning', '请完善信息', '技能名称不能为空');
  });

  it('填写名称与简介后提交：onSubmit 收到 pending 技能记录并关闭', () => {
    const { onSubmit, onClose } = renderModal();
    fireEvent.change(screen.getByPlaceholderText('例如：企业级 SQL 诊断智能体'), {
      target: { value: 'SQL 助手' },
    });
    fireEvent.change(screen.getByPlaceholderText(/用简洁的文字概括/), {
      target: { value: '自然语言转 SQL 查询' },
    });
    fireEvent.click(screen.getByRole('button', { name: '提交发布申请' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'SQL 助手',
        description: '自然语言转 SQL 查询',
        status: 'pending',
        category: 'coding',
        author: expect.objectContaining({ name: '李测试' }),
      })
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
