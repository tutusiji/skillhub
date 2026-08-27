import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UserEntity } from '../../database/entities/user.entity';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { JwtStrategy } from './jwt.strategy';
import { OssIamService } from './oss-iam.service';
import { resolveJwtSecret } from '../../common/runtime-env';

/**
 * 全局用户认证与 JWT 鉴权模块
 */
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        // 生产环境未配置强密钥时 resolveJwtSecret 会抛错终止启动：
        // 源码内置的默认密钥是公开的，任何人都能用它自签 super_admin 令牌
        secret: resolveJwtSecret(configService.get<string>('JWT_SECRET')),
        // 令牌有效期从 7 天收敛到 12 小时：前端只在 localStorage 存令牌、
        // 没有刷新令牌机制，7 天意味着一次令牌泄露可被利用整周
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN') || '12h',
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, JwtStrategy, OssIamService],
  exports: [AuthService, AuthGuard, JwtModule, PassportModule],
})
export class AuthModule {}
