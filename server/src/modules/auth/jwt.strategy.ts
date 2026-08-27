import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from './auth.service';
import { resolveJwtSecret } from '../../common/runtime-env';

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
      // 与签发端共用同一解析逻辑，避免两处默认值不一致导致"签得出、验不过"
      secretOrKey: resolveJwtSecret(),
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
