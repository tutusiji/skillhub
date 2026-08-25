import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * 岗位专家组配置实体
 *
 * 维护「岗位专家组矩阵」的专家组成员（id/名称/简称/描述/图标/徽章配色）。
 * 专家组即标签：技能通过 skills.expert_domains 关联到多个专家组。
 * 前端保留同名常量作为离线兜底；在线时以本表为权威。
 */
@Entity('expert_domains')
export class ExpertDomainEntity {
  /** 专家组 key，如 'fullstack'、'data_analyst' */
  @PrimaryColumn({ length: 50 })
  id: string;

  /** 专家组全称，如 '全栈与后端开发' */
  @Column({ length: 100 })
  name: string;

  /** 简称，如 '全栈开发'（首页卡片主标题） */
  @Column({ name: 'short_label', length: 50 })
  shortLabel: string;

  /** 详情描述（首页卡片副标题小字） */
  @Column({ type: 'text' })
  description: string;

  /** 图标名（前端 DomainIcon 映射） */
  @Column({ name: 'icon_name', length: 50, default: 'LayoutGrid' })
  iconName: string;

  /** 徽章背景 class */
  @Column({ name: 'badge_bg', length: 100, default: 'bg-slate-100' })
  badgeBg: string;

  /** 徽章文字 class */
  @Column({ name: 'badge_text', length: 100, default: 'text-slate-700' })
  badgeText: string;

  /** 徽章边框 class */
  @Column({ name: 'badge_border', length: 100, default: 'border-slate-200' })
  badgeBorder: string;

  /** 展示排序（升序） */
  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  /** 创建时间 */
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  /** 更新时间 */
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
