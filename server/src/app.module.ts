import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { GitMarketModule } from './modules/git-market/git-market.module';
import { SkillsModule } from './modules/skills/skills.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { DemandsModule } from './modules/demands/demands.module';

/**
 * SkillHub 应用程序根模块
 * 汇聚数据库持久化、Git 插件市场、技能管理、双引擎风控及企业鉴权等核心业务子模块
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    DatabaseModule,
    AuthModule,
    GitMarketModule,
    SkillsModule,
    AuditModule,
    DemandsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
