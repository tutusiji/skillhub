import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** 内部 IAM 返回的员工档案 */
export interface IamEmployeeProfile {
  /** 员工工号 */
  employeeId: string;
  /** 员工姓名 */
  name: string;
  /** 所属部门 */
  department?: string;
  /** 企业邮箱 */
  email?: string;
}

/** 桩模式下认可的工号格式：7 位数字 */
const STUB_EMPLOYEE_ID_PATTERN = /^\d{7}$/;

/**
 * 内部 IAM 单点登录适配服务
 *
 * 这是一个可插拔实现：`verifyEmployee` 是与内部 IAM 的**唯一**接触点。
 * - 配置了 IAM_BASE_URL 时走真实内网接口；
 * - 未配置时走本地桩逻辑，接受 7 位数字工号并合成档案，便于在没有内网环境时完整体验流程。
 *
 * 对接真实 IAM 时只需改动本文件的 fetchFromIam 方法，
 * 上层 AuthService.ossLogin 与前端登录入口都无需调整。
 */
@Injectable()
export class OssIamService {
  constructor(private readonly configService: ConfigService) {}

  /**
   * 校验工号是否为在职员工，并返回其档案
   * @param employeeId 员工工号
   * @returns 校验通过返回员工档案，否则返回 null
   */
  async verifyEmployee(employeeId: string): Promise<IamEmployeeProfile | null> {
    const baseUrl = this.configService.get<string>('IAM_BASE_URL') || '';

    if (!baseUrl.trim()) {
      return this.verifyByStub(employeeId);
    }

    try {
      return await this.fetchFromIam(baseUrl.trim(), employeeId);
    } catch (err) {
      // IAM 不可用时不静默放行，避免把校验失败当成校验通过
      console.error(
        `❌ 内部 IAM 校验工号 ${employeeId} 失败: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return null;
    }
  }

  /**
   * 调用真实内网 IAM 接口校验工号
   *
   * 【对接说明】请按内部 IAM 的实际契约调整下面三处：
   *   1. 请求地址与方法（当前假定 GET {IAM_BASE_URL}/employees/{工号}）
   *   2. 鉴权方式（当前假定 IAM_API_TOKEN 作为 Bearer Token，按需换成 AK/SK 或 mTLS）
   *   3. 响应字段映射（当前假定 { name, department, email, status } 结构）
   *
   * @param baseUrl IAM 服务基址
   * @param employeeId 员工工号
   */
  private async fetchFromIam(
    baseUrl: string,
    employeeId: string,
  ): Promise<IamEmployeeProfile | null> {
    const token = this.configService.get<string>('IAM_API_TOKEN') || '';
    const timeoutMs = Number(
      this.configService.get<string>('IAM_TIMEOUT_MS') || 5000,
    );

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(
        `${baseUrl.replace(/\/$/, '')}/employees/${encodeURIComponent(employeeId)}`,
        {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          signal: controller.signal,
        },
      );

      // 工号不存在时 IAM 通常返回 404，属正常的校验失败
      if (res.status === 404) return null;
      if (!res.ok) {
        throw new Error(`IAM 返回 HTTP ${res.status} ${res.statusText}`);
      }

      const data = (await res.json()) as {
        name?: string;
        department?: string;
        email?: string;
        status?: string;
      };

      // 已离职员工不允许登录
      if (data.status && data.status !== 'active') return null;
      if (!data.name) return null;

      return {
        employeeId,
        name: data.name,
        department: data.department,
        email: data.email,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * 桩实现：未配置 IAM 时按工号格式放行并合成档案
   * @param employeeId 员工工号
   */
  private verifyByStub(employeeId: string): IamEmployeeProfile | null {
    const trimmed = employeeId.trim();
    if (!STUB_EMPLOYEE_ID_PATTERN.test(trimmed)) return null;

    return {
      employeeId: trimmed,
      name: `员工 ${trimmed}`,
      department: '技术研发中心',
      email: `${trimmed}@skillhub.corp`,
    };
  }
}
