import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * AI 技能与插件主表实体
 * 包含技能元数据、多端客户端支持、文件树快照与多端安装命令
 */
@Entity('skills')
export class SkillEntity {
  /** 技能唯一主键 ID (例如 skill-1) */
  @PrimaryColumn({ length: 64 })
  id: string;

  /** 技能中文展示名称 */
  @Column({ length: 150 })
  name: string;

  /** 技能唯一 Slug 标识 (例如 @skillhub/sql-diagnose-agent) */
  @Column({ unique: true, length: 100 })
  slug: string;

  /** 业务分类 ('coding' | 'database' | 'devops' | 'mcp' | 'research') */
  @Column({ length: 50 })
  category: string;

  /** 技能详细功能描述 */
  @Column({ type: 'text' })
  description: string;

  /** 技能创建者/作者名称 */
  @Column({ length: 100 })
  author: string;

  /** 归属部门 */
  @Column({ default: '研发中心', length: 100 })
  department: string;

  /** 技能图标/封面 URL */
  @Column({ type: 'text', nullable: true })
  avatar: string;

  /** 最新版本号 (例如 v1.2.0) */
  @Column({ default: 'v1.0.0', length: 30 })
  version: string;

  /** 审核状态 ('approved' | 'pending' | 'rejected') */
  @Column({ default: 'pending', length: 30 })
  status: string;

  /** 支持的客户端列表 (['claude', 'cursor', 'mcp']) */
  @Column('simple-json', { default: '[]' })
  clients: string[];

  /** 标签列表 */
  @Column('simple-json', { default: '[]' })
  tags: string[];

  /** 累计下载/安装量 */
  @Column({ default: 0 })
  downloads: number;

  /** 获赞数 */
  @Column({ default: 0 })
  likes: number;

  /** 收藏/加星数 */
  @Column({ default: 0 })
  stars: number;

  /** 声明的系统权限与沙箱范围 */
  @Column('simple-json', { default: '[]' })
  permissions: string[];

  /** 多端一键安装命令配置 (Claude Code, Cursor, MCP, CLI) */
  @Column('simple-json')
  installCommands: {
    claude: string;
    cursor: string;
    mcp: string;
    cli: string;
  };

  /** ZIP 虚拟源码文件树目录结构快照 */
  @Column('simple-json', { default: '[]' })
  fileTree: any[];

  /** 技能说明文档 (SKILL.md / README 正文，与 description 摘要区分) */
  @Column({ type: 'text', nullable: true })
  readme: string;

  /** 适用专家组/岗位领域 (fullstack / dba / sre / ...) */
  @Column({ name: 'expert_domain', length: 50, nullable: true })
  expertDomain: string;

  /** 双引擎风控综合评分 (0~100) */
  @Column({ default: 100 })
  auditScore: number;

  /** 审核操作人姓名 (管理员通过/驳回时写入) */
  @Column({ name: 'reviewed_by', type: 'text', nullable: true })
  reviewedBy: string;

  /** 审核操作时间 */
  @Column({ name: 'reviewed_at', type: 'text', nullable: true })
  reviewedAt: string;

  /** 管理员审核意见与驳回理由 */
  @Column({ name: 'admin_feedback', type: 'text', nullable: true })
  adminFeedback: string;

  /** 创建时间 */
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  /** 更新时间 */
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
