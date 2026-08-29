import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * AI 技能与插件主表实体
 * 包含技能元数据、多端客户端支持、文件树快照与多端安装命令
 */
@Entity('skills')
@Index('idx_skills_submitter_status', ['submitterId', 'status'])
export class SkillEntity {
  /** 技能唯一主键 ID (例如 skill-1) */
  @PrimaryColumn({ length: 64 })
  id: string;

  /** 技能中文展示名称 */
  @Column({ length: 150 })
  name: string;

  /**
   * 插件 Slug 标识 (例如 @skillhub/sql-diagnose-agent)
   *
   * 注意：同一插件的所有版本共享根版本的 slug（版本链 parent_skill_id 同链）
   * —— 插件身份 = 版本链，对外一个插件只有一个名字。因此该列不再唯一，
   * 仅保留普通索引保证按 slug 查询（findBySlug / resolveUniqueSlug）不退化。
   */
  @Index()
  @Column({ length: 100 })
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

  /**
   * 提交者的用户 ID（由登录会话写入，不接受前端传值）
   * 用它而不是 author 姓名来判定"我的提交"：姓名可重复也可被伪造，
   * 只有用户 ID 才能稳定归属技能（个人中心与审核追溯都依赖它）
   */
  @Column({ name: 'submitter_id', type: 'text', nullable: true })
  submitterId: string | null;

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

  /**
   * 归属的专家组/岗位领域清单（标签概念，一个技能可属于多个专家组）
   * 由管理员在「分类和专家组管理」中维护；expertDomain 保留为详情页主领域兼容
   */
  @Column('simple-json', { name: 'expert_domains', default: '[]' })
  expertDomains: string[];

  /**
   * 用户上传的原始 ZIP 压缩包（base64 编码）
   * 保留它才能无损还原二进制文件（图片/字体等），供下载与 Git 市场发布使用；
   * fileTree 仅存文本内容与目录结构，二进制文件在其中的文本表示是不可逆的
   */
  @Column({ name: 'zip_blob', type: 'text', nullable: true })
  zipBlob: string | null;

  /** 上传时的原始 ZIP 文件名（下载时优先使用，如 ui-ux-pro-max-skill-2.11.0.zip） */
  @Column({ name: 'zip_file_name', length: 255, nullable: true })
  zipFileName: string | null;

  /** 双引擎风控综合评分 (0~100)；未在审核工作台运行体检并保存结果为 null（未体检） */
  @Column({ nullable: true })
  auditScore: number | null;

  /** 审核操作人姓名 (管理员通过/驳回时写入) */
  @Column({ name: 'reviewed_by', type: 'text', nullable: true })
  reviewedBy: string;

  /** 审核操作时间 */
  @Column({ name: 'reviewed_at', type: 'text', nullable: true })
  reviewedAt: string;

  /** 管理员审核意见与驳回理由 */
  @Column({ name: 'admin_feedback', type: 'text', nullable: true })
  adminFeedback: string;

  /**
   * 版本关系：当前版本指向其前驱版本（第一版为 null）
   * 多版本发布时，新版本记录这个字段指向旧版；approved 切换到 archived 时
   * 旧版的 superseded_by_id 指向新版，方便查"现在谁在用"
   */
  @Index()
  @Column({ name: 'parent_skill_id', type: 'text', nullable: true })
  parentSkillId: string | null;

  /**
   * 版本关系：当前 archived 版本指向替代它的 approved 版本
   * 与 parent_skill_id 反向：parentSkillId = "我从哪来"，supersededById = "谁替代了我"
   * 仅 archived 状态写入；approved / pending / rejected 均为 null
   */
  @Column({ name: 'superseded_by_id', type: 'text', nullable: true })
  supersededById: string | null;

  /**
   * 被新版替代的时间戳（archived 状态时填入）
   * 与 rejected（永久死信，需重新提交）的语义区分；archived = 历史版本，记录保留
   */
  @Column({ name: 'archived_at', type: 'text', nullable: true })
  archivedAt: string | null;

  /**
   * 多版本发布模式（仅在 parent_skill_id 非空时有意义）
   * 'replace' = 审核通过时自动 archive 旧版（counters 累加）
   * 'coexist' = 旧版保留 approved 不动，新版独立计 counter
   * 第一版（无 parent）为 null
   */
  @Column({ name: 'supersede_mode', length: 20, nullable: true })
  supersedeMode: 'replace' | 'coexist' | null;

  /** 创建时间 */
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  /** 更新时间 */
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
