import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Markdown } from '../ui/Markdown';

/**
 * Markdown 组件单测：标题/段落/代码块/表格/任务列表渲染 + XSS 安全契约。
 *
 * 安全契约（组件实现保证，此处回归）：内容不可信，原始 HTML 只当纯文本转义，
 * <script> 绝不成为 DOM 元素——这是 README tab 展示上传技能包内容的底线。
 */

function renderMd(content: string) {
  return render(<Markdown content={content} />);
}

describe('Markdown 基础渲染', () => {
  it('渲染标题、段落与加粗', () => {
    renderMd('# 一级标题\n\n这是**加粗**的正文。');
    expect(screen.getByRole('heading', { level: 1, name: '一级标题' })).toBeInTheDocument();
    // strong 是独立元素（直接文本为「加粗」）
    expect(screen.getByText('加粗')).toBeInTheDocument();
    // 段落的直接文本节点是「这是」+「的正文。」，需按 textContent 合并断言
    expect(
      screen.getByText((_, el) => el?.textContent === '这是加粗的正文。')
    ).toBeInTheDocument();
  });

  it('行内代码与围栏代码块（含语言标签）区分渲染', () => {
    renderMd('安装前先执行 `pnpm i`。\n\n```ts\nconst a: number = 1;\n```');
    // 行内代码带浅灰底样式，仍是 text 节点（可在 DOM 中找到原文）
    expect(screen.getByText('pnpm i')).toBeInTheDocument();
    // 围栏代码块：语言标签 + 代码原文
    expect(screen.getByText('ts')).toBeInTheDocument();
    expect(screen.getByText('const a: number = 1;')).toBeInTheDocument();
  });

  it('GFM 表格渲染为带表头的 table', () => {
    renderMd('| 字段 | 说明 |\n| --- | --- |\n| name | 技能名 |');
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '字段' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '说明' })).toBeInTheDocument();
    expect(screen.getByText('技能名')).toBeInTheDocument();
  });

  it('GFM 任务列表渲染复选框', () => {
    const { container } = renderMd('- [x] 已完成\n- [ ] 未完成');
    const boxes = container.querySelectorAll('input[type="checkbox"]');
    expect(boxes).toHaveLength(2);
    expect((boxes[0] as HTMLInputElement).checked).toBe(true);
    expect((boxes[1] as HTMLInputElement).checked).toBe(false);
  });

  it('链接渲染为 target=_blank 且带安全 rel', () => {
    renderMd('[查看文档](https://example.com/doc)');
    const link = screen.getByRole('link', { name: '查看文档' });
    expect(link).toHaveAttribute('href', 'https://example.com/doc');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});

describe('Markdown 安全契约', () => {
  it('原始 HTML 被转义：<script> 不成为 DOM 元素、不执行', () => {
    const { container } = renderMd('正文包含 <script>window.__xss = 1</script> 的内容');
    // 不会创建 script 元素（内容只以纯文本形式出现）
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    // 原始标签以纯文本展示，用户能看见它而非被吞掉
    expect(screen.getByText(/<script>window.__xss = 1<\/script>/)).toBeInTheDocument();
  });

  it('内联事件属性与危险标签不产生任何元素', () => {
    const { container } = renderMd(
      '<img src=x onerror="alert(1)">\n\n<div onclick="steal()">可点击</div>'
    );
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('div')).toBeNull();
  });
});
