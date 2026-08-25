import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SkillCategoryEntity } from '../../database/entities/skill-category.entity';
import { SkillCategoryService } from './skill-category.service';
import { SkillCategoryController } from './skill-category.controller';

/**
 * 技能分类标签管理模块
 * 集市分类 tab 与发布表单下拉的数据源；管理操作仅管理员可用
 */
@Module({
  imports: [TypeOrmModule.forFeature([SkillCategoryEntity])],
  controllers: [SkillCategoryController],
  providers: [SkillCategoryService],
  exports: [SkillCategoryService],
})
export class SkillCategoryModule {}
