import { Controller, Get, Post, Delete, Body, Param } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditRuleEntity } from '../../database/entities/audit-rule.entity';

/**
 * 双引擎风控与审核规则控制器
 */
@Controller('api/v1/audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  /**
   * 获取所有风控规则列表
   */
  @Get('rules')
  async getAllRules(): Promise<AuditRuleEntity[]> {
    return this.auditService.getAllRules();
  }

  /**
   * 新增或编辑风控规则并持久化
   * @param rule 规则数据
   */
  @Post('rules')
  async saveRule(@Body() rule: Partial<AuditRuleEntity>): Promise<AuditRuleEntity> {
    return this.auditService.saveRule(rule);
  }

  /**
   * 切换指定规则的启用状态
   * @param id 规则 ID
   */
  @Post('rules/:id/toggle')
  async toggleRule(@Param('id') id: string): Promise<AuditRuleEntity | null> {
    return this.auditService.toggleRule(id);
  }

  /**
   * 触发即时双引擎沙箱体检扫描
   * @param body 待体检 Payload (代码或 Prompt)
   */
  @Post('sandbox-scan')
  async runSandboxScan(@Body() body: { payload: string; skillId?: string }) {
    return this.auditService.runDualEngineScan(body.payload || '', body.skillId);
  }

  /**
   * 删除自定义风控规则 (内置预设规则受保护)
   * @param id 规则 ID
   */
  @Delete('rules/:id')
  async deleteRule(
    @Param('id') id: string,
  ): Promise<{ success: boolean; id: string }> {
    return this.auditService.deleteRule(id);
  }
}
