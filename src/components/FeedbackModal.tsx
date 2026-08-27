import React, { useState } from 'react';
import { MessageSquarePlus, Star, Send } from 'lucide-react';
import { UserAccount } from '../types';
import { Modal } from './Modal';

interface FeedbackModalProps {
  currentUser: UserAccount;
  onClose: () => void;
  /** 提交建议表单，由上层调用后端持久化 */
  onSubmit: (payload: { title: string; content: string; category: string; rating: number }) => void;
  onToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, message: string) => void;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  onClose,
  onSubmit,
  onToast
}) => {
  const [rating, setRating] = useState(5);
  const [category, setCategory] = useState<'feature' | 'bug' | 'security' | 'experience' | 'other'>('feature');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      onToast('warning', '请填写完整', '建议主题与详细内容不能为空');
      return;
    }

    onSubmit({
      title: title.trim(),
      content: content.trim(),
      category,
      rating,
    });
    onClose();
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="lg"
      panelClassName="!overflow-hidden"
      header={
        <div className="flex items-center gap-2 min-w-0">
          <MessageSquarePlus className="w-5 h-5 text-indigo-600 shrink-0" />
          <h3 className="text-base font-bold text-slate-900 truncate">提交建议</h3>
        </div>
      }
    >
      <div id="feedback-modal">
        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-800 mb-1.5">
              产品整体满意度评分
            </label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  type="button"
                  key={star}
                  onClick={() => setRating(star)}
                  className="p-1 hover:scale-110 transition-transform"
                >
                  <Star
                    className={`w-6 h-6 ${
                      star <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'
                    }`}
                  />
                </button>
              ))}
              <span className="text-xs font-semibold text-slate-600 ml-2">
                {rating === 5 ? '非常满意 🚀' : rating === 4 ? '比较满意 👍' : rating === 3 ? '一般 😐' : '有待改进 🛠️'}
              </span>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-800 mb-1">
              建议类别
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
            >
              <option value="feature">新功能需求建议 (Feature Request)</option>
              <option value="security">安全审核规则改进建议 (Security Rule)</option>
              <option value="experience">交互体验与文件树预览 (UI / UX)</option>
              <option value="bug">缺陷与异常报告 (Bug Report)</option>
              <option value="other">其他建议 (Other)</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-800 mb-1">
              建议主题 <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如：建议在 ZIP 打包下载中增加直接支持 Docker Compose 编排模板"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-800 mb-1">
              详细描述与诉求 <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="请详细描述您遇到的问题或希望 SkillHub 支持的场景，帮助内网开发者生态更强大..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 resize-none leading-relaxed"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
            >
              <Send className="w-3.5 h-3.5" />
              <span>提交建议</span>
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};
