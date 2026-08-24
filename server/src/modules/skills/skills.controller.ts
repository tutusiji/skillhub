import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { SkillsService } from './skills.service';
import { SkillEntity } from '../../database/entities/skill.entity';

/**
 * 技能集市与插件生命周期 API 控制器
 */
@Controller('api/v1/skills')
export class SkillsController {
  constructor(private readonly skillsService: SkillsService) {}

  /**
   * 获取技能市场列表
   * @param category 分类过滤 ('all' | 'coding' | 'database' | 'devops' | 'mcp')
   * @param status 审核状态过滤 ('all' | 'approved' | 'pending' | 'rejected')
   * @param search 搜索关键词
   */
  @Get()
  async findAll(
    @Query('category') category?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ): Promise<SkillEntity[]> {
    return this.skillsService.findAll({ category, status, search });
  }

  /**
   * 根据 Slug 或 ID 获取技能详细信息
   * @param slugOrId 技能标识符
   */
  @Get(':slug')
  async findBySlug(@Param('slug') slugOrId: string): Promise<SkillEntity> {
    return this.skillsService.findBySlug(slugOrId);
  }

  /**
   * 开发者上传/发布新技能 (持久化入库并根据扫描结果同步 Git)
   * @param body 包含名称、简介、分类与源码信息的请求体
   */
  @Post('upload')
  async createSkill(@Body() body: any): Promise<SkillEntity> {
    return this.skillsService.createSkill(body);
  }

  /**
   * 超级管理员审核通过指定技能，并触发 Git Commit 发布流水线
   * @param id 技能 ID
   */
  @Post(':id/approve')
  async approveSkill(
    @Param('id') id: string,
    @Body() body: { reviewer?: string; feedback?: string } = {},
    @Req() req?: Request,
  ): Promise<SkillEntity> {
    return this.skillsService.approveSkill(
      id,
      body.reviewer || (req as any)?.user?.name,
      body.feedback,
    );
  }

  /**
   * 管理员驳回技能上架申请 (必须填写驳回理由供开发者整改)
   * @param id 技能 ID
   * @param body 包含驳回理由的请求体
   */
  @Post(':id/reject')
  async rejectSkill(
    @Param('id') id: string,
    @Body() body: { reviewer?: string; feedback?: string } = {},
    @Req() req?: Request,
  ): Promise<SkillEntity> {
    if (!body.feedback || !body.feedback.trim()) {
      throw new BadRequestException('驳回技能必须填写具体理由');
    }
    return this.skillsService.rejectSkill(
      id,
      body.reviewer || (req as any)?.user?.name,
      body.feedback,
    );
  }

  /**
   * 管理员紧急下架技能，并从 Git 市场索引中剔除
   * @param id 技能 ID
   * @param body 下架原因
   */
  @Post(':id/delist')
  async delistSkill(
    @Param('id') id: string,
    @Body() body: { reviewer?: string; reason?: string } = {},
    @Req() req?: Request,
  ): Promise<SkillEntity> {
    return this.skillsService.delistSkill(
      id,
      body.reviewer || (req as any)?.user?.name,
      body.reason,
    );
  }

  /**
   * 管理员恢复已下架技能重新上线并同步 Git
   * @param id 技能 ID
   */
  @Post(':id/relist')
  async relistSkill(
    @Param('id') id: string,
    @Body() body: { reviewer?: string } = {},
    @Req() req?: Request,
  ): Promise<SkillEntity> {
    return this.skillsService.relistSkill(
      id,
      body.reviewer || (req as any)?.user?.name,
    );
  }

  /**
   * 累加技能社交互动计数 (点赞/收藏/下载)
   * @param id 技能 ID
   * @param body metric 指定计数字段，delta 为增量方向
   */
  @Patch(':id/metrics')
  async incrementMetric(
    @Param('id') id: string,
    @Body() body: { metric: 'likes' | 'stars' | 'downloads'; delta?: number },
  ): Promise<SkillEntity> {
    const allowed = ['likes', 'stars', 'downloads'];
    if (!body?.metric || !allowed.includes(body.metric)) {
      throw new BadRequestException(
        `metric 参数必须为 ${allowed.join(' / ')} 之一`,
      );
    }
    return this.skillsService.incrementMetric(id, body.metric, body.delta ?? 1);
  }

  /**
   * 回写前端重新体检得到的双引擎评分
   * @param id 技能 ID
   * @param body 包含最新得分的请求体
   */
  @Patch(':id/audit-score')
  async updateAuditScore(
    @Param('id') id: string,
    @Body() body: { score: number },
  ): Promise<SkillEntity> {
    if (typeof body?.score !== 'number' || Number.isNaN(body.score)) {
      throw new BadRequestException('score 必须为合法数值');
    }
    return this.skillsService.updateAuditScore(id, body.score);
  }

  /**
   * 管理员彻底删除技能并重建 Git 市场索引
   * @param id 技能 ID
   */
  @Delete(':id')
  async deleteSkill(
    @Param('id') id: string,
  ): Promise<{ success: boolean; id: string }> {
    return this.skillsService.deleteSkill(id);
  }
}
