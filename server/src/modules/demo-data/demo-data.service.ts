import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { UserEntity } from '../../database/entities/user.entity';
import { SkillEntity } from '../../database/entities/skill.entity';
import { SkillDemandEntity } from '../../database/entities/skill-demand.entity';
import { FeedbackEntity } from '../../database/entities/feedback.entity';
import { shouldSeedDemoData } from '../../common/runtime-env';

/**
 * 演示数据播种服务
 *
 * 在开发/演示环境预置一批可登录的模拟员工与业务数据，
 * 让集市、征集广场、建议管理等页面开箱即有真实感。
 *
 * 全部按业务键幂等：已存在则跳过（或原地升级），可随每次启动安全重复执行，
 * 不会污染真实数据。生产环境如有需要可整体移除本模块。
 */
@Injectable()
export class DemoDataService implements OnModuleInit {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(SkillEntity)
    private readonly skillRepository: Repository<SkillEntity>,
    @InjectRepository(SkillDemandEntity)
    private readonly demandRepository: Repository<SkillDemandEntity>,
    @InjectRepository(FeedbackEntity)
    private readonly feedbackRepository: Repository<FeedbackEntity>,
  ) {}

  /** 模拟员工档案（工号 / 登录账号 / 中文名 / 部门） */
  private readonly DEMO_EMPLOYEES: Array<{
    employeeId: string;
    loginName: string;
    name: string;
    department: string;
  }> = [
    { employeeId: '7462200', loginName: 'huang.kun11', name: '黄坤', department: '未来实验室/研究四部' },
    { employeeId: '7462205', loginName: 'wang.fang', name: '王芳', department: '未来实验室/研究三组' },
    { employeeId: '7462206', loginName: 'li.na', name: '李娜', department: '未来实验室/研究四部' },
    { employeeId: '7462207', loginName: 'zhao.qiang', name: '赵强', department: '未来实验室/研究二组' },
    { employeeId: '7462208', loginName: 'chen.chen', name: '陈晨', department: '未来实验室/研究一组' },
  ];

  /**
   * 模块初始化：幂等播种模拟员工与演示数据
   */
  async onModuleInit(): Promise<void> {
    // 生产环境默认不播种：演示账号共用弱口令 Password123!，
    // 随生产实例上线即等同于一组可直接登录的后门账号。
    // 需要在类生产环境做演练时显式设置 SEED_DEMO_DATA=true。
    if (!shouldSeedDemoData()) {
      console.log('ℹ️  已跳过演示数据播种 (生产环境 / SEED_DEMO_DATA=false)');
      return;
    }
    await this.seedEmployees();
    await this.seedDemoData();
  }

  /**
   * 播种模拟员工账号（密码统一 Password123!，可登录）
   * 已有同工号账号时：若为 OSS 桩自动开号，原地升级为模拟员工；否则跳过不覆盖
   */
  private async seedEmployees(): Promise<void> {
    const defaultHash = await bcrypt.hash('Password123!', 10);

    for (const emp of this.DEMO_EMPLOYEES) {
      const existing = await this.userRepository.findOne({
        where: { employeeId: emp.employeeId },
      });

      if (existing) {
        // OSS 桩自动开号的占位账号（名字为「员工 工号」），原地升级为模拟员工
        if (existing.authProvider === 'oss' && existing.name === `员工 ${emp.employeeId}`) {
          existing.name = emp.name;
          existing.loginName = emp.loginName;
          existing.authProvider = 'password';
          existing.passwordHash = defaultHash;
          existing.department = emp.department;
          await this.userRepository.save(existing);
          console.log(`✅ 演示账号 ${emp.loginName} (${emp.name}) 已就绪`);
        }
        continue;
      }

      const loginNameTaken = await this.userRepository.findOne({
        where: { loginName: emp.loginName },
      });
      if (loginNameTaken) continue;

      const user = this.userRepository.create({
        name: emp.name,
        email: `${emp.employeeId}@skillhub.corp`,
        employeeId: emp.employeeId,
        loginName: emp.loginName,
        authProvider: 'password',
        passwordHash: defaultHash,
        role: 'user',
        department: emp.department,
        avatar:
          'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
        points: 10000,
        menuPermissions: [],
      });
      await this.userRepository.save(user);
      console.log(`✅ 演示账号 ${emp.loginName} (${emp.name}) 已创建`);
    }
  }

  /**
   * 播种演示业务数据：黄坤名下的悬赏需求、待审核技能与建议
   * 均按业务键幂等，仅在第一份演示数据缺失时补建
   */
  private async seedDemoData(): Promise<void> {
    const huang = await this.userRepository.findOne({
      where: { employeeId: '7462200' },
    });
    if (!huang) return;

    // 1. 演示悬赏需求（已征集，管理员可演示审核队列与应征流程）
    const demandExists = await this.demandRepository.findOne({
      where: { title: '开发一个 PDF 表格抽取与 OCR 增强的 AI 技能' },
    });
    if (!demandExists) {
      const demand = this.demandRepository.create({
        title: '开发一个 PDF 表格抽取与 OCR 增强的 AI 技能',
        description:
          '面向企业文档数字化场景，需要支持扫描版 PDF 的表格结构还原与关键字段抽取，输出结构化 JSON。',
        targetDomain: 'data',
        expectedOutput: '可安装的 Claude Code 技能包，含 SKILL.md 与可执行脚本',
        bountyPoints: 1500,
        deadlineText: '2026-09-30',
        authorId: huang.id,
        authorName: huang.name,
        authorAvatar: huang.avatar,
        authorDepartment: huang.department,
        status: 'approved',
        candidates: [],
        pointsRefunded: false,
      });
      await this.demandRepository.save(demand);
      console.log('✅ 演示悬赏需求已创建');
    }

    // 2. 演示待审核技能（黄坤提交，管理员审核队列可见）
    const demoSkill = await this.skillRepository.findOne({
      where: { slug: '@skillhub/pdf-image-text-extractor' },
    });
    if (!demoSkill) {
      const skill = this.skillRepository.create({
        id: `skill-demo-${Date.now()}`,
        name: 'PDF 与图片文字提取 / pdf-image-text-extractor',
        slug: '@skillhub/pdf-image-text-extractor',
        category: 'data',
        description:
          '从扫描版 PDF 与图片中提取文字与表格内容，支持 OCR 识别与结构化输出，提升企业文档处理效率。',
        author: huang.name,
        department: huang.department,
        avatar:
          'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
        version: 'v1.0.0',
        status: 'pending',
        clients: ['claude', 'cursor'],
        tags: ['pdf', 'ocr', '文档处理'],
        downloads: 0,
        likes: 0,
        stars: 0,
        permissions: ['本地文件只读', '临时目录写入'],
        installCommands: {
          claude: '/plugin install pdf-image-text-extractor@skillhub',
          cursor: 'cursor ext install pdf-image-text-extractor',
          mcp: 'claude mcp add pdf-image-text-extractor',
          cli: 'npx @skillhub/cli install @skillhub/pdf-image-text-extractor',
        },
        fileTree: [
          {
            id: 'demo-f-1',
            name: 'SKILL.md',
            path: 'SKILL.md',
            type: 'file',
            size: 240,
            language: 'markdown',
            content: `# PDF 与图片文字提取\n\n支持 OCR 识别扫描件，提取表格与文字为结构化 JSON。`,
          },
        ],
        readme:
          '# PDF 与图片文字提取\n\n支持 OCR 识别扫描件，提取表格与文字为结构化 JSON，供企业文档数字化流水线使用。',
        expertDomain: 'data',
        auditScore: 82,
        reviewedBy: null,
        reviewedAt: null,
        adminFeedback: null,
      });
      await this.skillRepository.save(skill);
      console.log('✅ 演示待审核技能已创建');
    }

    // 3. 演示建议（黄坤提交，建议管理页可见）
    // 按建议标题幂等：缺失才补建，已有（含历史测试残留）则跳过不重复造
    const presets = [
      {
        title: '建议增加按部门维度的插件热度统计',
        content:
          '目前集市首页只有全局热度榜，希望可以按部门/岗位维度查看各团队最常用的技能，方便内部推广最佳实践。',
        category: 'feature',
        rating: 5,
      },
      {
        title: 'PDF 提取技能在扫描件上的识别率有待提升',
        content:
          '测试了部分扫描版表格，复杂表头的识别率不高，建议补充针对多级表头的后处理规则。',
        category: 'bug',
        rating: 3,
      },
    ];
    for (const preset of presets) {
      const exists = await this.feedbackRepository.findOne({
        where: { title: preset.title },
      });
      if (exists) continue;
      await this.feedbackRepository.save(
        this.feedbackRepository.create({
          title: preset.title,
          content: preset.content,
          category: preset.category,
          rating: preset.rating,
          submitterId: huang.id,
          submitterName: huang.name,
          submitterEmployeeId: huang.employeeId,
          submitterAvatar: huang.avatar,
          submitterDepartment: huang.department,
        }),
      );
    }
    console.log('✅ 演示建议已就绪');
  }
}
