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
import { shouldCountMetric } from '../../common/metric-throttle';

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
    @Req() req?: Request,
  ): Promise<SkillEntity[]> {
    // 允许匿名浏览，但可见范围按身份收敛（见 SkillsService.findAll）
    return this.skillsService.findAll(
      { category, status, search },
      this.optionalSession(req),
    );
  }

  /**
   * 根据 Slug 或 ID 获取技能详细信息
   * @param slugOrId 技能标识符
   */
  @Get(':slug')
  async findBySlug(
    @Param('slug') slugOrId: string,
    @Req() req?: Request,
  ): Promise<SkillEntity> {
    return this.skillsService.findBySlug(slugOrId, this.optionalSession(req));
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
    const operator = this.resolveSession(req);
    // 作者身份一律以登录会话为准：此前 author/department 直接取请求体，
    // 任何登录用户都能把技能署名成"超级管理员/安全合规部"来骗取信任
    // （社会工程学攻击面）。前端传来的这几个字段在此被强制覆盖。
    return this.skillsService.createSkill({
      ...body,
      author: operator.name,
      department: operator.department,
      avatar: operator.avatar || body?.avatar,
      submitterId: operator.id,
    });
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
   *
   * 鉴权分级：点赞与收藏是"身份行为"，必须登录后才能计数，否则匿名请求可以
   * 无限刷高任意技能的 likes/stars 从而操纵集市热门榜；下载计数保持允许匿名，
   * 因为产品明确允许访客直接下载源码与复制安装指令（见 handleDownloadZip）。
   * @param id 技能 ID
   * @param body metric 指定计数字段，delta 为增量方向
   */
  @Patch(':id/metrics')
  async incrementMetric(
    @Param('id') id: string,
    @Body() body: { metric: 'likes' | 'stars' | 'downloads'; delta?: number },
    @Req() req?: Request,
  ): Promise<SkillEntity> {
    const allowed = ['likes', 'stars', 'downloads'];
    if (!body?.metric || !allowed.includes(body.metric)) {
      throw new BadRequestException(
        `metric 参数必须为 ${allowed.join(' / ')} 之一`,
      );
    }
    const session =
      body.metric === 'downloads'
        ? this.optionalSession(req)
        : this.resolveSession(req);

    // 去重节流：同一来源对同一技能的同一计数项在冷却窗口内只计一次。
    // 匿名下载计数必须保留（访客可下载），但不能让脚本把 downloads 刷到几万来操纵热门榜。
    // 撤销操作（delta<0）不节流，否则"取消收藏"会因窗口未过而不生效。
    const actor = session?.id || this.clientIp(req);
    const delta = body.delta ?? 1;
    if (delta >= 0 && !shouldCountMetric(id, body.metric, actor)) {
      // 静默返回当前状态：对调用方是幂等成功，不暴露"被节流"这一细节
      return this.skillsService.findBySlug(id, session);
    }

    return this.skillsService.incrementMetric(id, body.metric, delta);
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
    @Req() req?: Request,
  ): Promise<SkillEntity> {
    // 安全体检得分是审核决策的核心依据：此前该接口完全没有鉴权，
    // 匿名请求即可把任意技能改成 100 分，让恶意技能显示"体检满分"骗过人工审核。
    // 该操作只会由管理员在审核页/风控中心发起，因此收紧为管理员专属。
    this.assertPrivileged(req, '回写技能体检得分');
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
    // 未上架技能的源码包不对无关方开放（findBySlug 会在无权时抛 404）
    await this.skillsService.findBySlug(id, this.optionalSession(req));

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
   * 解析请求来源 IP，用于互动计数的去重节流
   * 反代场景下 req.ip 需开启 trust proxy 才准确，故额外兼容 X-Forwarded-For
   * @param req HTTP 请求对象
   */
  private clientIp(req?: Request): string | undefined {
    if (!req) return undefined;
    const forwarded = req.headers?.['x-forwarded-for'];
    const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    const first = (raw || '').split(',')[0].trim();
    return first || req.ip || undefined;
  }

  /**
   * 尽力解析当前访问者会话，未登录或令牌失效时返回 null（不抛异常）
   *
   * 集市浏览允许匿名，但"能看到哪些技能"必须按身份收敛，
   * 因此读接口需要一个不强制登录、只用于判定可见范围的会话解析入口。
   * @param req HTTP 请求对象
   */
  private optionalSession(req?: Request): UserSession | null {
    const authHeader = req?.headers?.['authorization'];
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : (req?.query?.token as string);
    return token ? this.authService.validateToken(token) : null;
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
