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

  /** 企业工作邮箱 (唯一) */
  @Column({ unique: true, length: 150 })
  email: string;

  /** 加盐哈希密码 (bcrypt) */
  @Column({ name: 'password_hash', length: 255 })
  passwordHash: string;

  /** 用户系统角色 ('admin' | 'developer' | 'security_officer') */
  @Column({ default: 'developer', length: 30 })
  role: string;

  /** 所属研发部门/业务线 */
  @Column({ default: '技术研发中心', length: 100 })
  department: string;

  /** 用户头像 URL */
  @Column({ name: 'avatar_url', nullable: true, type: 'text' })
  avatar: string;

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
