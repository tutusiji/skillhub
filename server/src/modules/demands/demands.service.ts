import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  DemandCandidate,
  SkillDemandEntity,
} from '../../database/entities/skill-demand.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { UserSession } from '../auth/auth.service';

/** 悬赏积分下限，与前端发布表单校验保持一致 */
const MIN_BOUNTY_POINTS = 100;

/**
 * 技能征集需求 (悬赏市场) 服务
 * 负责需求发布、管理员审核流转、方案应征与验收，并保证悬赏积分的原子扣减/退还
 */
@Injectable()
export class DemandsService implements OnModuleInit {
  constructor(
    @InjectRepository(SkillDemandEntity)
    private readonly demandRepository: Repository<SkillDemandEntity>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 模块初始化：需求库为空时写入两条示例需求，保证新部署的征集广场非空
   */
  async onModuleInit() {
    const count = await this.demandRepository.count();
    if (count > 0) return;

    // 种子需求挂载到首个管理员账号，避免出现悬空的发布者信息
    const admin = await this.dataSource.getRepository(UserEntity).findOne({
      where: {},
      order: { createdAt: 'ASC' },
    });

    const presets: Partial<SkillDemandEntity>[] = [
      {
        title: 'PRD 智能拆解与 Mermaid 业务时序图生成 Agent',
        description:
          '上传 Markdown / 飞书 PRD 需求文档，自动识别业务角色、调用链路与分支条件，一键输出符合企业规范的 Mermaid 交互时序图与架构流程图。',
        targetDomain: 'pm',
        expectedOutput:
          '支持 Claude Code & Cursor 的 MCP 协议插件，包含 prd_parse、mermaid_render 两个工具。',
        bountyPoints: 2500,
        status: 'approved',
        reviewedBy: '系统预设',
        reviewedAt: new Date().toISOString(),
      },
      {
        title: 'Figma Design Tokens 自动同步转 Tailwind v4 / CSS 变量',
        description:
          '设计师在 Figma 修改色彩变量、圆角间距后，工程师可在编辑器内呼叫技能，自动拉取 Figma Token 并转换为符合规范的 Tailwind 配置与 TS 类型定义。',
        targetDomain: 'ui_ux',
        expectedOutput:
          '支持 Figma REST API 鉴权代理，输出标准 tailwind.config 与全局 CSS 变量层。',
        bountyPoints: 2000,
        status: 'approved',
        reviewedBy: '系统预设',
        reviewedAt: new Date().toISOString(),
      },
    ];

    for (const preset of presets) {
      await this.demandRepository.save(
        this.demandRepository.create({
          ...preset,
          authorId: admin?.id || 'system',
          authorName: admin?.name || '系统管理员',
          authorAvatar: admin?.avatar || '',
          authorDepartment: admin?.department || '基础架构部',
          candidates: [],
        }),
      );
    }
    console.log('✅ 技能征集需求种子数据初始化成功 (2 条示例需求)');
  }

  /**
   * 查询需求列表 (支持状态与关键词过滤)
   * @param query 过滤条件
   */
  async findAll(query: {
    status?: string;
    domain?: string;
  }): Promise<SkillDemandEntity[]> {
    const where: any = {};
    if (query.status && query.status !== 'all') where.status = query.status;
    if (query.domain && query.domain !== 'all')
      where.targetDomain = query.domain;

    return this.demandRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * 发布新需求：在同一事务内扣减发布者悬赏积分并落库需求，避免扣分成功但需求丢失
   * @param payload 需求表单数据
   * @param operator 当前登录用户会话
   */
  async createDemand(
    payload: {
      title?: string;
      description?: string;
      targetDomain?: string;
      expectedOutput?: string;
      bountyPoints?: number;
      deadlineText?: string;
    },
    operator: UserSession,
  ): Promise<SkillDemandEntity> {
    if (!payload?.title?.trim()) {
      throw new BadRequestException('需求标题为必填项');
    }
    if (!payload?.description?.trim()) {
      throw new BadRequestException('需求描述为必填项');
    }

    const bounty = Math.round(Number(payload.bountyPoints ?? 0));
    if (!Number.isFinite(bounty) || bounty < MIN_BOUNTY_POINTS) {
      throw new BadRequestException(
        `悬赏积分不能低于 ${MIN_BOUNTY_POINTS} 分`,
      );
    }

    // 事务保证：积分扣减与需求创建同时成功或同时回滚
    return this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(UserEntity);
      const author = await userRepo.findOne({ where: { id: operator.id } });
      if (!author) {
        throw new NotFoundException('未找到当前登录用户，无法发布需求');
      }

      if ((author.points ?? 0) < bounty) {
        throw new BadRequestException(
          `积分余额不足：当前 ${author.points ?? 0} 分，本次需要 ${bounty} 分`,
        );
      }

      author.points = (author.points ?? 0) - bounty;
      await userRepo.save(author);

      const demandRepo = manager.getRepository(SkillDemandEntity);
      const demand = demandRepo.create({
        title: payload.title.trim(),
        description: payload.description.trim(),
        targetDomain: payload.targetDomain || 'fullstack',
        expectedOutput: payload.expectedOutput?.trim() || '',
        bountyPoints: bounty,
        deadlineText: payload.deadlineText?.trim() || '永久有效',
        authorId: author.id,
        authorName: author.name,
        authorAvatar: author.avatar,
        authorDepartment: author.department,
        status: 'pending',
        candidates: [],
        pointsRefunded: false,
      });

      return demandRepo.save(demand);
    });
  }

  /**
   * 管理员审核通过需求，公开至征集广场
   * @param id 需求 ID
   * @param operator 操作者会话
   */
  async approveDemand(
    id: string,
    operator: UserSession,
  ): Promise<SkillDemandEntity> {
    this.assertPrivileged(operator, '审核征集需求');
    const demand = await this.getDemandOrThrow(id);

    if (demand.status !== 'pending') {
      throw new BadRequestException(
        `仅待审核需求可执行通过操作，当前状态为 ${demand.status}`,
      );
    }

    demand.status = 'approved';
    demand.reviewedBy = this.describeOperator(operator);
    demand.reviewedAt = new Date().toISOString();
    return this.demandRepository.save(demand);
  }

  /**
   * 管理员驳回需求，并在同一事务内退还悬赏积分
   * @param id 需求 ID
   * @param reason 驳回理由 (必填)
   * @param operator 操作者会话
   */
  async rejectDemand(
    id: string,
    reason: string,
    operator: UserSession,
  ): Promise<SkillDemandEntity> {
    this.assertPrivileged(operator, '驳回征集需求');
    if (!reason?.trim()) {
      throw new BadRequestException('驳回需求必须填写具体理由');
    }

    const demand = await this.getDemandOrThrow(id);
    if (demand.status !== 'pending') {
      throw new BadRequestException(
        `仅待审核需求可执行驳回操作，当前状态为 ${demand.status}`,
      );
    }

    return this.dataSource.transaction(async (manager) => {
      // 退还悬赏积分并打上已退款标记，防止后续删除时重复退款
      await this.refundBounty(manager, demand);

      const demandRepo = manager.getRepository(SkillDemandEntity);
      demand.status = 'rejected';
      demand.rejectReason = reason.trim();
      demand.reviewedBy = this.describeOperator(operator);
      demand.reviewedAt = new Date().toISOString();
      return demandRepo.save(demand);
    });
  }

  /**
   * 删除需求 (发布者本人或管理员)，未交付的需求会退还悬赏积分
   * @param id 需求 ID
   * @param operator 操作者会话
   */
  async deleteDemand(
    id: string,
    operator: UserSession,
  ): Promise<{ success: boolean; id: string; refunded: number }> {
    const demand = await this.getDemandOrThrow(id);
    const isAuthor = demand.authorId === operator.id;

    if (!isAuthor && !this.isPrivileged(operator)) {
      throw new ForbiddenException('仅需求发布者或管理员有权删除该需求');
    }

    return this.dataSource.transaction(async (manager) => {
      let refunded = 0;
      // 已交付 (fulfilled) 的需求积分已归属方案提交者，不再退还
      if (demand.status === 'pending' || demand.status === 'approved') {
        refunded = await this.refundBounty(manager, demand);
      }

      await manager.getRepository(SkillDemandEntity).remove(demand);
      return { success: true, id, refunded };
    });
  }

  /**
   * 开发者提交应征方案
   * @param id 需求 ID
   * @param payload 方案说明与关联技能
   * @param operator 提交者会话
   */
  async submitCandidate(
    id: string,
    payload: { notes?: string; skillId?: string; skillName?: string },
    operator: UserSession,
  ): Promise<SkillDemandEntity> {
    const demand = await this.getDemandOrThrow(id);

    if (demand.status !== 'approved') {
      throw new BadRequestException('该需求当前不在征集中，无法提交方案');
    }
    if (!payload?.notes?.trim()) {
      throw new BadRequestException('请填写方案说明');
    }
    if (demand.authorId === operator.id) {
      throw new BadRequestException('不能应征自己发布的需求');
    }

    const candidates = demand.candidates || [];
    if (candidates.some((c) => c.submitterId === operator.id)) {
      throw new BadRequestException('您已提交过方案，请等待需求发布者验收');
    }

    const candidate: DemandCandidate = {
      id: `cand-${Date.now()}`,
      skillId: payload.skillId,
      skillName: payload.skillName?.trim() || '开发者定制方案',
      submitterId: operator.id,
      submitterName: operator.name,
      submitterAvatar: operator.avatar || '',
      submittedAt: new Date().toISOString(),
      notes: payload.notes.trim(),
      status: 'pending',
    };

    demand.candidates = [...candidates, candidate];
    return this.demandRepository.save(demand);
  }

  /**
   * 需求发布者验收方案：在同一事务内把悬赏积分发放给方案提交者并关闭需求
   * @param id 需求 ID
   * @param candidateId 中选方案 ID
   * @param operator 操作者会话 (需为需求发布者或管理员)
   */
  async acceptCandidate(
    id: string,
    candidateId: string,
    operator: UserSession,
  ): Promise<SkillDemandEntity> {
    const demand = await this.getDemandOrThrow(id);

    if (demand.authorId !== operator.id && !this.isPrivileged(operator)) {
      throw new ForbiddenException('仅需求发布者或管理员可验收方案');
    }
    if (demand.status === 'fulfilled') {
      throw new BadRequestException('该需求已完成验收，悬赏积分已发放');
    }

    const candidate = (demand.candidates || []).find(
      (c) => c.id === candidateId,
    );
    if (!candidate) {
      throw new NotFoundException('未找到指定的应征方案');
    }

    return this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(UserEntity);
      const winner = await userRepo.findOne({
        where: { id: candidate.submitterId },
      });

      // 方案提交者账号可能已被移除，此时仅关闭需求并提示，不中断验收流程
      if (winner) {
        winner.points = (winner.points ?? 0) + demand.bountyPoints;
        await userRepo.save(winner);
      }

      demand.candidates = (demand.candidates || []).map((c) => ({
        ...c,
        status:
          c.id === candidateId ? ('accepted' as const) : ('rejected' as const),
      }));
      demand.status = 'fulfilled';
      // 积分已发放给中选者，标记为已结算避免删除时再退给发布者
      demand.pointsRefunded = true;
      demand.reviewedBy = this.describeOperator(operator);
      demand.reviewedAt = new Date().toISOString();

      return manager.getRepository(SkillDemandEntity).save(demand);
    });
  }

  /**
   * 在事务内退还悬赏积分给需求发布者 (幂等：已退款的需求不会重复入账)
   * @param manager 事务上下文
   * @param demand 目标需求
   */
  private async refundBounty(
    manager: { getRepository: DataSource['getRepository'] },
    demand: SkillDemandEntity,
  ): Promise<number> {
    if (demand.pointsRefunded) return 0;

    const userRepo = manager.getRepository(UserEntity);
    const author = await userRepo.findOne({ where: { id: demand.authorId } });
    if (author) {
      author.points = (author.points ?? 0) + demand.bountyPoints;
      await userRepo.save(author);
    }
    demand.pointsRefunded = true;
    return demand.bountyPoints;
  }

  /**
   * 按 ID 查询需求，不存在则抛 404
   * @param id 需求 ID
   */
  private async getDemandOrThrow(id: string): Promise<SkillDemandEntity> {
    const demand = await this.demandRepository.findOne({ where: { id } });
    if (!demand) {
      throw new NotFoundException('未找到对应的技能征集需求');
    }
    return demand;
  }

  /**
   * 判断操作者是否具备管理员权限
   * @param operator 操作者会话
   */
  private isPrivileged(operator: UserSession): boolean {
    return operator.role === 'admin' || operator.role === 'super_admin';
  }

  /**
   * 断言操作者具备管理员权限，否则抛 403
   * @param operator 操作者会话
   * @param action 操作描述，用于错误提示
   */
  private assertPrivileged(operator: UserSession, action: string): void {
    if (!this.isPrivileged(operator)) {
      throw new ForbiddenException(`仅管理员可${action}`);
    }
  }

  /**
   * 生成审核人展示文案 (含角色后缀)
   * @param operator 操作者会话
   */
  private describeOperator(operator: UserSession): string {
    const roleLabel =
      operator.role === 'super_admin'
        ? '超级管理员'
        : operator.role === 'admin'
          ? '管理员'
          : '成员';
    return `${operator.name} (${roleLabel})`;
  }
}
