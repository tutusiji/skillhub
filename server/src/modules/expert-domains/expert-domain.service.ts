import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExpertDomainEntity } from '../../database/entities/expert-domain.entity';

/** 默认专家组种子（与前端常量 EXPERT_DOMAINS 的业务组一致，空库时幂等播种） */
const DEFAULT_DOMAINS: Array<{
  id: string;
  name: string;
  shortLabel: string;
  description: string;
  iconName: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  sortOrder: number;
}> = [
  {
    id: 'fullstack',
    name: '全栈与后端开发',
    shortLabel: '全栈开发',
    description: 'API 编排、微服务治理、框架脚手架、数据库诊断与重构',
    iconName: 'Code2',
    badgeBg: 'bg-blue-50',
    badgeText: 'text-blue-700',
    badgeBorder: 'border-blue-200',
    sortOrder: 10,
  },
  {
    id: 'ui_ux',
    name: 'UI/UX 体验设计',
    shortLabel: 'UI 设计师',
    description: 'Figma 插件、Design Tokens、Tailwind 样式转化、色彩与可访问性审查',
    iconName: 'Palette',
    badgeBg: 'bg-fuchsia-50',
    badgeText: 'text-fuchsia-700',
    badgeBorder: 'border-fuchsia-200',
    sortOrder: 20,
  },
  {
    id: 'pm',
    name: '产品经理与规划',
    shortLabel: '产品经理',
    description: 'PRD 智能拆解、用户故事整理、流程图 Mermaid 生成、竞品知识萃取',
    iconName: 'KanbanSquare',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-800',
    badgeBorder: 'border-amber-200',
    sortOrder: 30,
  },
  {
    id: 'algorithm_ai',
    name: '算法与 AI 工程师',
    shortLabel: '算法工程师',
    description: 'Prompt 评估、RAG 向量微调、模型量化测评、深度推理链调优',
    iconName: 'Cpu',
    badgeBg: 'bg-purple-50',
    badgeText: 'text-purple-700',
    badgeBorder: 'border-purple-200',
    sortOrder: 40,
  },
  {
    id: 'hardware_iot',
    name: '硬件与嵌入式 IoT',
    shortLabel: '硬件工程师',
    description: '串口 Hex 协议抓包、固件日志解析、MCU 寄存器配置、硬件驱动调试',
    iconName: 'HardDrive',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-700',
    badgeBorder: 'border-emerald-200',
    sortOrder: 50,
  },
  {
    id: 'qa_test',
    name: '测试与质量保障',
    shortLabel: '测试工程师',
    description: '边界值自动化用例生成、Playwright/Cypress 脚本生成、压力测试调优',
    iconName: 'CheckCheck',
    badgeBg: 'bg-cyan-50',
    badgeText: 'text-cyan-700',
    badgeBorder: 'border-cyan-200',
    sortOrder: 60,
  },
  {
    id: 'devops',
    name: '运维与 DevOps / SRE',
    shortLabel: '运维开发',
    description: 'K8s 故障排查、CI/CD 流水线构建、Nginx 反代配置、监控告警规则',
    iconName: 'Server',
    badgeBg: 'bg-indigo-50',
    badgeText: 'text-indigo-700',
    badgeBorder: 'border-indigo-200',
    sortOrder: 70,
  },
  {
    id: 'data_analyst',
    name: '数据分析与 BI',
    shortLabel: '数据分析师',
    description: '复杂 SQL 调优、Pandas 数据清洗、Tableau/Metabase 图表生成',
    iconName: 'BarChart3',
    badgeBg: 'bg-rose-50',
    badgeText: 'text-rose-700',
    badgeBorder: 'border-rose-200',
    sortOrder: 80,
  },
  {
    id: 'general',
    name: '通用办公与协作',
    shortLabel: '通用协作',
    description: '文档总结、多语言翻译、会议纪要提取、知识库问答',
    iconName: 'Sparkles',
    badgeBg: 'bg-slate-50',
    badgeText: 'text-slate-700',
    badgeBorder: 'border-slate-200',
    sortOrder: 90,
  },
];

/**
 * 岗位专家组服务
 * 提供专家组列表查询与管理员增删改；列表按 sortOrder 升序
 */
@Injectable()
export class ExpertDomainService implements OnModuleInit {
  constructor(
    @InjectRepository(ExpertDomainEntity)
    private readonly domainRepository: Repository<ExpertDomainEntity>,
  ) {}

  /**
   * 模块初始化：专家组表为空时播种默认专家组
   */
  async onModuleInit(): Promise<void> {
    const count = await this.domainRepository.count();
    if (count > 0) return;

    for (const d of DEFAULT_DOMAINS) {
      await this.domainRepository.save(this.domainRepository.create(d));
    }
    console.log(`✅ 岗位专家组初始化成功 (${DEFAULT_DOMAINS.length} 个默认专家组)`);
  }

  /**
   * 查询全部专家组（按排序升序）
   */
  async findAll(): Promise<ExpertDomainEntity[]> {
    return this.domainRepository.find({
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
  }

  /**
   * 新增专家组
   * @param payload 专家组数据（key 唯一）
   */
  async create(payload: {
    id?: string;
    name?: string;
    shortLabel?: string;
    description?: string;
    iconName?: string;
    badgeBg?: string;
    badgeText?: string;
    badgeBorder?: string;
    sortOrder?: number;
  }): Promise<ExpertDomainEntity> {
    const id = (payload.id || '').trim().toLowerCase();
    if (!id || !/^[a-z0-9_]+$/.test(id)) {
      throw new Error('专家组 key 必须为非空的小写字母、数字或下划线');
    }
    const name = (payload.name || '').trim();
    const shortLabel = (payload.shortLabel || '').trim();
    if (!name || !shortLabel) {
      throw new Error('专家组名称与简称不能为空');
    }

    const existing = await this.domainRepository.findOne({ where: { id } });
    if (existing) {
      throw new Error(`专家组 ${id} 已存在`);
    }

    return this.domainRepository.save(
      this.domainRepository.create({
        id,
        name: name.slice(0, 100),
        shortLabel: shortLabel.slice(0, 50),
        description: (payload.description || '').trim(),
        iconName: payload.iconName || 'LayoutGrid',
        badgeBg: payload.badgeBg || 'bg-slate-100',
        badgeText: payload.badgeText || 'text-slate-700',
        badgeBorder: payload.badgeBorder || 'border-slate-200',
        sortOrder: Number(payload.sortOrder) || 0,
      }),
    );
  }

  /**
   * 更新专家组
   * @param id 专家组 key
   * @param payload 待更新字段
   */
  async update(
    id: string,
    payload: {
      name?: string;
      shortLabel?: string;
      description?: string;
      iconName?: string;
      badgeBg?: string;
      badgeText?: string;
      badgeBorder?: string;
      sortOrder?: number;
    },
  ): Promise<ExpertDomainEntity> {
    const domain = await this.domainRepository.findOne({ where: { id } });
    if (!domain) {
      throw new Error(`专家组 ${id} 不存在`);
    }

    if (payload.name !== undefined) {
      const name = (payload.name || '').trim();
      if (!name) throw new Error('专家组名称不能为空');
      domain.name = name.slice(0, 100);
    }
    if (payload.shortLabel !== undefined) {
      const shortLabel = (payload.shortLabel || '').trim();
      if (!shortLabel) throw new Error('专家组简称不能为空');
      domain.shortLabel = shortLabel.slice(0, 50);
    }
    if (payload.description !== undefined) {
      domain.description = (payload.description || '').trim();
    }
    if (payload.iconName !== undefined) {
      domain.iconName = payload.iconName || 'LayoutGrid';
    }
    if (payload.badgeBg !== undefined) domain.badgeBg = payload.badgeBg || 'bg-slate-100';
    if (payload.badgeText !== undefined) domain.badgeText = payload.badgeText || 'text-slate-700';
    if (payload.badgeBorder !== undefined) domain.badgeBorder = payload.badgeBorder || 'border-slate-200';
    if (payload.sortOrder !== undefined) {
      domain.sortOrder = Number(payload.sortOrder) || 0;
    }
    return this.domainRepository.save(domain);
  }

  /**
   * 删除专家组
   * @param id 专家组 key
   */
  async remove(id: string): Promise<{ success: boolean }> {
    const domain = await this.domainRepository.findOne({ where: { id } });
    if (!domain) {
      throw new Error(`专家组 ${id} 不存在`);
    }
    await this.domainRepository.remove(domain);
    return { success: true };
  }
}
