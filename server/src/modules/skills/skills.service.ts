import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { SkillEntity } from '../../database/entities/skill.entity';
import {
  GitMarketService,
  toPluginName,
} from '../git-market/git-market.service';
import { AuditService } from '../audit/audit.service';
import * as JSZip from 'jszip';
import { shouldSeedDemoData } from '../../common/runtime-env';
import { buildAvatarUrl } from '../../common/avatar.util';

export interface FileTreeNode {
  name: string;
  type: 'file' | 'directory';
  size?: number;
  content?: string;
  children?: FileTreeNode[];
}

/**
 * 技能列表对外暴露的列白名单（显式排除 zipBlob 与 fileTree）
 *
 * 列表接口需要能秒级渲染，单条数据必须保持轻量。两个高体积字段被显式排除：
 *
 * 1. zipBlob：上传 ZIP 包的 base64，体积可达数 MB/条；只在两处需要 —
 *    原始包下载 (getOriginalZip) 与 Git 市场发布 (zipBufferOf)，按 id 单独查。
 * 2. fileTree：详情页源码预览用的文件树，每条记录的 content 字段累计可达数十 MB
 *    （曾经一个技能压了 26.7 MB）。列表只展示卡片元信息，不需要源码；
 *    详情页与审核页通过 /api/v1/skills/:slug 单独拿全量。
 */
const LIST_SKILL_COLUMNS = [
  'id',
  'name',
  'slug',
  'category',
  'description',
  'author',
  'submitterId',
  'department',
  'avatar',
  'version',
  'status',
  'clients',
  'tags',
  'downloads',
  'likes',
  'stars',
  'permissions',
  'installCommands',
  'readme',
  'expertDomain',
  'expertDomains',
  'zipFileName',
  'auditScore',
  'reviewedBy',
  'reviewedAt',
  'adminFeedback',
  'createdAt',
  'updatedAt',
] as (keyof SkillEntity)[];

/**
 * 技能详情对外暴露的列白名单（list 全部 + fileTree，仍排除 zipBlob）
 * 详情页源码预览 / 审核页文件树展开 / ZIP 兜底重建都需要 fileTree，但 zipBlob
 * 永远走单独接口 /skills/:id/zip，不在常规 JSON 响应里返回。
 */
const DETAIL_SKILL_COLUMNS = [
  ...LIST_SKILL_COLUMNS,
  'fileTree',
] as (keyof SkillEntity)[];

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

    // 数据库已有技能时，仍需校验 Git 市场索引是否与之一致：
    // storage/git-marketplace 是可重建的运行时数据，一旦被清理或损坏，
    // 已上架技能会从 marketplace.json 消失导致客户端装不到，此处启动即自愈
    if (count > 0) {
      // 自愈失败不应阻断启动：Git 市场是可重建的运行时数据，
      // 而 API 与前端必须先能起来（否则整站不可用）
      try {
        await this.reconcileGitMarketOnBoot();
      } catch (error) {
        console.warn(
          '⚠️  Git 市场索引自愈失败，服务继续启动（可稍后重新审核任一技能触发重建）:',
          (error as Error).message,
        );
      }
      return;
    }

    // 空库时才播种；生产环境默认不塞演示技能（真实集市应由员工提交填充）
    if (count === 0 && !shouldSeedDemoData()) {
      console.log('ℹ️  已跳过预置技能播种 (生产环境 / SEED_DEMO_DATA=false)');
      return;
    }

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
          avatar: buildAvatarUrl('7462201'),
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
          avatar: buildAvatarUrl('7462202'),
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
   *
   * 可见性收敛：
   *   - 管理员（admin/super_admin）看全部
   *   - 提交者本人看"已上架 + 自己提交的"（含 pending / rejected / archived）
   *   - 普通匿名访客只看已上架
   *   - 默认隐藏 archived（被新版替代的旧版本），只有 owner/admin 显式传
   *     includeArchived=true 才返回
   *
   * @param query 查询参数对象
   */
  async findAll(
    query: {
      category?: string;
      status?: string;
      search?: string;
      includeArchived?: boolean;
    },
    viewer?: { id: string; role: string } | null,
  ): Promise<SkillEntity[]> {
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
      // 列表必须只取元信息列：fileTree 累计可达数十 MB（详情页才需要）、
      // zipBlob 单条数 MB（只走 /skills/:id/zip）。详见 LIST_SKILL_COLUMNS 注释。
      select: LIST_SKILL_COLUMNS,
    });

    // 可见性收敛：此前列表把待审核/已驳回/已下架技能一并下发，仅靠前端过滤隐藏，
    // 任何人直接调接口就能看到别人尚未通过审核的技能名称、简介与作者。
    // 规则：管理员看全部（审核队列依赖）；普通用户看"已上架 + 自己提交的"；匿名只看已上架。
    const isPrivileged =
      viewer?.role === 'admin' || viewer?.role === 'super_admin';
    if (!isPrivileged) {
      skills = skills.filter(
        (skill) =>
          skill.status === 'approved' ||
          (!!viewer?.id && skill.submitterId === viewer.id),
      );
    }

    // archived 默认隐藏（被新版替代的旧版本），仅 owner/admin 显式开启才返回
    const canSeeArchived = isPrivileged || !!viewer?.id;
    if (!query.includeArchived || !canSeeArchived) {
      skills = skills.filter((s) => s.status !== 'archived');
    }

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
   *
   * 可见性：
   *   - 已上架技能对所有人开放
   *   - 未上架技能对管理员和提交者本人开放（其他人返回 404 避免泄露存在性）
   *   - archived（被新版替代的旧版本）只对 owner / admin 开放（通过 ?includeArchived=true）
   *
   * @param slugOrId Slug 标识或 UUID
   */
  async findBySlug(
    slugOrId: string,
    viewer?: { id: string; role: string } | null,
    options: { includeArchived?: boolean } = {},
  ): Promise<SkillEntity> {
    const clean = slugOrId.startsWith('@') ? slugOrId : `@skillhub/${slugOrId}`;
    const skill = await this.skillRepository.findOne({
      where: [{ slug: slugOrId }, { slug: clean }, { id: slugOrId }],
      // 详情页需要文件树做源码预览；原始 ZIP 仍走 /skills/:id/zip 下载
      select: DETAIL_SKILL_COLUMNS,
    });

    if (!skill) {
      throw new NotFoundException(`未找到指定技能: ${slugOrId}`);
    }

    // 与列表同源的可见性规则：未上架技能的源码只对管理员与提交者本人开放，
    // 返回 404 而非 403，避免暴露"该 slug 存在但你看不到"这一信息
    const isPrivileged =
      viewer?.role === 'admin' || viewer?.role === 'super_admin';
    const isOwner = !!viewer?.id && skill.submitterId === viewer.id;
    if (skill.status !== 'approved' && !isPrivileged && !isOwner) {
      throw new NotFoundException(`未找到指定技能: ${slugOrId}`);
    }

    // archived 默认对外隐藏；只有 owner/admin 显式传 includeArchived=true 才返回
    if (
      skill.status === 'archived' &&
      !options.includeArchived &&
      !isPrivileged &&
      !isOwner
    ) {
      throw new NotFoundException(`未找到指定技能: ${slugOrId}`);
    }
    return skill;
  }

  /**
   * 查询技能的所有版本（版本链）
   *
   * 沿 parent_skill_id 链回溯到根，再把所有同链上的技能按时间倒序列出。
   * 同样按 owner/admin 限权：archived 版本只对 owner/admin 可见。
   *
   * @param rootId 链上任意一节点（通常是当前已上架的最新版）
   * @param viewer 当前查看者
   * @returns 完整版本链（含 status 标签）
   */
  async findVersions(
    rootId: string,
    viewer?: { id: string; role: string } | null,
  ): Promise<SkillEntity[]> {
    // 1. 先顺 parent 链回溯到根（最旧版本）
    let cursor: SkillEntity | null = await this.skillRepository.findOne({
      where: { id: rootId },
    });
    if (!cursor) throw new NotFoundException(`未找到指定技能: ${rootId}`);

    while (cursor?.parentSkillId) {
      const parent: SkillEntity | null = await this.skillRepository.findOne({
        where: { id: cursor.parentSkillId },
      });
      if (!parent) break;
      cursor = parent;
    }
    const root = cursor;
    if (!root) throw new NotFoundException(`未找到指定技能: ${rootId}`);

    // 2. 从根向下收集所有子版本（按 createdAt 升序）
    const versions: SkillEntity[] = [root];
    let frontier: SkillEntity[] = [root];
    while (frontier.length > 0) {
      const ids = frontier.map((v) => v.id);
      const children = await this.skillRepository
        .createQueryBuilder('s')
        .where('s.parent_skill_id IN (:...ids)', { ids })
        .orderBy('s.createdAt', 'ASC')
        .getMany();
      if (children.length === 0) break;
      versions.push(...children);
      frontier = children;
    }

    // 3. 按 createdAt 倒序：最新版在前
    versions.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    // 4. 可见性收敛：archived 只对 owner/admin 可见
    const isPrivileged =
      viewer?.role === 'admin' || viewer?.role === 'super_admin';
    const filtered = versions.filter((v) => {
      if (v.status !== 'archived') return true;
      return isPrivileged || (!!viewer?.id && v.submitterId === viewer.id);
    });

    return filtered.map((v) => this.stripZipBlob(v));
  }

  /**
   * 解析 ZIP 二进制流提取文件树
   * @param zipBuffer ZIP 二进制流
   */
  /**
   * 从 ZIP 数据解析出文件树
   * zipBuffer 支持两种形态：Buffer（Node 端）与 base64 字符串（前端上传经 JSON 传输）
   * @param zipSource ZIP 数据源
   */
  async parseZipFileTree(zipSource: Buffer | string): Promise<FileTreeNode[]> {
    const zip =
      typeof zipSource === 'string'
        ? await JSZip.loadAsync(zipSource, { base64: true })
        : await JSZip.loadAsync(zipSource);
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
   * 递归展平文件树中的文本内容，用于扩大风控扫描覆盖面
   * @param nodes 文件树节点列表
   */
  private flattenFileContents(nodes: FileTreeNode[] = []): string {
    const chunks: string[] = [];
    for (const node of nodes) {
      if (node.content) chunks.push(node.content);
      if (node.children?.length) {
        chunks.push(this.flattenFileContents(node.children));
      }
    }
    return chunks.join('\n');
  }

  /**
   * 归一化技能 slug 并确保数据库唯一
   * slug 缺省时基于技能名称派生；若已被占用则追加自增后缀，避免 UNIQUE 约束报 500
   * @param rawSlug 前端传入的原始 slug (可为空)
   * @param name 技能名称，用于兜底派生
   */
  private async resolveUniqueSlug(
    rawSlug: string | undefined,
    name: string,
  ): Promise<{ cleanSlug: string; fullSlug: string }> {
    // 1. 归一化：去掉 scope 前缀，仅保留 ASCII 字母数字与连字符
    //    Git 插件目录名与 /plugin install 命令必须为 ASCII，故中文等字符一律剔除
    const source = (rawSlug || name || '').trim();
    let base = source
      .replace(/^@/, '')
      .replace(/^skillhub\//, '')
      .replace(/[\s_/]+/g, '-')
      .replace(/[^a-zA-Z0-9-]/g, '')
      .replace(/-{2,}/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();

    // 2. 名称为纯中文等无法派生出 ASCII slug 时，使用时间戳兜底
    if (!base || !/[a-z0-9]/.test(base)) {
      base = `skill-${Date.now().toString(36)}`;
    }

    // 3. 冲突检测：同名 slug 已存在时追加自增序号
    let candidate = base;
    let suffix = 1;
    while (
      (await this.skillRepository.countBy({
        slug: `@skillhub/${candidate}`,
      })) > 0
    ) {
      suffix += 1;
      candidate = `${base}-${suffix}`;
    }

    return { cleanSlug: candidate, fullSlug: `@skillhub/${candidate}` };
  }

  /**
   * 上传并创建新技能 (持久化入库并根据扫描结果同步 Git)
   *
   * 多版本发布支持（Phase 3）：
   *   - 不传 parentSkillId → 全新技能，status=pending
   *   - 传 parentSkillId + supersedeMode='coexist' → 新版独立计 counter，parent 不动
   *   - 传 parentSkillId + supersedeMode='replace' → 新版从 parent 继承 counter 起点
   *     （parent.likes 复制到 new.likes；parent 后续不重置，archived 后冻结）
   *
   * 守卫：parent 必须存在 + 同一提交者；该 parent 若已有 pending 子版，禁止再排队新版本
   * @param payload 技能表单数据
   */
  async createSkill(payload: {
    name: string;
    slug?: string;
    category: any;
    description: string;
    author: string;
    /** 提交者用户 ID，由控制器从登录会话注入（不接受前端传值） */
    submitterId?: string;
    department?: string;
    avatar?: string;
    version?: string;
    permissions?: string[];
    clients?: string[];
    tags?: string[];
    readme?: string;
    expertDomain?: string;
    fileTree?: FileTreeNode[];
    /** 原始 ZIP：Buffer（Node 调用）或 base64 字符串（前端 JSON 传输） */
    zipBuffer?: Buffer | string;
    /** 上传时的原始 ZIP 文件名（下载与展示用） */
    zipFileName?: string;
    /** 多版本发布：父版本 ID（指定则进入"发新版本"流程） */
    parentSkillId?: string;
    /** 多版本发布：父版本处理模式，'coexist'（默认）保留共存，'replace' 替代旧版 */
    supersedeMode?: 'coexist' | 'replace';
  }): Promise<SkillEntity> {
    if (!payload?.name?.trim()) {
      throw new BadRequestException('技能名称为必填项');
    }
    if (!payload?.description?.trim()) {
      throw new BadRequestException('技能简介为必填项');
    }

    // 父版本校验（多版本发布前置检查）
    let parent: SkillEntity | null = null;
    if (payload.parentSkillId) {
      parent = await this.skillRepository.findOne({
        where: { id: payload.parentSkillId },
      });
      if (!parent) {
        throw new NotFoundException(
          `未找到父版本技能: ${payload.parentSkillId}`,
        );
      }
      // 必须由父版本的提交者本人发新版本，防止越权
      if (parent.submitterId && parent.submitterId !== payload.submitterId) {
        throw new ForbiddenException('仅原技能作者可发布该技能的新版本');
      }
      // 防堆积：若该父版本已有 pending 子版本，禁止再次排队
      const pendingChild = await this.skillRepository
        .createQueryBuilder('s')
        .where('s.parent_skill_id = :pid', { pid: parent.id })
        .andWhere("s.status = 'pending'")
        .getOne();
      if (pendingChild) {
        throw new BadRequestException(
          '该技能已有待审核的新版本，请先处理或驳回后再发布新版本',
        );
      }
    }

    // slug 允许省略：由技能名称自动派生，并保证全局唯一 (避免 UNIQUE 约束 500)
    const { cleanSlug, fullSlug } = await this.resolveUniqueSlug(
      payload.slug,
      payload.name,
    );

    // 文件树优先级：前端传入的 fileTree（含文本内容，供详情预览）> ZIP 结构解析 > 默认模板
    // 注意：zipBuffer 解析只生成目录结构不读内容，若用它覆盖前端 fileTree 会导致文件预览丢失内容
    let fileTree: FileTreeNode[] = [];
    if (payload.fileTree?.length) {
      fileTree = payload.fileTree;
    } else if (payload.zipBuffer) {
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

    // 触发双引擎风控扫描：将描述、README 与文件内容一并纳入扫描面
    // 注意：扫描结果只作为评分与风控参考落库（auditScore），不决定上架状态——
    // 所有新提交一律进入管理员人工审核队列，由管理员审核通过后才上架并发布 Git
    const scanPayload = [
      payload.description,
      payload.readme || '',
      this.flattenFileContents(fileTree),
    ]
      .filter(Boolean)
      .join('\n');

    const scanResult = await this.auditService.runDualEngineScan(scanPayload);

    // "替代旧版"模式：counter 起点从父版本继承（parent 后续不重置）
    const inheritCounters =
      payload.parentSkillId &&
      (payload.supersedeMode || 'coexist') === 'replace' &&
      parent;
    const seedLikes = inheritCounters ? parent!.likes : 0;
    const seedStars = inheritCounters ? parent!.stars : 0;
    const seedDownloads = inheritCounters ? parent!.downloads : 0;

    const newSkill = this.skillRepository.create({
      id: `skill-${Date.now()}`,
      name: payload.name,
      slug: fullSlug,
      category: payload.category || 'coding',
      description: payload.description,
      author: payload.author,
      submitterId: payload.submitterId || null,
      department: payload.department || '研发中心',
      // 头像快照：优先用调用方传入的（已是登录用户头像），否则按提交者身份派生
      avatar:
        payload.avatar ||
        buildAvatarUrl(payload.submitterId || payload.author || 'anonymous'),
      version: payload.version || 'v1.0.0',
      // 统一待管理员审核：扫描通过与否都不自动上架
      status: 'pending',
      clients: payload.clients?.length
        ? payload.clients
        : ['claude', 'cursor', 'mcp'],
      tags: payload.tags?.length
        ? payload.tags
        : ['AI技能', payload.category],
      // 替代旧版模式下从父版本继承 counter 起点
      downloads: seedDownloads,
      likes: seedLikes,
      stars: seedStars,
      permissions: payload.permissions || ['默认沙箱权限'],
      installCommands: {
        claude: `/plugin install ${cleanSlug}@skillhub`,
        cursor: `cursor ext install ${cleanSlug}`,
        mcp: `claude mcp add ${cleanSlug} -- npx -y @skillhub/${cleanSlug}`,
        cli: `npx @skillhub/cli install ${fullSlug}`,
      },
      fileTree,
      // 保留开发者填写的完整说明文档与适用专家组，避免详情页回显丢失
      readme: payload.readme || payload.description,
      expertDomain: payload.expertDomain || null,
      auditScore: scanResult.score,
      // 保留原始 ZIP（base64）与上传文件名，供无损下载与 Git 市场发布使用
      zipBlob: payload.zipBuffer
        ? typeof payload.zipBuffer === 'string'
          ? payload.zipBuffer
          : payload.zipBuffer.toString('base64')
        : null,
      zipFileName: payload.zipFileName?.trim() || null,
      // 多版本发布：父版本关系（第一版为 null）+ 替代模式
      parentSkillId: payload.parentSkillId || null,
      supersedeMode: payload.parentSkillId
        ? payload.supersedeMode || 'coexist'
        : null,
    });

    const saved = await this.skillRepository.save(newSkill);

    // 新提交一律 pending，等待管理员人工审核（审核通过由 approveSkill 触发 Git 发布）
    return this.stripZipBlob(saved);
  }

  /**
   * 管理员审核通过技能并自动提交发布至 Git 市场
   *
   * 多版本联动（Phase 4）：
   *   - 'replace' 模式：父版本被自动 archive（status='archived'，superseded_by_id 指向新版）
   *   - 'coexist' 模式：父版本保持 approved 不动（新版独立走 Git 发布，git 仓只保留最新版）
   *   - 无 parent：原行为，单独通过
   *
   * @param id 技能 ID
   */
  async approveSkill(
    id: string,
    reviewer?: string,
    feedback?: string,
  ): Promise<SkillEntity> {
    const skill = await this.skillRepository.findOne({ where: { id } });
    if (!skill) throw new NotFoundException('未找到对应待审核技能');

    skill.status = 'approved';
    skill.reviewedBy = reviewer || '系统管理员';
    skill.reviewedAt = new Date().toISOString();
    skill.adminFeedback = feedback || '审核通过，准予在内网市场公开。';

    const updated = await this.skillRepository.save(skill);

    // 'replace' 模式：把父版本 archive 掉，记录 supersede 关系
    // 注意：counter 已在新版 create 时从父版本继承（Phase 3），此处不再累加
    if (updated.parentSkillId && updated.supersedeMode === 'replace') {
      await this.skillRepository
        .createQueryBuilder()
        .update(SkillEntity)
        .set({
          status: 'archived',
          archivedAt: new Date().toISOString(),
          supersededById: updated.id,
        })
        .where('id = :id', { id: updated.parentSkillId })
        .andWhere("status != 'archived'")
        .execute();
    }

    // 用用户上传的原始 ZIP 写入 Git 市场，确保安装到的是真实技能内容而非模板空壳
    // 即使 coexist 模式，git 仓也只保留最新版；旧版可通过 /skills/:id/zip 直接下载
    await this.gitMarketService.syncApprovedSkillToGit(
      updated,
      this.zipBufferOf(updated),
      updated.version,
    );
    return this.stripZipBlob(updated);
  }

  /**
   * 剥离响应中的 zipBlob 字段
   *
   * 写操作（上传/审核/计数等）需要读出完整实体（Git 发布要用原始 ZIP），
   * 但返回给前端时必须去掉这个数 MB 的 base64 字段，
   * 否则单次审核响应就有数 MB，且前端会把它长期留在内存里。
   * @param skill 技能实体
   */
  private stripZipBlob(skill: SkillEntity): SkillEntity {
    const { zipBlob: _zipBlob, ...rest } = skill;
    return rest as SkillEntity;
  }

  /**
   * 从技能实体解码出原始 ZIP Buffer（zipBlob 存 base64）
   * @param skill 技能实体
   */
  private zipBufferOf(skill: SkillEntity): Buffer | undefined {
    return skill.zipBlob ? Buffer.from(skill.zipBlob, 'base64') : undefined;
  }

  /**
   * 读取技能上传时的原始 ZIP（含文件名）
   * @param id 技能 ID
   */
  async getOriginalZip(
    id: string,
  ): Promise<{ buffer: Buffer; fileName: string | null } | null> {
    const skill = await this.skillRepository.findOne({ where: { id } });
    if (!skill || !skill.zipBlob) return null;
    return {
      buffer: Buffer.from(skill.zipBlob, 'base64'),
      fileName: skill.zipFileName,
    };
  }

  /**
   * 管理员驳回技能上架申请并记录驳回理由
   * @param id 技能 ID
   * @param reviewer 审核人姓名
   * @param feedback 驳回理由 (必填，用于开发者整改)
   */
  async rejectSkill(
    id: string,
    reviewer?: string,
    feedback?: string,
  ): Promise<SkillEntity> {
    const skill = await this.skillRepository.findOne({ where: { id } });
    if (!skill) throw new NotFoundException('未找到对应待审核技能');

    skill.status = 'rejected';
    skill.reviewedBy = reviewer || '系统管理员';
    skill.reviewedAt = new Date().toISOString();
    skill.adminFeedback = feedback || '未通过安全合规审查，请修复后重新提交。';

    return this.stripZipBlob(await this.skillRepository.save(skill));
  }

  /**
   * 管理员紧急下架已上线技能 (状态置为 offline，同时从 Git 市场索引移除)
   * @param id 技能 ID
   * @param reviewer 操作人姓名
   * @param reason 下架原因
   */
  async delistSkill(
    id: string,
    reviewer?: string,
    reason?: string,
  ): Promise<SkillEntity> {
    const skill = await this.skillRepository.findOne({ where: { id } });
    if (!skill) throw new NotFoundException('未找到对应技能');

    skill.status = 'offline';
    skill.reviewedBy = reviewer || '系统管理员';
    skill.reviewedAt = new Date().toISOString();
    skill.adminFeedback = reason || '管理员已将该技能临时下架。';

    const updated = await this.skillRepository.save(skill);
    // 下架后需重建 Git 市场索引，避免客户端仍能安装
    await this.rebuildGitMarketIndex();
    return this.stripZipBlob(updated);
  }

  /**
   * 管理员恢复已下架技能上线，并重新同步至 Git 市场
   * @param id 技能 ID
   * @param reviewer 操作人姓名
   */
  async relistSkill(id: string, reviewer?: string): Promise<SkillEntity> {
    const skill = await this.skillRepository.findOne({ where: { id } });
    if (!skill) throw new NotFoundException('未找到对应技能');

    skill.status = 'approved';
    skill.reviewedBy = reviewer || '系统管理员';
    skill.reviewedAt = new Date().toISOString();
    skill.adminFeedback = '技能已恢复上线。';

    const updated = await this.skillRepository.save(skill);
    await this.gitMarketService.syncApprovedSkillToGit(
      updated,
      this.zipBufferOf(updated),
      updated.version,
    );
    return this.stripZipBlob(updated);
  }

  /**
   * 管理员彻底删除技能记录并刷新 Git 市场索引
   * @param id 技能 ID
   */
  async deleteSkill(id: string): Promise<{ success: boolean; id: string }> {
    const skill = await this.skillRepository.findOne({ where: { id } });
    if (!skill) throw new NotFoundException('未找到对应技能');

    await this.skillRepository.remove(skill);
    await this.rebuildGitMarketIndex();
    return { success: true, id };
  }

  /**
   * 启动时对齐 Git 市场与数据库：把所有已上架技能重新写入插件仓库
   * 覆盖 storage/git-marketplace 被删除/损坏，或历史清单缺少 owner 字段的场景
   */
  private async reconcileGitMarketOnBoot(): Promise<void> {
    const approved = await this.skillRepository.find({
      where: { status: 'approved' },
    });
    if (approved.length === 0) return;

    const manifest = this.gitMarketService.getMarketplaceManifest();
    const indexed = new Set(manifest.plugins.map((p) => p.name));
    // 除了清单缺条目，还要检查插件目录结构是否符合最新 Claude Code schema
    const missing = approved.filter((skill) => {
      const cleanSlug = toPluginName(skill.slug);
      if (!indexed.has(cleanSlug)) return true;
      return !this.gitMarketService.isPluginLayoutValid(cleanSlug);
    });

    if (missing.length === 0) return;

    let repaired = 0;
    for (const skill of missing) {
      // 单个技能的 ZIP 损坏不能让整个服务起不来：
      // syncApprovedSkillToGit 内部会解析 ZIP，脏数据会抛异常，
      // 而这里处于 onModuleInit，未捕获的异常会导致进程直接退出。
      try {
        await this.gitMarketService.syncApprovedSkillToGit(
          skill,
          this.zipBufferOf(skill),
          skill.version,
        );
        repaired += 1;
      } catch (error) {
        console.warn(
          `⚠️  技能 ${skill.slug} 同步至 Git 市场失败，已跳过（不影响服务启动）:`,
          (error as Error).message,
        );
      }
    }
    // 补齐后再全量重建一次索引，剔除历史命名残留的插件目录与清单条目
    await this.rebuildGitMarketIndex();

    console.log(
      `🔧 Git 市场索引已自愈：修复/补齐 ${repaired}/${missing.length} 个已上架插件 (共 ${approved.length} 个在线)`,
    );
  }

  /**
   * 重建 Git 市场插件索引：仅保留当前处于 approved 状态的技能
   */
  private async rebuildGitMarketIndex(): Promise<void> {
    const approved = await this.skillRepository.find({
      where: { status: 'approved' },
      order: { createdAt: 'DESC' },
    });
    await this.gitMarketService.rebuildMarketplaceIndex(approved);
  }

  /**
   * 累加技能社交互动计数 (点赞/收藏/下载)，返回最新计数快照
   * @param id 技能 ID
   * @param metric 计数字段 ('likes' | 'stars' | 'downloads')
   * @param delta 增量 (+1 表示点赞，-1 表示取消)
   */
  async incrementMetric(
    id: string,
    metric: 'likes' | 'stars' | 'downloads',
    delta: number,
  ): Promise<SkillEntity> {
    const skill = await this.skillRepository.findOne({ where: { id } });
    if (!skill) throw new NotFoundException('未找到对应技能');

    const step = delta >= 0 ? 1 : -1;
    skill[metric] = Math.max(0, (skill[metric] ?? 0) + step);
    return this.stripZipBlob(await this.skillRepository.save(skill));
  }

  /**
   * 回写双引擎体检得分与结论到技能记录 (供前端重新体检后同步)
   * @param id 技能 ID
   * @param score 最新综合得分
   */
  async updateAuditScore(id: string, score: number): Promise<SkillEntity> {
    const skill = await this.skillRepository.findOne({ where: { id } });
    if (!skill) throw new NotFoundException('未找到对应技能');

    skill.auditScore = Math.max(0, Math.min(100, Math.round(score)));
    return this.stripZipBlob(await this.skillRepository.save(skill));
  }

  /**
   * 管理员把已上架的技能回滚到指定的历史版本（仅 super_admin）
   *
   * 行为：
   *   1. 当前 approved 版本 → status='archived', archived_at=NOW, superseded_by_id=target
   *   2. target 版本 → status='approved', archived_at=NULL, superseded_by_id=NULL
   *   3. 重新同步 Git 市场至 target（marketplace.json 的 version 字段切回 target）
   *   4. counter 不重置：target 当时已有的 + 中间被归档期间累计的，都保留在 target 上
   *
   * 守卫：
   *   - 当前必须有 approved 版本（不能"回滚到一个还没审核通过的版本"）
   *   - target 必须在该技能链上（沿 parent_skill_id 可达）
   *   - target 自身的 status 可以是 archived 或 rejected（管理员回滚可救活被驳回的）
   *
   * @param id 当前 approved 版本的 ID
   * @param targetVersionId 目标历史版本 ID
   */
  async rollbackSkill(
    id: string,
    targetVersionId: string,
  ): Promise<{ current: SkillEntity; target: SkillEntity }> {
    if (!targetVersionId) {
      throw new BadRequestException('targetVersionId 不能为空');
    }

    const current = await this.skillRepository.findOne({ where: { id } });
    if (!current) throw new NotFoundException('未找到当前版本');
    if (current.status !== 'approved') {
      throw new BadRequestException(
        `当前版本状态为 ${current.status}，仅已上架 (approved) 的技能可回滚`,
      );
    }

    const target = await this.skillRepository.findOne({
      where: { id: targetVersionId },
    });
    if (!target) throw new NotFoundException('未找到目标历史版本');

    // target 必须在 current 的版本链上：沿 current.parent_skill_id 一直回溯，
    // 任何一级命中 target 即认为在同一链
    let cursor: SkillEntity | null = current;
    let inChain = false;
    while (cursor) {
      if (cursor.id === target.id) {
        inChain = true;
        break;
      }
      if (!cursor.parentSkillId) break;
      cursor = await this.skillRepository.findOne({
        where: { id: cursor.parentSkillId },
      });
    }
    if (!inChain) {
      throw new BadRequestException(
        '目标版本不在该技能的版本链上，不能回滚',
      );
    }
    if (target.id === current.id) {
      throw new BadRequestException('目标版本与当前版本相同，无需回滚');
    }

    // 1. 当前 → archived，指向 target
    current.status = 'archived';
    current.archivedAt = new Date().toISOString();
    current.supersededById = target.id;
    // 2. target → approved，清空它的反向指针
    target.status = 'approved';
    target.archivedAt = null;
    target.supersededById = null;
    target.reviewedBy = '系统管理员';
    target.reviewedAt = new Date().toISOString();
    target.adminFeedback = `由 v${current.version} 回滚至 v${target.version}`;

    await this.skillRepository.save(current);
    const savedTarget = await this.skillRepository.save(target);

    // 3. 重新同步 Git 市场至 target 的版本
    // 沿用 approveSkill 的写法：拿 target 的原始 ZIP 推到 git 仓
    await this.gitMarketService.syncApprovedSkillToGit(
      savedTarget,
      this.zipBufferOf(savedTarget),
      savedTarget.version,
    );

    return { current: this.stripZipBlob(current), target: this.stripZipBlob(savedTarget) };
  }

  /**
   * 维护技能的专家组归属（专家组即标签，一个技能可属于多个专家组）
   * @param id 技能 ID
   * @param domains 专家组 ID 清单
   */
  async updateExpertDomains(
    id: string,
    domains: string[],
  ): Promise<SkillEntity> {
    const skill = await this.skillRepository.findOne({ where: { id } });
    if (!skill) throw new NotFoundException('未找到对应技能');

    // 去重 + 忽略空值；保留主领域字段作为详情页兼容展示
    const clean = [...new Set(domains.map(d => d.trim()).filter(Boolean))];
    skill.expertDomains = clean;
    if (clean.length > 0 && !skill.expertDomain) {
      skill.expertDomain = clean[0];
    }
    return this.stripZipBlob(await this.skillRepository.save(skill));
  }

  /**
   * 技能作者自更新元数据（不需要管理员参与）
   *
   * 支持修改的字段（白名单）：
   *   - name          1-150 字符
   *   - description   1-500 字符
   *   - category      1-50 字符
   *   - version       1-20 字符
   *
   * 守卫：
   *   1. 必须是技能的提交者本人（防越权改别人的）
   *   2. 状态不能是 rejected（驳回后需走重新提交）
   *   3. 已上架 (approved) 的技能要改 version，必须同时带 newZipProvided=true
   *      —— 防止用户随意虚标版本号
   *
   * 副作用：
   *   - name 改了会重新派生 slug；旧 slug 仍可经 findBySlug 用 id 回查兼容
   *   - 状态为 approved 时同步刷一次 Git 市场索引（仅 name/description，
   *     zipBuffer 传 undefined 时 syncApprovedSkillToGit 不会重写文件内容）
   *
   * @param id 技能 ID
   * @param operator 当前登录会话
   * @param payload 待更新字段
   */
  async updateOwnMeta(
    id: string,
    operator: { id: string; name: string },
    payload: {
      name?: string;
      description?: string;
      category?: string;
      version?: string;
      /** 已 approved 的技能改 version 时必须为 true（前端「发布新版本」流程才会传） */
      newZipProvided?: boolean;
    },
  ): Promise<SkillEntity> {
    const skill = await this.skillRepository.findOne({ where: { id } });
    if (!skill) throw new NotFoundException('未找到对应技能');

    // 1. 提交者本人才能改自己的技能
    if (skill.submitterId !== operator.id) {
      throw new ForbiddenException('仅技能提交者本人可编辑该技能的元数据');
    }

    // 2. 驳回状态不允许直接编辑，必须走重新提交通道
    if (skill.status === 'rejected') {
      throw new BadRequestException(
        '已驳回的技能不能直接编辑，请前往重新提交通道',
      );
    }

    // 3. 字段白名单 + 长度校验
    const updates: Partial<SkillEntity> = {};
    if (payload.name !== undefined) {
      const name = payload.name.trim();
      if (!name) throw new BadRequestException('技能名称不能为空');
      if (name.length > 150) {
        throw new BadRequestException('技能名称不能超过 150 字符');
      }
      updates.name = name;
    }
    if (payload.description !== undefined) {
      const description = payload.description.trim();
      if (!description) throw new BadRequestException('技能简介不能为空');
      if (description.length > 500) {
        throw new BadRequestException('技能简介不能超过 500 字符');
      }
      updates.description = description;
    }
    if (payload.category !== undefined) {
      const category = payload.category.trim();
      if (!category) throw new BadRequestException('分类不能为空');
      if (category.length > 50) {
        throw new BadRequestException('分类不能超过 50 字符');
      }
      updates.category = category;
    }
    if (payload.version !== undefined) {
      const version = payload.version.trim();
      if (!version) throw new BadRequestException('版本号不能为空');
      if (version.length > 20) {
        throw new BadRequestException('版本号不能超过 20 字符');
      }
      // 已上架的技能要改 version 必须挂载新 ZIP（防止随意虚标版本号）
      if (skill.status === 'approved' && !payload.newZipProvided) {
        throw new BadRequestException(
          '已上架技能的版本号变更需要同步上传新 ZIP 包，请使用「发布新版本」入口',
        );
      }
      updates.version = version;
    }

    // 没有实际要改的字段直接返回当前状态，避免无效的 DB 写入
    if (Object.keys(updates).length === 0) {
      return this.stripZipBlob(skill);
    }

    // 4. name 改了要重新派生 slug，保持 slug 唯一性；旧 slug 仍可经 id 回查
    if (updates.name && updates.name !== skill.name) {
      const { fullSlug } = await this.resolveUniqueSlug(
        skill.slug,
        updates.name,
      );
      updates.slug = fullSlug;
    }

    Object.assign(skill, updates);
    const saved = await this.skillRepository.save(skill);

    // 5. 已上架的技能：同步刷一次 Git 市场索引（仅元数据，文件内容不动）
    if (saved.status === 'approved' && (updates.name || updates.description)) {
      try {
        await this.gitMarketService.syncApprovedSkillToGit(
          saved,
          undefined,
          saved.version,
        );
      } catch (error) {
        // Git 同步失败不应阻断元数据保存——元数据已落库，下次启动自愈会补齐
        console.warn(
          `⚠️  技能 ${saved.slug} 元数据更新后 Git 同步失败（不影响主流程）:`,
          (error as Error).message,
        );
      }
    }

    return this.stripZipBlob(saved);
  }
}
