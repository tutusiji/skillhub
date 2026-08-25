import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExpertDomainEntity } from '../../database/entities/expert-domain.entity';
import { ExpertDomainService } from './expert-domain.service';
import { ExpertDomainController } from './expert-domain.controller';

/**
 * 岗位专家组管理模块
 * 首页专家组矩阵与技能归属的数据源；管理操作仅管理员可用
 */
@Module({
  imports: [TypeOrmModule.forFeature([ExpertDomainEntity])],
  controllers: [ExpertDomainController],
  providers: [ExpertDomainService],
  exports: [ExpertDomainService],
})
export class ExpertDomainModule {}
