import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { DemandsService } from './demands.service';
import { AuthService, UserSession } from '../auth/auth.service';
import { SkillDemandEntity } from '../../database/entities/skill-demand.entity';

/**
 * 技能征集需求 (悬赏市场) API 控制器
 */
@Controller('api/v1/demands')
export class DemandsController {
  constructor(
    private readonly demandsService: DemandsService,
    private readonly authService: AuthService,
  ) {}

  /**
   * 获取征集需求列表
   * @param status 状态过滤 ('all' | 'pending' | 'approved' | 'rejected' | 'fulfilled')
   * @param domain 专家组领域过滤
   */
  @Get()
  async findAll(
    @Query('status') status?: string,
    @Query('domain') domain?: string,
  ): Promise<SkillDemandEntity[]> {
    return this.demandsService.findAll({ status, domain });
  }

  /**
   * 发布新的技能征集需求 (发布时冻结扣减悬赏积分)
   * @param body 需求表单数据
   */
  @Post()
  async createDemand(
    @Body() body: any,
    @Req() req: Request,
  ): Promise<SkillDemandEntity> {
    return this.demandsService.createDemand(body, this.resolveSession(req));
  }

  /**
   * 管理员审核通过需求
   * @param id 需求 ID
   */
  @Post(':id/approve')
  async approveDemand(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<SkillDemandEntity> {
    return this.demandsService.approveDemand(id, this.resolveSession(req));
  }

  /**
   * 管理员驳回需求并退还悬赏积分
   * @param id 需求 ID
   * @param body 驳回理由
   */
  @Post(':id/reject')
  async rejectDemand(
    @Param('id') id: string,
    @Body() body: { reason?: string } = {},
    @Req() req: Request,
  ): Promise<SkillDemandEntity> {
    return this.demandsService.rejectDemand(
      id,
      body?.reason || '',
      this.resolveSession(req),
    );
  }

  /**
   * 开发者提交应征方案
   * @param id 需求 ID
   * @param body 方案说明与关联技能 ID
   */
  @Post(':id/candidates')
  async submitCandidate(
    @Param('id') id: string,
    @Body() body: { notes?: string; skillId?: string; skillName?: string },
    @Req() req: Request,
  ): Promise<SkillDemandEntity> {
    return this.demandsService.submitCandidate(
      id,
      body,
      this.resolveSession(req),
    );
  }

  /**
   * 需求发布者验收中选方案并发放悬赏积分
   * @param id 需求 ID
   * @param candidateId 中选方案 ID
   */
  @Post(':id/candidates/:candidateId/accept')
  async acceptCandidate(
    @Param('id') id: string,
    @Param('candidateId') candidateId: string,
    @Req() req: Request,
  ): Promise<SkillDemandEntity> {
    return this.demandsService.acceptCandidate(
      id,
      candidateId,
      this.resolveSession(req),
    );
  }

  /**
   * 删除需求 (未交付时退还悬赏积分)
   * @param id 需求 ID
   */
  @Delete(':id')
  async deleteDemand(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<{ success: boolean; id: string; refunded: number }> {
    return this.demandsService.deleteDemand(id, this.resolveSession(req));
  }

  /**
   * 从请求头解析并校验当前操作者身份会话
   * @param req HTTP 请求对象
   */
  private resolveSession(req: Request): UserSession {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : (req.query?.token as string);

    const session = token ? this.authService.validateToken(token) : null;
    if (!session) {
      throw new UnauthorizedException('请先登录后再操作技能征集需求');
    }
    return session;
  }
}
