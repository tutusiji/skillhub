import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../services/api';
import { useFeedbackStore } from '../feedbackStore';
import { useToastStore } from '../toastStore';
import { makeApiFeedback, makeFeedback } from '../../test/factories';

// mock api 模块：展开真实模块方法名逐一替换为 vi.fn()，保留真实 mapper。
// 注意：vi.mock 工厂会被提升到文件顶部，不能引用文件内顶层 import 绑定（TDZ），
// 辅助函数必须在工厂里用动态 await import() 拿。
vi.mock('../../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/api')>();
  const { createApiMock } = await import('../../test/helpers/mockApi');
  return { ...actual, api: createApiMock(actual.api) };
});

const createFeedback = () => vi.mocked(api.createFeedback);
const deleteFeedback = () => vi.mocked(api.deleteFeedback);

/**
 * feedbackStore 单测：创建/删除成功后更新列表并 toast，失败仅 toast 不破坏列表。
 * 跨 store 联动（→ toastStore）一并断言。
 */

beforeEach(() => {
  useFeedbackStore.setState({ feedbackList: [] });
  useToastStore.setState({ toasts: [] });
});

describe('feedbackStore.createFeedback', () => {
  it('成功后把新建议插入列表头部并弹成功 toast', async () => {
    const created = makeApiFeedback({ title: '新建议' });
    createFeedback().mockResolvedValue(created);

    useFeedbackStore.setState({ feedbackList: [makeFeedback({ id: 'old' })] });
    await useFeedbackStore.getState().createFeedback({
      title: '新建议',
      content: '内容',
      category: 'experience',
      rating: 5,
    });

    const list = useFeedbackStore.getState().feedbackList;
    expect(list).toHaveLength(2);
    expect(list[0].title).toBe('新建议');
    expect(list[0].id).toBe(created.id);
    expect(list[1].id).toBe('old');
    expect(useToastStore.getState().toasts[0].type).toBe('success');
  });

  it('失败时列表不变并弹错误 toast', async () => {
    createFeedback().mockRejectedValue(new Error('网关超时'));
    useFeedbackStore.setState({ feedbackList: [makeFeedback({ id: 'old' })] });

    await useFeedbackStore.getState().createFeedback({
      title: '新建议',
      content: '内容',
      category: 'bug',
      rating: 3,
    });

    expect(useFeedbackStore.getState().feedbackList).toHaveLength(1);
    const toast = useToastStore.getState().toasts[0];
    expect(toast.type).toBe('error');
    expect(toast.message).toContain('网关超时');
  });
});

describe('feedbackStore.deleteFeedback', () => {
  it('成功后从列表移除并弹成功 toast', async () => {
    deleteFeedback().mockResolvedValue(undefined as never);
    useFeedbackStore.setState({
      feedbackList: [makeFeedback({ id: 'a' }), makeFeedback({ id: 'b' })],
    });

    await useFeedbackStore.getState().deleteFeedback('a');

    expect(useFeedbackStore.getState().feedbackList.map((f) => f.id)).toEqual(['b']);
    expect(useToastStore.getState().toasts[0].type).toBe('success');
  });

  it('失败时列表不变并弹错误 toast', async () => {
    deleteFeedback().mockRejectedValue(new Error('无权限'));
    useFeedbackStore.setState({ feedbackList: [makeFeedback({ id: 'a' })] });

    await useFeedbackStore.getState().deleteFeedback('a');

    expect(useFeedbackStore.getState().feedbackList).toHaveLength(1);
    expect(useToastStore.getState().toasts[0].type).toBe('error');
  });
});

describe('feedbackStore.setFeedbackList', () => {
  it('整表覆盖（登录/回源时使用）', () => {
    const list = [makeFeedback({ id: 'x' }), makeFeedback({ id: 'y' })];
    useFeedbackStore.getState().setFeedbackList(list);
    expect(useFeedbackStore.getState().feedbackList.map((f) => f.id)).toEqual(['x', 'y']);
  });
});
