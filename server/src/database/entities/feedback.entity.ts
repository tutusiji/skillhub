import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

/**
 * 用户建议/反馈数据表实体
 * 记录员工对全站功能与体验的建议，支持管理员查看与删除（不做回复流转）
 */
@Entity('feedback')
export class FeedbackEntity {
  /** 建议唯一主键 */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** 建议主题 */
  @Column({ length: 200 })
  title: string;

  /** 建议详细内容 */
  @Column({ type: 'text' })
  content: string;

  /** 建议分类 ('feature' | 'bug' | 'security' | 'experience' | 'other') */
  @Column({ length: 30, default: 'feature' })
  category: string;

  /** 满意度评分 (1-5) */
  @Column({ default: 5 })
  rating: number;

  /** 提交者用户 ID (uuid) */
  @Column({ name: 'submitter_id', length: 64 })
  submitterId: string;

  /** 提交者姓名快照 */
  @Column({ name: 'submitter_name', length: 150 })
  submitterName: string;

  /** 提交者工号快照 */
  @Column({ name: 'submitter_employee_id', length: 32, nullable: true })
  submitterEmployeeId: string | null;

  /** 提交者头像快照 */
  @Column({ name: 'submitter_avatar', type: 'text', nullable: true })
  submitterAvatar: string;

  /** 提交者部门快照 */
  @Column({ name: 'submitter_department', length: 100, nullable: true })
  submitterDepartment: string;

  /** 提交时间 */
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
