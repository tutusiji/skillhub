import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FeedbackEntity } from '../../database/entities/feedback.entity';
import { UserSession } from '../auth/auth.service';

/** 建议分类白名单，与前端表单保持一致 */
const CATEGORY_KEYS = ['feature', 'bug', 'security', 'experience', 'other'] as const;

/**
 * 用户建议服务
 * 管理员可见全部建议并可删除；普通用户只可见自己的建议
 */
@Injectable()
export class FeedbackService {
  constructor(
    @InjectRepository(FeedbackEntity)
    private readonly feedbackRepository: Repository<FeedbackEntity>,
  ) {}

  /**
   * 提交一条建议
   * @param payload 建议内容
   * @param operator 提交者会话
   */
  async create(
    payload: { title?: string; content?: string; category?: string; rating?: number },
    operator: UserSession,
  ): Promise<FeedbackEntity> {
    const title = (payload.title || '').trim();
    const content = (payload.content || '').trim();
    if (!title || !content) {
      throw new Error('建议主题与内容不能为空');
    }

    const category = CATEGORY_KEYS.includes(payload.category as any)
      ? (payload.category as string)
      : 'feature';
    const rating = Math.min(5, Math.max(1, Math.round(Number(payload.rating) || 5)));

    const item = this.feedbackRepository.create({
      title: title.slice(0, 200),
      content: content.slice(0, 5000),
      category,
      rating,
      submitterId: operator.id,
      submitterName: operator.name,
      submitterEmployeeId: operator.employeeId ?? null,
      submitterAvatar: operator.avatar ?? '',
      submitterDepartment: operator.department,
    });
    return this.feedbackRepository.save(item);
  }

  /**
   * 查询建议列表：管理员看全部，普通用户只看自己的
   * @param operator 查询者会话
   */
  async list(operator: UserSession): Promise<FeedbackEntity[]> {
    const isPrivileged =
      operator.role === 'admin' || operator.role === 'super_admin';
    const where = isPrivileged ? {} : { submitterId: operator.id };
    return this.feedbackRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * 删除建议：管理员可删任意建议，普通用户只能删自己的
   * @param id 建议 ID
   * @param operator 操作者会话
   * @returns 是否找到并删除
   */
  async remove(
    id: string,
    operator: UserSession,
  ): Promise<{ success: boolean }> {
    const item = await this.feedbackRepository.findOne({ where: { id } });
    if (!item) return { success: false };

    const isPrivileged =
      operator.role === 'admin' || operator.role === 'super_admin';
    if (!isPrivileged && item.submitterId !== operator.id) {
      throw new ForbiddenException('无权删除他人的建议');
    }

    await this.feedbackRepository.remove(item);
    return { success: true };
  }
}
