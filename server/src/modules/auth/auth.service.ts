import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UserEntity } from '../../database/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { findByUuid } from '../../common/db-id.util';
import { OssIamService } from './oss-iam.service';

/** 超级管理员的固定登录名，该标识为系统保留、不可注册 */
export const SUPER_ADMIN_LOGIN = 'admin';

/** 超级管理员初始密码，首次创建账号时使用 */
const DEFAULT_SUPER_ADMIN_PASSWORD = 'skill@2026';

/** 可被委任的角色白名单，super_admin 不可通过接口授予 */
export const ASSIGNABLE_ROLES = ['admin', 'user'];

/** 菜单级权限白名单：'audit' 审核管理 / 'rules' 风控中心 */
export const MENU_PERMISSION_KEYS = ['audit', 'rules'] as const;

/** 管理员默认获得的菜单权限 */
const DEFAULT_ADMIN_MENU_PERMISSIONS = ['audit', 'rules'];

export interface UserSession {
  id: string;
  name: string;
  email: string;
  /** 员工工号，超级管理员为 null */
  employeeId?: string | null;
  /** 专用登录名，仅超级管理员有值 */
  loginName?: string | null;
  /** 账号来源：password 自助注册 / oss 单点登录开号 */
  authProvider?: string;
  role: string;
  /** 菜单级权限清单（超管恒全量，前端兜底） */
  menuPermissions?: string[];
  department: string;
  avatar?: string;
  points?: number;
}

export interface AuthResponse {
  token: string;
  user: UserSession;
}

/**
 * 企业用户认证与鉴权核心服务
 * 提供用户注册、加盐密码哈希加密、账号登录、JWT 签发与种子用户初始化
 */
@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly jwtService: JwtService,
    private readonly ossIamService: OssIamService,
  ) {}

  /**
   * 模块初始化：播种预置账号，并对已有数据做幂等校正
   * 每次启动都会执行校正（而非仅空库时播种），确保历史数据平滑过渡到工号登录体系
   */
  async onModuleInit() {
    const count = await this.userRepository.count();
    if (count === 0) {
      await this.seedPresetUsers();
    }
    // 已有数据也要校正：角色改名、补工号、确保超管存在
    await this.reconcileAccounts();
  }

  /**
   * 播种 3 个预置演示账号 (仅空库时执行)
   */
  private async seedPresetUsers(): Promise<void> {
    const defaultHash = await bcrypt.hash('Password123!', 10);

    const presetUsers = [
      {
        name: '陈建国 (DBA架构师)',
        email: 'chenjg@skillhub.corp',
        employeeId: '7462201',
        passwordHash: defaultHash,
        role: 'user',
        department: '数据基础设施部',
        avatar:
          'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
        points: 10000,
      },
      {
        name: '张伟 (SRE专家)',
        email: 'zhangwei@skillhub.corp',
        employeeId: '7462202',
        passwordHash: defaultHash,
        role: 'user',
        department: '运维保障中心',
        avatar:
          'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
        points: 10000,
      },
    ];

    for (const u of presetUsers) {
      await this.userRepository.save(this.userRepository.create(u));
    }
    console.log('✅ 用户种子数据初始化成功 (2 个演示普通用户)');
  }

  /**
   * 账号数据幂等校正，每次启动执行，可重复运行
   * 1. 历史角色 developer 统一改名为 user
   * 2. 确保存在唯一的超级管理员账号 (登录名 admin)
   * 3. 为无工号的历史账号补发工号，避免工号登录体系下被锁死
   *
   * 顺序很重要：必须先认定超管，再补发工号，否则超管会被当成普通账号占用一个工号
   */
  private async reconcileAccounts(): Promise<void> {
    // 1. 角色改名：developer → user
    const renamed = await this.userRepository
      .createQueryBuilder()
      .update(UserEntity)
      .set({ role: 'user' })
      .where('role = :legacy', { legacy: 'developer' })
      .execute();
    if (renamed.affected) {
      console.log(`✅ 已将 ${renamed.affected} 个 developer 账号角色改名为 user`);
    }

    // 2. 确保超级管理员存在且角色正确
    await this.ensureSuperAdmin();

    // 3. 补发工号：按创建时间顺序生成，保证可重复执行时结果稳定
    const missingIdUsers = await this.userRepository.find({
      where: { employeeId: IsNull() },
      order: { createdAt: 'ASC' },
    });
    let backfilled = 0;
    for (const user of missingIdUsers) {
      // 超管走登录名通道，不占用工号
      if (user.loginName === SUPER_ADMIN_LOGIN) continue;
      user.employeeId = await this.allocateEmployeeId();
      await this.userRepository.save(user);
      backfilled += 1;
    }
    if (backfilled) {
      console.log(`✅ 已为 ${backfilled} 个历史账号补发工号`);
    }

    // 4. 为已有管理员补齐默认菜单权限，避免升级后管理员突然看不到管理菜单
    const adminUsers = await this.userRepository.find({
      where: { role: 'admin' },
    });
    let permsFixed = 0;
    for (const user of adminUsers) {
      const perms = Array.isArray(user.menuPermissions) ? user.menuPermissions : [];
      if (perms.length === 0) {
        user.menuPermissions = [...DEFAULT_ADMIN_MENU_PERMISSIONS];
        await this.userRepository.save(user);
        permsFixed += 1;
      }
    }
    if (permsFixed) {
      console.log(`✅ 已为 ${permsFixed} 个管理员补齐默认菜单权限`);
    }
  }

  /**
   * 确保系统中存在唯一的超级管理员账号 (登录名 admin)
   * 历史部署里 admin@skillhub.corp 可能已作为普通管理员存在，此时原地升级而非新建
   */
  private async ensureSuperAdmin(): Promise<void> {
    const existing = await this.userRepository.findOne({
      where: { loginName: SUPER_ADMIN_LOGIN },
    });
    if (existing) {
      let changed = false;
      if (existing.role !== 'super_admin') {
        existing.role = 'super_admin';
        changed = true;
      }
      // 超管以登录名为唯一凭证，不应占用员工工号
      if (existing.employeeId) {
        existing.employeeId = null;
        changed = true;
      }
      // 超管恒拥有全部菜单权限（数据一致化，前端判定也有兜底）
      if (!Array.isArray(existing.menuPermissions) || existing.menuPermissions.length !== MENU_PERMISSION_KEYS.length) {
        existing.menuPermissions = [...MENU_PERMISSION_KEYS] as string[];
        changed = true;
      }
      if (changed) {
        await this.userRepository.save(existing);
        console.log('✅ 超级管理员账号信息已校正');
      }
      return;
    }

    const legacyAdmin = await this.userRepository.findOne({
      where: { email: 'admin@skillhub.corp' },
    });
    if (legacyAdmin) {
      legacyAdmin.loginName = SUPER_ADMIN_LOGIN;
      legacyAdmin.role = 'super_admin';
      legacyAdmin.employeeId = null;
      legacyAdmin.menuPermissions = [...MENU_PERMISSION_KEYS] as string[];
      legacyAdmin.passwordHash = await bcrypt.hash(
        DEFAULT_SUPER_ADMIN_PASSWORD,
        10,
      );
      await this.userRepository.save(legacyAdmin);
      console.log(
        `✅ 已将历史账号 admin@skillhub.corp 升级为超级管理员 (登录名 ${SUPER_ADMIN_LOGIN})`,
      );
      return;
    }

    const superAdmin = this.userRepository.create({
      name: '系统超级管理员',
      email: 'admin@skillhub.corp',
      loginName: SUPER_ADMIN_LOGIN,
      employeeId: null,
      passwordHash: await bcrypt.hash(DEFAULT_SUPER_ADMIN_PASSWORD, 10),
      role: 'super_admin',
      menuPermissions: [...MENU_PERMISSION_KEYS] as string[],
      department: '基础架构部',
      avatar:
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      points: 10000,
    });
    await this.userRepository.save(superAdmin);
    console.log(
      `✅ 超级管理员账号已创建 (登录名 ${SUPER_ADMIN_LOGIN}，请尽快修改初始密码)`,
    );
  }

  /**
   * 分配一个未被占用的 7 位工号
   * 从 7460000 起递增探测，保证生成结果稳定且不与已有工号冲突
   */
  private async allocateEmployeeId(): Promise<string> {
    const existing = await this.userRepository.find({
      select: ['employeeId'],
    });
    const taken = new Set(
      existing.map((u) => u.employeeId).filter((v): v is string => Boolean(v)),
    );
    let seq = 7460000;
    while (taken.has(String(seq))) seq += 1;
    return String(seq);
  }

  /**
   * 用户注册新账号
   * 工号为必填的唯一登录标识；角色恒为普通用户，不接受调用方指定，防止自封管理员
   * @param dto 注册数据传输对象 (工号、姓名、密码、部门)
   */
  async register(dto: RegisterDto): Promise<AuthResponse> {
    const employeeId = dto.employeeId.trim();
    if (employeeId === SUPER_ADMIN_LOGIN) {
      throw new ConflictException('该工号为系统保留标识，无法注册');
    }

    const existingId = await this.userRepository.findOne({
      where: { employeeId },
    });
    if (existingId) {
      throw new ConflictException('该工号已注册，请直接登录');
    }

    // 邮箱列非空且唯一，未提供时按工号派生占位邮箱
    const email = (
      dto.email?.trim() || `${employeeId}@skillhub.corp`
    ).toLowerCase();
    const existingEmail = await this.userRepository.findOne({
      where: { email },
    });
    if (existingEmail) {
      throw new ConflictException('该企业邮箱已被占用，请更换邮箱');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const newUser = this.userRepository.create({
      name: dto.name.trim(),
      email,
      employeeId,
      loginName: null,
      authProvider: 'password',
      passwordHash,
      department: dto.department?.trim() || '技术研发中心',
      // 角色不可由注册方指定，一律为普通用户，后续由超级管理员委任
      role: 'user',
      menuPermissions: [],
      avatar:
        dto.avatar ||
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      points: 10000,
    });

    const savedUser = await this.userRepository.save(newUser);
    return {
      token: this.generateJwt(savedUser),
      user: this.toSessionUser(savedUser),
    };
  }

  /**
   * 账号密码登录
   * 账号标识按 登录名 → 工号 → 邮箱 顺序解析
   * 邮箱通道仅为历史账号兜底，前端只暴露工号/登录名输入
   * @param dto 登录参数 (账号、密码)
   */
  async login(dto: LoginDto): Promise<AuthResponse> {
    const account = (dto.account || dto.email || '').trim();
    if (!account) {
      throw new UnauthorizedException('请输入登录账号');
    }

    const user = await this.resolveLoginAccount(account);
    // 用户不存在与密码错误返回同一提示，避免账号枚举
    if (!user) {
      throw new UnauthorizedException('账号或密码不正确');
    }

    // OSS 开号的账号没有可用密码，必须继续走单点登录通道
    if (user.authProvider === 'oss') {
      throw new UnauthorizedException(
        '该账号由内部 IAM 单点登录创建，请使用「内部 OSS 登录」入口',
      );
    }

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('账号或密码不正确');
    }

    return {
      token: this.generateJwt(user),
      user: this.toSessionUser(user),
    };
  }

  /**
   * 按账号标识解析用户：登录名 → 工号 → 邮箱
   * @param account 用户输入的账号标识
   */
  private async resolveLoginAccount(
    account: string,
  ): Promise<UserEntity | null> {
    const byLoginName = await this.userRepository.findOne({
      where: { loginName: account },
    });
    if (byLoginName) return byLoginName;

    const byEmployeeId = await this.userRepository.findOne({
      where: { employeeId: account },
    });
    if (byEmployeeId) return byEmployeeId;

    return this.userRepository.findOne({
      where: { email: account.toLowerCase() },
    });
  }

  /**
   * 内部 IAM 单点登录：校验通过后按工号幂等开号
   * @param employeeId 员工工号
   */
  async ossLogin(employeeId: string): Promise<AuthResponse> {
    const trimmed = (employeeId || '').trim();
    if (!trimmed) {
      throw new BadRequestException('请输入员工工号');
    }

    const profile = await this.ossIamService.verifyEmployee(trimmed);
    if (!profile) {
      throw new UnauthorizedException('内部 IAM 未找到该工号对应的在职员工');
    }

    let user = await this.userRepository.findOne({
      where: { employeeId: profile.employeeId },
    });

    if (!user) {
      // OSS 开号不设可用密码，写入一段随机哈希占位
      const unusableHash = await bcrypt.hash(
        `oss-${profile.employeeId}-${Date.now()}-${Math.random()}`,
        10,
      );
      user = this.userRepository.create({
        name: profile.name,
        email: (
          profile.email || `${profile.employeeId}@skillhub.corp`
        ).toLowerCase(),
        employeeId: profile.employeeId,
        loginName: null,
        authProvider: 'oss',
        passwordHash: unusableHash,
        role: 'user',
        menuPermissions: [],
        department: profile.department || '技术研发中心',
        avatar:
          'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
        points: 10000,
      });
      user = await this.userRepository.save(user);
      console.log(`✅ OSS 单点登录自动开号: ${profile.employeeId}`);
    } else {
      // 已存在账号时同步 IAM 侧的最新姓名与部门
      user.name = profile.name || user.name;
      user.department = profile.department || user.department;
      user = await this.userRepository.save(user);
    }

    return {
      token: this.generateJwt(user),
      user: this.toSessionUser(user),
    };
  }

  /**
   * 获取当前全部企业用户列表
   */
  async getAllUsers(): Promise<UserSession[]> {
    const users = await this.userRepository.find({
      order: { createdAt: 'ASC' },
    });
    return users.map((u) => this.toSessionUser(u));
  }

  /**
   * 根据用户主键 ID 查找用户
   * @param id 用户 UUID
   */
  async findUserById(id: string): Promise<UserSession | null> {
    const user = await findByUuid(this.userRepository, id);
    return user ? this.toSessionUser(user) : null;
  }

  /**
   * 超级管理员委任/撤销指定用户的管理员角色
   * 只接受 admin / user 两个值：super_admin 是系统根权限，不可通过接口授予，
   * 否则任何管理员都能自造超管、绕过「仅超管可任命管理员」这条边界
   * @param userId 目标用户 ID
   * @param role 新角色 ('admin' | 'user')
   */
  async updateUserRole(userId: string, role: string): Promise<UserSession> {
    if (!ASSIGNABLE_ROLES.includes(role)) {
      throw new BadRequestException(
        `角色必须为 ${ASSIGNABLE_ROLES.join(' / ')} 之一`,
      );
    }

    const user = await findByUuid(this.userRepository, userId);
    if (!user) {
      throw new NotFoundException('未找到指定企业用户');
    }

    // 超级管理员自身的角色不可被改写，避免系统失去唯一根权限
    if (user.role === 'super_admin') {
      throw new BadRequestException('超级管理员的角色不可变更');
    }

    user.role = role;
    // 委任为管理员时给予默认菜单权限；撤销为普通用户时清空权限
    user.menuPermissions =
      role === 'admin' ? [...DEFAULT_ADMIN_MENU_PERMISSIONS] : [];
    const saved = await this.userRepository.save(user);
    return this.toSessionUser(saved);
  }

  /**
   * 超级管理员调整指定管理员的菜单级权限（勾选/取消「审核管理/风控中心」）
   * 权限值需在白名单内；超级管理员的权限恒全量，不接受修改
   * @param userId 目标用户 ID
   * @param permissions 菜单权限清单，如 ['audit', 'rules']
   */
  async updateUserMenuPermissions(
    userId: string,
    permissions: string[],
  ): Promise<UserSession> {
    if (!Array.isArray(permissions)) {
      throw new BadRequestException('permissions 必须为字符串数组');
    }
    const invalid = permissions.filter(
      (p) => !(MENU_PERMISSION_KEYS as readonly string[]).includes(p),
    );
    if (invalid.length > 0) {
      throw new BadRequestException(
        `存在未知的菜单权限: ${invalid.join(', ')}（可选: ${MENU_PERMISSION_KEYS.join(' / ')}）`,
      );
    }

    const user = await findByUuid(this.userRepository, userId);
    if (!user) {
      throw new NotFoundException('未找到指定企业用户');
    }
    if (user.role === 'super_admin') {
      throw new BadRequestException('超级管理员的菜单权限恒为全部，不可调整');
    }

    user.menuPermissions = [...new Set(permissions)];
    const saved = await this.userRepository.save(user);
    return this.toSessionUser(saved);
  }

  /**
   * 调整用户悬赏积分余额 (发布需求扣分 / 需求交付奖励加分)
   * @param userId 目标用户 ID
   * @param delta 积分增量 (负数表示扣减)
   */
  async adjustUserPoints(userId: string, delta: number): Promise<UserSession> {
    if (typeof delta !== 'number' || Number.isNaN(delta)) {
      throw new BadRequestException('积分增量必须为合法数值');
    }

    const user = await findByUuid(this.userRepository, userId);
    if (!user) {
      throw new NotFoundException('未找到指定企业用户');
    }

    const next = (user.points ?? 0) + Math.round(delta);
    if (next < 0) {
      throw new BadRequestException('积分余额不足，无法完成本次扣减');
    }

    user.points = next;
    const saved = await this.userRepository.save(user);
    return this.toSessionUser(saved);
  }

  /**
   * 校验传入的 JWT 访问令牌
   *
   * 注意：这里曾经内置 token-dev-admin / token-dev-user 两个硬编码演示令牌，
   * 任何人带上即可获得管理员会话，属于鉴权后门，已移除，不要再加回来。
   * @param token 访问令牌
   */
  validateToken(token: string): UserSession | null {
    if (!token) return null;

    try {
      const payload = this.jwtService.verify(token);
      return {
        id: payload.sub,
        name: payload.name,
        email: payload.email,
        role: payload.role,
        department: payload.department,
      };
    } catch {
      return null;
    }
  }

  /**
   * 解析令牌并从数据库加载最新用户画像
   * JWT 载荷是签发时的快照 (不含 points，且角色可能已被管理员变更)，
   * 因此 /auth/me 必须回源数据库，否则前端看到的积分余额与权限会一直过期
   * @param token 访问令牌
   */
  async resolveFreshSession(token: string): Promise<UserSession | null> {
    const session = this.validateToken(token);
    if (!session) return null;

    // 主键回源：JWT 的 sub 是真实 uuid，命中即取库中最新角色与积分
    const byId = await findByUuid(this.userRepository, session.id);
    if (byId) return this.toSessionUser(byId);

    // 账号已被删除时不再退回令牌快照：令牌里的角色可能已失效，
    // 继续放行等于让已删账号带着旧权限访问
    return null;
  }

  /**
   * 判定指定接口路径是否允许公开/匿名访问
   *
   * 说明：`/api/v1/auth/users` 曾在白名单里，导致匿名即可拉取全量用户的
   * 邮箱、角色、部门与积分，已移除。前端改为登录后再拉取组织名单。
   * @param path 请求路径
   */
  isAnonymousAllowed(path: string): boolean {
    const publicPaths = [
      // 技能集市与征集广场允许游客浏览
      '/api/v1/skills',
      '/api/v1/demands',
      '/api/v1/skill-categories',
      '/api/v1/expert-domains',
      '/api/v1/auth/login',
      '/api/v1/auth/register',
      '/api/v1/auth/oss-login',
      // 风控规则定义与沙箱体检：前端本地正则引擎依赖它们，写操作由控制器内的角色校验兜底
      '/api/v1/audit/rules',
      '/api/v1/audit/sandbox-scan',
      // Claude Code 插件市场协议端点
      '/skillhub.git',
      '/market.git',
      '/.claude-plugin',
    ];
    return publicPaths.some((p) => path.startsWith(p));
  }

  /**
   * 签发标准的 JWT 访问令牌
   * @param user 用户实体
   */
  private generateJwt(user: UserEntity): string {
    const payload = {
      sub: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
    };
    return this.jwtService.sign(payload);
  }

  /**
   * 将数据库实体转化为安全的用户会话对象 (排除密码字段)
   * @param user 用户实体
   */
  private toSessionUser(user: UserEntity): UserSession {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      employeeId: user.employeeId,
      loginName: user.loginName,
      authProvider: user.authProvider,
      menuPermissions: Array.isArray(user.menuPermissions)
        ? user.menuPermissions
        : [],
      role: user.role,
      department: user.department,
      avatar: user.avatar,
      points: user.points,
    };
  }
}
