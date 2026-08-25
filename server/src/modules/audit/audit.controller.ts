import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Req,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuditService } from './audit.service';
import { LlmAuditService, LlmConfigView } from './llm-audit.service';
import { AuditRuleEntity } from '../../database/entities/audit-rule.entity';
import { AuthService, UserSession } from '../auth/auth.service';

/**
 * 双引擎风控与审核规则控制器
 */
@Controller('api/v1/audit')
export class AuditController {
  constructor(
    private readonly auditService: AuditService,
    private readonly llmAuditService: LlmAuditService,
    private readonly authService: AuthService,
  ) {}

  /**
   * 读取 LLM 审核引擎网关配置 (API Key 仅返回掩码，不回传明文)
   */
  @Get('llm-config')
  async getLlmConfig(@Req() req: Request): Promise<LlmConfigView> {
    this.assertPrivileged(req, '查看大模型网关配置');
    return this.llmAuditService.getConfigView();
  }

  /**
   * 更新 LLM 审核引擎网关配置
   * apiKey 留空表示保持原值不变，传 null 表示清空凭据并自动停用真实调用
   * @param body 配置字段
   */
  @Put('llm-config')
  async updateLlmConfig(
    @Body()
    body: {
      baseUrl?: string;
      apiKey?: string | null;
      modelName?: string;
      temperature?: number;
      maxTokens?: number;
      systemPrompt?: string;
      timeoutMs?: number;
      maxRetries?: number;
      isEnabled?: boolean;
    },
    @Req() req?: Request,
  ): Promise<LlmConfigView> {
    this.assertPrivileged(req, '修改大模型网关配置');
    return this.llmAuditService.updateConfig(body || {});
  }

  /**
   * 对 LLM 网关执行真实连通性测试 (发送一次最小探测请求)
   */
  @Post('llm-config/test')
  async testLlmConnectivity(@Req() req: Request): Promise<{
    success: boolean;
    latencyMs: number;
    message: string;
    model?: string;
  }> {
    this.assertPrivileged(req, '测试大模型网关');
    return this.llmAuditService.testConnectivity();
  }

  /**
   * 获取所有风控规则列表 (允许匿名读取，前端本地正则引擎需要规则定义)
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
  async saveRule(
    @Body() rule: Partial<AuditRuleEntity>,
    @Req() req?: Request,
  ): Promise<AuditRuleEntity> {
    this.assertPrivileged(req, '维护风控规则');
    return this.auditService.saveRule(rule);
  }

  /**
   * 切换指定规则的启用状态
   * @param id 规则 ID
   */
  @Post('rules/:id/toggle')
  async toggleRule(
    @Param('id') id: string,
    @Req() req?: Request,
  ): Promise<AuditRuleEntity | null> {
    this.assertPrivileged(req, '启停风控规则');
    return this.auditService.toggleRule(id);
  }

  /**
   * 触发即时双引擎沙箱体检扫描 (上传技能时游客也可能触发，允许匿名)
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
    @Req() req?: Request,
  ): Promise<{ success: boolean; id: string }> {
    this.assertPrivileged(req, '删除风控规则');
    return this.auditService.deleteRule(id);
  }

  /**
   * 断言操作者具备管理员权限
   * 风控规则与大模型网关配置均属高危面：网关配置可被改写到外部地址，
   * 此前这些接口完全没有鉴权
   * @param req HTTP 请求对象
   * @param action 操作描述，用于错误提示
   */
  private assertPrivileged(
    req: Request | undefined,
    action: string,
  ): UserSession {
    const authHeader = req?.headers?.['authorization'];
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : (req?.query?.token as string);

    const session = token ? this.authService.validateToken(token) : null;
    if (!session) {
      throw new UnauthorizedException('请先登录后再进入风控中心');
    }
    if (session.role !== 'admin' && session.role !== 'super_admin') {
      throw new ForbiddenException(`仅管理员有权${action}`);
    }
    return session;
  }
}
