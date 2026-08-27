import React, { useState } from 'react';
import { 
  Folder, 
  FolderOpen, 
  FileCode, 
  FileText, 
  FileJson, 
  Terminal, 
  Copy, 
  Check, 
  File, 
  ChevronRight, 
  ChevronDown,
  Layers, 
  Code2
} from 'lucide-react';
import { FileTreeNode } from '../types';

interface FileTreeViewerProps {
  tree: FileTreeNode[];
  defaultSelectedPath?: string;
  onCopyFile?: (filename: string, content: string) => void;
  /**
   * 外壳高度类，默认固定 460px（详情页这种「页面内嵌一块」的场景合适）。
   * 弹窗里应传 'h-full'，让本组件填满父级已经限高的容器 —— 否则组件自己的
   * 460px 高度会和弹窗内容区各滚一套，出现双滚动条。
   */
  heightClassName?: string;
}

function getFileIcon(filename: string) {
  if (filename.endsWith('.json')) return <FileJson className="w-4 h-4 text-amber-500 shrink-0" />;
  if (filename.endsWith('.ts') || filename.endsWith('.tsx') || filename.endsWith('.js') || filename.endsWith('.jsx')) {
    return <FileCode className="w-4 h-4 text-sky-500 shrink-0" />;
  }
  if (filename.endsWith('.py')) return <Code2 className="w-4 h-4 text-emerald-500 shrink-0" />;
  if (filename.endsWith('.sh') || filename.endsWith('.bash')) return <Terminal className="w-4 h-4 text-indigo-500 shrink-0" />;
  if (filename.endsWith('.md')) return <FileText className="w-4 h-4 text-slate-500 shrink-0" />;
  return <File className="w-4 h-4 text-slate-400 shrink-0" />;
}

function formatBytes(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

// Find first file in tree
function findFirstFile(nodes: FileTreeNode[]): FileTreeNode | null {
  for (const node of nodes) {
    if (node.type === 'file') return node;
    if (node.type === 'directory' && node.children) {
      const found = findFirstFile(node.children);
      if (found) return found;
    }
  }
  return null;
}

export const FileTreeViewer: React.FC<FileTreeViewerProps> = ({
  tree,
  defaultSelectedPath,
  onCopyFile,
  heightClassName = 'h-[460px]',
}) => {
  const [selectedFile, setSelectedFile] = useState<FileTreeNode | null>(() => {
    if (defaultSelectedPath) {
      const findByPath = (nodes: FileTreeNode[]): FileTreeNode | null => {
        for (const n of nodes) {
          if (n.type === 'file' && (n.path === defaultSelectedPath || n.name === defaultSelectedPath)) return n;
          if (n.children) {
            const res = findByPath(n.children);
            if (res) return res;
          }
        }
        return null;
      };
      const found = findByPath(tree);
      if (found) return found;
    }
    return findFirstFile(tree);
  });

  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    src: true,
    root: true,
    lib: true
  });

  const [copied, setCopied] = useState(false);

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => ({
      ...prev,
      [folderId]: !prev[folderId]
    }));
  };

  const handleCopy = () => {
    if (!selectedFile?.content) return;
    navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    if (onCopyFile) {
      onCopyFile(selectedFile.name, selectedFile.content);
    }
    setTimeout(() => setCopied(false), 2000);
  };

  const renderTreeNode = (node: FileTreeNode, level = 0) => {
    if (node.type === 'directory') {
      const isExpanded = expandedFolders[node.id] ?? true;
      return (
        <div key={node.id} className="select-none">
          <div
            onClick={() => toggleFolder(node.id)}
            className="flex items-center gap-1.5 py-1.5 px-2 rounded-xl hover:bg-slate-100 cursor-pointer text-slate-700 text-xs font-semibold transition-colors"
            style={{ paddingLeft: `${Math.max(8, level * 14 + 8)}px` }}
          >
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            )}
            {isExpanded ? (
              <FolderOpen className="w-4 h-4 text-amber-500 shrink-0" />
            ) : (
              <Folder className="w-4 h-4 text-amber-500 shrink-0" />
            )}
            <span className="truncate">{node.name}</span>
            <span className="ml-auto text-[10px] text-slate-400 font-mono">
              {node.children?.length ?? 0} 项
            </span>
          </div>
          {isExpanded && node.children && (
            <div className="flex flex-col">
              {node.children.map(child => renderTreeNode(child, level + 1))}
            </div>
          )}
        </div>
      );
    }

    // File item
    const isSelected = selectedFile?.id === node.id;
    return (
      <div
        key={node.id}
        id={`file-tree-node-${node.id}`}
        onClick={() => setSelectedFile(node)}
        className={`flex items-center gap-2 py-1.5 px-2 rounded-xl cursor-pointer text-xs transition-colors ${
          isSelected
            ? 'bg-indigo-50 text-indigo-700 font-bold ring-1 ring-indigo-200'
            : 'text-slate-600 hover:bg-slate-100'
        }`}
        style={{ paddingLeft: `${Math.max(8, level * 14 + 20)}px` }}
      >
        {getFileIcon(node.name)}
        <span className="truncate flex-1 font-medium">{node.name}</span>
        {node.size && (
          <span className="text-[10px] text-slate-400 shrink-0 font-mono">
            {formatBytes(node.size)}
          </span>
        )}
      </div>
    );
  };

  const lines = selectedFile?.content ? selectedFile.content.split('\n') : [];

  return (
    <div
      className={`border border-slate-200 rounded-3xl overflow-hidden bg-white shadow-sm flex flex-col md:flex-row min-h-0 ${heightClassName}`}
    >
      {/* File Tree Sidebar */}
      <div className="w-full md:w-64 md:h-auto max-h-52 md:max-h-none border-b md:border-b-0 md:border-r border-slate-200 bg-slate-50/80 p-3.5 overflow-y-auto flex flex-col shrink-0 min-h-0">
        <div className="flex items-center justify-between px-2 pb-2 mb-2 border-b border-slate-200">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <Layers className="w-3.5 h-3.5 text-indigo-600" />
            <span>ZIP 包目录结构</span>
          </div>
          <span className="text-[10px] bg-slate-200/80 px-2 py-0.5 rounded text-slate-600 font-mono font-semibold">
            {tree.length} 根节点
          </span>
        </div>
        <div className="flex-1 space-y-0.5">
          {tree.map(node => renderTreeNode(node))}
        </div>
      </div>

      {/* Code / Content Viewer */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-950 text-slate-200 overflow-hidden font-mono">
        {selectedFile ? (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                {getFileIcon(selectedFile.name)}
                <span className="text-xs text-slate-200 font-bold truncate">
                  {selectedFile.path || selectedFile.name}
                </span>
                <span className="text-[10px] bg-slate-800 text-indigo-300 px-2 py-0.5 rounded font-mono font-semibold">
                  {selectedFile.language || 'text'}
                </span>
                <span className="text-[10px] text-slate-400">
                  {lines.length} 行 · {selectedFile.content?.length || 0} 字节
                </span>
              </div>
              <button
                onClick={handleCopy}
                id="btn-copy-file-content"
                className="flex items-center gap-1 text-xs px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors shrink-0 font-semibold active:scale-95"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">已复制源码</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>复制源码</span>
                  </>
                )}
              </button>
            </div>

            {/* Code Content */}
            <div className="flex-1 overflow-auto p-4 text-xs leading-relaxed font-mono">
              <table className="w-full border-collapse">
                <tbody>
                  {lines.map((line, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/60 transition-colors">
                      <td className="w-10 select-none text-right pr-4 text-slate-600 text-[11px] align-top">
                        {idx + 1}
                      </td>
                      <td className="text-slate-200 font-mono whitespace-pre break-all align-top">
                        {line || ' '}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">
            请在左侧文件树选择文件预览内容
          </div>
        )}
      </div>
    </div>
  );
};
