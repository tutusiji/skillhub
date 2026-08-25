import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * 技能分类标签配置实体
 *
 * 维护「技能与 MCP 插件全量集市」与发布表单中的分类选项。
 * 分类 key（id）即技能实体 skills.category 的取值，管理端可增删改显示名、
 * 排序与启用状态；禁用后不再出现在集市 tab 与发布表单下拉中。
 */
@Entity('skill_categories')
export class SkillCategoryEntity {
  /** 分类 key，如 'coding'、'database'（与 skills.category 对应） */
  @PrimaryColumn({ length: 50 })
  id: string;

  /** 分类展示名称，如 '数据库与 SQL' */
  @Column({ length: 100 })
  label: string;

  /** 展示排序（升序） */
  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  /** 是否启用（禁用后集市与发布表单不再展示） */
  @Column({ name: 'is_enabled', default: true })
  isEnabled: boolean;

  /** 创建时间 */
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  /** 更新时间 */
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
