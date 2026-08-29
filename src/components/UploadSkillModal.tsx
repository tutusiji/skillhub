import React, { useState, useEffect } from 'react';
import {
  Upload,
  FileArchive,
  CheckCircle2,
  Folder,
  FolderTree,
  File,
  FileText,
  FileCode,
  Image as ImageIcon,
  GitBranch,
} from 'lucide-react';
import JSZip from 'jszip';
import {
  FileTreeNode,
  SkillCategory,
  SkillCategoryItem,
  SkillItem,
  UserAccount,
} from '../types';
import { api } from '../services/api';
import { Modal } from './Modal';
import { Select } from './Select';

interface UploadSkillModalProps {
  currentUser: UserAccount;
  onClose: () => void;
  onSubmit: (newSkill: SkillItem) => void;
  onToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, message: string) => void;
  /**
   * 多版本发布：父版本 ID（不传表示全新技能）
   * 传了则弹窗标题改为「发布新版本」并显示 supersedeMode 选择器
   */
  parentSkillId?: string;
  /**
   * 多版本发布：父版本显示名（仅用于弹窗标题展示）
   */
  parentSkillName?: string;
  /**
   * 多版本发布：默认 supersedeMode
   * 默认 'coexist'（新版独立计 counter，旧版保留 approved 不动）
   */
  defaultSupersedeMode?: 'coexist' | 'replace';
}

/** ZIP 内文件按扩展名归类图标 */
function fileIconFor(name: string) {
  const lower = name.toLowerCase();
  if (lower.endsWith('.md') || lower.endsWith('.txt')) return <FileText className="w-3.5 h-3.5" />;
  if (lower.endsWith('.json') || lower.endsWith('.js') || lower.endsWith('.ts')) return <FileCode className="w-3.5 h-3.5" />;
  if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.svg')) return <ImageIcon className="w-3.5 h-3.5" />;
  return <File className="w-3.5 h-3.5" />;
}

/** 统计 ZIP 源码树中的文件总数（不含目录） */
function countZipFiles(nodes: FileTreeNode[]): number {
  let count = 0;
  const walk = (ns: FileTreeNode[]) => {
    for (const n of ns) {
      if (n.type === 'directory') walk(n.children || []);
      else count++;
    }
  };
  walk(nodes);
  return count;
}

/**
 * 递归渲染 ZIP 源码树（只展示目录/文件层级，不含文件内容）
 * 按 DFS 顺序收集到 acc，超出 limit 即截断，避免超大压缩包拖垮渲染
 * @param nodes 当前层节点
 * @param depth 缩进深度
 * @param acc 结果收集数组
 * @param limit 最大渲染节点数
 */
function renderZipTree(nodes: FileTreeNode[], depth: number, acc: React.ReactNode[], limit: number) {
  for (const node of nodes) {
    if (acc.length >= limit) return;
    acc.push(
      <div
        key={node.id || node.path}
        className="flex items-center gap-1.5 text-slate-600"
        style={{ paddingLeft: depth * 16 }}
      >
        {node.type === 'directory' ? (
          <Folder className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
        ) : (
          fileIconFor(node.name)
        )}
        <span className="truncate">{node.name}</span>
        {node.type === 'directory' ? (
          <span className="text-[10px] text-indigo-400 shrink-0">目录</span>
        ) : (
          node.size ? (
            <span className="text-[10px] text-slate-400 shrink-0">
              {node.size >= 1024 ? `${(node.size / 1024).toFixed(1)} KB` : `${node.size} B`}
            </span>
          ) : null
        )}
      </div>,
    );
    if (node.type === 'directory' && node.children?.length) {
      renderZipTree(node.children, depth + 1, acc, limit);
    }
  }
}

/**
 * 将 File 转为 base64 字符串（分块处理避免大文件栈溢出）
 * 用于把用户上传的原始 ZIP 一并提交后端，保证二进制文件无损保留
 * @param file 上传的文件
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as ArrayBuffer;
      const bytes = new Uint8Array(result);
      const CHUNK = 0x8000;
      let binary = '';
      for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
      }
      resolve(btoa(binary));
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

/**
 * 从 ZIP 文件中解析出文件树（与后端 parseZipFileTree 逻辑一致）
 * @param zipFile 用户选择的 ZIP 压缩包
 */
async function parseZipToTree(zipFile: File): Promise<FileTreeNode[]> {
  const zip = await JSZip.loadAsync(zipFile);
  const tree: FileTreeNode[] = [];

  for (const [filename, fileObj] of Object.entries(zip.files)) {
    if (fileObj.dir) continue;
    const parts = filename.split('/');
    let currentLevel = tree;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;

      if (isFile) {
        const size = (fileObj as any).uncompressedSize || 0;
        currentLevel.push({
          id: `zip-file-${filename.replace(/\//g, '-')}`,
          name: part,
          path: filename,
          type: 'file',
          size,
          content: await fileObj.async('string').catch(() => ''),
        });
      } else {
        let dirNode = currentLevel.find(
          n => n.name === part && n.type === 'directory',
        );
        if (!dirNode) {
          dirNode = {
            id: `zip-dir-${part}-${Math.random().toString(36).slice(2, 7)}`,
            name: part,
            path: parts.slice(0, i + 1).join('/'),
            type: 'directory',
            children: [],
          };
          currentLevel.push(dirNode);
        }
        currentLevel = dirNode.children!;
      }
    }
  }
  return tree;
}

/**
 * 从 ZIP 解析出的文件树中定位说明文档（README.md / SKILL.md）
 * @param tree 文件树
 */
function findReadmeFile(tree: FileTreeNode[]): FileTreeNode | null {
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
 * 从说明文档内容中解析出技能名称与简介
 * 优先读取 YAML frontmatter 的 name/description，其次取第一个 Markdown 标题与首段正文
 * @param content 说明文档内容
 */
function extractMetaFromReadme(content: string): { name?: string; description?: string } {
  const result: { name?: string; description?: string } = {};

  // 1. YAML frontmatter：---\nname: xxx\ndescription: yyy\n---
  const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (fmMatch) {
    const fm = fmMatch[1];
    const nameMatch = fm.match(/^\s*name\s*:\s*["']?([^"'\n]+)["']?\s*$/m);
    const descMatch = fm.match(/^\s*description\s*:\s*["']?([^"'\n]+)["']?\s*$/m);
    if (nameMatch) result.name = nameMatch[1].trim();
    if (descMatch) result.description = descMatch[1].trim();
  }

  // 2. 第一个 Markdown 一级标题作为名称兜底
  if (!result.name) {
    const titleMatch = content.match(/^#\s+(.+)$/m);
    if (titleMatch) result.name = titleMatch[1].trim().replace(/^["']|["']$/g, '');
  }

  // 3. 无 frontmatter 简介时，取正文首段非空文字
  if (!result.description) {
    const body = content.replace(/^---[\s\S]*?---/, '').trim();
    const firstParagraph = body
      .split(/\n{2,}/)
      .map(p => p.replace(/^[#>*\-\s]+/, '').trim())
      .find(p => p.length >= 10);
    if (firstParagraph) result.description = firstParagraph.slice(0, 200);
  }

  return result;
}

/**
 * 发布新技能弹窗：简单表单 + ZIP 压缩包上传
 * 填写名称、简介、分类，上传插件源码 ZIP 包后提交管理员审核
 */
export const UploadSkillModal: React.FC<UploadSkillModalProps> = ({
  currentUser,
  onClose,
  onSubmit,
  onToast,
  parentSkillId,
  parentSkillName,
  defaultSupersedeMode,
}) => {
  // 表单字段
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<SkillCategory>('coding');
  // 分类选项：后端数据源（管理员可维护），离线时回退默认值
  const [categoryOptions, setCategoryOptions] = useState<SkillCategoryItem[]>([]);
  // 原始 ZIP 的 base64（选择文件时转换，随提交入库保证无损）
  const [zipBufferBase64, setZipBufferBase64] = useState('');
  // 多版本发布：替代模式（仅在传了 parentSkillId 时生效）
  const [supersedeMode, setSupersedeMode] = useState<'coexist' | 'replace'>(
    defaultSupersedeMode || 'coexist',
  );
  // 版本号（用户可自填，默认 v1.0.0；多版本发布时建议自填并加版本号后缀）
  const [version, setVersion] = useState('v1.0.0');

  useEffect(() => {
    api
      .listSkillCategories()
      .then(cats => {
        setCategoryOptions(cats);
        if (cats.length > 0 && !cats.some(c => c.id === category)) {
          setCategory(cats[0].id as SkillCategory);
        }
      })
      .catch(() => {
        /* 后端不可用时使用默认分类 */
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ZIP 上传状态
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [zipTree, setZipTree] = useState<FileTreeNode[] | null>(null);
  const [parsing, setParsing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  /**
   * 处理 ZIP 文件选择：解压为文件树供预览与提交
   * @param file 选中的 ZIP 文件
   */
  const handleZipSelected = async (file: File | null) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.zip')) {
      onToast('warning', '文件格式不对', '请上传 .zip 压缩包');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      onToast('warning', '文件过大', 'ZIP 压缩包不能超过 50MB');
      return;
    }

    setParsing(true);
    try {
      const tree = await parseZipToTree(file);
      if (tree.length === 0) {
        onToast('warning', '压缩包为空', 'ZIP 中没有找到任何文件');
        return;
      }
      setZipFile(file);
      setZipTree(tree);

      // 把原始 ZIP 转 base64 保留，随提交入库（下载与 Git 发布以此为准，二进制无损）
      try {
        const b64 = await fileToBase64(file);
        setZipBufferBase64(b64);
      } catch (e) {
        console.warn('ZIP base64 转换失败，将仅保存文件树:', e);
        setZipBufferBase64('');
      }

      // 从 ZIP 内的说明文档（README.md / SKILL.md）自动解析技能名称与简介
      const readme = findReadmeFile(tree);
      if (readme?.content) {
        const meta = extractMetaFromReadme(readme.content);
        if (meta.name && !name.trim()) {
          setName(meta.name);
          onToast('info', '已自动解析', `已从 ${readme.name} 解析出技能名称：${meta.name}`);
        }
        if (meta.description && !description.trim()) {
          setDescription(meta.description);
        }
      }

      onToast('success', 'ZIP 解析成功', `已解压出 ${tree.length} 个文件，可预览源码树`);
    } catch (err) {
      console.error(err);
      onToast('error', '解析失败', '无法解析该 ZIP 压缩包，请确认是有效的插件源码包');
      setZipFile(null);
      setZipTree(null);
      setZipBufferBase64('');
    } finally {
      setParsing(false);
    }
  };

  /**
   * 提交发布：构造技能记录并交给上层提交后端
   */
  const handleSubmit = () => {
    if (!name.trim()) {
      onToast('warning', '请完善信息', '技能名称不能为空');
      return;
    }
    if (!description.trim()) {
      onToast('warning', '请完善信息', '请填写技能简介');
      return;
    }

    setSubmitting(true);
    const now = new Date().toISOString();
    const newSkill: SkillItem = {
      id: `skill-${Date.now()}`,
      name: name.trim(),
      slug: `@skillhub/${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'skill'}`,
      version: version.trim() || 'v1.0.0',
      description: description.trim(),
      expertDomain: 'fullstack',
      category,
      // 原始 ZIP（base64）与上传文件名：随提交一并入库，保证下载与 Git 发布无损
      zipBufferBase64: zipBufferBase64,
      zipFileName: zipFile?.name || undefined,
      clients: ['claude', 'cursor', 'mcp'],
      author: {
        name: currentUser.name,
        avatar: currentUser.avatar,
        department: currentUser.department,
        verified: currentUser.role === 'admin',
      },
      tags: [category, '新提交'],
      likes: 0,
      stars: 0,
      downloads: 1,
      isLiked: false,
      isStarred: false,
      createdAt: now,
      updatedAt: now,
      status: 'pending',
      permissions: ['本地工程文件只读读取', '标准 Stdio 通信'],
      readme: `# ${name.trim()}\n\n${description.trim()}`,
      // 核心：来自用户上传的 ZIP 压缩包的文件树
      fileTree: zipTree || [
        {
          id: 'f-default-1',
          name: 'skills',
          path: 'skills',
          type: 'directory',
          children: [
            {
              id: 'f-default-1-1',
              name: 'SKILL.md',
              path: 'skills/SKILL.md',
              type: 'file',
              size: 120,
              language: 'markdown',
              content: `# ${name.trim()}\n\n${description.trim()}`,
            },
          ],
        },
      ],
      installCommands: {
        claude: `claude install ${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'skill'}`,
        cursor: `cursor ext install skill`,
        mcp: `mcp add ${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        cli: `npx @skillhub/cli install skill`,
      },
      auditResults: {
        overallStatus: 'pending',
        score: 0,
        scannedAt: now,
        reviewedBy: '待服务端复检',
        regexResults: [],
        llmResults: [],
      },
      // 多版本发布：附带到本地 SkillItem，让 App.tsx 的 handleCreateSkill 透传
      parentSkillId,
      supersedeMode,
    } as any;

    onSubmit(newSkill);
    onToast('success', '提交审核成功', '您的插件已进入管理员审核队列，可在「个人中心」跟踪进度！');
    onClose();
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="4xl"
      align="top"
      containerClassName="pt-10 sm:pt-16"
      panelClassName="!overflow-hidden"
      header={
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Upload className="w-5 h-5 text-indigo-600 shrink-0" />
            <span className="truncate">
              {parentSkillId ? `发布新版本：${parentSkillName || '现有技能'}` : '发布新技能 / 插件'}
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {parentSkillId
              ? '新版本将作为子记录入库，审核通过后才会对其他用户可见'
              : '上传插件源码 ZIP 包并填写基本信息，提交后自动进入管理员审核'}
          </p>
        </div>
      }
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md transition-all active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{submitting ? '提交中...' : '提交发布申请'}</span>
          </button>
        </div>
      }
    >
      <div id="upload-skill-modal" className="flex flex-col flex-1 min-h-0">
        {/* Body */}
        <div className="p-5 text-xs space-y-4">
          {/* 基础信息 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-800 mb-1">
                技能名称 <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="例如：企业级 SQL 诊断智能体"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-800 mb-1">
                技术分类
              </label>
              <Select
                size="md"
                value={category}
                onChange={e => setCategory(e.target.value as SkillCategory)}
              >
                {categoryOptions.length > 0
                  ? categoryOptions.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.label}</option>
                    ))
                  : (
                      <>
                        <option value="coding">编程提效 (Coding)</option>
                        <option value="database">数据库与 SQL 优化 (Database)</option>
                        <option value="devops">DevOps 与 CI/CD 运维</option>
                        <option value="mcp">MCP Server 扩展协议</option>
                        <option value="security">安全与合规 (Security)</option>
                        <option value="productivity">生产力与知识库 (DeepResearch)</option>
                        <option value="data">大数据与商业智能 (Data)</option>
                        <option value="agent">自主决策智能体 (Agent)</option>
                      </>
                    )}
              </Select>
            </div>

            <div>
              <label className="block font-bold text-slate-800 mb-1">
                版本号 <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={version}
                onChange={e => setVersion(e.target.value)}
                placeholder={parentSkillId ? '例：v1.2.0' : 'v1.0.0'}
                maxLength={20}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-800 mb-1">
                技能简介 <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="用简洁的文字概括此技能的主要功能与适用场景..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
              />
            </div>

            {/* 多版本发布：替代模式选择器（仅在传了 parentSkillId 时显示） */}
            {parentSkillId && (
              <div className="sm:col-span-2 p-3.5 rounded-xl bg-indigo-50/60 border border-indigo-200/80 space-y-2">
                <div className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                  <GitBranch className="w-3.5 h-3.5" />
                  新版本发布模式
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${supersedeMode === 'coexist' ? 'border-indigo-400 bg-white' : 'border-slate-200 bg-white/50 hover:bg-white'}`}>
                    <input
                      type="radio"
                      name="supersedeMode"
                      value="coexist"
                      checked={supersedeMode === 'coexist'}
                      onChange={() => setSupersedeMode('coexist')}
                      className="mt-0.5"
                    />
                    <div className="text-xs">
                      <div className="font-bold text-slate-800">保留共存</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">新版独立计 counter；旧版保持 approved 不动，详情页可手动切换</div>
                    </div>
                  </label>
                  <label className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${supersedeMode === 'replace' ? 'border-indigo-400 bg-white' : 'border-slate-200 bg-white/50 hover:bg-white'}`}>
                    <input
                      type="radio"
                      name="supersedeMode"
                      value="replace"
                      checked={supersedeMode === 'replace'}
                      onChange={() => setSupersedeMode('replace')}
                      className="mt-0.5"
                    />
                    <div className="text-xs">
                      <div className="font-bold text-slate-800">替代旧版</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">新版从旧版继承 counter 起点；审核通过时旧版自动 archive</div>
                    </div>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* ZIP 上传组件（核心） */}
          <div>
            <label className="block font-bold text-slate-800 mb-1.5">
              插件源码 ZIP 压缩包
            </label>

            {!zipTree ? (
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => {
                  e.preventDefault();
                  setDragOver(false);
                  handleZipSelected(e.dataTransfer.files?.[0] || null);
                }}
                className={`border-2 border-dashed rounded-2xl p-8 text-center transition-colors cursor-pointer ${
                  dragOver
                    ? 'border-indigo-400 bg-indigo-50/60'
                    : 'border-slate-300 bg-slate-50/60 hover:border-indigo-400 hover:bg-indigo-50/30'
                }`}
                onClick={() => document.getElementById('zip-file-input')?.click()}
              >
                <input
                  id="zip-file-input"
                  type="file"
                  accept=".zip,application/zip,application/x-zip-compressed"
                  className="hidden"
                  onChange={e => handleZipSelected(e.target.files?.[0] || null)}
                />
                <FileArchive className="w-10 h-10 text-indigo-400 mx-auto mb-3" />
                <div className="text-sm font-bold text-slate-700">
                  {parsing ? '正在解析 ZIP 压缩包...' : '点击选择或将 ZIP 拖拽到此处'}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  支持 .zip 格式，单个文件不超过 50MB
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
                {/* 已选文件信息 */}
                <div className="p-3.5 flex items-center justify-between bg-emerald-50/70 border-b border-emerald-100">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileArchive className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-emerald-900 truncate">{zipFile?.name}</div>
                      <div className="text-[11px] text-emerald-700">
                        {countZipFiles(zipTree)} 个文件 · {(zipFile?.size || 0) / 1024 >= 1024
                          ? `${((zipFile?.size || 0) / 1024 / 1024).toFixed(1)} MB`
                          : `${Math.round((zipFile?.size || 0) / 1024)} KB`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => { setZipFile(null); setZipTree(null); setZipBufferBase64(''); }}
                      className="px-3 py-1.5 rounded-lg border border-emerald-200 bg-white text-emerald-700 text-[11px] font-bold hover:bg-emerald-50"
                    >
                      重新上传
                    </button>
                  </div>
                </div>

                {/* 文件树预览：递归渲染层级结构，仅展示目录与文件名，不含文件内容 */}
                <div className="p-3.5 max-h-56 overflow-y-auto">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 mb-2">
                    <FolderTree className="w-3.5 h-3.5" />
                    源码树预览（层级结构）
                  </div>
                  <div className="space-y-1">
                    {(() => {
                      const acc: React.ReactNode[] = [];
                      renderZipTree(zipTree, 0, acc, 200);
                      return acc;
                    })()}
                    {countZipFiles(zipTree) > 200 && (
                      <div className="text-[11px] text-slate-400 text-center pt-1">
                        仅展示前 200 项，共 {countZipFiles(zipTree)} 个文件
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 提交提示 */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-500 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
            <span>
              提交后进入管理员人工审核队列。系统会自动对源码进行双引擎安全体检，
              评分将作为管理员审核的参考依据。
            </span>
          </div>
        </div>
      </div>
    </Modal>
  );
};
