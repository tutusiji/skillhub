import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * 企业用户与账号数据表实体
 * 用于存储员工账号、密码哈希、所属部门与 RBAC 权限角色
 */
@Entity('users')
export class UserEntity {
  /** 用户唯一标识符 */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** 员工姓名/昵称 */
  @Column({ length: 150 })
  name: string;

  /** 企业工作邮箱 (唯一)。工号登录体系下不再作为主要登录凭证，仅作历史账号兜底通道 */
  @Column({ unique: true, length: 150 })
  email: string;

  /**
   * 员工工号 (唯一)，如 '7462200'
   * 普通用户的主要登录标识；OSS 登录也以此为幂等键
   * 可空：超级管理员用 loginName 登录，不占用工号
   */
  @Column({ name: 'employee_id', unique: true, nullable: true, length: 32 })
  employeeId: string | null;

  /**
   * 专用登录名 (唯一)，目前仅超级管理员使用 'admin'
   * 普通员工不分配登录名，一律用工号登录
   */
  @Column({ name: 'login_name', unique: true, nullable: true, length: 64 })
  loginName: string | null;

  /**
   * 账号来源渠道：'password' 自助注册 / 'oss' 内部 IAM 单点登录自动开号
   * OSS 开号的账号没有可用密码，只能继续走 OSS 通道登录
   */
  @Column({ name: 'auth_provider', default: 'password', length: 20 })
  authProvider: string;

  /** 加盐哈希密码 (bcrypt)。OSS 开号的账号存放一段不可用的随机哈希 */
  @Column({ name: 'password_hash', length: 255 })
  passwordHash: string;

  /**
   * 菜单级权限清单，如 ['audit', 'rules', 'demands', 'feedback', 'manage']
   * 超管恒拥有全部菜单（前端判定兜底），管理员按此清单逐项控制业务菜单可见性：
   * audit 审核管理 / rules 风控中心 / demands 征集管理 / feedback 建议管理 / manage 分类和专家组管理
   */
  @Column('simple-json', { name: 'menu_permissions', default: '[]' })
  menuPermissions: string[];

  /** 用户系统角色 ('super_admin' | 'admin' | 'user') */
  @Column({ default: 'user', length: 30 })
  role: string;

  /** 所属研发部门/业务线 */
  @Column({ default: '技术研发中心', length: 100 })
  department: string;

  /** 用户头像 URL */
  @Column({ name: 'avatar_url', nullable: true, type: 'text' })
  avatar: string;

  /**
   * 用户手动切换头像时选中的 seed（如 '7462200-a3f9'）
   *
   * 为空表示「跟随默认」，头像 seed 由工号推导。一旦用户点过「换一个头像」，
   * 这里就存下他选中的 seed，启动期 reconcile 必须以它为准重建 URL，
   * 否则换 host 或重启时会把用户选的脸重置回默认脸。
   * 只存 seed 不存完整 URL，是为了让「换头像服务」与「用户选择」互不干扰。
   */
  @Column({ name: 'avatar_seed', nullable: true, type: 'text' })
  avatarSeed: string | null;

  /** 积分/贡献点数 */
  @Column({ default: 10000 })
  points: number;

  /** 账号创建时间 */
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  /** 账号信息最后更新时间 */
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
