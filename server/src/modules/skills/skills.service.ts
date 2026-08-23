import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { SkillEntity } from '../../database/entities/skill.entity';
import { GitMarketService } from '../git-market/git-market.service';
import { AuditService } from '../audit/audit.service';
import JSZip from 'jszip';

export interface FileTreeNode {
  name: string;
  type: 'file' | 'directory';
  size?: number;
  content?: string;
  children?: FileTreeNode[];
}

/**
 * 技能全生命周期管理服务 (基于 TypeORM 数据库持久化)
 * 负责技能 CRUD、ZIP 源码包文件树提取、多端命令生成与 Git 市场自动化发布
 */
@Injectable()
export class SkillsService implements OnModuleInit {
  constructor(
    @InjectRepository(SkillEntity)
    private readonly skillRepository: Repository<SkillEntity>,
    private readonly gitMarketService: GitMarketService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * 模块初始化：若技能库为空，则自动初始化种子技能并提交至 Git 市场
   */
  async onModuleInit() {
    const count = await this.skillRepository.count();
    if (count === 0) {
      const presetSkills: Partial<SkillEntity>[] = [
        {
          id: 'skill-1',
          name: 'PostgreSQL 慢 SQL 智能排查与索引诊断助手',
          slug: '@skillhub/sql-diagnose-agent',
          category: 'database',
          description:
            '深度分析企业数据库 Slow Query 日志，自动评估缺失索引并生成 EXPLAIN 优化执行计划。',
          author: '陈建国 (DBA架构师)',
          department: '数据基础设施部',
          avatar:
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces',
          version: 'v1.2.0',
          status: 'approved',
          clients: ['claude', 'cursor', 'mcp'],
          tags: ['PostgreSQL', '慢SQL排查', '索引优化', '安全沙箱'],
          downloads: 3840,
          likes: 218,
          stars: 96,
          permissions: ['只读连接内网只读从库', '执行 EXPLAIN 计划分析'],
          installCommands: {
            claude: '/plugin install sql-diagnose-agent@skillhub',
            cursor: 'cursor ext install skillhub-sql-diagnose',
            mcp: 'claude mcp add sql-diagnose-agent -- npx -y @skillhub/sql-diagnose-mcp',
            cli: 'npx @skillhub/cli install @skillhub/sql-diagnose-agent',
          },
          fileTree: [
            {
              name: 'skills',
              type: 'directory',
              children: [{ name: 'SKILL.md', type: 'file', size: 1420 }],
            },
            {
              name: '.claude-plugin',
              type: 'directory',
              children: [{ name: 'plugin.json', type: 'file', size: 380 }],
            },
          ],
          auditScore: 98,
        },
        {
          id: 'skill-2',
          name: 'K8s 生产集群故障自动巡检与 Pod 自愈 Copilot',
          slug: '@skillhub/k8s-auto-ops-copilot',
          category: 'devops',
          description:
            '实时监听 Kubernetes 集群事件，精准定位 CrashLoopBackOff 与 OOMKilled 异常根因。',
          author: '张伟 (SRE专家)',
          department: '运维保障中心',
          avatar:
            'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=faces',
          version: 'v2.1.0',
          status: 'approved',
          clients: ['claude', 'cursor', 'mcp'],
          tags: ['K8s', '故障诊断', 'SRE自愈', '只读沙箱'],
          downloads: 5120,
          likes: 342,
          stars: 184,
          permissions: ['Kubernetes 只读 API 访问', '集群指标采集'],
          installCommands: {
            claude: '/plugin install k8s-auto-ops-copilot@skillhub',
            cursor: 'cursor ext install skillhub-k8s-copilot',
            mcp: 'claude mcp add k8s-copilot -- npx -y @skillhub/k8s-mcp',
            cli: 'npx @skillhub/cli install @skillhub/k8s-auto-ops-copilot',
          },
          fileTree: [
            {
              name: 'skills',
              type: 'directory',
              children: [{ name: 'SKILL.md', type: 'file', size: 2100 }],
            },
          ],
          auditScore: 95,
        },
      ];

      for (const item of presetSkills) {
        const entity = this.skillRepository.create(item);
        await this.skillRepository.save(entity);
        await this.gitMarketService.syncApprovedSkillToGit(
          entity,
          undefined,
          entity.version,
        );
      }
      console.log('✅ 数据库技能初始种子数据初始化成功 (2 个核心技能)');
    }
  }

  /**
   * 获取技能列表（支持分类、状态和关键词过滤）
   * @param query 查询参数对象
   */
  async findAll(query: {
    category?: string;
    status?: string;
    search?: string;
  }): Promise<SkillEntity[]> {
    const where: any = {};
    if (query.category && query.category !== 'all') {
      where.category = query.category;
    }
    if (query.status && query.status !== 'all') {
      where.status = query.status;
    }

    let skills = await this.skillRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });

    if (query.search) {
      const s = query.search.toLowerCase();
      skills = skills.filter(
        (skill) =>
          skill.name.toLowerCase().includes(s) ||
          skill.slug.toLowerCase().includes(s) ||
          skill.description.toLowerCase().includes(s),
      );
    }

    return skills;
  }

  /**
   * 根据 Slug 或 ID 查询技能详情
   * @param slugOrId Slug 标识或 UUID
   */
  async findBySlug(slugOrId: string): Promise<SkillEntity> {
    const clean = slugOrId.startsWith('@') ? slugOrId : `@skillhub/${slugOrId}`;
    const skill = await this.skillRepository.findOne({
      where: [{ slug: slugOrId }, { slug: clean }, { id: slugOrId }],
    });

    if (!skill) {
      throw new NotFoundException(`未找到指定技能: ${slugOrId}`);
    }
    return skill;
  }

  /**
   * 解析 ZIP 二进制流提取文件树
   * @param zipBuffer ZIP 二进制流
   */
  async parseZipFileTree(zipBuffer: Buffer): Promise<FileTreeNode[]> {
    const zip = await JSZip.loadAsync(zipBuffer);
    const tree: FileTreeNode[] = [];

    for (const [filename, fileObj] of Object.entries(zip.files)) {
      if (fileObj.dir) continue;
      const parts = filename.split('/');
      let currentLevel = tree;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isFile = i === parts.length - 1;

        if (isFile) {
          currentLevel.push({
            name: part,
            type: 'file',
            size: (fileObj as any)._data?.uncompressedSize || 0,
          });
        } else {
          let dirNode = currentLevel.find(
            (n) => n.name === part && n.type === 'directory',
          );
          if (!dirNode) {
            dirNode = { name: part, type: 'directory', children: [] };
            currentLevel.push(dirNode);
          }
          currentLevel = dirNode.children!;
        }
      }
    }
    return tree;
  }

  /**
   * 上传并创建新技能 (持久化入库并根据扫描结果同步 Git)
   * @param payload 技能表单数据
   */
  async createSkill(payload: {
    name: string;
    slug: string;
    category: any;
    description: string;
    author: string;
    department?: string;
    permissions?: string[];
    zipBuffer?: Buffer;
  }): Promise<SkillEntity> {
    const cleanSlug = payload.slug.replace('@', '').replace('/', '-');
    const fullSlug = payload.slug.startsWith('@')
      ? payload.slug
      : `@skillhub/${cleanSlug}`;

    let fileTree: FileTreeNode[] = [];
    if (payload.zipBuffer) {
      fileTree = await this.parseZipFileTree(payload.zipBuffer);
    } else {
      fileTree = [
        {
          name: 'skills',
          type: 'directory',
          children: [{ name: 'SKILL.md', type: 'file', size: 1024 }],
        },
      ];
    }

    // 触发双引擎风控扫描
    const scanResult = await this.auditService.runDualEngineScan(
      payload.description,
    );

    const newSkill = this.skillRepository.create({
      id: `skill-${Date.now()}`,
      name: payload.name,
      slug: fullSlug,
      category: payload.category || 'coding',
      description: payload.description,
      author: payload.author,
      department: payload.department || '研发中心',
      avatar:
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces',
      version: 'v1.0.0',
      status: scanResult.status === 'passed' ? 'approved' : 'pending',
      clients: ['claude', 'cursor', 'mcp'],
      tags: ['AI技能', payload.category],
      downloads: 0,
      likes: 0,
      stars: 0,
      permissions: payload.permissions || ['默认沙箱权限'],
      installCommands: {
        claude: `/plugin install ${cleanSlug}@skillhub`,
        cursor: `cursor ext install ${cleanSlug}`,
        mcp: `claude mcp add ${cleanSlug} -- npx -y @skillhub/${cleanSlug}`,
        cli: `npx @skillhub/cli install ${fullSlug}`,
      },
      fileTree,
      auditScore: scanResult.score,
    });

    const saved = await this.skillRepository.save(newSkill);

    // 审核直接通过则自动触发 Git Commit
    if (saved.status === 'approved') {
      await this.gitMarketService.syncApprovedSkillToGit(
        saved,
        payload.zipBuffer,
        saved.version,
      );
    }

    return saved;
  }

  /**
   * 管理员审核通过技能并自动提交发布至 Git 市场
   * @param id 技能 ID
   */
  async approveSkill(id: string): Promise<SkillEntity> {
    const skill = await this.skillRepository.findOne({ where: { id } });
    if (!skill) throw new NotFoundException('未找到对应待审核技能');

    skill.status = 'approved';
    const updated = await this.skillRepository.save(skill);
    await this.gitMarketService.syncApprovedSkillToGit(
      updated,
      undefined,
      updated.version,
    );
    return updated;
  }
}
