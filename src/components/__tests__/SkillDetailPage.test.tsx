import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { api } from '../../services/api';
import { SkillDetailPage } from '../views/SkillDetailPage';
import { makeApiSkill, makeSkill } from '../../test/factories';

/**
 * SkillDetailPage 单测：返回按钮 / 版本选择器（仅 owner/admin 可见）/
 * 版本切换同步 URL / tab 切换。
 *
 * mock api（createApiMock 保留真实 mapper mapApiSkill）、mock Select 为原生
 * <select>、mock canvas-confetti（SkillCard/详情页彩带依赖，jsdom 无 canvas）。
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

const getVersions = () => vi.mocked(api.getSkillVersions);

function renderDetail(
  props: Partial<React.ComponentProps<typeof SkillDetailPage>> = {},
) {
  const callbacks = {
    onBack: vi.fn(),
    onToggleStar: vi.fn(),
    onToggleLike: vi.fn(),
    onDownloadZip: vi.fn(),
    onCopySuccess: vi.fn(),
  };
  render(
    <SkillDetailPage
      skill={makeSkill({ id: 's1', slug: '@skillhub/demo-1', name: '演示技能' })}
      {...callbacks}
      {...props}
    />
  );
  return callbacks;
}

beforeEach(() => {
  getVersions().mockReset();
  // 默认单版本（链长 1 → 不显示版本选择器）。版本链接口返回 ApiSkill 形状
  // （author 为 string），必须用 makeApiSkill，否则 mapApiSkill 抛错、
  // effect 的 .catch 会把 versions 置 null。
  getVersions().mockResolvedValue([makeApiSkill({ id: 's1', version: 'v1.0.0' })]);
  vi.clearAllMocks();
});

describe('SkillDetailPage 基础渲染', () => {
  it('渲染技能名与返回按钮，点击返回触发 onBack', () => {
    const callbacks = renderDetail();
    expect(screen.getByText('演示技能')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '返回技能集市' }));
    expect(callbacks.onBack).toHaveBeenCalledTimes(1);
  });

  it('默认展示 README tab，可切换到「多端安装指令」', () => {
    renderDetail();
    fireEvent.click(screen.getByRole('button', { name: '多端安装指令' }));
    // 安装页出现客户端切换标签
    expect(screen.getByText(/选择客户端进行一键安装/)).toBeInTheDocument();
  });
});

describe('SkillDetailPage 版本选择器', () => {
  it('普通用户（非 owner/admin）不拉取版本链、不显示版本选择器', () => {
    renderDetail({ currentUser: { id: 'other-user', role: 'user' } });
    expect(getVersions()).not.toHaveBeenCalled();
    expect(screen.queryByText('版本')).not.toBeInTheDocument();
  });

  it('管理员可见版本选择器，切换版本回调 onSelectVersion 并同步 ?v= URL', async () => {
    getVersions().mockResolvedValue([
      makeApiSkill({ id: 'v1', version: 'v1.0.0', status: 'archived' }),
      makeApiSkill({ id: 'v2', version: 'v2.0.0' }),
    ]);
    const onSelectVersion = vi.fn();
    renderDetail({
      currentUser: { id: 'admin-1', role: 'admin' },
      onSelectVersion,
    });

    // 版本选择器出现（标题区分于其他下拉）
    const select = await screen.findByTitle('切换到该技能链上的其他历史版本');
    expect(select).toBeInTheDocument();

    fireEvent.change(select, { target: { value: 'v2' } });
    await waitFor(() =>
      expect(onSelectVersion).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'v2', version: 'v2.0.0' }),
      )
    );
    expect(window.location.search).toContain('v=v2');
  });

  it('作者本人（submitterId 匹配）可见版本选择器', async () => {
    getVersions().mockResolvedValue([
      makeApiSkill({ id: 'v1', version: 'v1.0.0' }),
      makeApiSkill({ id: 'v2', version: 'v2.0.0' }),
    ]);
    renderDetail({
      skill: makeSkill({ id: 's1', submitterId: 'u-42' }),
      currentUser: { id: 'u-42', role: 'user' },
      // 选择器渲染还要求 onSelectVersion 存在（与 App 层透传一致）
      onSelectVersion: vi.fn(),
    });
    expect(
      await screen.findByTitle('切换到该技能链上的其他历史版本')
    ).toBeInTheDocument();
  });
});
