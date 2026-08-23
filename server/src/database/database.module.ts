import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as fs from 'fs';
import { UserEntity } from './entities/user.entity';
import { SkillEntity } from './entities/skill.entity';
import { AuditRuleEntity } from './entities/audit-rule.entity';
import { AuditReportEntity } from './entities/audit-report.entity';

/**
 * 数据库连接与 ORM 配置模块
 * 支持 SQLite 本地开箱即用存储与 PostgreSQL 生产环境变量配置无缝切换
 */
@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const dbType = configService.get<string>('DB_TYPE', 'sqlite');
        const storageDir = path.resolve(process.cwd(), 'storage');

        if (!fs.existsSync(storageDir)) {
          fs.mkdirSync(storageDir, { recursive: true });
        }

        const entities = [
          UserEntity,
          SkillEntity,
          AuditRuleEntity,
          AuditReportEntity,
        ];

        if (dbType === 'postgres' || configService.get<string>('DATABASE_URL')) {
          return {
            type: 'postgres',
            url: configService.get<string>('DATABASE_URL'),
            host: configService.get<string>('DB_HOST', 'localhost'),
            port: configService.get<number>('DB_PORT', 5432),
            username: configService.get<string>('DB_USER', 'postgres'),
            password: configService.get<string>('DB_PASSWORD', 'postgres'),
            database: configService.get<string>('DB_NAME', 'skillhub'),
            entities,
            synchronize: true, // 自动同步表结构
            logging: false,
          };
        }

        // 默认采用本地 SQLite 持久化数据库
        const dbPath = path.join(storageDir, 'skillhub.sqlite');
        return {
          type: 'sqlite',
          database: dbPath,
          entities,
          synchronize: true, // 自动生成并迁移数据表
          logging: false,
        };
      },
    }),
    TypeOrmModule.forFeature([
      UserEntity,
      SkillEntity,
      AuditRuleEntity,
      AuditReportEntity,
    ]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
