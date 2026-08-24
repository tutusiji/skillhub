import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SkillDemandEntity } from '../../database/entities/skill-demand.entity';
import { DemandsService } from './demands.service';
import { DemandsController } from './demands.controller';

/**
 * 技能征集需求 (悬赏市场) 业务模块
 */
@Module({
  imports: [TypeOrmModule.forFeature([SkillDemandEntity])],
  controllers: [DemandsController],
  providers: [DemandsService],
  exports: [DemandsService],
})
export class DemandsModule {}
