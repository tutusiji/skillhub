import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

/**
 * 双引擎风控规则表实体
 * 包含正则特征库、LLM 语义研判 Prompt 模板与级别配置
 */
@Entity('audit_rules')
export class AuditRuleEntity {
  /** 规则唯一 ID */
  @PrimaryColumn({ length: 64 })
  id: string;

  /** 规则名称 */
  @Column({ length: 150 })
  name: string;

  /** 引擎类型 ('regex' | 'llm') */
  @Column({ length: 30 })
  type: string;

  /** 风险级别 ('critical' | 'high' | 'medium' | 'low') */
  @Column({ length: 30 })
  severity: string;

  /** 规则分类 ('security' | 'privacy' | 'compliance' | 'stability') */
  @Column({ length: 50 })
  category: string;

  /** 规则详细说明 */
  @Column({ type: 'text', nullable: true })
  description: string;

  /** 正则表达式特征表达式 (针对 regex 类型) */
  @Column({ type: 'text', nullable: true })
  pattern: string;

  /** LLM 研判提示词模板 (针对 llm 类型) */
  @Column({ name: 'llm_prompt_template', type: 'text', nullable: true })
  llmPromptTemplate: string;

  /** 是否已启用 */
  @Column({ default: true })
  isEnabled: boolean;

  /** 是否为系统内置预设规则 */
  @Column({ default: false })
  isPreset: boolean;

  /** 规则创建时间 */
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
