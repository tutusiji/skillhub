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
    // 页头技能名 + README tab 默认渲染的 `## 演示技能` 标题（markdown 渲染后
    // 成为真正的 <h2>）都会命中，用 getAllByText 断言「至少出现技能名」。
    expect(screen.getAllByText('演示技能').length).toBeGreaterThan(0);
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

describe('SkillDetailPage 使用说明 (README)', () => {
  it('fileTree 含 README.md 时直接展示其原文，而非 readme 摘要', () => {
    renderDetail({
      skill: makeSkill({
        readme: '旧摘要：仅一行简介',
        fileTree: [
          {
            id: 'readme',
            name: 'README.md',
            path: 'README.md',
            type: 'file',
            content: '# 真实使用文档\n\n## 安装步骤\n1. 执行安装命令',
          },
        ],
      }),
    });
    // README tab 是默认页：展示技能包内 README.md 的真实内容
    expect(screen.getByText(/真实使用文档/)).toBeInTheDocument();
    expect(screen.getByText(/安装步骤/)).toBeInTheDocument();
    // 不展示上传时生成的 readme 摘要
    expect(screen.queryByText(/旧摘要/)).not.toBeInTheDocument();
  });

  it('README 在子目录（docs/README.md）同样命中', () => {
    renderDetail({
      skill: makeSkill({
        readme: '摘要',
        fileTree: [
          {
            id: 'd1',
            name: 'docs',
            path: 'docs',
            type: 'directory',
            children: [
              {
                id: 'r1',
                name: 'README.md',
                path: 'docs/README.md',
                type: 'file',
                content: '子目录里的文档正文',
              },
            ],
          },
        ],
      }),
    });
    expect(screen.getByText(/子目录里的文档正文/)).toBeInTheDocument();
  });

  it('fileTree 无说明文档时回退到 readme 摘要', () => {
    renderDetail({
      skill: makeSkill({
        readme: '回退摘要内容',
        fileTree: [
          {
            id: 's1',
            name: 'main.ts',
            path: 'src/main.ts',
            type: 'file',
            content: 'console.log(1)',
          },
        ],
      }),
    });
    expect(screen.getByText('回退摘要内容')).toBeInTheDocument();
  });

  it('纯技能（仅 SKILL.md）展示正文，剥离顶部 YAML frontmatter', () => {
    renderDetail({
      skill: makeSkill({
        readme: '旧摘要',
        fileTree: [
          {
            id: 's1',
            name: 'SKILL.md',
            path: 'SKILL.md',
            type: 'file',
            content:
              '---\nname: my-skill\ndescription: 元数据\nalowed-tools:\n  - Read\n---\n\n# 技能使用说明\n\n调用方式……',
          },
        ],
      }),
    });
    // 展示 SKILL.md 正文而非 frontmatter 元数据
    expect(screen.getByText(/技能使用说明/)).toBeInTheDocument();
    expect(screen.getByText(/调用方式/)).toBeInTheDocument();
    expect(screen.queryByText(/元数据/)).not.toBeInTheDocument();
    expect(screen.queryByText(/alowed-tools/)).not.toBeInTheDocument();
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
