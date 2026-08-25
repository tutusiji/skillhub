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
import { ExpertDomainService } from './expert-domain.service';
import { AuthService, UserSession } from '../auth/auth.service';
import { ExpertDomainEntity } from '../../database/entities/expert-domain.entity';

/**
 * 岗位专家组 API 控制器
 * 列表读取匿名可用（首页矩阵与技能详情需要）；增删改仅管理员
 */
@Controller('api/v1/expert-domains')
export class ExpertDomainController {
  constructor(
    private readonly domainService: ExpertDomainService,
    private readonly authService: AuthService,
  ) {}

  /**
   * 获取专家组列表
   */
  @Get()
  async findAll(): Promise<ExpertDomainEntity[]> {
    return this.domainService.findAll();
  }

  /**
   * 新增专家组（管理员）
   * @param body 专家组数据
   */
  @Post()
  async create(@Body() body: any, @Req() req: Request): Promise<ExpertDomainEntity> {
    this.assertAdmin(req, '新增专家组');
    try {
      return await this.domainService.create(body || {});
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
  }

  /**
   * 更新专家组（管理员）
   * @param id 专家组 key
   * @param body 待更新字段
   */
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any, @Req() req: Request): Promise<ExpertDomainEntity> {
    this.assertAdmin(req, '更新专家组');
    try {
      return await this.domainService.update(id, body || {});
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
  }

  /**
   * 删除专家组（管理员）
   * @param id 专家组 key
   */
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: Request): Promise<{ success: boolean }> {
    this.assertAdmin(req, '删除专家组');
    try {
      return await this.domainService.remove(id);
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
