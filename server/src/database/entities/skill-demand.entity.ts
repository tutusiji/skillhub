import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * 需求应征方案候选人快照结构
 */
export interface DemandCandidate {
  id: string;
  skillId?: string;
  skillName: string;
  submitterId: string;
  submitterName: string;
  submitterAvatar: string;
  submittedAt: string;
  notes: string;
  status: 'pending' | 'accepted' | 'rejected';
}

/**
 * 技能征集需求 (悬赏) 数据表实体
 * 记录需求正文、悬赏积分、审核流转状态与应征方案候选清单
 */
@Entity('skill_demands')
export class SkillDemandEntity {
  /** 需求唯一主键 */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** 需求标题 */
  @Column({ length: 200 })
  title: string;

  /** 需求详细描述与业务背景 */
  @Column({ type: 'text' })
  description: string;

  /** 目标专家组/岗位领域 */
  @Column({ name: 'target_domain', length: 50, default: 'fullstack' })
  targetDomain: string;

  /** 期望交付物形态说明 */
  @Column({ name: 'expected_output', type: 'text', nullable: true })
  expectedOutput: string;

  /** 悬赏积分 (最低 100，发布时从账户冻结扣减) */
  @Column({ name: 'bounty_points', default: 100 })
  bountyPoints: number;

  /** 有效期文案 (默认 '永久有效') */
  @Column({ name: 'deadline_text', length: 100, default: '永久有效' })
  deadlineText: string;

  /** 需求发布者用户 ID */
  @Column({ name: 'author_id', length: 64 })
  authorId: string;

  /** 需求发布者姓名快照 */
  @Column({ name: 'author_name', length: 150 })
  authorName: string;

  /** 需求发布者头像快照 */
  @Column({ name: 'author_avatar', type: 'text', nullable: true })
  authorAvatar: string;

  /** 需求发布者部门快照 */
  @Column({ name: 'author_department', length: 100, nullable: true })
  authorDepartment: string;

  /** 流转状态 ('pending' | 'approved' | 'rejected' | 'fulfilled' | 'closed') */
  @Column({ length: 30, default: 'pending' })
  status: string;

  /** 管理员驳回理由 */
  @Column({ name: 'reject_reason', type: 'text', nullable: true })
  rejectReason: string;

  /** 应征方案候选清单快照 */
  @Column('simple-json', { default: '[]' })
  candidates: DemandCandidate[];

  /** 悬赏积分是否已退还 (防止驳回后再删除导致重复退款) */
  @Column({ name: 'points_refunded', default: false })
  pointsRefunded: boolean;

  /** 审核操作人 */
  @Column({ name: 'reviewed_by', type: 'text', nullable: true })
  reviewedBy: string;

  /** 审核操作时间 */
  @Column({ name: 'reviewed_at', type: 'text', nullable: true })
  reviewedAt: string;

  /** 创建时间 */
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  /** 最后更新时间 */
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
