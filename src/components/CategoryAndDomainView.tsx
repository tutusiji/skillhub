import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users,
  Tags,
  Search,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  ListChecks,
  GripVertical,
  Save,
} from 'lucide-react';
import { ExpertDomain, ExpertDomainInfo, SkillCategoryItem, SkillItem, UserAccount } from '../types';
import { getExpertDomainMeta } from '../data/expertDomains';
import { api, ExpertDomainPayload } from '../services/api';
import { useExpertDomains } from '../hooks/useExpertDomains';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { PopconfirmBubble } from './PopconfirmBubble';
import { Avatar } from './Avatar';

interface CategoryAndDomainViewProps {
  currentUser: UserAccount;
  skills: SkillItem[];
  onRefreshSkills: (skills: SkillItem[]) => void;
  onToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, message: string) => void;
}

/** 专家组中技能成员选择弹层用的候选池（仅已上架技能） */
function useApprovedSkills(skills: SkillItem[]) {
  return useMemo(() => skills.filter(s => s.status === 'approved'), [skills]);
}

/** 默认分类选项：新增时提供常见 key 快捷填充 */
const SUGGESTED_IDS = ['research', 'office', 'analytics', 'automation', 'data', 'mcp'];

/** 可选的专家组图标（与 DomainIcon 映射一致） */
const ICON_OPTIONS = [
  'Code2', 'Palette', 'KanbanSquare', 'Cpu', 'HardDrive',
  'CheckCheck', 'Server', 'BarChart3', 'Sparkles', 'Layers', 'LayoutGrid',
];

/** 可选的徽章配色组合 */
const BADGE_THEMES: Array<{ label: string; badgeBg: string; badgeText: string; badgeBorder: string }> = [
  { label: '蓝色', badgeBg: 'bg-blue-50', badgeText: 'text-blue-700', badgeBorder: 'border-blue-200' },
  { label: '紫色', badgeBg: 'bg-purple-50', badgeText: 'text-purple-700', badgeBorder: 'border-purple-200' },
  { label: '靛蓝', badgeBg: 'bg-indigo-50', badgeText: 'text-indigo-700', badgeBorder: 'border-indigo-200' },
  { label: '绿色', badgeBg: 'bg-emerald-50', badgeText: 'text-emerald-700', badgeBorder: 'border-emerald-200' },
  { label: '青色', badgeBg: 'bg-cyan-50', badgeText: 'text-cyan-700', badgeBorder: 'border-cyan-200' },
  { label: '琥珀', badgeBg: 'bg-amber-50', badgeText: 'text-amber-800', badgeBorder: 'border-amber-200' },
  { label: '玫红', badgeBg: 'bg-rose-50', badgeText: 'text-rose-700', badgeBorder: 'border-rose-200' },
  { label: '灰色', badgeBg: 'bg-slate-100', badgeText: 'text-slate-700', badgeBorder: 'border-slate-200' },
];

/**
 * 分类和专家组管理页面
 * - 专家组矩阵管理：每个专家组由管理员选择技能加入（专家组即标签，一个技能可属于多个组）
 * - 标签管理：技能分类的增删改与启停
 */
export const CategoryAndDomainView: React.FC<CategoryAndDomainViewProps> = ({
  currentUser,
  skills,
  onRefreshSkills,
  onToast,
}) => {
  const [activeTab, setActiveTab] = useState<'domains' | 'tags'>('domains');

  // —— 专家组矩阵管理状态 ——
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null);
  const [memberPickerOpen, setMemberPickerOpen] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [savingDomains, setSavingDomains] = useState<string[]>([]);

  // 专家组数据：后端为权威（支持增删改查），离线回退常量
  const { domains: domainOptions, refresh: refreshDomains } = useExpertDomains();
  // 专家组新增/编辑表单
  const [domainFormOpen, setDomainFormOpen] = useState(false);
  const [editingDomain, setEditingDomain] = useState<ExpertDomainInfo | null>(null);
  const [form, setForm] = useState<{
    id: string; name: string; shortLabel: string; description: string;
    iconName: string; badgeBg: string; badgeText: string; badgeBorder: string; sortOrder: number;
  }>({
    id: '', name: '', shortLabel: '', description: '',
    iconName: 'Layers', badgeBg: 'bg-indigo-50', badgeText: 'text-indigo-700', badgeBorder: 'border-indigo-200', sortOrder: 0,
  });

  // ESC 关闭专家组表单弹层
  const closeDomainForm = useCallback(() => {
    setDomainFormOpen(false);
  }, []);
  useEscapeKey(closeDomainForm, domainFormOpen);

  // —— 标签管理状态 ——
  const [categories, setCategories] = useState<SkillCategoryItem[]>([]);
  const [newId, setNewId] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState('');

  const approvedSkills = useApprovedSkills(skills);

  useEffect(() => {
    api
      .listSkillCategories()
      .then(setCategories)
      .catch(() => { /* 离线时为空 */ });
  }, []);

  /** 打开新增专家组表单 */
  const openCreateDomain = () => {
    setEditingDomain(null);
    setForm({
      id: '', name: '', shortLabel: '', description: '',
      iconName: 'Layers', badgeBg: 'bg-indigo-50', badgeText: 'text-indigo-700', badgeBorder: 'border-indigo-200',
      sortOrder: (domainOptions.length + 1) * 10,
    });
    setDomainFormOpen(true);
  };

  /** 打开编辑专家组表单 */
  const openEditDomain = (d: ExpertDomainInfo) => {
    setEditingDomain(d);
    setForm({
      id: d.id as string,
      name: d.name,
      shortLabel: d.shortLabel,
      description: d.description,
      iconName: d.iconName,
      badgeBg: d.badgeBg,
      badgeText: d.badgeText,
      badgeBorder: d.badgeBorder,
      sortOrder: 0,
    });
    setDomainFormOpen(true);
  };

  /** 保存专家组（新增或编辑） */
  const handleSaveDomain = async () => {
    const payload: ExpertDomainPayload = {
      name: form.name.trim(),
      shortLabel: form.shortLabel.trim(),
      description: form.description.trim(),
      iconName: form.iconName,
      badgeBg: form.badgeBg,
      badgeText: form.badgeText,
      badgeBorder: form.badgeBorder,
      sortOrder: form.sortOrder,
    };
    if (!payload.name || !payload.shortLabel) {
      onToast('warning', '请完善信息', '专家组名称与简称不能为空');
      return;
    }
    try {
      if (editingDomain) {
        await api.updateExpertDomain(editingDomain.id as string, payload);
        onToast('success', '专家组已更新', `「${payload.name}」已保存`);
      } else {
        const id = form.id.trim().toLowerCase();
        if (!id || !/^[a-z0-9_]+$/.test(id)) {
          onToast('warning', '专家组 key 不合法', '仅支持小写字母、数字与下划线');
          return;
        }
        await api.createExpertDomain({ ...payload, id });
        onToast('success', '专家组已新增', `「${payload.name}」已创建`);
      }
      refreshDomains();
      setDomainFormOpen(false);
    } catch (err) {
      onToast('error', '保存失败', (err as Error).message);
    }
  };

  /**
   * 删除专家组（已二次确认，由 PopconfirmBubble 触发）
   * 单独抽出便于 PopconfirmBubble.onConfirm 直接复用，memberCount 由调用方计算后传入。
   */
  const performDeleteDomain = async (d: ExpertDomainInfo) => {
    try {
      await api.deleteExpertDomain(d.id as string);
      refreshDomains();
      onToast('success', '专家组已删除', `专家组「${d.name}」已移除`);
    } catch (err) {
      onToast('error', '删除失败', (err as Error).message);
    }
  };

  /** 某技能是否属于指定专家组 */
  const skillInDomain = (skill: SkillItem, domainId: string) =>
    (skill.expertDomains || []).includes(domainId);

  /**
   * 勾选/取消某技能在某专家组的归属（专家组即标签）
   * @param skill 技能
   * @param domainId 专家组 ID
   * @param checked 是否加入
   */
  const handleToggleSkillDomain = async (skill: SkillItem, domainId: string, checked: boolean) => {
    const current = Array.isArray(skill.expertDomains) ? skill.expertDomains : [];
    const next = checked
      ? [...new Set([...current, domainId])]
      : current.filter(d => d !== domainId);

    // 乐观更新
    onRefreshSkills(skills.map(s => (s.id === skill.id ? { ...s, expertDomains: next } : s)));
    setSavingDomains(prev => [...prev, skill.id]);

    try {
      await api.updateSkillExpertDomains(skill.id, next);
      onToast(
        checked ? 'success' : 'info',
        checked ? '已加入专家组' : '已移出专家组',
        `「${skill.name}」${checked ? '已加入' : '已移出'}「${getExpertDomainMeta(domainId as ExpertDomain, domainOptions)?.name || domainId}」`
      );
    } catch (err) {
      // 失败回滚
      onRefreshSkills(skills.map(s => (s.id === skill.id ? { ...s, expertDomains: current } : s)));
      onToast('error', '操作失败', (err as Error).message);
    } finally {
      setSavingDomains(prev => prev.filter(id => id !== skill.id));
    }
  };

  /** 专家组成员的候选技能（已上架且不属于该组） */
  const candidateSkillsFor = (domainId: string) => {
    const q = memberSearch.trim().toLowerCase();
    return approvedSkills.filter(s => {
      if (skillInDomain(s, domainId)) return false;
      if (q) {
        return (
          s.name.toLowerCase().includes(q) ||
          s.slug.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q)
        );
      }
      return true;
    });
  };

  // —— 标签管理操作 ——
  const handleCreateCategory = async () => {
    const id = newId.trim().toLowerCase();
    const label = newLabel.trim();
    if (!id || !/^[a-z0-9-]+$/.test(id)) {
      onToast('warning', '分类 key 不合法', '仅支持小写字母、数字与连字符');
      return;
    }
    if (!label) {
      onToast('warning', '请填写分类名称', '分类显示名称不能为空');
      return;
    }
    try {
      const created = await api.createSkillCategory({
        id,
        label,
        sortOrder: (categories.length + 1) * 10,
      });
      setCategories(prev => [...prev, created].sort((a, b) => a.sortOrder - b.sortOrder));
      setNewId('');
      setNewLabel('');
      onToast('success', '分类已新增', `分类「${created.label}」已创建`);
    } catch (err) {
      onToast('error', '新增失败', (err as Error).message);
    }
  };

  const handleSaveCategoryEdit = async () => {
    if (!editingId) return;
    const label = editingLabel.trim();
    if (!label) {
      onToast('warning', '请填写分类名称', '分类显示名称不能为空');
      return;
    }
    try {
      const updated = await api.updateSkillCategory(editingId, { label });
      setCategories(prev => prev.map(c => (c.id === editingId ? { ...c, label: updated.label } : c)));
      setEditingId(null);
      onToast('success', '分类已更新', `分类已改名为「${updated.label}」`);
    } catch (err) {
      onToast('error', '更新失败', (err as Error).message);
    }
  };

  const handleToggleCategory = async (cat: SkillCategoryItem) => {
    try {
      const updated = await api.updateSkillCategory(cat.id, { isEnabled: !cat.isEnabled });
      setCategories(prev => prev.map(c => (c.id === cat.id ? { ...c, isEnabled: updated.isEnabled } : c)));
      onToast(
        updated.isEnabled ? 'success' : 'info',
        updated.isEnabled ? '分类已启用' : '分类已停用',
        `「${updated.label}」${updated.isEnabled ? '重新出现在集市与发布表单' : '已从集市与发布表单隐藏'}`
      );
    } catch (err) {
      onToast('error', '操作失败', (err as Error).message);
    }
  };

  /**
   * 删除分类（已二次确认，由 PopconfirmBubble 触发）
   */
  const performDeleteCategory = async (cat: SkillCategoryItem) => {
    try {
      await api.deleteSkillCategory(cat.id);
      setCategories(prev => prev.filter(c => c.id !== cat.id));
      onToast('success', '分类已删除', `分类「${cat.label}」已移除`);
    } catch (err) {
      onToast('error', '删除失败', (err as Error).message);
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200 text-left">
      {/* Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white shadow-xl border border-indigo-900/40 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-bold shadow-2xs">
            <ListChecks className="w-3.5 h-3.5" />
            <span>内容组织管理</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            分类和专家组管理
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-2xl">
            维护技能集市的分类标签，并按岗位专家组为技能打标——专家组即标签，一个技能可属于多个专家组。
          </p>
        </div>
      </div>

      {/* Tab 切换 */}
      <div className="flex items-center gap-1.5 p-1.5 bg-white border border-slate-200 rounded-2xl shadow-2xs w-fit">
        <button
          onClick={() => setActiveTab('domains')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
            activeTab === 'domains' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          岗位专家组矩阵管理
        </button>
        <button
          onClick={() => setActiveTab('tags')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
            activeTab === 'tags' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Tags className="w-3.5 h-3.5" />
          标签管理
        </button>
      </div>

      {/* Tab 1: 专家组矩阵管理 */}
      {activeTab === 'domains' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-slate-500 leading-relaxed">
              针对每一个专家组，管理员可选择已上架技能加入其中。技能可同时属于多个专家组（标签语义），
              集市首页与技能详情会按专家组维度聚合展示。
            </p>
            <button
              onClick={openCreateDomain}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              新增专家组
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {domainOptions.map(domain => {
              // 直接用后端返回的 domain（覆盖了最新的 shortLabel/配色），不要再退回静态常量
              const meta = domain;
              const members = approvedSkills.filter(s => skillInDomain(s, domain.id));
              const isExpanded = expandedDomain === domain.id;
              const isPickerOpen = memberPickerOpen === domain.id;

              return (
                <div
                  key={domain.id}
                  className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden"
                >
                  {/* 专家组头部 */}
                  <div className="flex items-center gap-2 p-4 hover:bg-slate-50/70 transition-colors">
                  <button
                    onClick={() => setExpandedDomain(isExpanded ? null : domain.id)}
                    className="flex-1 min-w-0 flex items-center gap-3 text-left"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                    <span className={`px-2.5 py-1 rounded-full border text-[11px] font-black ${meta?.badgeBg} ${meta?.badgeText} ${meta?.badgeBorder}`}>
                      {meta?.shortLabel || domain.id}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-slate-900 truncate">{domain.name}</div>
                      <div className="text-[11px] text-slate-400 truncate">{domain.description}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-bold shrink-0">
                      {members.length} 个技能
                    </span>
                  </button>

                  {/* 编辑 / 删除 */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEditDomain(domain)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                      title="编辑专家组"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    {(() => {
                      const memberCount = approvedSkills.filter(s => (s.expertDomains || []).includes(domain.id as string)).length;
                      return (
                        <PopconfirmBubble
                          title={`确定删除专家组「${domain.name}」？`}
                          description={memberCount > 0
                            ? `当前有 ${memberCount} 个技能归属于该专家组，删除后这些技能的该归属将被一并移除。`
                            : '删除后不可恢复。'}
                          type="danger"
                          confirmText="确认删除"
                          cancelText="取消"
                          placement="top-left"
                          onConfirm={() => performDeleteDomain(domain)}
                          trigger={({ onClick }) => (
                            <button
                              onClick={onClick}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                              title="删除专家组"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        />
                      );
                    })()}
                  </div>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-3">
                      {/* 成员列表 */}
                      {members.length === 0 ? (
                        <div className="p-3 rounded-xl bg-slate-50 text-[11px] text-slate-400 text-center">
                          该专家组暂无技能，点击「添加技能」从集市中选择
                        </div>
                      ) : (
                        <div className="space-y-1.5 max-h-56 overflow-y-auto">
                          {members.map(skill => (
                            <div key={skill.id} className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
                              <Avatar src={skill.author.avatar} name={skill.author.name} className="w-6 h-6 rounded-lg shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-bold text-slate-800 truncate">{skill.name}</div>
                                <div className="text-[10px] font-mono text-slate-400 truncate">{skill.slug}</div>
                              </div>
                              <button
                                onClick={() => handleToggleSkillDomain(skill, domain.id, false)}
                                disabled={savingDomains.includes(skill.id)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                                title="移出该专家组"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* 添加技能按钮 */}
                      <button
                        onClick={() => {
                          setMemberPickerOpen(isPickerOpen ? null : domain.id);
                          setMemberSearch('');
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-dashed border-indigo-300 text-indigo-600 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-indigo-50 transition-all"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {isPickerOpen ? '收起选择器' : '添加技能到该专家组'}
                      </button>

                      {/* 成员选择器 */}
                      {isPickerOpen && (
                        <div className="p-3 rounded-2xl border border-indigo-200 bg-indigo-50/40 space-y-2">
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                            <input
                              type="text"
                              value={memberSearch}
                              onChange={e => setMemberSearch(e.target.value)}
                              placeholder="搜索已上架技能..."
                              className="w-full pl-8 pr-3 py-2 rounded-xl border border-indigo-200 bg-white text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                          <div className="max-h-52 overflow-y-auto space-y-1">
                            {candidateSkillsFor(domain.id).slice(0, 50).map(skill => (
                              <button
                                key={skill.id}
                                onClick={() => handleToggleSkillDomain(skill, domain.id, true)}
                                disabled={savingDomains.includes(skill.id)}
                                className="w-full flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/60 text-left transition-all disabled:opacity-50"
                              >
                                <Avatar src={skill.author.avatar} name={skill.author.name} className="w-6 h-6 rounded-lg shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-bold text-slate-800 truncate">{skill.name}</div>
                                  <div className="text-[10px] font-mono text-slate-400 truncate">{skill.slug}</div>
                                </div>
                                <Plus className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                              </button>
                            ))}
                            {candidateSkillsFor(domain.id).length === 0 && (
                              <div className="p-3 text-center text-[11px] text-slate-400">
                                {memberSearch.trim() ? '没有匹配的已上架技能' : '所有已上架技能都已加入该专家组'}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 2: 标签管理（技能分类） */}
      {activeTab === 'tags' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* 新增表单 */}
          <div className="lg:col-span-4 bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
              <Plus className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">新增分类</h3>
            </div>
            <div className="p-4 space-y-3">
              <input
                type="text"
                value={newId}
                onChange={e => setNewId(e.target.value)}
                placeholder="分类 key (如 research)"
                list="category-suggestions"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 font-mono text-xs outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <datalist id="category-suggestions">
                {SUGGESTED_IDS.filter(sid => !categories.some(c => c.id === sid)).map(sid => (
                  <option key={sid} value={sid} />
                ))}
              </datalist>
              <input
                type="text"
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                placeholder="分类名称 (如 行业研究)"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={handleCreateCategory}
                className="w-full px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                新增分类
              </button>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                分类出现在集市分类 tab 与发布表单的下拉中；停用后从这些位置隐藏，已归属技能不受影响。
              </p>
            </div>
          </div>

          {/* 分类列表 */}
          <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tags className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">技能分类列表</h3>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-bold">{categories.length} 个</span>
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {categories.map(cat => (
                <div key={cat.id} className="p-3.5 flex items-center gap-3 hover:bg-slate-50/70 transition-colors">
                  <GripVertical className="w-4 h-4 text-slate-300 shrink-0" />
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 font-mono text-[11px] border border-slate-200 shrink-0">
                    {cat.id}
                  </span>

                  {editingId === cat.id ? (
                    <div className="flex-1 flex items-center gap-2 min-w-0">
                      <input
                        type="text"
                        autoFocus
                        value={editingLabel}
                        onChange={e => setEditingLabel(e.target.value)}
                        className="flex-1 px-3 py-1.5 rounded-xl border border-indigo-300 bg-white text-slate-900 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <button
                        onClick={handleSaveCategoryEdit}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-bold flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" /> 保存
                      </button>
                    </div>
                  ) : (
                    <span className={`flex-1 font-bold truncate ${cat.isEnabled ? 'text-slate-900' : 'text-slate-400 line-through'}`}>
                      {cat.label}
                    </span>
                  )}

                  <button
                    onClick={() => handleToggleCategory(cat)}
                    title={cat.isEnabled ? '点击停用' : '点击启用'}
                    className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${
                      cat.isEnabled ? 'bg-emerald-500' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
                        cat.isEnabled ? 'left-[18px]' : 'left-0.5'
                      }`}
                    />
                  </button>

                  <button
                    onClick={() => { setEditingId(cat.id); setEditingLabel(cat.label); }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                    title="改名"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <PopconfirmBubble
                    title={`确定删除分类「${cat.label}」？`}
                    description="已归属该分类的技能不受影响，但将不再出现在分类列表中。"
                    type="danger"
                    confirmText="确认删除"
                    cancelText="取消"
                    placement="top-left"
                    onConfirm={() => performDeleteCategory(cat)}
                    trigger={({ onClick }) => (
                      <button
                        onClick={onClick}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 专家组新增/编辑表单弹层 */}
      {domainFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            id="expert-domain-form"
            className="relative w-full max-w-lg bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden"
          >
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">
                  {editingDomain ? `编辑专家组：${editingDomain.name}` : '新增专家组'}
                </h3>
              </div>
              <button
                onClick={() => setDomainFormOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs">
              {!editingDomain && (
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    专家组 key <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.id}
                    onChange={e => setForm({ ...form, id: e.target.value })}
                    placeholder="小写字母/数字/下划线，如 research"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 font-mono outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    专家组名称 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="如 行业研究专家组"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    简称 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.shortLabel}
                    onChange={e => setForm({ ...form, shortLabel: e.target.value })}
                    placeholder="首页卡片标题，如 行业研究"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  详情描述
                </label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="首页卡片副标题小字展示的岗位描述"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 resize-none leading-relaxed"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">图标</label>
                  <select
                    value={form.iconName}
                    onChange={e => setForm({ ...form, iconName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 font-mono outline-none"
                  >
                    {ICON_OPTIONS.map(icon => (
                      <option key={icon} value={icon}>{icon}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-800 mb-1">徽章配色</label>
                  <select
                    value={`${form.badgeBg}|${form.badgeText}|${form.badgeBorder}`}
                    onChange={e => {
                      const [bg, text, border] = e.target.value.split('|');
                      setForm({ ...form, badgeBg: bg, badgeText: text, badgeBorder: border });
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 outline-none"
                  >
                    {BADGE_THEMES.map(t => (
                      <option key={t.label} value={`${t.badgeBg}|${t.badgeText}|${t.badgeBorder}`}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 徽章预览 */}
              <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className={`px-2.5 py-1 rounded-full border text-[11px] font-black ${form.badgeBg} ${form.badgeText} ${form.badgeBorder}`}>
                  {form.shortLabel || '徽章预览'}
                </span>
                <span className="text-[11px] text-slate-400">徽章将展示在首页卡片与技能详情</span>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
              <button
                onClick={() => setDomainFormOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100"
              >
                取消
              </button>
              <button
                onClick={handleSaveDomain}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                {editingDomain ? '保存修改' : '创建专家组'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
