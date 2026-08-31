import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import JSZip from 'jszip';
import { downloadSkillAsZip } from '../zipHelper';
import type { FileTreeNode } from '../../types';

/**
 * ZIP 兜底下载单测。
 * jsdom 没有 URL.createObjectURL，测试里 stub 全局 URL 捕获生成的 blob；
 * 下载链路把 <a> 从 DOM 移除，所以用 click 探针捕获链接元素本身，
 * 再用真实 JSZip 读回 blob 验证：单根目录拍平、文件名推导、占位内容。
 */

const tree = (): FileTreeNode[] => [
  {
    id: '0',
    name: 'my-skill',
    path: 'my-skill',
    type: 'directory',
    children: [
      { id: '1', name: 'SKILL.md', path: 'my-skill/SKILL.md', type: 'file', content: '---\nname: demo\n---' },
      {
        id: '2',
        name: 'src',
        path: 'my-skill/src',
        type: 'directory',
        children: [
          { id: '3', name: 'index.ts', path: 'my-skill/src/index.ts', type: 'file', content: 'export {};' },
        ],
      },
    ],
  },
];

describe('downloadSkillAsZip', () => {
  const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:mock-url');
  const revokeObjectURL = vi.fn<(url: string) => void>();
  let clickedLink: HTMLAnchorElement | null = null;

  beforeEach(() => {
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
    clickedLink = null;
    document.body.innerHTML = '';
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clickedLink = this;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function readZipContents(): Promise<string[]> {
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    const zip = await JSZip.loadAsync(blob);
    return Object.keys(zip.files).sort();
  }

  it('顶层单目录时拍平外壳，优先使用上传时的原始文件名', async () => {
    await downloadSkillAsZip('演示技能', '@skillhub/demo', 'v1.2.0', tree(), 'original-package.zip');

    expect(clickedLink).not.toBeNull();
    expect(clickedLink!.download).toBe('original-package.zip');
    expect(clickedLink!.href).toBe('blob:mock-url');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');

    // 拍平后压缩包内直接是 SKILL.md / src/，没有 my-skill/ 外壳
    expect(await readZipContents()).toEqual(['SKILL.md', 'src/', 'src/index.ts']);
  });

  it('无原始文件名时按 slug 主体 + 版本号推导文件名', async () => {
    await downloadSkillAsZip('演示技能', '@skillhub/demo', 'v1.2.0', tree());
    expect(clickedLink!.download).toBe('demo-v1.2.0.zip');
  });

  it('无 content 的文件写入占位内容', async () => {
    const nodes: FileTreeNode[] = [{ id: '0', name: 'README.md', path: 'README.md', type: 'file' }];
    await downloadSkillAsZip('x', '@skillhub/x', 'v1.0.0', nodes);
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    const zip = await JSZip.loadAsync(blob);
    const readme = await zip.file('README.md')!.async('string');
    expect(readme).toBe('# README.md\n// File created by SkillHub');
  });

  it('默认版本号兜底为 v1.0.0', async () => {
    await downloadSkillAsZip('x', '@skillhub/x', '', tree());
    expect(clickedLink!.download).toBe('x-v1.0.0.zip');
  });
});
