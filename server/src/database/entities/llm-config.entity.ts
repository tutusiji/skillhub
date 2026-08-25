import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

/**
 * LLM 审核引擎网关配置表实体
 * 全局仅一行 (id = 'default')，用于集中管理双引擎中「语义研判引擎」的模型网关凭据
 * 注意：apiKey 落库后不会通过 API 明文回传前端，仅返回掩码
 */
@Entity('llm_configs')
export class LlmConfigEntity {
  /** 配置行主键，固定为 'default'（全局单例配置） */
  @PrimaryColumn({ length: 32 })
  id: string;

  /** OpenAI 兼容协议的网关基址，如 https://api.deepseek.com/v1 */
  @Column({ name: 'base_url', length: 300, default: '' })
  baseUrl: string;

  /** 网关访问密钥 (仅服务端可读，不回传前端) */
  @Column({ name: 'api_key', type: 'text', nullable: true })
  apiKey: string;

  /** 模型名称，如 deepseek-chat */
  @Column({ name: 'model_name', length: 120, default: '' })
  modelName: string;

  /** 采样温度，审核场景建议 0 ~ 0.2 以保证判定稳定 */
  @Column({ type: 'float', default: 0.1 })
  temperature: number;

  /** 单次响应最大 token 数 */
  @Column({ name: 'max_tokens', type: 'int', default: 2048 })
  maxTokens: number;

  /** 审核引擎系统提示词 */
  @Column({ name: 'system_prompt', type: 'text', nullable: true })
  systemPrompt: string;

  /** 单次调用超时毫秒数 */
  @Column({ name: 'timeout_ms', type: 'int', default: 20000 })
  timeoutMs: number;

  /** 调用失败后的最大重试次数 */
  @Column({ name: 'max_retries', type: 'int', default: 2 })
  maxRetries: number;

  /** 是否启用真实 LLM 调用 (关闭时降级为本地启发式引擎) */
  @Column({ name: 'is_enabled', default: false })
  isEnabled: boolean;

  /** 最近一次连通性测试时间 */
  @Column({ name: 'last_tested_at', type: 'timestamp', nullable: true })
  lastTestedAt: Date | null;

  /** 最近一次连通性测试结果 ('success' | 'failed' | 'untested') */
  @Column({ name: 'test_status', length: 20, default: 'untested' })
  testStatus: string;

  /** 最近一次连通性测试的诊断信息 */
  @Column({ name: 'test_message', type: 'text', nullable: true })
  testMessage: string;

  /** 配置更新时间 */
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
