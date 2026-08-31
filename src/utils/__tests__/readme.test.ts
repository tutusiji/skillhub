import { describe, expect, it } from 'vitest';
import { FileTreeNode } from '../../types';
import { findReadmeFile, stripFrontmatter } from '../readme';

/**
 * findReadmeFile 单测：从文件树定位说明文档。
 *
 * 关键行为（readme.ts 实现契约）：
 *  - 查找目标按优先级：README.md（含大小写变体）> SKILL.md > 裸 README；
 *  - 递归扫全树（README 常放在子目录，如 docs/README.md），按 path 结尾匹配；
 *  - directory 节点跳过（内容只挂在 file 节点）。
 */

function file(name: string, path: string, content = 'content'): FileTreeNode {
  return { id: name, name, path, type: 'file', content };
}
function dir(name: string, path: string, children: FileTreeNode[]): FileTreeNode {
  return { id: name, name, path, type: 'directory', children };
}

describe('findReadmeFile', () => {
  it('空树返回 null', () => {
    expect(findReadmeFile([])).toBeNull();
  });

  it('定位根目录 README.md', () => {
    const node = findReadmeFile([
      file('main.ts', 'src/main.ts'),
      file('README.md', 'README.md', '# 说明'),
    ]);
    expect(node).not.toBeNull();
    expect(node!.name).toBe('README.md');
    expect(node!.content).toBe('# 说明');
  });

  it('README 在子目录也能定位（按 path 结尾匹配）', () => {
    const tree = [
      dir('src', 'src', [file('a.ts', 'src/a.ts')]),
      dir('docs', 'docs', [file('README.md', 'docs/README.md', '# docs')]),
    ];
    expect(findReadmeFile(tree)?.path).toBe('docs/README.md');
  });

  it('大小写变体（readme.md / Readme.md）同样命中', () => {
    expect(findReadmeFile([file('readme.md', 'readme.md')])?.name).toBe('readme.md');
    expect(findReadmeFile([file('Readme.md', 'Readme.md')])?.name).toBe('Readme.md');
  });

  it('无 README 时回退到 SKILL.md', () => {
    expect(findReadmeFile([file('SKILL.md', 'SKILL.md', '# skill')])?.name).toBe('SKILL.md');
  });

  it('README.md 优先于 SKILL.md（按 targets 顺序取第一个命中）', () => {
    const tree = [file('SKILL.md', 'SKILL.md'), file('README.md', 'README.md')];
    expect(findReadmeFile(tree)?.name).toBe('README.md');
  });

  it('纯代码目录（无说明文档）返回 null', () => {
    const tree = [
      dir('src', 'src', [file('index.ts', 'src/index.ts')]),
      file('package.json', 'package.json'),
    ];
    expect(findReadmeFile(tree)).toBeNull();
  });
});

describe('stripFrontmatter', () => {
  it('剥离标准 YAML frontmatter（第一行 --- 到闭合 ---）', () => {
    const md = [
      '---',
      'name: demo',
      'description: 技能简介',
      'allowed-tools:',
      '  - Read',
      '---',
      '',
      '# 技能正文',
      '使用说明……',
    ].join('\n');
    const stripped = stripFrontmatter(md);
    expect(stripped).not.toContain('name: demo');
    expect(stripped).not.toContain('allowed-tools');
    expect(stripped).toContain('# 技能正文');
    expect(stripped).toContain('使用说明');
    // 正文不带闭合 --- 残留
    expect(stripped.startsWith('# 技能正文')).toBe(true);
  });

  it('无 frontmatter 的文档原样返回', () => {
    const md = '# README\n\n普通正文';
    expect(stripFrontmatter(md)).toBe(md);
  });

  it('开头是 --- 但没有成对闭合 --- 时原样返回（不误伤分隔线）', () => {
    const md = '---\n这只是一个以分隔线开头的普通文档';
    expect(stripFrontmatter(md)).toBe(md);
  });
});
