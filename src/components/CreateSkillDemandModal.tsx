import React, { useState } from 'react';
import {
  Sparkles,
  Coins,
  AlertCircle,
  Calendar,
  Layers, 
  HelpCircle, 
  CheckCircle2, 
  Target, 
  Info,
  ChevronRight,
  Clock
} from 'lucide-react';
import { ExpertDomain, SkillDemand, UserAccount } from '../types';
import { useExpertDomains } from '../hooks/useExpertDomains';
import { Modal } from './Modal';

interface CreateSkillDemandModalProps {
  isOpen: boolean;
  currentUser: UserAccount | null;
  onClose: () => void;
  onSubmitDemand: (demand: Omit<SkillDemand, 'id' | 'createdAt' | 'updatedAt' | 'submissionsCount'>) => void;
  onOpenLogin: () => void;
  onToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, message: string) => void;
}

export const CreateSkillDemandModal: React.FC<CreateSkillDemandModalProps> = ({
  isOpen,
  currentUser,
  onClose,
  onSubmitDemand,
  onOpenLogin,
  onToast
}) => {
  const [title, setTitle] = useState('');
  const [targetDomain, setTargetDomain] = useState<ExpertDomain>('fullstack');
  const [description, setDescription] = useState('');
  const [expectedOutput, setExpectedOutput] = useState('');
  const [bountyPoints, setBountyPoints] = useState<number>(500);
  const [deadlineText, setDeadlineText] = useState('永久有效');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!currentUser) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        size="md"
        showCloseButton={false}
      >
        <div className="p-8 text-center space-y-6">
          <div className="w-16 h-16 rounded-3xl bg-amber-50 text-amber-600 border border-amber-200/80 flex items-center justify-center mx-auto shadow-sm">
            <Coins className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-black text-slate-900">需要登录后发布征集需求</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              登录企业账号即可使用您持有的 <strong className="text-indigo-600 font-bold">10,000 奖励积分</strong> 发起征集业务急需的 AI 技能与 MCP 插件。
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              取消
            </button>
            <button
              onClick={() => {
                onClose();
                onOpenLogin();
              }}
              className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-500/20"
            >
              立即登录
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      onToast('warning', '信息未完善', '请填写技能需求标题');
      return;
    }

    if (!description.trim() || description.length < 15) {
      onToast('warning', '描述过短', '请至少输入 15 字以上清晰描述业务场景与痛点');
      return;
    }

    if (bountyPoints < 100) {
      onToast('warning', '奖励积分不足', '奖励积分最低 100 积分起步');
      return;
    }

    if (currentUser.points < bountyPoints) {
      onToast('error', '积分余额不足', `当前可用积分为 ${currentUser.points}，无法设定 ${bountyPoints} 积分`);
      return;
    }

    setIsSubmitting(true);

    try {
      onSubmitDemand({
        title: title.trim(),
        description: description.trim(),
        targetDomain,
        expectedOutput: expectedOutput.trim() || '符合企业规范与安全标准的 MCP 插件 / Prompt 技能扩展包',
        bountyPoints,
        deadlineText,
        author: {
          id: currentUser.id,
          name: currentUser.name,
          avatar: currentUser.avatar,
          department: currentUser.department
        },
        status: 'pending'
      });

      onToast('success', '征集需求已提交', `奖励 ${bountyPoints} 积分已冻结，待管理员审核通过后将在征集广场上线！`);
      onClose();
      // Reset
      setTitle('');
      setDescription('');
      setExpectedOutput('');
      setBountyPoints(500);
      setDeadlineText('永久有效');
    } catch (err: any) {
      onToast('error', '提交失败', err?.message || '网络异常');
    } finally {
      setIsSubmitting(false);
    }
  };

  const { domains: backendDomains } = useExpertDomains();
  const domainOptions = backendDomains;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="2xl"
      align="top"
      containerClassName="pt-10 sm:pt-16"
      header={
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 border border-amber-200/80 flex items-center justify-center shrink-0">
            <Coins className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-black text-slate-900 truncate">
                发布技能需求征集
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[11px] font-bold border border-amber-200">
                积分激励
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              描述业务痛点并设定奖励积分，吸引内网全栈/算法/设计/测试工程师为你定制 AI 技能。
            </p>
          </div>
        </div>
      }
    >
      <div className="p-5 sm:p-6 text-left space-y-5">
        {/* Balance Card */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 via-orange-50/50 to-indigo-50/40 border border-amber-200/80 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-sm shadow-sm">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] text-slate-500 font-medium">我的技能积分</div>
              <div className="text-base font-black text-slate-900">
                {currentUser.points.toLocaleString()} <span className="text-xs font-normal text-slate-600">积分</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[11px] text-slate-500 block">发布后自动扣除冻结</span>
            <span className="text-xs font-bold text-amber-700">撤销需求全额原路退还</span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              需求标题 <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="例如：PRD 智能拆解与 Mermaid 业务时序图生成器"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs text-slate-800"
            />
          </div>

          {/* Expert Domain Category */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              面向专家组 / 岗位分类 <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {domainOptions.map(domain => (
                <button
                  type="button"
                  key={domain.id}
                  onClick={() => setTargetDomain(domain.id)}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    targetDomain === domain.id
                      ? `${domain.badgeBg} ${domain.badgeText} border-indigo-400 font-bold ring-2 ring-indigo-400/20 shadow-2xs`
                      : 'bg-slate-50/60 border-slate-200 text-slate-600 hover:bg-slate-100/80 font-medium'
                  }`}
                >
                  <div className="text-xs">{domain.shortLabel}</div>
                  <div className="text-[10px] text-slate-400 truncate mt-0.5">{domain.name}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              需求背景与详细痛点描述 <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="详细说明你在日常开发/设计/产品工作中遇到的痛点、希望 AI 插件执行的具体工作流与上下文..."
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs text-slate-800 resize-none leading-relaxed"
            />
          </div>

          {/* Expected Output */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              期望交付形式与能力标准 (选填)
            </label>
            <input
              type="text"
              value={expectedOutput}
              onChange={e => setExpectedOutput(e.target.value)}
              placeholder="例如：支持 Claude Code CLI 与 MCP 协议，输出格式规范，附带只读权限配置"
              className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs text-slate-800"
            />
          </div>

          {/* Bounty Points & Deadline */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                设定奖励积分 <span className="text-rose-500">* (最低 100 起)</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={100}
                  max={currentUser.points}
                  step={50}
                  required
                  value={bountyPoints}
                  onChange={e => setBountyPoints(Math.max(100, parseInt(e.target.value) || 100))}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs text-slate-900 font-bold pl-8"
                />
                <Coins className="absolute left-3 top-2.5 w-4 h-4 text-amber-500" />
              </div>
              <div className="flex items-center gap-1.5 mt-1.5 text-[11px]">
                <span className="text-slate-400">快捷推荐：</span>
                {[500, 1000, 2000, 3000].map(amt => (
                  <button
                    type="button"
                    key={amt}
                    onClick={() => setBountyPoints(amt)}
                    className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${
                      bountyPoints === amt 
                        ? 'bg-amber-100 text-amber-900 border-amber-300' 
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {amt}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                时间周期
              </label>
              <div className="relative">
                <select
                  value={deadlineText}
                  onChange={e => setDeadlineText(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs text-slate-800 bg-white"
                >
                  <option value="永久有效">永久有效 (默认)</option>
                  <option value="7天有效">7天内有效</option>
                  <option value="30天有效">30天内有效</option>
                  <option value="90天有效">90天内有效</option>
                </select>
              </div>
              <span className="text-[11px] text-slate-400 mt-1.5 block">
                到期若未解决可随时延期或撤销返还积分
              </span>
            </div>
          </div>

          {/* Audit Notice */}
          <div className="p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-100 text-xs text-slate-600 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-indigo-900">
              <Info className="w-3.5 h-3.5 text-indigo-600" />
              <span>审核与发布机制</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              提交后超级管理员与普通管理员将在管理中心看到审核记录，通过后即在全站征集广场公开亮相；若被驳回会给出详细理由，你可在个人中心随时修改或撤回。
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 active:scale-95 text-white text-xs font-bold transition-all shadow-md shadow-amber-500/20 flex items-center gap-2"
            >
              <Coins className="w-4 h-4" />
              <span>确认冻结并发布需求 ({bountyPoints} 积分)</span>
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};
