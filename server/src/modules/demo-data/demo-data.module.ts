import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../../database/entities/user.entity';
import { SkillEntity } from '../../database/entities/skill.entity';
import { SkillDemandEntity } from '../../database/entities/skill-demand.entity';
import { FeedbackEntity } from '../../database/entities/feedback.entity';
import { DemoDataService } from './demo-data.service';

/**
 * 演示数据播种模块
 * 幂等预置模拟员工与业务数据，开发/演示环境开箱即有内容；生产可整体移除
 */
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      SkillEntity,
      SkillDemandEntity,
      FeedbackEntity,
    ]),
  ],
  providers: [DemoDataService],
  exports: [DemoDataService],
})
export class DemoDataModule {}
