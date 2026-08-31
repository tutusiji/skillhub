import { create } from 'zustand';
import type { AuditRule, DeepSeekConfig } from '../types';
import { api, mapAuditRule } from '../services/api';
import { useToastStore } from './toastStore';

/**
 * 风控规则 store（迁移自 App.tsx 全部规则 handler + LLM 网关展示配置）。
 * 依赖 DAG：→ toastStore。
 * 规则以后端 /audit/rules 为唯一数据源（服务端已 seed 预置规则），本地不再内置
 * 副本，否则前端正则引擎会用与服务端不一致的规则做体检。变更一律乐观更新 +
 * 失败快照回滚 + toast 提示（规则 CRUD 是权威变更，不走 fire-and-forget）。
 */

/** LLM 网关展示配置初值：真实凭据与生效配置由后端 /audit/llm-config 持久化，
 *  前端只保留中性占位（不写死任何厂商地址/模型名） */
const INITIAL_LLM_CONFIG: DeepSeekConfig = {
  baseUrl: '',
  apiKey: '',
  modelName: '',
  temperature: 0.1,
  maxTokens: 2048,
  systemPrompt:
    '你是一个企业级 AI 技能安全合规审计引擎。请对待审代码与 Prompt 模板做多维度语义风险推导，输出风险等级、漏洞位置与整改建议。',
  testStatus: 'untested',
};

interface RulesState {
  rules: AuditRule[];
  /** LLM 网关展示配置（页脚/表单只读展示，真实凭据不回显） */
  deepseekConfig: DeepSeekConfig;

  setRules: (rules: AuditRule[]) => void;
  setDeepseekConfig: (config: DeepSeekConfig) => void;
  /** 新增/编辑规则：乐观写入 → 后端按新旧 ID 一并覆盖（新建时后端会重分配 ID） */
  saveRule: (rule: AuditRule) => Promise<void>;
  /** 删除规则（乐观移除 + 失败回滚） */
  deleteRule: (id: string) => Promise<void>;
  /** 开关规则（乐观翻转 + 失败回滚） */
  toggleRule: (id: string) => Promise<void>;
}

export const useRulesStore = create<RulesState>((set, get) => ({
  // 业务数据一律以后端为权威：初值必须为空，由 fetchMarketData 填充
  rules: [],
  deepseekConfig: INITIAL_LLM_CONFIG,

  setRules: (rules) => set({ rules }),
  setDeepseekConfig: (config) => set({ deepseekConfig: config }),

  saveRule: async (rule) => {
    const snapshot = get().rules;

    // 乐观更新：存在则替换，不存在则追加（新建场景先展示用户输入）
    set((state) => {
      const exists = state.rules.some((r) => r.id === rule.id);
      return exists
        ? { rules: state.rules.map((r) => (r.id === rule.id ? rule : r)) }
        : { rules: [...state.rules, rule] };
    });

    try {
      const saved = await api.saveAuditRule(rule);
      const mapped = mapAuditRule(saved);
      // 后端可能重新分配了规则 ID (新建场景)，需按新旧 ID 一并覆盖
      set((state) => {
        const merged = state.rules.map((r) =>
          r.id === rule.id || r.id === mapped.id ? mapped : r
        );
        return merged.some((r) => r.id === mapped.id)
          ? { rules: merged }
          : { rules: [...merged, mapped] };
      });
      useToastStore
        .getState()
        .addToast('success', '规则已保存', `${mapped.name} 已生效于双引擎风控`);
    } catch (error) {
      set({ rules: snapshot });
      useToastStore.getState().addToast('error', '规则保存失败', (error as Error).message);
    }
  },

  deleteRule: async (id) => {
    const snapshot = get().rules;
    set((state) => ({ rules: state.rules.filter((r) => r.id !== id) }));

    try {
      await api.deleteAuditRule(id);
      useToastStore
        .getState()
        .addToast('info', '规则已删除', '已将该项规则从检测引擎中移除');
    } catch (error) {
      set({ rules: snapshot });
      useToastStore.getState().addToast('error', '规则删除失败', (error as Error).message);
    }
  },

  toggleRule: async (id) => {
    const snapshot = get().rules;
    set((state) => ({
      rules: state.rules.map((r) => (r.id === id ? { ...r, isEnabled: !r.isEnabled } : r)),
    }));

    try {
      const updated = await api.toggleAuditRule(id);
      set((state) => ({
        rules: state.rules.map((r) => (r.id === id ? mapAuditRule(updated) : r)),
      }));
    } catch (error) {
      set({ rules: snapshot });
      useToastStore.getState().addToast('error', '规则状态切换失败', (error as Error).message);
    }
  },
}));
