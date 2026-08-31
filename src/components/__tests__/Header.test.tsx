import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Header } from '../layout/Header';
import { useRouterStore } from '../../stores/routerStore';
import { useAuthStore } from '../../stores/authStore';
import { useSkillsStore } from '../../stores/skillsStore';
import { useDemandsStore } from '../../stores/demandsStore';
import { makeDemand, makeSkill, makeUser } from '../../test/factories';

/**
 * Header 组件单测：RBAC 分支导航 + 待审计数徽标 + 用户菜单。
 *
 * Header 已改为直读 store（router/auth/skills/demands）并从 usePermissions
 * 派生菜单权限，测试通过 useXStore.setState 预置登录态与数据。
 * jsdom 无媒体查询，桌面 nav 与底部移动 nav 都会渲染，文本断言一律用
 * getAllByText（避免「征集广场」等同时出现在两处导致的重复匹配）。
 */

const renderHeader = (props: Partial<React.ComponentProps<typeof Header>> = {}) => {
  const callbacks = {
    onSelectTab: vi.fn(),
    onOpenUpload: vi.fn(),
    onOpenCommandPalette: vi.fn(),
    onOpenLogin: vi.fn(),
    onLogout: vi.fn(),
  };
  render(<Header {...callbacks} {...props} />);
  return callbacks;
};

const expectInDoc = (text: string) =>
  expect(screen.getAllByText(text).length).toBeGreaterThan(0);
const expectNotInDoc = (text: string) =>
  expect(screen.queryAllByText(text)).toHaveLength(0);

beforeEach(() => {
  useRouterStore.setState({ currentTab: 'market', previousTab: 'market' });
  useAuthStore.setState({
    currentUser: null,
    authResolved: true,
    allUsers: [],
    _sessionRestoreStarted: false,
  });
  useSkillsStore.setState({ skills: [] });
  useDemandsStore.setState({ demands: [] });
});

describe('Header 未登录', () => {
  it('显示登录按钮，不显示个人中心/审核管理/风控中心', () => {
    renderHeader();
    expect(screen.getByRole('button', { name: '登录账号' })).toBeInTheDocument();
    expectNotInDoc('审核管理');
    expectNotInDoc('风控中心');
    // 个人中心按钮仅登录后渲染
    expect(screen.queryByRole('button', { name: /个人中心/ })).not.toBeInTheDocument();
  });

  it('点击技能集市触发 onSelectTab("market")', () => {
    const callbacks = renderHeader();
    fireEvent.click(screen.getByRole('button', { name: '技能集市' }));
    expect(callbacks.onSelectTab).toHaveBeenCalledWith('market');
  });
});

describe('Header 超级管理员', () => {
  beforeEach(() => {
    useAuthStore.setState({
      currentUser: makeUser({ id: 'admin-1', role: 'super_admin', name: '系统管理员' }),
      authResolved: true,
    });
  });

  it('显示审核管理/风控中心导航', () => {
    renderHeader();
    expectInDoc('审核管理');
    expectInDoc('风控中心');
  });

  it('用户菜单包含 权限设置 / 建议管理 / 分类和专家组管理', () => {
    renderHeader();
    fireEvent.click(screen.getByRole('button', { name: /系统管理员/ }));
    expectInDoc('权限设置');
    expectInDoc('建议管理');
    expectInDoc('分类和专家组管理');
  });

  it('待审计数徽标 = 待审技能 + 待审需求', () => {
    useSkillsStore.setState({
      skills: [
        makeSkill({ id: 's1', status: 'pending' }),
        makeSkill({ id: 's2', status: 'pending' }),
        makeSkill({ id: 's3', status: 'approved' }),
      ],
    });
    useDemandsStore.setState({ demands: [makeDemand({ id: 'd1', status: 'pending' })] });
    renderHeader();
    // 桌面「审核管理」按钮内出现总数徽标（2+1=3）
    const auditBtn = screen.getByRole('button', { name: /审核管理/ });
    expect(auditBtn).toHaveTextContent('3');
  });

  it('退出登录触发 onLogout', () => {
    const callbacks = renderHeader();
    fireEvent.click(screen.getByRole('button', { name: /系统管理员/ }));
    fireEvent.click(screen.getByText('退出当前登录'));
    expect(callbacks.onLogout).toHaveBeenCalledTimes(1);
  });
});

describe('Header admin 按菜单权限逐项控制', () => {
  it('menuPermissions=["audit"]：显示审核管理，不显示风控中心', () => {
    useAuthStore.setState({
      currentUser: makeUser({ id: 'admin-2', role: 'admin', menuPermissions: ['audit'] }),
      authResolved: true,
    });
    renderHeader();
    expectInDoc('审核管理');
    expectNotInDoc('风控中心');
  });

  it('menuPermissions=["rules"]：显示风控中心，不显示审核管理', () => {
    useAuthStore.setState({
      currentUser: makeUser({ id: 'admin-3', role: 'admin', menuPermissions: ['rules'] }),
      authResolved: true,
    });
    renderHeader();
    expectInDoc('风控中心');
    expectNotInDoc('审核管理');
  });
});
