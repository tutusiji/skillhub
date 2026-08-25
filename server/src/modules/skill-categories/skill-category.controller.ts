import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { SkillCategoryService } from './skill-category.service';
import { AuthService, UserSession } from '../auth/auth.service';
import { SkillCategoryEntity } from '../../database/entities/skill-category.entity';

/**
 * 技能分类标签 API 控制器
 * 列表读取匿名可用（集市与发布表单需要）；增删改仅管理员
 */
@Controller('api/v1/skill-categories')
export class SkillCategoryController {
  constructor(
    private readonly categoryService: SkillCategoryService,
    private readonly authService: AuthService,
  ) {}

  /**
   * 获取分类列表（默认仅启用中的，集市展示用；?all=1 返回全部）
   * @param all 是否返回全部（含禁用）
   */
  @Get()
  async findAll(@Req() req: Request): Promise<SkillCategoryEntity[]> {
    const all = String(req.query?.all || '') === '1';
    return this.categoryService.findAll(!all);
  }

  /**
   * 新增分类（管理员）
   * @param body 分类数据
   */
  @Post()
  async create(
    @Body() body: { id?: string; label?: string; sortOrder?: number; isEnabled?: boolean },
    @Req() req: Request,
  ): Promise<SkillCategoryEntity> {
    this.assertAdmin(req, '新增分类');
    try {
      return await this.categoryService.create(body || {});
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
  }

  /**
   * 更新分类（管理员）
   * @param id 分类 key
   * @param body 待更新字段
   */
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: { label?: string; sortOrder?: number; isEnabled?: boolean },
    @Req() req: Request,
  ): Promise<SkillCategoryEntity> {
    this.assertAdmin(req, '更新分类');
    try {
      return await this.categoryService.update(id, body || {});
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
  }

  /**
   * 删除分类（管理员）
   * @param id 分类 key
   */
  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<{ success: boolean }> {
    this.assertAdmin(req, '删除分类');
    try {
      return await this.categoryService.remove(id);
    } catch (err) {
      throw new NotFoundException((err as Error).message);
    }
  }

  /**
   * 断言操作者为管理员
   * @param req HTTP 请求对象
   * @param action 操作描述
   */
  private assertAdmin(req: Request, action: string): UserSession {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : (req.query?.token as string);

    const session = token ? this.authService.validateToken(token) : null;
    if (!session) {
      throw new UnauthorizedException('请先登录后再操作');
    }
    if (session.role !== 'admin' && session.role !== 'super_admin') {
      throw new ForbiddenException(`仅管理员有权${action}`);
    }
    return session;
  }
}
