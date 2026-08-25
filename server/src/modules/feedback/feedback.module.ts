import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeedbackEntity } from '../../database/entities/feedback.entity';
import { FeedbackService } from './feedback.service';
import { FeedbackController } from './feedback.controller';

/**
 * 用户建议管理模块
 * 依赖全局 AuthModule 提供的 AuthService 做会话解析
 */
@Module({
  imports: [TypeOrmModule.forFeature([FeedbackEntity])],
  controllers: [FeedbackController],
  providers: [FeedbackService],
})
export class FeedbackModule {}
