import { Module } from '@nestjs/common';
import { GitMarketController } from './git-market.controller';
import { GitMarketService } from './git-market.service';

/**
 * Git Smart HTTP 插件市场模块
 * 提供 Git 协议端点与自动 Git Commit 流水线
 */
@Module({
  controllers: [GitMarketController],
  providers: [GitMarketService],
  exports: [GitMarketService],
})
export class GitMarketModule {}
