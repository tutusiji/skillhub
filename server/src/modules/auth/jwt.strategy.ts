import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from './auth.service';

/**
 * Passport JWT 鉴权解析策略
 * 从 HTTP Header Authorization: Bearer <Token> 中提取并解析用户信息
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'skillhub_enterprise_secret_key_2026',
    });
  }

  /**
   * 校验并注入 JWT Token Payload 中的用户信息
   * @param payload JWT 载荷数据
   */
  async validate(payload: { sub: string; email: string; role: string }) {
    const user = await this.authService.findUserById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('无效或已注销的身份令牌');
    }
    return user;
  }
}
