import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  UnauthorizedException,
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

    const session = this.authService.validateToken(token);
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
}
