import React, { useState } from 'react';
import { 
  X, 
  Upload, 
  Sparkles, 
  Check, 
  ShieldCheck, 
  Plus, 
  Trash2, 
  ArrowRight, 
  ArrowLeft,
  FolderTree
} from 'lucide-react';
import { AuditRule, ClientPlatform, DeepSeekConfig, FileTreeNode, SkillCategory, SkillItem, UserAccount } from '../types';
import { executeDualEngineAudit } from '../utils/auditRunner';
import { FileTreeViewer } from './FileTreeViewer';
import { AuditReportInspector } from './AuditReportInspector';

interface UploadSkillModalProps {
  currentUser: UserAccount;
  rules: AuditRule[];
  deepseekConfig?: DeepSeekConfig;
  onClose: () => void;
  onSubmit: (newSkill: SkillItem) => void;
  onToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, message: string) => void;
}

export const UploadSkillModal: React.FC<UploadSkillModalProps> = ({
  currentUser,
  rules,
  deepseekConfig,
  onClose,
  onSubmit,
  onToast
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form Fields
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('@skillhub/');
  const [version, setVersion] = useState('v1.0.0');
  const [category, setCategory] = useState<SkillCategory>('coding');
  const [description, setDescription] = useState('');
  const [clients, setClients] = useState<ClientPlatform[]>(['claude', 'cursor', 'mcp']);
  const [permissions, setPermissions] = useState<string[]>([
    '本地工程文件只读读取',
    '标准 Stdio 通信'
  ]);
  const [customPermInput, setCustomPermInput] = useState('');
  const [readme, setReadme] = useState(`# 新技能说明文档\n\n## 功能概述\n请详细描述该技能在 Claude / Cursor 或 MCP 体系下的主要业务功能。\n\n## 安装与配置\n\`\`\`bash\nclaude install @your-team/skill-name\n\`\`\``);

  // Files in package
  const [files, setFiles] = useState<FileTreeNode[]>([
    {
      id: 'f-init-1',
      name: 'package.json',
      path: 'package.json',
      type: 'file',
      size: 480,
      language: 'json',
      content: `{\n  "name": "@skillhub/my-custom-skill",\n  "version": "1.0.0",\n  "description": "Enterprise custom AI skill",\n  "main": "dist/index.js",\n  "dependencies": {\n    "@modelcontextprotocol/sdk": "^0.6.0"\n  }\n}`
    },
    {
      id: 'f-init-2',
      name: 'skill.config.json',
      path: 'skill.config.json',
      type: 'file',
      size: 210,
      language: 'json',
      content: `{\n  "name": "my-custom-skill",\n  "readOnly": true,\n  "timeoutMs": 3000\n}`
    },
    {
      id: 'f-init-3',
      name: 'src',
      path: 'src',
      type: 'directory',
      children: [
        {
          id: 'f-init-3-1',
          name: 'index.ts',
          path: 'src/index.ts',
          type: 'file',
          size: 1100,
          language: 'typescript',
          content: `// SkillHub Enterprise Plugin Entry\nexport async function runSkillTask(input: string) {\n  console.log("Processing task for internal workflow:", input);\n  return { success: true, message: "Task completed safely" };\n}`
        }
      ]
    }
  ]);

  // New file input state
  const [newFileName, setNewFileName] = useState('');
  const [newFileContent, setNewFileContent] = useState('');

  // Pre-flight audit state
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditProgressText, setAuditProgressText] = useState('');
  const [preflightAuditResults, setPreflightAuditResults] = useState<any>(null);

  const toggleClient = (c: ClientPlatform) => {
    setClients(prev => 
      prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]
    );
  };

  const handleAddPermission = () => {
    if (!customPermInput.trim()) return;
    setPermissions(prev => [...prev, customPermInput.trim()]);
    setCustomPermInput('');
  };

  const handleRemovePermission = (index: number) => {
    setPermissions(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddNewFile = () => {
    if (!newFileName.trim()) return;
    const name = newFileName.trim();
    const isTs = name.endsWith('.ts') || name.endsWith('.js');
    const isPy = name.endsWith('.py');
    const isJson = name.endsWith('.json');
    const lang = isTs ? 'typescript' : isPy ? 'python' : isJson ? 'json' : 'text';

    const newFile: FileTreeNode = {
      id: `file-${Date.now()}`,
      name,
      path: name,
      type: 'file',
      size: newFileContent.length,
      language: lang,
      content: newFileContent || `// ${name}\n`
    };

    setFiles(prev => [...prev, newFile]);
    setNewFileName('');
    setNewFileContent('');
    onToast('info', '文件已加入打包树', `已将 ${name} 添加至插件包中`);
  };

  const handleRunPreflightAudit = async () => {
    setIsAuditing(true);
    try {
      const summary = await executeDualEngineAudit(
        {
          name,
          slug,
          readme,
          permissions,
          fileTree: files
        },
        rules,
        (progress) => {
          setAuditProgressText(progress);
        },
        deepseekConfig
      );
      setPreflightAuditResults(summary);
      setStep(4);
    } catch (err) {
      console.error(err);
      onToast('error', '体检失败', '双引擎扫描过程中发生异常');
    } finally {
      setIsAuditing(false);
    }
  };

  const handleFinalSubmit = () => {
    if (!name.trim() || !slug.trim()) {
      onToast('warning', '请完善信息', '插件名称和唯一标识不能为空');
      return;
    }

    const newSkill: SkillItem = {
      id: `skill-${Date.now()}`,
      name: name.trim(),
      slug: slug.trim(),
      version: version.trim() || 'v1.0.0',
      description: description.trim() || '企业内网专属 AI 技能',
      category,
      clients: clients.length > 0 ? clients : ['claude'],
      author: {
        name: currentUser.name,
        avatar: currentUser.avatar,
        department: currentUser.department,
        verified: currentUser.role === 'admin'
      },
      tags: [category, ...clients, '新提交'],
      likes: 0,
      stars: 0,
      downloads: 1,
      isLiked: false,
      isStarred: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'pending', // Pending admin approval!
      permissions,
      readme,
      fileTree: files,
      installCommands: {
        claude: `claude install ${slug.trim()}`,
        cursor: `cursor ext install ${slug.replace('@', '').replace('/', '-')}`,
        mcp: `mcp add ${slug.trim()}`,
        cli: `npx @skillhub/cli install ${slug.trim()}`
      },
      auditResults: preflightAuditResults || {
        overallStatus: 'warning',
        score: 75,
        scannedAt: new Date().toISOString(),
        reviewedBy: '提交时双引擎初筛',
        regexResults: [],
        llmResults: []
      }
    };

    onSubmit(newSkill);
    onToast('success', '提交审核成功', '您的插件已进入管理员审核队列，可在“个人中心”跟踪进度！');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div 
        id="upload-skill-modal"
        className="relative w-full max-w-4xl bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Upload className="w-5 h-5 text-indigo-600" />
              <span>发布新技能 / 插件到内网市场</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              遵循企业内网规范，发布后将自动启动正则特征与 LLM 大模型双引擎合规体检
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Steps Progress Indicator */}
        <div className="px-6 py-3 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between text-xs font-semibold">
          <div className="flex items-center gap-4 sm:gap-6 overflow-x-auto">
            <button 
              onClick={() => setStep(1)} 
              className={`flex items-center gap-1.5 ${step === 1 ? 'text-indigo-600 font-bold' : 'text-slate-500'}`}
            >
              <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[11px] font-bold">1</span>
              <span>基础元数据</span>
            </button>
            <button 
              onClick={() => setStep(2)} 
              className={`flex items-center gap-1.5 ${step === 2 ? 'text-indigo-600 font-bold' : 'text-slate-500'}`}
            >
              <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[11px] font-bold">2</span>
              <span>权限与文档</span>
            </button>
            <button 
              onClick={() => setStep(3)} 
              className={`flex items-center gap-1.5 ${step === 3 ? 'text-indigo-600 font-bold' : 'text-slate-500'}`}
            >
              <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[11px] font-bold">3</span>
              <span>ZIP 包与源码树</span>
            </button>
            <button 
              onClick={() => step >= 4 && setStep(4)} 
              className={`flex items-center gap-1.5 ${step === 4 ? 'text-indigo-600 font-bold' : 'text-slate-500'}`}
            >
              <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[11px] font-bold">4</span>
              <span>双引擎安全初筛</span>
            </button>
          </div>

          <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
            步骤 {step} / 4
          </span>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 text-xs">
          {/* STEP 1: Basic Info */}
          {step === 1 && (
            <div className="space-y-4 max-w-2xl mx-auto">
              <div>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    唯一包标识 (Slug) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={slug}
                    onChange={e => setSlug(e.target.value)}
                    placeholder="@skillhub/my-agent"
                    className="w-full font-mono px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    版本号 (SemVer)
                  </label>
                  <input
                    type="text"
                    value={version}
                    onChange={e => setVersion(e.target.value)}
                    placeholder="v1.0.0"
                    className="w-full font-mono px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  所属业务类别
                </label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value as SkillCategory)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="coding">编程提效 (Coding)</option>
                  <option value="database">数据库与 SQL 优化 (Database)</option>
                  <option value="devops">DevOps 与 CI/CD 运维</option>
                  <option value="mcp">MCP Server 扩展协议</option>
                  <option value="security">安全与合规 (Security)</option>
                  <option value="productivity">生产力与知识库 (DeepResearch)</option>
                  <option value="data">大数据与商业智能 (Data)</option>
                  <option value="agent">自主决策智能体 (Agent)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  简要描述 (一句话亮点)
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="用简洁的文字概括此技能的主要功能与适用场景..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-2">
                  支持的客户端生态
                </label>
                <div className="flex flex-wrap gap-2">
                  {(['claude', 'cursor', 'mcp', 'open-webui', 'chatgpt', 'copilot'] as ClientPlatform[]).map(c => {
                    const active = clients.includes(c);
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => toggleClient(c)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all ${
                          active
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                            : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Permissions & README */}
          {step === 2 && (
            <div className="space-y-4 max-w-2xl mx-auto">
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  声明权限清单 (遵循最小特权原则)
                </label>
                <div className="space-y-2 mb-3">
                  {permissions.map((perm, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-100 text-slate-800 font-medium">
                      <span>{perm}</span>
                      <button
                        type="button"
                        onClick={() => handleRemovePermission(idx)}
                        className="text-slate-400 hover:text-rose-500 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customPermInput}
                    onChange={e => setCustomPermInput(e.target.value)}
                    placeholder="输入权限描述，如：内网 MySQL 8.0 只读连接"
                    className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddPermission}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>添加权限</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  README.md 说明文档 (支持 Markdown)
                </label>
                <textarea
                  rows={8}
                  value={readme}
                  onChange={e => setReadme(e.target.value)}
                  className="w-full font-mono px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs focus:ring-2 focus:ring-indigo-500 outline-none leading-relaxed"
                />
              </div>
            </div>
          )}

          {/* STEP 3: File Tree & ZIP Package */}
          {step === 3 && (
            <div className="space-y-4 max-w-3xl mx-auto">
              <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-start gap-3">
                <FolderTree className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <div className="text-xs text-indigo-950">
                  <div className="font-bold">ZIP 源码包与目录结构定义</div>
                  <div className="opacity-90 mt-0.5">
                    您可以添加文件或编辑源码。下方可实时查看打包树预览。这些文件将作为双引擎审核与用户打包下载的真实内容。
                  </div>
                </div>
              </div>

              {/* Add file widget */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3 shadow-2xs">
                <div className="font-bold text-slate-800">
                  向打包树添加新文件
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={newFileName}
                    onChange={e => setNewFileName(e.target.value)}
                    placeholder="文件路径 (例如: src/helper.ts, prompt.txt)"
                    className="w-full font-mono px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleAddNewFile}
                    className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-slate-800"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>确认加入打包树</span>
                  </button>
                </div>
                <textarea
                  rows={4}
                  value={newFileContent}
                  onChange={e => setNewFileContent(e.target.value)}
                  placeholder="在此输入文件源码内容..."
                  className="w-full font-mono px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs resize-none"
                />
              </div>

              {/* Tree preview */}
              <div>
                <div className="text-xs font-bold text-slate-800 mb-2">
                  当前打包树预览：
                </div>
                <FileTreeViewer tree={files} />
              </div>
            </div>
          )}

          {/* STEP 4: Dual Engine Preflight Audit Result */}
          {step === 4 && (
            <div className="space-y-4 max-w-3xl mx-auto">
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs text-emerald-950">
                  <div className="font-bold">双引擎提交前体检完成</div>
                  <div className="opacity-90 mt-0.5">
                    系统已针对所有正则规则与大模型语义规则进行了预审模拟。点击审核项可查看详情。
                  </div>
                </div>
              </div>

              {preflightAuditResults && (
                <AuditReportInspector summary={preflightAuditResults} />
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div>
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((step - 1) as any)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>上一步</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {step < 3 && (
              <button
                type="button"
                onClick={() => setStep((step + 1) as any)}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors"
              >
                <span>下一步</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {step === 3 && (
              <button
                type="button"
                onClick={handleRunPreflightAudit}
                disabled={isAuditing}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4 text-indigo-200" />
                <span>{isAuditing ? auditProgressText || '正在执行双引擎扫描...' : '启动双引擎安全体检'}</span>
              </button>
            )}

            {step === 4 && (
              <button
                type="button"
                onClick={handleFinalSubmit}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold transition-all shadow-lg active:scale-95 hover:bg-slate-800"
              >
                <Check className="w-4 h-4" />
                <span>正式提交管理员审核</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
