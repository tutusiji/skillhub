import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
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
  async approveSkill(@Param('id') id: string): Promise<SkillEntity> {
    return this.skillsService.approveSkill(id);
  }
}
