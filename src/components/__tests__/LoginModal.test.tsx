import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { api } from '../../services/api';
import { LoginModal } from '../modals/LoginModal';
import { makeApiUser } from '../../test/factories';

/**
 * LoginModal 单测：账号密码登录 / 内部 OSS 单点登录 / 新账号注册。
 *
 * mock api（展开真实方法名逐一遍历），mapper 用真实实现（mapApiUser 保留）。
 * 断言：提交参数、token 写入 localStorage、成功回调 onLogin、失败错误提示。
 */

vi.mock('../../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/api')>();
  const { createApiMock } = await import('../../test/helpers/mockApi');
  return { ...actual, api: createApiMock(actual.api) };
});

const login = () => vi.mocked(api.login);
const ossLogin = () => vi.mocked(api.ossLogin);
const register = () => vi.mocked(api.register);

function renderLoginModal() {
  const onLogin = vi.fn();
  const onClose = vi.fn();
  render(<LoginModal isOpen onClose={onClose} onLogin={onLogin} />);
  return { onLogin, onClose };
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('LoginModal 账号密码登录', () => {
  it('提交后调用 api.login、写 token 并回调 onLogin', async () => {
    const { onLogin, onClose } = renderLoginModal();
    login().mockResolvedValue({
      token: 'tok-1',
      user: makeApiUser({ employeeId: '7462201', name: '李测试' }),
    });

    fireEvent.change(screen.getByPlaceholderText('例如：7462200'), {
      target: { value: '7462201' },
    });
    fireEvent.change(screen.getByPlaceholderText('请输入密码'), {
      target: { value: 'pass123' },
    });
    fireEvent.click(screen.getByRole('button', { name: '登录账号' }));

    await waitFor(() => expect(onLogin).toHaveBeenCalledTimes(1));
    expect(login()).toHaveBeenCalledWith('7462201', 'pass123');
    expect(localStorage.getItem('skillhub_token')).toBe('tok-1');
    // 登录成功后关闭弹窗
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('失败时展示错误信息，不回调 onLogin', async () => {
    const { onLogin } = renderLoginModal();
    login().mockRejectedValue(new Error('账号或密码错误'));

    fireEvent.change(screen.getByPlaceholderText('例如：7462200'), {
      target: { value: 'admin' },
    });
    fireEvent.change(screen.getByPlaceholderText('请输入密码'), {
      target: { value: 'wrong' },
    });
    fireEvent.click(screen.getByRole('button', { name: '登录账号' }));

    await waitFor(() =>
      expect(screen.getByText('账号或密码错误')).toBeInTheDocument()
    );
    expect(onLogin).not.toHaveBeenCalled();
  });
});

describe('LoginModal 内部 OSS 单点登录', () => {
  it('切到 OSS 页签，提交后调用 api.ossLogin', async () => {
    const { onLogin } = renderLoginModal();
    ossLogin().mockResolvedValue({
      token: 'tok-2',
      user: makeApiUser({ employeeId: '7462202', name: '王测试' }),
    });

    fireEvent.click(screen.getByRole('button', { name: /内部 OSS 登录/ }));
    fireEvent.change(screen.getByPlaceholderText('例如：7462200'), {
      target: { value: '7462202' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'OSS 免密登录' }));

    await waitFor(() => expect(onLogin).toHaveBeenCalledTimes(1));
    expect(ossLogin()).toHaveBeenCalledWith('7462202');
  });
});

describe('LoginModal 新账号注册', () => {
  it('提交后调用 api.register，成功后自动登录并关闭', async () => {
    const { onLogin } = renderLoginModal();
    register().mockResolvedValue({
      token: 'tok-r',
      user: makeApiUser({ employeeId: '7462203', name: '林悦' }),
    });

    fireEvent.click(screen.getByRole('button', { name: /新账号注册/ }));
    fireEvent.change(screen.getByPlaceholderText('例如：7462200'), {
      target: { value: '7462203' },
    });
    fireEvent.change(screen.getByPlaceholderText('例如：林悦 (AI安全组)'), {
      target: { value: '林悦' },
    });
    fireEvent.change(screen.getByPlaceholderText('设置安全密码'), {
      target: { value: 'pass123' },
    });
    fireEvent.click(screen.getByRole('button', { name: '立即完成注册' }));

    await waitFor(() => expect(register()).toHaveBeenCalledTimes(1));
    expect(register()).toHaveBeenCalledWith({
      employeeId: '7462203',
      name: '林悦',
      password: 'pass123',
      department: '企业应用研发部',
      email: undefined,
    });
    // 注册成功 1s 后自动登录并关闭
    await waitFor(() => expect(onLogin).toHaveBeenCalledTimes(1), { timeout: 2000 });
    expect(localStorage.getItem('skillhub_token')).toBe('tok-r');
  });
});
