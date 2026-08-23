import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';

/**
 * 企业级用户与 API Token 鉴权守卫
 * 用于保护内网受限资源与管理端接口
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  /**
   * 拦截请求并验证 Header 或 Query 中的 Token 是否有效
   * @param context 执行上下文
   */
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];
    const queryToken = request.query?.token;

    let token = '';
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    } else if (queryToken) {
      token = queryToken as string;
    }

    // 若未传递 token，检查是否允许匿名访问 (如公开浏览)，否则校验 Token
    const user = this.authService.validateToken(token);
    if (!user && !this.authService.isAnonymousAllowed(request.path)) {
      throw new UnauthorizedException('未授权：无效或过期的企业访问令牌');
    }

    request.user = user;
    return true;
  }
}
