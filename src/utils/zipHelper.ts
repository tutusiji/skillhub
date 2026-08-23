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
 */
export async function downloadSkillAsZip(skillName: string, slug: string, fileTree: FileTreeNode[]): Promise<void> {
  const zip = new JSZip();
  const rootFolderName = slug.replace(/^@/, '').replace('/', '-');
  const rootFolder = zip.folder(rootFolderName) || zip;

  for (const node of fileTree) {
    addNodeToZip(rootFolder, node);
  }

  // Generate zip file blob
  const content = await zip.generateAsync({ type: 'blob' });
  const filename = `${rootFolderName}-v_package.zip`;

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
