import { create } from 'zustand';
import type { FeedbackItem } from '../types';
import { api, mapApiFeedback } from '../services/api';
import { useToastStore } from './toastStore';

/**
 * 建议（反馈）列表 store。
 * 依赖 DAG：→ toastStore。
 * 数据源为后端 /api/v1/feedback（登录后拉取，未登录时为空列表）；
 * 创建/删除均为「以后端结果为准」的权威写操作，失败只提示不回滚
 * （列表由后端接口回源，本地只是展示缓存）。
 */
interface FeedbackState {
  feedbackList: FeedbackItem[];
  /** 以整表覆盖（登录/回源/分页刷新时使用） */
  setFeedbackList: (list: FeedbackItem[]) => void;
  /** 提交新建议：成功后插入列表头部并 toast */
  createFeedback: (payload: {
    title: string;
    content: string;
    category: string;
    rating: number;
  }) => Promise<void>;
  /** 删除建议：成功后从列表移除并 toast */
  deleteFeedback: (id: string) => Promise<void>;
}

export const useFeedbackStore = create<FeedbackState>((set) => ({
  feedbackList: [],
  setFeedbackList: (list) => set({ feedbackList: list }),
  createFeedback: async (payload) => {
    try {
      const created = await api.createFeedback(payload);
      set((state) => ({ feedbackList: [mapApiFeedback(created), ...state.feedbackList] }));
      useToastStore
        .getState()
        .addToast('success', '感谢您的建议', '您的建议已提交至建议中心，管理员会持续跟进！');
    } catch (error) {
      useToastStore.getState().addToast('error', '提交失败', (error as Error).message);
    }
  },
  deleteFeedback: async (id) => {
    try {
      await api.deleteFeedback(id);
      set((state) => ({ feedbackList: state.feedbackList.filter((f) => f.id !== id) }));
      useToastStore
        .getState()
        .addToast('success', '建议已删除', '该建议已从建议中心移除');
    } catch (error) {
      useToastStore.getState().addToast('error', '删除失败', (error as Error).message);
    }
  },
}));
