import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

/**
 * 安全沙箱体检报告与日志数据表实体
 * 记录每次技能扫描的耗时、得分、判定结论与命中的正则/LLM 研判结果快照
 */
@Entity('audit_reports')
export class AuditReportEntity {
  /** 报告唯一主键 */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** 关联的技能 ID */
  @Column({ name: 'skill_id', nullable: true, length: 64 })
  skillId: string;

  /** 综合安全得分 (0~100) */
  @Column({ default: 100 })
  score: number;

  /** 放行判定状态 ('passed' | 'warning' | 'failed') */
  @Column({ length: 30 })
  status: string;

  /** 扫描分析总耗时 (毫秒) */
  @Column({ name: 'duration_ms', default: 0 })
  durationMs: number;

  /** 正则特征引擎命中清单快照 */
  @Column('simple-json', { name: 'regex_hits', default: '[]' })
  regexHits: any[];

  /** LLM 语义研判结论与建议快照 */
  @Column('simple-json', { name: 'llm_verdict' })
  llmVerdict: any;

  /** 体检时间 */
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
