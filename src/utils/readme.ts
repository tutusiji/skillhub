import { FileTreeNode } from '../types';

/**
 * 从技能文件树中定位说明文档节点。
 *
 * 查找目标按优先级排列：README.md（含大小写变体）> SKILL.md > 裸 README。
 * 上传解析与详情页「使用说明」共用同一份查找逻辑，保证两边认定的文档一致
 * （上传时用它自动填充名称/简介，详情页用它直接展示 README.md 原文）。
 *
 * @param tree ZIP 解析出的文件树
 * @returns 命中的文档节点（content 为文本内容），未找到返回 null
 */
export function findReadmeFile(tree: FileTreeNode[]): FileTreeNode | null {
  const targets = ['README.md', 'readme.md', 'Readme.md', 'SKILL.md', 'skill.md', 'README', 'readme'];
  const flat: FileTreeNode[] = [];
  const walk = (nodes: FileTreeNode[]) => {
    for (const n of nodes) {
      if (n.type === 'directory') walk(n.children || []);
      else flat.push(n);
    }
  };
  walk(tree);
  for (const t of targets) {
    const found = flat.find(n => n.name === t || n.path === t || n.path?.endsWith(`/${t}`));
    if (found) return found;
  }
  return null;
}

/**
 * 去掉 Markdown 开头的 YAML frontmatter（--- ... ---）。
 *
 * 纯技能（Claude Skill）的说明文档是 SKILL.md，其顶部 frontmatter（name/
 * description/allowed-tools 等）是给 Claude Code 读取的元数据，不是给人看的
 * 使用文档，展示前剥离。只命中「第一行就是 ---」的标准格式：普通 README.md
 * 即使开头是 --- 分隔线，只要没有成对的闭合 --- 就原样返回，不会误伤。
 *
 * @param markdown 原始 Markdown 内容
 * @returns 去掉 frontmatter 后的正文；无 frontmatter 时原样返回
 */
export function stripFrontmatter(markdown: string): string {
  const lines = markdown.split('\n');
  if (!/^---\s*$/.test(lines[0] || '')) return markdown;
  for (let i = 1; i < lines.length; i++) {
    if (/^---\s*$/.test(lines[i])) {
      // trim：去掉闭合 --- 与正文之间遗留的空行/缩进，避免正文顶着一个空行
      return lines.slice(i + 1).join('\n').trim();
    }
  }
  return markdown;
}
