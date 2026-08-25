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
        secret:
          configService.get<string>('JWT_SECRET') ||
          'skillhub_enterprise_secret_key_2026',
        signOptions: { expiresIn: '7d' }, // Token 默认 7 天有效
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, JwtStrategy, OssIamService],
  exports: [AuthService, AuthGuard, JwtModule, PassportModule],
})
export class AuthModule {}
