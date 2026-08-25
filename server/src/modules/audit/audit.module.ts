import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditRuleEntity } from '../../database/entities/audit-rule.entity';
import { AuditReportEntity } from '../../database/entities/audit-report.entity';
import { LlmConfigEntity } from '../../database/entities/llm-config.entity';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { LlmAuditService } from './llm-audit.service';

/**
 * 双引擎风控审计模块
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      AuditRuleEntity,
      AuditReportEntity,
      LlmConfigEntity,
    ]),
  ],
  controllers: [AuditController],
  providers: [AuditService, LlmAuditService],
  exports: [AuditService, LlmAuditService],
})
export class AuditModule {}
