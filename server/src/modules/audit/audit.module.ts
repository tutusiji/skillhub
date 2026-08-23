import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditRuleEntity } from '../../database/entities/audit-rule.entity';
import { AuditReportEntity } from '../../database/entities/audit-report.entity';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

/**
 * 双引擎风控审计模块
 */
@Module({
  imports: [TypeOrmModule.forFeature([AuditRuleEntity, AuditReportEntity])],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
