import { Module } from '@nestjs/common';
import { SkillsController } from './skills.controller';
import { SkillsService } from './skills.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SkillEntity } from '../../database/entities/skill.entity';
import { GitMarketModule } from '../git-market/git-market.module';
import { AuditModule } from '../audit/audit.module';

/**
 * 技能管理业务模块
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([SkillEntity]),
    GitMarketModule,
    AuditModule,
  ],
  controllers: [SkillsController],
  providers: [SkillsService],
  exports: [SkillsService],
})
export class SkillsModule {}
