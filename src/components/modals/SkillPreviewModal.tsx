import React, { useState, useEffect } from 'react';
import {
  Eye,
  Clock,
  XCircle,
  ShieldAlert,
  AlertTriangle,
  FolderTree,
  CalendarClock,
  Package,
  Tag,
  ShieldCheck,
  Loader2,
  ExternalLink,
  Archive,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { FileTreeViewer } from '../ui/FileTreeViewer';
import { api, mapApiSkill } from '../../services/api';
import { SkillItem } from '../../types';

interface SkillPreviewModalProps {
  skill: SkillItem;
  onClose: () => void;
  /** 已发布/已下架/已归档技能底部「打开完整详情页」入口（进入详情页做下载/安装等完整操作） */
  onOpenDetail?: () => void;
}

/**
 * 技能预览弹窗 —— 个人中心「查看技能详情与文件树」的统一只读预览。
 *
 * 待审核/已驳回走「未发布预览」；已上架/已下架/已归档同样弹窗预览，
 * 底部提供「打开完整详情页」入口，完整操作（下载/安装/审计报告/发新版）仍从详情页进行。
 *
 * 与 SkillDetailPage 的区别：
 *   - 只读：不渲染收藏/点赞/下载/安装/分享/发布新版本等动作
 *   - 无返回按钮：只有关闭，天然回到个人中心，不会污染 /skill/:slug 深链
 *   - 顶部显著标注当前技能状态，避免误以为是详情页
 *   - fileTree 不在列表接口下发，打开时按需拉取详情（与详情页深链同一条链路）
 */
export const SkillPreviewModal: React.FC<SkillPreviewModalProps> = ({ skill, onClose, onOpenDetail }) => {
  const [detail, setDetail] = useState<SkillItem | null>(null);
  const [loading, setLoading] = useState(!(skill.fileTree?.length));

  // 已发布（上架/下架/归档）提供「打开完整详情页」入口；待审/驳回保持纯预览
  const isPublished =
    skill.status === 'approved' ||
    skill.status === 'offline' ||
    skill.status === 'archived';
  const isPending = skill.status === 'pending';
  const isRejected = skill.status === 'rejected';

  // 头部状态徽章：按技能状态区分文案与配色
  const statusBadge = (() => {
    if (isPending) {
      return { text: '技能预览 · 审核中', cls: 'bg-amber-50 text-amber-800 border-amber-200', Icon: Clock };
    }
    if (isRejected) {
      return { text: '技能预览 · 已驳回', cls: 'bg-rose-50 text-rose-700 border-rose-200', Icon: XCircle };
    }
    if (skill.status === 'offline') {
      return { text: '技能预览 · 已下架', cls: 'bg-slate-100 text-slate-700 border-slate-300', Icon: Eye };
    }
    if (skill.status === 'archived') {
      return { text: '技能预览 · 已归档', cls: 'bg-slate-100 text-slate-700 border-slate-300', Icon: Archive };
    }
    return { text: '技能预览 · 已上架', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: ShieldCheck };
  })();

  // 打开时按需拉取完整详情（含 fileTree）；列表数据没有源码。
  // 按 id 而非 slug 拉取：同一插件的所有版本共享根 slug，按 slug 会解析到
  // 「当前版本」而非被预览的这条历史/待审版本。
  useEffect(() => {
    if (skill.fileTree?.length) {
      setDetail(skill);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api
      .getSkill(skill.id)
      .then(raw => {
        if (cancelled) return;
        setDetail(mapApiSkill(raw));
      })
      .catch(() => {
        if (cancelled) return;
        // 拉取失败退回列表数据，元数据仍可预览
        setDetail(skill);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [skill]);

  const meta = detail ?? skill;

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="5xl"
      align="top"
      // 预览弹窗可能叠在其它弹窗之上（如版本记录弹窗里点「预览详情」），
      // 提级到 z-60 保证盖住下层弹窗，而不是被后渲染的同层弹窗压住。
      zIndex={60}
      containerClassName="pt-10 sm:pt-16"
      header={
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Eye className="w-5 h-5 text-indigo-600 shrink-0" />
              <span className="truncate">{meta.name}</span>
            </h2>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 ${statusBadge.cls}`}>
              <statusBadge.Icon className="w-3 h-3" />
              {statusBadge.text}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-mono truncate">
            {meta.slug} · {meta.version}
          </p>
        </div>
      }
      footer={
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-slate-400">
            {isPublished
              ? '预览不占用发布状态，完整操作请进入详情页'
              : '预览不占用上架状态，仅作者可见'}
          </span>
          <div className="flex items-center gap-2">
            {isPublished && onOpenDetail && (
              <button
                onClick={onOpenDetail}
                className="px-4 py-2 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                打开完整详情页
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors"
            >
              返回个人中心
            </button>
          </div>
        </div>
      }
    >
      <div className="p-5 sm:p-6 space-y-4">
        {/* 预览态显著标注：未发布技能标注仅作者可见；已发布技能提示完整操作在详情页 */}
        <div className={`p-3 rounded-2xl text-xs flex items-start gap-2 ${
          isPublished
            ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
            : 'bg-indigo-50 border border-indigo-200 text-indigo-800'
        }`}>
          {isPublished ? (
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          )}
          <div>
            {isPublished ? (
              <>
                <strong>技能预览（已发布）</strong> —— 下载原始 ZIP / 复制安装命令 /
                查看审计报告 / 发布新版本等完整操作，请在详情页中进行。
              </>
            ) : (
              <>
                <strong>技能预览（未发布）</strong> —— 此插件尚未上架，仅作者可见。
                收藏 / 点赞 / 下载 / 安装 / 分享等操作对预览态暂不可用。
              </>
            )}
          </div>
        </div>

        {/* 驳回意见 */}
        {isRejected && meta.auditResults?.adminFeedback && (
          <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <strong>管理员驳回意见：</strong>
              <span>{meta.auditResults.adminFeedback}</span>
            </div>
          </div>
        )}

        {/* 元信息 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="text-[10px] text-slate-500 flex items-center gap-1">
              <Tag className="w-3 h-3" /> 分类
            </div>
            <div className="text-xs font-bold text-slate-800 mt-1 truncate">{meta.category}</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="text-[10px] text-slate-500 flex items-center gap-1">
              <Package className="w-3 h-3" /> 版本
            </div>
            <div className="text-xs font-bold text-slate-800 mt-1 font-mono">{meta.version}</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="text-[10px] text-slate-500 flex items-center gap-1">
              <CalendarClock className="w-3 h-3" /> 提交时间
            </div>
            <div className="text-xs font-bold text-slate-800 mt-1">
              {new Date(meta.createdAt).toLocaleDateString('zh-CN')}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="text-[10px] text-slate-500 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> 双引擎得分
            </div>
            <div className="text-xs font-bold text-slate-800 mt-1">
              {meta.auditResults?.score ?? '—'} 分
            </div>
          </div>
        </div>

        {/* 简介 */}
        <div>
          <div className="text-xs font-bold text-slate-800 mb-1.5">技能简介</div>
          <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 border border-slate-200/80 rounded-xl p-3">
            {meta.description}
          </p>
        </div>

        {/* 文件树 */}
        <div>
          <div className="text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
            <FolderTree className="w-3.5 h-3.5 text-indigo-600" />
            文件树（源码预览）
          </div>
          <div className="rounded-2xl border border-slate-200 overflow-hidden h-[min(400px,50vh)]">
            {loading ? (
              <div className="h-full flex items-center justify-center bg-slate-50 text-xs text-slate-400 gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>正在加载文件树…</span>
              </div>
            ) : (
              <FileTreeViewer tree={meta.fileTree ?? []} heightClassName="h-full" />
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
