import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../services/api';
import { useRulesStore } from '../rulesStore';
import { useToastStore } from '../toastStore';
import { makeApiAuditRule, makeAuditRule } from '../../test/factories';

// mock api 模块：展开真实模块方法名逐一替换为 vi.fn()，保留真实 mapper。
vi.mock('../../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/api')>();
  const { createApiMock } = await import('../../test/helpers/mockApi');
  return { ...actual, api: createApiMock(actual.api) };
});

const saveRule = () => vi.mocked(api.saveAuditRule);
const deleteRule = () => vi.mocked(api.deleteAuditRule);
const toggleRule = () => vi.mocked(api.toggleAuditRule);

/**
 * rulesStore 单测：规则 CRUD 的乐观更新 + 失败快照回滚 + 新建时后端重分配 ID 的
 * 新旧 ID 合并覆盖；deepseekConfig 为中性占位，setter 直接替换。
 */

beforeEach(() => {
  localStorage.clear();
  useRulesStore.setState({ rules: [], deepseekConfig: useRulesStore.getState().deepseekConfig });
  useToastStore.setState({ toasts: [] });
  vi.clearAllMocks();
});

describe('rulesStore.saveRule', () => {
  it('编辑已有规则：乐观覆盖 + 后端回写', async () => {
    useRulesStore.setState({ rules: [makeAuditRule({ id: 'r1', isEnabled: false })] });
    saveRule().mockResolvedValue(makeApiAuditRule({ id: 'r1', isEnabled: true }));

    // 乐观阶段：立即生效
    const p = useRulesStore.getState().saveRule(makeAuditRule({ id: 'r1', isEnabled: true }));
    expect(useRulesStore.getState().rules[0].isEnabled).toBe(true);

    await p;
    expect(useRulesStore.getState().rules[0].isEnabled).toBe(true);
    expect(useToastStore.getState().toasts[0]).toMatchObject({
      type: 'success',
      title: '规则已保存',
    });
  });

  it('新建规则：后端重分配 ID 时按新旧 ID 一并覆盖', async () => {
    // 前端暂存 id 与后端落库 id 不同（新建场景），合并后应只剩后端实体
    saveRule().mockResolvedValue(makeApiAuditRule({ id: 'r-server-9', name: '内网探测' }));

    await useRulesStore.getState().saveRule(makeAuditRule({ id: 'local-temp', name: '内网探测' }));

    const rules = useRulesStore.getState().rules;
    expect(rules).toHaveLength(1);
    expect(rules[0].id).toBe('r-server-9');
    expect(useRulesStore.getState().rules.some((r) => r.id === 'local-temp')).toBe(false);
  });

  it('保存失败：回滚乐观写入并弹错误', async () => {
    useRulesStore.setState({ rules: [makeAuditRule({ id: 'r1', isEnabled: false })] });
    saveRule().mockRejectedValue(new Error('网络中断'));

    await useRulesStore.getState().saveRule(makeAuditRule({ id: 'r1', isEnabled: true }));

    expect(useRulesStore.getState().rules[0].isEnabled).toBe(false);
    expect(useToastStore.getState().toasts[0]).toMatchObject({
      type: 'error',
      title: '规则保存失败',
    });
  });
});

describe('rulesStore.deleteRule', () => {
  it('删除成功：乐观移除并提示', async () => {
    useRulesStore.setState({ rules: [makeAuditRule({ id: 'r1' }), makeAuditRule({ id: 'r2' })] });
    deleteRule().mockResolvedValue({ success: true, id: 'r1' });

    await useRulesStore.getState().deleteRule('r1');

    expect(useRulesStore.getState().rules.map((r) => r.id)).toEqual(['r2']);
    expect(useToastStore.getState().toasts[0]).toMatchObject({
      type: 'info',
      title: '规则已删除',
    });
  });

  it('删除失败：回滚被删规则', async () => {
    useRulesStore.setState({ rules: [makeAuditRule({ id: 'r1' })] });
    deleteRule().mockRejectedValue(new Error('无权限'));

    await useRulesStore.getState().deleteRule('r1');

    expect(useRulesStore.getState().rules).toHaveLength(1);
    expect(useToastStore.getState().toasts[0]).toMatchObject({
      type: 'error',
      title: '规则删除失败',
    });
  });
});

describe('rulesStore.toggleRule', () => {
  it('开关成功：乐观翻转 + 后端回写状态', async () => {
    useRulesStore.setState({ rules: [makeAuditRule({ id: 'r1', isEnabled: false })] });
    toggleRule().mockResolvedValue(makeApiAuditRule({ id: 'r1', isEnabled: true }));

    const p = useRulesStore.getState().toggleRule('r1');
    // 乐观阶段立即翻转
    expect(useRulesStore.getState().rules[0].isEnabled).toBe(true);

    await p;
    expect(useRulesStore.getState().rules[0].isEnabled).toBe(true);
  });

  it('开关失败：回滚翻转', async () => {
    useRulesStore.setState({ rules: [makeAuditRule({ id: 'r1', isEnabled: true })] });
    toggleRule().mockRejectedValue(new Error('服务异常'));

    await useRulesStore.getState().toggleRule('r1');

    expect(useRulesStore.getState().rules[0].isEnabled).toBe(true);
    expect(useToastStore.getState().toasts[0]).toMatchObject({
      type: 'error',
      title: '规则状态切换失败',
    });
  });
});

describe('rulesStore.setDeepseekConfig', () => {
  it('直接替换展示配置（中性占位，不含真实凭据）', () => {
    useRulesStore.getState().setDeepseekConfig({ modelName: 'qwen-max' } as never);
    expect(useRulesStore.getState().deepseekConfig.modelName).toBe('qwen-max');
  });
});
