import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { api } from '../../services/api';
import { MarketplaceView } from '../views/MarketplaceView';
import { makeSkill, makeUser } from '../../test/factories';

/**
 * MarketplaceView 单测：仅渲染 approved 技能 / 加载骨架 / 空态 /
 * 分类专家组管理按钮权限 / 精选卡片点击 / 搜索过滤。
 *
 * mock api（listSkillCategories → [] 走常量兜底，且避免 setCategories(undefined)
 * 触发 categories.length 崩溃）、mock Select 为原生 <select>、
 * mock canvas-confetti（SkillCard 依赖，jsdom 无 canvas）。
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

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

function renderView(
  props: Partial<React.ComponentProps<typeof MarketplaceView>> = {},
) {
  const callbacks = {
    onSelectSkill: vi.fn(),
    onOpenUpload: vi.fn(),
    onToggleStar: vi.fn(),
    onToggleLike: vi.fn(),
    onDownloadZip: vi.fn(),
    onCopyInstallCmd: vi.fn(),
  };
  render(<MarketplaceView skills={[]} {...callbacks} {...props} />);
  return callbacks;
}

beforeEach(() => {
  vi.mocked(api.listSkillCategories).mockResolvedValue([]);
  vi.clearAllMocks();
});

describe('MarketplaceView 技能列表', () => {
  it('只渲染 approved 技能，隐藏 pending/rejected/offline', () => {
    renderView({
      skills: [
        makeSkill({ id: 's1', name: '已上架技能', status: 'approved' }),
        makeSkill({ id: 's2', name: '待审核技能', status: 'pending' }),
        makeSkill({ id: 's3', name: '已驳回技能', status: 'rejected' }),
        makeSkill({ id: 's4', name: '已下架技能', status: 'offline' }),
      ],
    });
    expect(screen.getAllByText('已上架技能').length).toBeGreaterThan(0);
    expect(screen.queryByText('待审核技能')).not.toBeInTheDocument();
    expect(screen.queryByText('已驳回技能')).not.toBeInTheDocument();
    expect(screen.queryByText('已下架技能')).not.toBeInTheDocument();
  });

  it('首次加载中显示骨架屏提示（加载中…）', () => {
    renderView({ skills: [], isLoading: true });
    expect(screen.getByText('加载中…')).toBeInTheDocument();
  });

  it('无匹配技能时显示空态', () => {
    renderView({ skills: [], isLoading: false });
    expect(screen.getByText('未找到匹配的技能或插件')).toBeInTheDocument();
  });

  it('点击精选卡片触发 onSelectSkill', () => {
    const callbacks = renderView({
      skills: [makeSkill({ id: 's1', name: '热门技能', status: 'approved' })],
    });
    fireEvent.click(screen.getAllByText('热门技能')[0]);
    expect(callbacks.onSelectSkill).toHaveBeenCalledTimes(1);
  });

  it('搜索框过滤后集市数量更新为 1 款', () => {
    renderView({
      skills: [
        // 注意：approvedSkills 按 slug 去重（同一插件多版本只展示一张卡），
        // 两个技能必须给不同 slug，否则会被折叠成 1 款。
        makeSkill({ id: 's1', slug: 'sql-assistant', name: 'SQL 助手', status: 'approved' }),
        makeSkill({ id: 's2', slug: 'report-builder', name: '报表生成器', status: 'approved' }),
      ],
    });
    // 集市数量徽标是 {count} 款（数字与「款」是两个文本节点），
    // 用函数匹配器取归一化后的直连文本，精确等于「2 款」，
    // 避免误中 hero 区的「2 款插件」徽标。
    expect(
      screen.getByText((content, el) => el?.tagName === 'SPAN' && content === '2 款')
    ).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/搜索技能名称/), {
      target: { value: 'SQL' },
    });
    expect(
      screen.getByText((content, el) => el?.tagName === 'SPAN' && content === '1 款')
    ).toBeInTheDocument();
  });
});

describe('MarketplaceView 分类和专家组管理入口', () => {
  it('canAccessManage=true 时显示入口并回调 onOpenManage', () => {
    const onOpenManage = vi.fn();
    renderView({ canAccessManage: true, onOpenManage });
    fireEvent.click(screen.getByRole('button', { name: '分类和专家组管理' }));
    expect(onOpenManage).toHaveBeenCalledTimes(1);
  });

  it('普通用户且无菜单权限时不显示入口', () => {
    renderView({ currentUser: makeUser({ id: 'u1', role: 'user' }) });
    expect(screen.queryByText('分类和专家组管理')).not.toBeInTheDocument();
  });
});
