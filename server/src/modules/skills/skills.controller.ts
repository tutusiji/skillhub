import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { SkillsService } from './skills.service';
import { SkillEntity } from '../../database/entities/skill.entity';
import { AuthService, UserSession } from '../auth/auth.service';

/**
 * 技能集市与插件生命周期 API 控制器
 */
@Controller('api/v1/skills')
export class SkillsController {
  constructor(
    private readonly skillsService: SkillsService,
    private readonly authService: AuthService,
  ) {}

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
  async createSkill(
    @Body() body: any,
    @Req() req: Request,
  ): Promise<SkillEntity> {
    this.resolveSession(req);
    return this.skillsService.createSkill(body);
  }

  /**
   * 管理员审核通过指定技能，并触发 Git Commit 发布流水线
   * @param id 技能 ID
   */
  @Post(':id/approve')
  async approveSkill(
    @Param('id') id: string,
    @Body() body: { feedback?: string } = {},
    @Req() req?: Request,
  ): Promise<SkillEntity> {
    const operator = this.assertPrivileged(req, '审核技能');
    return this.skillsService.approveSkill(id, operator.name, body.feedback);
  }

  /**
   * 管理员驳回技能上架申请 (必须填写驳回理由供开发者整改)
   * @param id 技能 ID
   * @param body 包含驳回理由的请求体
   */
  @Post(':id/reject')
  async rejectSkill(
    @Param('id') id: string,
    @Body() body: { feedback?: string } = {},
    @Req() req?: Request,
  ): Promise<SkillEntity> {
    const operator = this.assertPrivileged(req, '驳回技能');
    if (!body.feedback || !body.feedback.trim()) {
      throw new BadRequestException('驳回技能必须填写具体理由');
    }
    return this.skillsService.rejectSkill(id, operator.name, body.feedback);
  }

  /**
   * 管理员紧急下架技能，并从 Git 市场索引中剔除
   * @param id 技能 ID
   * @param body 下架原因
   */
  @Post(':id/delist')
  async delistSkill(
    @Param('id') id: string,
    @Body() body: { reason?: string } = {},
    @Req() req?: Request,
  ): Promise<SkillEntity> {
    const operator = this.assertPrivileged(req, '下架技能');
    return this.skillsService.delistSkill(id, operator.name, body.reason);
  }

  /**
   * 管理员恢复已下架技能重新上线并同步 Git
   * @param id 技能 ID
   */
  @Post(':id/relist')
  async relistSkill(@Param('id') id: string, @Req() req?: Request): Promise<SkillEntity> {
    const operator = this.assertPrivileged(req, '恢复技能上线');
    return this.skillsService.relistSkill(id, operator.name);
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
   * 管理员维护技能的专家组归属（专家组即标签，一个技能可属于多个专家组）
   * @param id 技能 ID
   * @param body 专家组 ID 清单
   */
  @Put(':id/expert-domains')
  async updateExpertDomains(
    @Param('id') id: string,
    @Body() body: { domains?: string[] },
    @Req() req?: Request,
  ): Promise<SkillEntity> {
    this.assertPrivileged(req, '维护专家组归属');
    if (!Array.isArray(body?.domains)) {
      throw new BadRequestException('domains 必须为字符串数组');
    }
    return this.skillsService.updateExpertDomains(id, body.domains);
  }

  /**
   * 下载技能上传时的原始 ZIP 压缩包（无损还原二进制文件，文件名与上传一致）
   * 无原始 ZIP 时返回 404，前端回退到从文件树重建
   * @param id 技能 ID
   * @param res HTTP 响应
   */
  @Get(':id/zip')
  async downloadOriginalZip(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.skillsService.getOriginalZip(id);
    if (!result) {
      throw new NotFoundException('该技能没有保留原始 ZIP 压缩包');
    }
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(result.fileName || `${id}.zip`)}"`,
    );
    res.send(result.buffer);
  }

  /**
   * 管理员彻底删除技能并重建 Git 市场索引
   * @param id 技能 ID
   */
  @Delete(':id')
  async deleteSkill(
    @Param('id') id: string,
    @Req() req?: Request,
  ): Promise<{ success: boolean; id: string }> {
    this.assertPrivileged(req, '删除技能');
    return this.skillsService.deleteSkill(id);
  }

  /**
   * 从请求头解析并校验当前操作者身份会话
   * @param req HTTP 请求对象
   */
  private resolveSession(req?: Request): UserSession {
    const authHeader = req?.headers?.['authorization'];
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : (req?.query?.token as string);

    const session = token ? this.authService.validateToken(token) : null;
    if (!session) {
      throw new UnauthorizedException('请先登录后再操作技能');
    }
    return session;
  }

  /**
   * 断言操作者具备管理员权限
   * 技能的审核、上下架与删除属于高危操作，此前完全没有鉴权，任何人都能下架他人技能
   * @param req HTTP 请求对象
   * @param action 操作描述，用于错误提示
   */
  private assertPrivileged(req: Request | undefined, action: string): UserSession {
    const session = this.resolveSession(req);
    if (session.role !== 'admin' && session.role !== 'super_admin') {
      throw new ForbiddenException(`仅管理员有权${action}`);
    }
    return session;
  }
}
