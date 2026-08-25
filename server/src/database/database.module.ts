import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UserEntity } from './entities/user.entity';
import { SkillEntity } from './entities/skill.entity';
import { AuditRuleEntity } from './entities/audit-rule.entity';
import { AuditReportEntity } from './entities/audit-report.entity';
import { SkillDemandEntity } from './entities/skill-demand.entity';
import { LlmConfigEntity } from './entities/llm-config.entity';
import { FeedbackEntity } from './entities/feedback.entity';
import { SkillCategoryEntity } from './entities/skill-category.entity';
import { ExpertDomainEntity } from './entities/expert-domain.entity';

/**
 * 数据库连接与 ORM 配置模块
 * 统一使用 PostgreSQL（生产级），通过 DB_* 环境变量或 DATABASE_URL 连接
 */
@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const entities = [
          UserEntity,
          SkillEntity,
          AuditRuleEntity,
          AuditReportEntity,
          SkillDemandEntity,
          LlmConfigEntity,
          FeedbackEntity,
          SkillCategoryEntity,
          ExpertDomainEntity,
        ];

        return {
          type: 'postgres',
          url: configService.get<string>('DATABASE_URL') || undefined,
          host: configService.get<string>('DB_HOST', 'localhost'),
          port: configService.get<number>('DB_PORT', 5432),
          username: configService.get<string>('DB_USER', 'postgres'),
          password: configService.get<string>('DB_PASSWORD', 'postgres'),
          database: configService.get<string>('DB_NAME', 'skillhub'),
          entities,
          synchronize: true, // 自动同步表结构
          logging: false,
        };
      },
    }),
    TypeOrmModule.forFeature([
      UserEntity,
      SkillEntity,
      AuditRuleEntity,
      AuditReportEntity,
      SkillDemandEntity,
      LlmConfigEntity,
      FeedbackEntity,
      SkillCategoryEntity,
      ExpertDomainEntity,
    ]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
