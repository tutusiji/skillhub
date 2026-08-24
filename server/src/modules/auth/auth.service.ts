import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UserEntity } from '../../database/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

export interface UserSession {
  id: string;
  name: string;
  email: string;
  role: string;
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
  ) {}

  /**
   * 模块初始化：如果数据库中尚无用户，则自动填充系统预设管理员与研发工程师账号
   */
  async onModuleInit() {
    const count = await this.userRepository.count();
    if (count === 0) {
      const defaultPassword = 'Password123!';
      const defaultHash = await bcrypt.hash(defaultPassword, 10);

      const presetUsers = [
        {
          name: '系统安全超管',
          email: 'admin@skillhub.corp',
          passwordHash: defaultHash,
          role: 'admin',
          department: '基础架构部',
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
          points: 10000,
        },
        {
          name: '陈建国 (DBA架构师)',
          email: 'chenjg@skillhub.corp',
          passwordHash: defaultHash,
          role: 'developer',
          department: '数据基础设施部',
          avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
          points: 10000,
        },
        {
          name: '张伟 (SRE专家)',
          email: 'zhangwei@skillhub.corp',
          passwordHash: defaultHash,
          role: 'developer',
          department: '运维保障中心',
          avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
          points: 10000,
        },
      ];

      for (const u of presetUsers) {
        const user = this.userRepository.create(u);
        await this.userRepository.save(user);
      }
      console.log('✅ 数据库用户种子数据初始化成功 (3 个预设账号)');
    }
  }

  /**
   * 用户注册新账号
   * @param dto 注册数据传输对象 (姓名、邮箱、密码、部门、角色)
   */
  async register(dto: RegisterDto): Promise<AuthResponse> {
    const existing = await this.userRepository.findOne({
      where: { email: dto.email.trim().toLowerCase() },
    });

    if (existing) {
      throw new ConflictException('该企业邮箱已被注册，请直接登录或使用其他邮箱');
    }

    // 加盐哈希加密密码 (10 rounds)
    const passwordHash = await bcrypt.hash(dto.password, 10);

    const defaultAvatar =
      dto.role === 'admin'
        ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
        : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80';

    const newUser = this.userRepository.create({
      name: dto.name.trim(),
      email: dto.email.trim().toLowerCase(),
      passwordHash,
      department: dto.department?.trim() || '技术研发中心',
      role: dto.role || 'developer',
      avatar: dto.avatar || defaultAvatar,
      points: 10000,
    });

    const savedUser = await this.userRepository.save(newUser);
    const token = this.generateJwt(savedUser);

    return {
      token,
      user: this.toSessionUser(savedUser),
    };
  }

  /**
   * 账号密码登录
   * @param dto 登录参数 (邮箱、密码)
   */
  async login(dto: LoginDto): Promise<AuthResponse> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.userRepository.findOne({ where: { email } });

    if (!user) {
      throw new UnauthorizedException('邮箱或密码不正确');
    }

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('邮箱或密码不正确');
    }

    const token = this.generateJwt(user);
    return {
      token,
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
    const user = await this.userRepository.findOne({ where: { id } });
    return user ? this.toSessionUser(user) : null;
  }

  /**
   * 超级管理员变更指定用户的组织角色权限
   * @param userId 目标用户 ID
   * @param role 新角色 ('developer' | 'admin' | 'super_admin')
   */
  async updateUserRole(userId: string, role: string): Promise<UserSession> {
    const allowed = ['developer', 'admin', 'super_admin'];
    if (!allowed.includes(role)) {
      throw new BadRequestException(`角色必须为 ${allowed.join(' / ')} 之一`);
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('未找到指定企业用户');
    }

    user.role = role;
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

    const user = await this.userRepository.findOne({ where: { id: userId } });
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
   * 校验传入的 Token (支持 JWT 令牌与硬编码 Demo Token 兼容)
   * @param token 访问令牌
   */
  validateToken(token: string): UserSession | null {
    if (!token) return null;

    // 兼容历史演示 Token
    if (token === 'token-dev-admin') {
      return {
        id: 'usr-admin-1',
        name: '系统安全超管',
        email: 'admin@skillhub.corp',
        role: 'admin',
        department: '基础架构部',
      };
    }
    if (token === 'token-dev-user') {
      return {
        id: 'usr-dev-1',
        name: '研发工程师',
        email: 'dev@skillhub.corp',
        role: 'developer',
        department: '技术研发中心',
      };
    }

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
   * 判定指定接口路径是否允许公开/匿名访问
   * @param path 请求路径
   */
  isAnonymousAllowed(path: string): boolean {
    const publicPaths = [
      '/api/v1/skills',
      '/api/v1/auth/login',
      '/api/v1/auth/register',
      '/api/v1/auth/users',
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
      role: user.role,
      department: user.department,
      avatar: user.avatar,
      points: user.points,
    };
  }
}
