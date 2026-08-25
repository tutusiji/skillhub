import JSZip from 'jszip';
import { FileTreeNode } from '../types';

/**
 * Recursively adds FileTreeNode items to a JSZip instance
 */
function addNodeToZip(zip: JSZip, node: FileTreeNode) {
  if (node.type === 'directory' && node.children) {
    const folder = zip.folder(node.name);
    if (folder) {
      for (const child of node.children) {
        addNodeToZip(folder, child);
      }
    }
  } else {
    // It's a file
    const content = node.content || `# ${node.name}\n// File created by SkillHub`;
    zip.file(node.name, content);
  }
}

/**
 * Packages the file tree into a ZIP and triggers browser download
 * 兜底路径：仅在没有保留原始 ZIP（旧数据）时使用；
 * 正常情况走后端原始 ZIP 下载接口（文件名/层级/二进制与上传完全一致）。
 * 注意：不再额外包一层根目录——fileTree 已还原上传 ZIP 的真实层级，
 * 再套 rootFolder 会导致解压后多一层目录。
 * @param skillName 技能名称
 * @param slug 技能标识
 * @param version 版本号
 * @param fileTree 文件树
 * @param zipFileName 上传时的原始文件名（优先使用）
 */
export async function downloadSkillAsZip(
  skillName: string,
  slug: string,
  version: string,
  fileTree: FileTreeNode[],
  zipFileName?: string,
): Promise<void> {
  const zip = new JSZip();

  // 压缩包内直接平铺文件：若文件树顶层是单个目录（用户上传 ZIP 自带的根目录），
  // 拍平该目录，让解压后直接看到 SKILL.md / src/ 等文件，不再多一层外壳
  const isSingleRootDir =
    fileTree.length === 1 &&
    fileTree[0].type === 'directory' &&
    (fileTree[0].children || []).length > 0;
  const nodes = isSingleRootDir ? fileTree[0].children! : fileTree;

  for (const node of nodes) {
    addNodeToZip(zip, node);
  }

  // DEFLATE 压缩，避免输出膨胀为未压缩的原始大小
  const content = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
  // 文件名优先沿用上传时的原始名；旧数据没有时用 slug 主体+版本号（去掉 @scope/ 前缀，不加额外前缀）
  const versionTag = (version || 'v1.0.0').replace(/^v/, '');
  const baseName = slug.replace(/^@[^/]+\//, '').replace(/\//g, '-');
  const filename = zipFileName || `${baseName}-v${versionTag}.zip`;

  // Trigger browser download
  const url = URL.createObjectURL(content);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
