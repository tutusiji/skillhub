import React, { useCallback, useEffect, useState } from 'react';
import {
  GitBranch,
  CheckCircle2,
  Clock,
  XCircle,
  Eye,
  Archive,
  Download,
  Edit3,
  Trash2,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  RefreshCw,
  PackageOpen,
} from 'lucide-react';
import { Modal } from './Modal';
import { api, mapApiSkill } from '../services/api';
import { SkillItem } from '../types';
import { PopconfirmBubble } from './PopconfirmBubble';

interface SkillVersionManagerModalProps {
  /** 插件代表行（个人中心列表按插件分组后的当前版本），用于定位版本链与展示插件身份 */
  plugin: SkillItem;
  onClose: () => void;
  /** 预览某个版本的详情与文件树（只读弹窗） */
  onPreview: (skill: SkillItem) => void;
  /** 下载某个版本的原始 ZIP */
  onDownloadZip: (skill: SkillItem) => void;
  /** 编辑某个版本的元数据（白名单字段） */
  onEditMeta?: (skill: SkillItem) => void;
  /** 从某个版本发布新版本（带 parentSkillId 打开上传弹窗） */
  onPublishNewVersion?: (skill: SkillItem) => void;
  /** 删除某个版本（仅驳回版本可删，作者本人）；返回 Promise 供弹窗在成功后刷新 */
  onDeleteVersion: (id: string) => Promise<void>;
  onToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, message: string) => void;
}

/** 版本状态徽章：颜色与文案与个人中心/详情页保持一致 */
const STATUS_BADGE: Record<
  string,
  { text: string; cls: string; Icon: typeof CheckCircle2 }
> = {
  approved: { text: '已上架', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: CheckCircle2 },
  pending: { text: '审核中', cls: 'bg-amber-50 text-amber-800 border-amber-200', Icon: Clock },
  rejected: { text: '已驳回', cls: 'bg-rose-50 text-rose-700 border-rose-200', Icon: XCircle },
  offline: { text: '已下架', cls: 'bg-slate-100 text-slate-700 border-slate-300', Icon: Eye },
  archived: { text: '已归档', cls: 'bg-slate-100 text-slate-700 border-slate-300', Icon: Archive },
};

/**
 * 插件版本记录管理弹窗 —— 个人中心「我的技能插件」的二层入口
 *
 * 一层列表只展示插件卡片（一个插件一行）；点进本弹窗后按版本链拉全量版本
 * （含 archived，owner 可见性由后端收敛），逐版本提供：
 *   预览详情 / 下载 ZIP / 编辑元数据 / 发布新版本 / 删除（仅驳回版本）。
 * 版本记录经 GET /skills/:id/versions 实时拉取，删除后自动刷新。
 */
export const SkillVersionManagerModal: React.FC<SkillVersionManagerModalProps> = ({
  plugin,
  onClose,
  onPreview,
  onDownloadZip,
  onEditMeta,
  onPublishNewVersion,
  onDeleteVersion,
  onToast,
}) => {
  const [versions, setVersions] = useState<SkillItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // 删除中的版本 ID（防连点）
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .getSkillVersions(plugin.id)
      .then((list) => setVersions(list.map(mapApiSkill)))
      .catch((e) => setError((e as Error).message || '版本记录加载失败'))
      .finally(() => setLoading(false));
  }, [plugin.id]);

  useEffect(load, [load]);

  const handleDelete = (v: SkillItem) => {
    if (deletingId) return;
    setDeletingId(v.id);
    onDeleteVersion(v.id)
      .then(() => {
        onToast('success', '版本已删除', `${v.name} v${v.version} 已彻底移除`);
        load(); // 刷新版本链
      })
      .catch(() => {
        // App 层已弹错误 toast，这里无需重复提示
      })
      .finally(() => setDeletingId(null));
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="5xl"
      align="top"
      containerClassName="pt-10 sm:pt-16"
      header={
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-indigo-600 shrink-0" />
              <span className="truncate">{plugin.name}</span>
              <span className="text-sm font-normal text-slate-400">· 版本记录</span>
            </h2>
            {versions && !loading && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                {versions.length} 个版本
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1 font-mono truncate">
            {plugin.slug} · 当前 {plugin.version}
          </p>
        </div>
      }
      footer={
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-slate-400">
            同一插件的所有版本共享一个名称与安装命令；对外仅展示当前已上架版本。
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors"
          >
            关闭
          </button>
        </div>
      }
    >
      <div className="p-5 sm:p-6">
        {loading && !versions && (
          <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-3">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-xs">正在加载版本记录…</span>
          </div>
        )}

        {error && !versions && (
          <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-500" />
            <span className="text-xs">{error}</span>
            <button
              onClick={load}
              className="mt-1 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" /> 重试
            </button>
          </div>
        )}

        {versions && versions.length === 0 && (
          <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-3">
            <PackageOpen className="w-8 h-8 text-slate-300" />
            <span className="text-xs">暂无版本记录</span>
          </div>
        )}

        {versions && versions.length > 0 && (
          <div className="space-y-3">
            {versions.map((v) => {
              const badge = STATUS_BADGE[v.status] ?? STATUS_BADGE.approved;
              const isRejected = v.status === 'rejected';
              const isArchived = v.status === 'archived';
              const isPending = v.status === 'pending';
              const isCurrent = v.id === plugin.id;
              const isDeleting = deletingId === v.id;

              return (
                <div
                  key={v.id}
                  className={`rounded-2xl border p-4 space-y-3 transition-colors ${
                    isCurrent
                      ? 'border-indigo-300 bg-indigo-50/40'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  {/* 版本头部：版本号 + 状态 + 当前标记 */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-mono text-sm font-bold text-slate-900">
                        {v.version}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 border ${badge.cls}`}>
                        <badge.Icon className="w-3 h-3" />
                        {badge.text}
                      </span>
                      {isCurrent && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-600 text-white">
                          当前
                        </span>
                      )}
                      {isArchived && v.supersededById && (
                        <span className="text-[11px] text-slate-400 flex items-center gap-1">
                          <GitBranch className="w-3 h-3" /> 已被新版替代
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      提交于 {new Date(v.createdAt).toLocaleString('zh-CN')}
                    </div>
                  </div>

                  {/* 得分与驳回意见 */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
                      双引擎得分：
                      <b className="text-slate-900">
                        {v.auditResults?.score != null ? `${v.auditResults.score} 分` : '未体检'}
                      </b>
                    </span>
                    {isCurrent && (
                      <span className="text-[11px] text-slate-400">
                        {v.status === 'approved' ? '对外上架中，集市可见' : '未上架，仅你可见'}
                      </span>
                    )}
                  </div>

                  {isRejected && v.auditResults?.adminFeedback && (
                    <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <strong>管理员驳回意见：</strong>
                        <span>{v.auditResults.adminFeedback}</span>
                      </div>
                    </div>
                  )}

                  {/* 操作栏 */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                    <button
                      onClick={() => onPreview(v)}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" /> 预览详情
                    </button>
                    <button
                      onClick={() => onDownloadZip(v)}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" /> 下载 ZIP
                    </button>

                    {!isArchived && onEditMeta && (
                      <button
                        onClick={() => {
                          onEditMeta(v);
                          onClose();
                        }}
                        disabled={isRejected}
                        className="px-3 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50/60 hover:bg-indigo-50 text-indigo-700 font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        title={isRejected ? '已驳回：不能直接编辑，请发布新版本整改' : '编辑名称、简介、分类、版本号'}
                      >
                        <Edit3 className="w-3.5 h-3.5" /> 编辑元数据
                      </button>
                    )}

                    {!isArchived && onPublishNewVersion && (
                      <button
                        onClick={() => {
                          onPublishNewVersion(v);
                          onClose();
                        }}
                        disabled={isPending}
                        className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        title={isPending ? '已有待审核的新版本，请等待审核' : '上传新版本 ZIP，进入审核队列'}
                      >
                        <GitBranch className="w-3.5 h-3.5" /> 发布新版本
                      </button>
                    )}

                    {isRejected && (
                      <PopconfirmBubble
                        title="确定删除这个被驳回的版本吗？"
                        description="删除后不可恢复；若需整改请用「发布新版本」重新提交。"
                        type="danger"
                        confirmText="确认删除"
                        cancelText="取消"
                        placement="top-right"
                        onConfirm={() => handleDelete(v)}
                        trigger={({ onClick }) => (
                          <button
                            onClick={onClick}
                            disabled={isDeleting}
                            className="px-3 py-1.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            {isDeleting ? '删除中…' : '删除版本'}
                          </button>
                        )}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
};
