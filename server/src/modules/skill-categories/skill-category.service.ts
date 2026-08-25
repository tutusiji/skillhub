import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SkillCategoryEntity } from '../../database/entities/skill-category.entity';

/** 默认分类种子（key 与 skills.category 既有取值一致），空库时幂等播种 */
const DEFAULT_CATEGORIES: Array<{
  id: string;
  label: string;
  sortOrder: number;
}> = [
  { id: 'database', label: '数据库与 SQL', sortOrder: 10 },
  { id: 'devops', label: 'DevOps / CI/CD', sortOrder: 20 },
  { id: 'mcp', label: 'MCP Server 协议', sortOrder: 30 },
  { id: 'security', label: '安全与合规', sortOrder: 40 },
  { id: 'coding', label: '编程提效与脚手架', sortOrder: 50 },
  { id: 'productivity', label: '知识库与 DeepResearch', sortOrder: 60 },
  { id: 'data', label: '大数据分析', sortOrder: 70 },
  { id: 'agent', label: '自主智能体', sortOrder: 80 },
];

/**
 * 技能分类标签服务
 * 提供分类列表查询与管理员增删改，列表按 sortOrder 升序
 */
@Injectable()
export class SkillCategoryService implements OnModuleInit {
  constructor(
    @InjectRepository(SkillCategoryEntity)
    private readonly categoryRepository: Repository<SkillCategoryEntity>,
  ) {}

  /**
   * 模块初始化：分类表为空时播种默认分类，保证集市与发布表单开箱可用
   */
  async onModuleInit(): Promise<void> {
    const count = await this.categoryRepository.count();
    if (count > 0) return;

    for (const cat of DEFAULT_CATEGORIES) {
      await this.categoryRepository.save(
        this.categoryRepository.create({ ...cat, isEnabled: true }),
      );
    }
    console.log(`✅ 技能分类标签初始化成功 (${DEFAULT_CATEGORIES.length} 个默认分类)`);
  }

  /**
   * 查询全部分类（按排序升序），集市与发布表单共用
   * @param onlyEnabled 仅返回启用中的分类
   */
  async findAll(onlyEnabled = false): Promise<SkillCategoryEntity[]> {
    return this.categoryRepository.find({
      where: onlyEnabled ? { isEnabled: true } : {},
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
  }

  /**
   * 新增分类
   * @param payload 分类数据（key 唯一）
   */
  async create(payload: {
    id?: string;
    label?: string;
    sortOrder?: number;
    isEnabled?: boolean;
  }): Promise<SkillCategoryEntity> {
    const id = (payload.id || '').trim().toLowerCase();
    if (!id || !/^[a-z0-9-]+$/.test(id)) {
      throw new Error('分类 key 必须为非空的小写字母、数字或连字符');
    }
    const label = (payload.label || '').trim();
    if (!label) {
      throw new Error('分类名称不能为空');
    }

    const existing = await this.categoryRepository.findOne({ where: { id } });
    if (existing) {
      throw new Error(`分类 ${id} 已存在`);
    }

    return this.categoryRepository.save(
      this.categoryRepository.create({
        id,
        label: label.slice(0, 100),
        sortOrder: Number(payload.sortOrder) || 0,
        isEnabled: payload.isEnabled !== false,
      }),
    );
  }

  /**
   * 更新分类（名称/排序/启用状态）
   * @param id 分类 key
   * @param payload 待更新字段
   */
  async update(
    id: string,
    payload: { label?: string; sortOrder?: number; isEnabled?: boolean },
  ): Promise<SkillCategoryEntity> {
    const category = await this.categoryRepository.findOne({ where: { id } });
    if (!category) {
      throw new Error(`分类 ${id} 不存在`);
    }

    if (payload.label !== undefined) {
      const label = (payload.label || '').trim();
      if (!label) throw new Error('分类名称不能为空');
      category.label = label.slice(0, 100);
    }
    if (payload.sortOrder !== undefined) {
      category.sortOrder = Number(payload.sortOrder) || 0;
    }
    if (payload.isEnabled !== undefined) {
      category.isEnabled = payload.isEnabled;
    }
    return this.categoryRepository.save(category);
  }

  /**
   * 删除分类
   * @param id 分类 key
   */
  async remove(id: string): Promise<{ success: boolean }> {
    const category = await this.categoryRepository.findOne({ where: { id } });
    if (!category) {
      throw new Error(`分类 ${id} 不存在`);
    }
    await this.categoryRepository.remove(category);
    return { success: true };
  }
}
