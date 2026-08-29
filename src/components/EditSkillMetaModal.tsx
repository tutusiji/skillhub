import React, { useState, useEffect } from 'react';
import { Save, X, Edit3, AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';
import { Select } from './Select';
import { api } from '../services/api';
import { SkillItem, SkillCategory, SkillCategoryItem } from '../types';

interface EditSkillMetaModalProps {
  skill: SkillItem;
  onClose: () => void;
  /**
   * 编辑成功回调（参数为后端返回的最新 SkillItem 映射）
   * 由父组件负责把更新写回 skills 列表与触发 toast
   */
  onSuccess: (updated: SkillItem) => void;
  onToast: (
    type: 'success' | 'error' | 'warning' | 'info',
    title: string,
    message: string,
  ) => void;
}

/**
 * 技能作者编辑元数据弹窗（白名单字段：name / description / category / version）
 *
 * 与 UploadSkillModal 的区别：
 *   - 不带 ZIP 上传和双引擎风控扫描（编辑元数据不重跑风控）
 *   - 状态为 approved 时，version 字段禁用（要改 version 必须走"发布新版本"入口）
 *   - 状态为 rejected 时不允许编辑（引导走重新提交通道）
 */
export const EditSkillMetaModal: React.FC<EditSkillMetaModalProps> = ({
  skill,
  onClose,
  onSuccess,
  onToast,
}) => {
  const [name, setName] = useState(skill.name);
  const [description, setDescription] = useState(skill.description);
  const [category, setCategory] = useState<SkillCategory>(skill.category);
  const [version, setVersion] = useState(skill.version);
  const [categoryOptions, setCategoryOptions] = useState<SkillCategoryItem[]>(
    [],
  );
  const [submitting, setSubmitting] = useState(false);

  const isApproved = skill.status === 'approved';
  const isRejected = skill.status === 'rejected';

  useEffect(() => {
    api
      .listSkillCategories()
      .then(cats => {
        if (cats.length === 0) return;
        if (!cats.some(c => c.id === category)) {
          // 技能当前分类不在已启用分类里（分类被禁用/重命名/遗留值）。
          // 保留原值并补入选项，避免用户没动分类却在保存时被静默改成第一个分类。
          if (category) {
            setCategoryOptions([...cats, { id: category, label: category, sortOrder: 0, isEnabled: true }]);
          } else {
            setCategoryOptions(cats);
            setCategory(cats[0].id as SkillCategory);
          }
        } else {
          setCategoryOptions(cats);
        }
      })
      .catch(() => {
        /* 离线时使用当前值 */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async () => {
    if (!name.trim()) {
      onToast('warning', '请完善信息', '技能名称不能为空');
      return;
    }
    if (!description.trim()) {
      onToast('warning', '请完善信息', '请填写技能简介');
      return;
    }
    if (!version.trim()) {
      onToast('warning', '请完善信息', '版本号不能为空');
      return;
    }

    setSubmitting(true);
    try {
      const result = await api.updateSkillMeta(skill.id, {
        name: name.trim(),
        description: description.trim(),
        category,
        version: version.trim(),
        // 弹窗本身不支持 ZIP 上传；如需改 version，请关闭后用「发布新版本」入口
        newZipProvided: false,
      });
      // 把后端最新记录映射为前端 SkillItem 回传
      onSuccess({
        ...skill,
        name: result.name,
        slug: result.slug,
        version: result.version,
        description: result.description,
        category: result.category as SkillCategory,
        updatedAt: result.updatedAt || new Date().toISOString(),
      });
      onToast('success', '保存成功', `已更新 ${name.trim()} 的元数据`);
      onClose();
    } catch (error) {
      onToast('error', '保存失败', (error as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="lg"
      align="top"
      containerClassName="pt-10 sm:pt-16"
      header={
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-indigo-600 shrink-0" />
            <span className="truncate">编辑元数据：{skill.name}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            仅修改元数据，ZIP 包与版本号变更需走「发布新版本」入口
          </p>
        </div>
      }
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 disabled:opacity-50"
          >
            <X className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || isRejected}
            className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-500 disabled:opacity-50 flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            {submitting ? '保存中…' : '保存修改'}
          </button>
        </div>
      }
    >
      <div className="p-5 sm:p-6 space-y-4">
        {isRejected && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>已驳回的技能不能直接编辑，请前往「发布新版本」入口重新提交。</div>
          </div>
        )}

        {isApproved && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              已上架技能的版本号需在「发布新版本」时一并变更（需同步上传新 ZIP 包）。
              此弹窗的版本号字段已禁用。
            </div>
          </div>
        )}

        <div>
          <label className="block font-bold text-slate-800 mb-1 text-xs">
            技能名称 <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={150}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>

        <div>
          <label className="block font-bold text-slate-800 mb-1 text-xs">
            技能简介 <span className="text-rose-500">*</span>
          </label>
          <textarea
            rows={3}
            value={description}
            onChange={e => setDescription(e.target.value)}
            maxLength={500}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block font-bold text-slate-800 mb-1 text-xs">
              分类 <span className="text-rose-500">*</span>
            </label>
            <Select
              size="md"
              value={category}
              onChange={e => setCategory(e.target.value as SkillCategory)}
            >
              {categoryOptions.length > 0
                ? categoryOptions.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.label}
                    </option>
                  ))
                : (
                  <>
                    <option value="coding">编程开发 (Coding)</option>
                    <option value="database">数据与数据库 (Database)</option>
                    <option value="devops">运维与 DevOps</option>
                    <option value="mcp">MCP 协议</option>
                    <option value="research">调研与研究 (Research)</option>
                    <option value="data">大数据与商业智能 (Data)</option>
                    <option value="agent">自主决策智能体 (Agent)</option>
                  </>
                )}
            </Select>
          </div>

          <div>
            <label className="block font-bold text-slate-800 mb-1 text-xs">
              版本号 <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={version}
              onChange={e => setVersion(e.target.value)}
              disabled={isApproved}
              maxLength={20}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs focus:ring-2 focus:ring-indigo-500 outline-none font-mono disabled:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-500"
            />
          </div>
        </div>
      </div>
    </Modal>
  );
};
