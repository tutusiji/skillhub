import {
  Controller,
  Post,
  Patch,
  Get,
  Body,
  Param,
  Req,
  UnauthorizedException,
  ForbiddenException,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService, AuthResponse, UserSession } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

/**
 * 用户认证与登录/注册 API 控制器
 */
@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * 新用户/员工账号注册
   * @param registerDto 注册表单参数 (姓名、邮箱、密码、部门、角色)
   */
  @Post('register')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async register(@Body() registerDto: RegisterDto): Promise<AuthResponse> {
    return this.authService.register(registerDto);
  }

  /**
   * 账号密码登录
   * @param loginDto 登录参数 (邮箱、密码)
   */
  @Post('login')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async login(@Body() loginDto: LoginDto): Promise<AuthResponse> {
    return this.authService.login(loginDto);
  }

  /**
   * 获取当前登录用户身份画像与积分信息
   * @param req HTTP 请求对象 (从 Header 中解析 Token)
   */
  @Get('me')
  async getProfile(@Req() req: Request): Promise<UserSession> {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : (req.query.token as string);

    if (!token) {
      throw new UnauthorizedException('请先登录获取访问令牌');
    }

    // 回源数据库，确保积分余额与角色变更能即时反映到前端
    const session = await this.authService.resolveFreshSession(token);
    if (!session) {
      throw new UnauthorizedException('无效或已过期的登录凭证');
    }

    return session;
  }

  /**
   * 获取企业用户列表 (供前端快速身份切换与人员选择)
   */
  @Get('users')
  async getAllUsers(): Promise<UserSession[]> {
    return this.authService.getAllUsers();
  }

  /**
   * 超级管理员变更指定用户的角色权限 (仅 admin / super_admin 可操作)
   * @param id 目标用户 ID
   * @param body 包含新角色的请求体
   */
  @Patch('users/:id/role')
  async updateUserRole(
    @Param('id') id: string,
    @Body() body: { role: string },
    @Req() req: Request,
  ): Promise<UserSession> {
    const operator = this.resolveSession(req);
    if (operator.role !== 'admin' && operator.role !== 'super_admin') {
      throw new ForbiddenException('仅管理员可变更组织成员角色权限');
    }
    return this.authService.updateUserRole(id, body?.role);
  }

  /**
   * 调整指定用户的悬赏积分余额 (需求发布扣分 / 交付奖励加分)
   * @param id 目标用户 ID
   * @param body 积分增量
   */
  @Patch('users/:id/points')
  async adjustUserPoints(
    @Param('id') id: string,
    @Body() body: { delta: number },
    @Req() req: Request,
  ): Promise<UserSession> {
    const operator = this.resolveSession(req);
    // 普通用户仅可扣减自己的积分，管理员可调整任意成员
    const isPrivileged =
      operator.role === 'admin' || operator.role === 'super_admin';
    if (!isPrivileged && operator.id !== id) {
      throw new ForbiddenException('无权调整其他成员的积分余额');
    }
    return this.authService.adjustUserPoints(id, body?.delta);
  }

  /**
   * 从请求头中解析并校验当前操作者身份会话
   * @param req HTTP 请求对象
   */
  private resolveSession(req: Request): UserSession {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : (req.query?.token as string);

    const session = token ? this.authService.validateToken(token) : null;
    if (!session) {
      throw new UnauthorizedException('请先登录后再执行该操作');
    }
    return session;
  }
}
