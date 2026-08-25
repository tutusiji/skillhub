import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Req,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { FeedbackService } from './feedback.service';
import { AuthService, UserSession } from '../auth/auth.service';
import { FeedbackEntity } from '../../database/entities/feedback.entity';

/**
 * 用户建议管理 API 控制器
 */
@Controller('api/v1/feedback')
export class FeedbackController {
  constructor(
    private readonly feedbackService: FeedbackService,
    private readonly authService: AuthService,
  ) {}

  /**
   * 提交一条建议（需登录）
   * @param body 建议内容
   */
  @Post()
  async create(
    @Body() body: { title?: string; content?: string; category?: string; rating?: number },
    @Req() req: Request,
  ): Promise<FeedbackEntity> {
    const operator = this.resolveSession(req);
    try {
      return await this.feedbackService.create(body || {}, operator);
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
  }

  /**
   * 查询建议列表：管理员看全部，普通用户只看自己的
   */
  @Get()
  async list(@Req() req: Request): Promise<FeedbackEntity[]> {
    const operator = this.resolveSession(req);
    return this.feedbackService.list(operator);
  }

  /**
   * 删除建议：管理员可删任意建议，普通用户只能删自己的
   * @param id 建议 ID
   */
  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<{ success: boolean }> {
    const operator = this.resolveSession(req);
    const result = await this.feedbackService.remove(id, operator);
    if (!result.success) {
      throw new NotFoundException('未找到对应的建议记录');
    }
    return result;
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
      throw new UnauthorizedException('请先登录后再操作');
    }
    return session;
  }
}
