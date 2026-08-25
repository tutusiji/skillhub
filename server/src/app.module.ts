import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { GitMarketModule } from './modules/git-market/git-market.module';
import { SkillsModule } from './modules/skills/skills.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { AuthGuard } from './modules/auth/auth.guard';
import { DemandsModule } from './modules/demands/demands.module';
import { FeedbackModule } from './modules/feedback/feedback.module';
import { DemoDataModule } from './modules/demo-data/demo-data.module';
import { SkillCategoryModule } from './modules/skill-categories/skill-category.module';
import { ExpertDomainModule } from './modules/expert-domains/expert-domain.module';

/**
 * SkillHub 应用程序根模块
 * 汇聚数据库持久化、Git 插件市场、技能管理、双引擎风控及企业鉴权等核心业务子模块
 *
 * 环境配置加载顺序（后者覆盖前者）：
 *   1. 通用 .env（提交的本地开发默认值）
 *   2. .env.local（本机覆盖，不入库）
 *   3. .env.<APP_ENV>（按环境加载，如 .env.test / .env.prod，不入库）
 * APP_ENV 取值：dev / test / prod，默认 dev
 */
function resolveEnvFiles(): string[] {
  const appEnv = process.env.APP_ENV || process.env.NODE_ENV || 'dev';
  return ['.env', '.env.local', `.env.${appEnv}`];
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: resolveEnvFiles(),
    }),
    DatabaseModule,
    AuthModule,
    GitMarketModule,
    SkillsModule,
    AuditModule,
    DemandsModule,
    FeedbackModule,
    DemoDataModule,
    SkillCategoryModule,
    ExpertDomainModule,
  ],
  controllers: [],
  providers: [
    // 全局鉴权守卫：非匿名白名单路径必须携带有效令牌
    // 此前 AuthGuard 虽已实现却从未注册，等于形同虚设
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AppModule {}
