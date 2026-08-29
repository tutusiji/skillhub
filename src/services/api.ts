import type {
  AuditExecutionSummary,
  AuditRule,
  ClientPlatform,
  ExpertDomain,
  FeedbackItem,
  FileTreeNode,
  RuleSeverity,
  RuleType,
  SkillCategory,
  SkillCategoryItem,
  SkillDemand,
  SkillDemandCandidate,
  SkillItem,
  UserAccount,
  UserRole,
} from '../types';
import { resolveAvatar } from '../utils/avatar';

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001'
).replace(/\/$/, '');

export function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('skillhub_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** 后端在线状态标记：任一请求成功即置为 true，网络异常置为 false */
let backendOnline = false;

/**
 * 读取当前后端连通状态，供 UI 展示"离线模式"提示
 */
export function isBackendOnline(): boolean {
  return backendOnline;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
        ...init?.headers,
      },
    });
    backendOnline = true;
  } catch (networkError) {
    // 网络层失败（后端未启动 / 隧道中断）：标记离线并抛出统一错误
    backendOnline = false;
    throw new Error('无法连接后端服务，已切换至本地离线模式');
  }

  const text = await response.text();

  // 响应体可能不是 JSON（代理层 502 页面 / 网关 HTML），解析失败不应抛 SyntaxError
  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    // 502/503/504 通常是 dev 代理或网关连不上 NestJS，而非业务错误：给出可操作提示
    if (response.status === 502 || response.status === 503 || response.status === 504) {
      backendOnline = false;
      throw new Error(
        data?.message ||
          `后端服务未就绪 (${response.status})，请确认 NestJS 已启动 (pnpm run server:dev)`
      );
    }
    const message = Array.isArray(data?.message)
      ? data.message.join('；')
      : data?.message ||
        (text && !data ? `请求失败 (${response.status})：${text.slice(0, 120)}` : '') ||
        `请求失败 (${response.status})`;
    throw new Error(message);
  }
  return data as T;
}

interface RawFileTreeNode {
  name: string;
  type?: 'file' | 'directory';
  size?: number;
  language?: string;
  content?: string;
  children?: RawFileTreeNode[];
}

function normalizeFileTree(nodes: RawFileTreeNode[] = [], parentPath = ''): FileTreeNode[] {
  return nodes.map((node, index) => {
    const path = parentPath ? `${parentPath}/${node.name}` : node.name;
    return {
      id: `${path}:${index}`,
      name: node.name,
      path,
      type: node.type ?? 'file',
      size: node.size,
      language: node.language,
      content: node.content,
      children: node.children ? normalizeFileTree(node.children, path) : undefined,
    };
  });
}

export interface ApiSkill {
  id: string;
  slug: string;
  name: string;
  version?: string;
  description: string;
  category: string;
  author: string;
  /** 提交者用户 ID（后端从登录会话写入，用于判定「我的提交」） */
  submitterId?: string | null;
  avatar?: string;
  department?: string;
  status?: string;
  clients?: string[];
  tags?: string[];
  downloads?: number;
  likes?: number;
  stars?: number;
  permissions?: string[];
  installCommands: SkillItem['installCommands'];
  fileTree?: RawFileTreeNode[];
  readme?: string;
  expertDomain?: string;
  expertDomains?: string[];
  auditScore?: number;
  /** 权威放行判定（后端按最近一次已保存体检报告回传；未体检为 null） */
  auditStatus?: 'passed' | 'warning' | 'failed' | 'pending' | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  adminFeedback?: string | null;
  zipFileName?: string | null;
  zipBlob?: string | null;
  /** 版本链：当前版本指向其前驱版本（第一版为 null）；同一插件所有版本共享根 slug */
  parentSkillId?: string | null;
  /** 版本链：已归档版本指向替代它的 approved 版本 */
  supersededById?: string | null;
  /** 版本链：被新版替代的时间戳（archived 状态时填入） */
  archivedAt?: string | null;
  /** 版本链：'replace' = 替代旧版归档；'coexist' = 旧版保留 approved 独立计数 */
  supersedeMode?: 'coexist' | 'replace' | null;
  createdAt?: string;
  updatedAt?: string;
}

export function mapApiSkill(skill: ApiSkill): SkillItem {
  // 未体检技能（auditScore 为空）不虚构分数：显示「待体检」，列表/详情/审批都不出分
  const score = skill.auditScore ?? null;
  // 权威判定优先取后端回传的 auditStatus（引擎语义结论），
  // 只有旧数据缺该字段时才按得分兜底推断，避免前端阈值与引擎结论打架
  const overallStatus: AuditExecutionSummary['overallStatus'] =
    skill.auditStatus ??
    (score == null
      ? 'pending'
      : score >= 90
        ? 'passed'
        : score >= 70
          ? 'warning'
          : 'failed');
  return {
    id: skill.id,
    slug: skill.slug,
    name: skill.name,
    version: skill.version ?? 'v1.0.0',
    description: skill.description,
    category: skill.category as SkillCategory,
    zipFileName: skill.zipFileName ?? undefined,
    submitterId: skill.submitterId ?? undefined,
    clients: (skill.clients ?? ['claude']) as ClientPlatform[],
    author: {
      name: skill.author,
      // 头像为空时按作者名派生，避免整列技能共用同一张兜底人像
      avatar: resolveAvatar(skill.avatar, { name: skill.author }),
      department: skill.department ?? '技术研发中心',
      verified: false,
    },
    tags: skill.tags ?? [],
    likes: skill.likes ?? 0,
    stars: skill.stars ?? 0,
    downloads: skill.downloads ?? 0,
    createdAt: skill.createdAt ?? new Date().toISOString(),
    updatedAt: skill.updatedAt ?? skill.createdAt ?? new Date().toISOString(),
    status: (skill.status ?? 'pending') as SkillItem['status'],
    permissions: skill.permissions ?? [],
    parentSkillId: skill.parentSkillId ?? null,
    supersededById: skill.supersededById ?? null,
    archivedAt: skill.archivedAt ?? null,
    supersedeMode: skill.supersedeMode ?? null,
    readme: skill.readme || skill.description,
    expertDomain: (skill.expertDomain as SkillItem['expertDomain']) ?? undefined,
    expertDomains: Array.isArray(skill.expertDomains) ? skill.expertDomains : [],
    fileTree: normalizeFileTree(skill.fileTree ?? []),
    installCommands: skill.installCommands,
    auditResults: {
      overallStatus,
      score,
      scannedAt: skill.updatedAt ?? new Date().toISOString(),
      regexResults: [],
      llmResults: [],
      reviewedBy: skill.reviewedBy ?? undefined,
      reviewedAt: skill.reviewedAt ?? undefined,
      adminFeedback: skill.adminFeedback ?? undefined,
    },
  };
}

export interface ApiUser {
  id: string;
  name: string;
  email: string;
  employeeId?: string | null;
  loginName?: string | null;
  authProvider?: string;
  menuPermissions?: string[];
  role: string;
  department: string;
  avatar?: string;
  points?: number;
}

export function mapApiUser(user: ApiUser): UserAccount {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    employeeId: user.employeeId ?? null,
    loginName: user.loginName ?? null,
    authProvider: user.authProvider === 'oss' ? 'oss' : 'password',
    menuPermissions: Array.isArray(user.menuPermissions) ? user.menuPermissions : [],
    role: user.role as UserRole,
    avatar: resolveAvatar(user.avatar, user),
    department: user.department,
    joinedAt: new Date().toISOString().split('T')[0],
    points: user.points ?? 10000,
  };
}

/** 后端建议记录（映射自 feedback 表） */
export interface ApiFeedback {
  id: string;
  title: string;
  content: string;
  category: string;
  rating: number;
  submitterId: string;
  submitterName: string;
  submitterEmployeeId: string | null;
  submitterAvatar: string;
  submitterDepartment: string | null;
  createdAt: string;
}

/** 后端建议记录映射为前端 FeedbackItem */
export function mapApiFeedback(item: ApiFeedback): FeedbackItem {
  return {
    id: item.id,
    userName: item.submitterName,
    userEmail: item.submitterEmployeeId
      ? `${item.submitterEmployeeId}@skillhub.corp`
      : '',
    category: (['feature', 'bug', 'security', 'experience', 'other'].includes(item.category)
      ? item.category
      : 'feature') as FeedbackItem['category'],
    rating: item.rating,
    title: item.title,
    content: item.content,
    createdAt: new Date(item.createdAt).toISOString(),
    status: 'pending',
    submitterEmployeeId: item.submitterEmployeeId ?? undefined,
    submitterDepartment: item.submitterDepartment ?? undefined,
    submitterAvatar: item.submitterAvatar || undefined,
  };
}

/** 后端专家组记录（映射自 expert_domains 表） */
export interface ApiExpertDomain {
  id: string;
  name: string;
  shortLabel: string;
  description: string;
  iconName: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  sortOrder: number;
}

/** 专家组创建/更新载荷（可省略的字段用 undefined 表示不修改） */
export interface ExpertDomainPayload {
  id?: string;
  name?: string;
  shortLabel?: string;
  description?: string;
  iconName?: string;
  badgeBg?: string;
  badgeText?: string;
  badgeBorder?: string;
  sortOrder?: number;
}

export interface ApiAuditRule {
  id: string;
  name: string;
  type: string;
  severity: string;
  category: string;
  description?: string;
  pattern?: string;
  llmPromptTemplate?: string;
  isEnabled: boolean;
  isPreset: boolean;
  createdAt?: string;
}

export function mapAuditRule(rule: ApiAuditRule): AuditRule {
  const timestamp = rule.createdAt ?? new Date().toISOString();
  return {
    id: rule.id,
    name: rule.name,
    type: rule.type as RuleType,
    severity: rule.severity as RuleSeverity,
    category: rule.category as AuditRule['category'],
    description: rule.description ?? '',
    pattern: rule.pattern,
    llmPromptTemplate: rule.llmPromptTemplate,
    isEnabled: rule.isEnabled,
    isPreset: rule.isPreset,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export interface ApiSkillDemand {
  id: string;
  title: string;
  description: string;
  targetDomain: string;
  expectedOutput?: string;
  bountyPoints: number;
  deadlineText?: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  authorDepartment?: string;
  status: string;
  rejectReason?: string | null;
  candidates?: SkillDemandCandidate[];
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * 将后端需求实体映射为前端 SkillDemand 结构
 * 后端以扁平字段存储发布者快照，前端使用嵌套 author 对象，此处负责结构转换
 * @param demand 后端返回的需求实体
 */
export function mapApiDemand(demand: ApiSkillDemand): SkillDemand {
  const candidates = demand.candidates ?? [];
  return {
    id: demand.id,
    title: demand.title,
    description: demand.description,
    targetDomain: demand.targetDomain as ExpertDomain,
    expectedOutput: demand.expectedOutput ?? '',
    bountyPoints: demand.bountyPoints,
    deadlineText: demand.deadlineText ?? '永久有效',
    author: {
      id: demand.authorId,
      name: demand.authorName,
      avatar: demand.authorAvatar ?? '',
      department: demand.authorDepartment ?? '技术研发中心',
    },
    status: demand.status as SkillDemand['status'],
    rejectReason: demand.rejectReason ?? undefined,
    submissionsCount: candidates.length,
    candidates,
    createdAt: demand.createdAt ?? new Date().toISOString(),
    updatedAt: demand.updatedAt ?? demand.createdAt ?? new Date().toISOString(),
    reviewedBy: demand.reviewedBy ?? undefined,
    reviewedAt: demand.reviewedAt ?? undefined,
  };
}

/** 后端双引擎沙箱扫描返回的 LLM 语义研判结论 */
export interface ApiLlmVerdict {
  score: number;
  confidence: number;
  status: 'passed' | 'warning' | 'failed';
  summary: string;
  reasoning: string[];
  suggestions: string[];
  engine?: 'llm' | 'heuristic';
  model?: string;
  latencyMs?: number;
  degradedReason?: string;
}

/** 后端双引擎沙箱扫描结果 */
export interface ApiSandboxScanResult {
  score: number;
  status: 'passed' | 'warning' | 'failed';
  durationMs: number;
  regexHits: Array<{
    ruleId: string;
    ruleName: string;
    severity: string;
    lineHint?: string;
    matchSnippet?: string;
  }>;
  llmVerdict: ApiLlmVerdict;
}

/** 后端返回的 LLM 审核引擎配置视图 (apiKey 仅有掩码，无明文) */
export interface ApiLlmConfig {
  /** 网关协议：'openai' 兼容 /chat/completions，或 'anthropic' Messages API */
  protocol: 'openai' | 'anthropic';
  baseUrl: string;
  apiKeyMask: string;
  hasApiKey: boolean;
  modelName: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  timeoutMs: number;
  maxRetries: number;
  isEnabled: boolean;
  lastTestedAt: string | null;
  testStatus: string;
  testMessage: string | null;
  updatedAt: string | null;
}

/** LLM 网关连通性测试结果 */
export interface ApiLlmTestResult {
  success: boolean;
  latencyMs: number;
  message: string;
  model?: string;
}

export const api = {
  async listSkills(): Promise<ApiSkill[]> {
    return apiFetch<ApiSkill[]>('/api/v1/skills');
  },
  /**
   * 按 slug 或 ID 获取技能详情（含完整文件内容，用于详情页源码预览）
   * @param slugOrId 技能标识
   */
  async getSkill(slugOrId: string): Promise<ApiSkill> {
    return apiFetch<ApiSkill>(`/api/v1/skills/${encodeURIComponent(slugOrId)}`);
  },

  /**
   * 拉取技能最近一次双引擎体检报告明细（正则命中 + LLM 语义研判）
   * 与详情接口同源的可见性规则；历史技能无关联报告时返回仅含分数的摘要
   * 返回即前端 AuditExecutionSummary 同构，无需再映射
   */
  async getSkillAuditReport(slugOrId: string): Promise<AuditExecutionSummary> {
    return apiFetch<AuditExecutionSummary>(
      `/api/v1/skills/${encodeURIComponent(slugOrId)}/audit-report`,
    );
  },
  async listUsers(): Promise<ApiUser[]> {
    return apiFetch<ApiUser[]>('/api/v1/auth/users');
  },
  async listAuditRules(): Promise<ApiAuditRule[]> {
    return apiFetch<ApiAuditRule[]>('/api/v1/audit/rules');
  },
  async profile(): Promise<ApiUser> {
    return apiFetch<ApiUser>('/api/v1/auth/me');
  },
  /**
   * 账号密码登录
   * @param account 登录账号：超级管理员用登录名 admin，普通员工用工号
   * @param password 登录密码
   */
  async login(account: string, password: string): Promise<{ token: string; user: ApiUser }> {
    return apiFetch('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ account, password }),
    });
  },

  /**
   * 内部 IAM 单点登录 (OSS)：凭工号免密登录，首次登录自动开号
   * @param employeeId 员工工号
   */
  async ossLogin(employeeId: string): Promise<{ token: string; user: ApiUser }> {
    return apiFetch('/api/v1/auth/oss-login', {
      method: 'POST',
      body: JSON.stringify({ employeeId }),
    });
  },

  /**
   * 新员工自助注册
   * 注意：角色不可指定，后端一律创建为普通用户，管理员只能由超级管理员委任
   * @param payload 注册表单（工号、姓名、密码、部门、可选邮箱）
   */
  async register(payload: {
    employeeId: string;
    name: string;
    password: string;
    department?: string;
    email?: string;
  }): Promise<{ token: string; user: ApiUser }> {
    return apiFetch('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * 开发者提交新技能上架申请，后端会执行双引擎风控扫描并按结果决定是否直接发布
   * @param payload 技能表单数据（含虚拟文件树）
   */
  async createSkill(payload: {
    name: string;
    slug: string;
    category: string;
    description: string;
    author: string;
    department?: string;
    avatar?: string;
    version?: string;
    permissions?: string[];
    clients?: string[];
    tags?: string[];
    readme?: string;
    expertDomain?: string;
    fileTree?: unknown[];
    /** 原始 ZIP（base64）与上传文件名，供无损下载与 Git 市场发布 */
    zipBuffer?: string;
    zipFileName?: string;
    /** 多版本发布：父版本 ID（不传表示全新技能；传了则进入"发新版本"流程） */
    parentSkillId?: string;
    /** 多版本发布：父版本处理模式。coexist=保留共存，replace=替代旧版（counter 继承） */
    supersedeMode?: 'coexist' | 'replace';
  }): Promise<ApiSkill> {
    return apiFetch<ApiSkill>('/api/v1/skills/upload', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * 技能作者本人编辑元数据（白名单字段，不需要管理员权限）
   * 已上架技能改 version 时必须在 payload 同步传 newZipProvided=true，
   * 后端会拒绝"裸改 approved 的 version"以防止虚标版本号
   * @param id 技能 ID
   * @param payload 待更新字段
   */
  async updateSkillMeta(
    id: string,
    payload: {
      name?: string;
      description?: string;
      category?: string;
      version?: string;
      newZipProvided?: boolean;
    },
  ): Promise<ApiSkill> {
    return apiFetch<ApiSkill>(`/api/v1/skills/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  /**
   * 下载技能上传时的原始 ZIP 压缩包（文件名与上传一致、二进制无损）
   * @param id 技能 ID
   * @returns 触发浏览器下载；无原始 ZIP 时返回 null
   */
  async downloadOriginalZip(id: string): Promise<{ fileName: string } | null> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/skills/${id}/zip`, {
        headers: authHeaders(),
      });
      if (!res.ok) return null;
      const disposition = res.headers.get('content-disposition') || '';
      const match = disposition.match(/filename="([^"]+)"/);
      const fileName = match ? decodeURIComponent(match[1]) : `${id}.zip`;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return { fileName };
    } catch {
      return null;
    }
  },

  /**
   * 管理员审核通过技能，后端会同步提交至 Git 市场
   * @param id 技能 ID
   * @param feedback 审核意见
   */
  async approveSkill(id: string, feedback?: string): Promise<ApiSkill> {
    return apiFetch<ApiSkill>(`/api/v1/skills/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ feedback }),
    });
  },

  /**
   * 管理员驳回技能上架申请（驳回理由必填）
   * @param id 技能 ID
   * @param feedback 驳回理由
   */
  async rejectSkill(id: string, feedback: string): Promise<ApiSkill> {
    return apiFetch<ApiSkill>(`/api/v1/skills/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ feedback }),
    });
  },

  /**
   * 管理员紧急下架技能，同时从 Git 市场索引剔除
   * @param id 技能 ID
   * @param reason 下架原因
   */
  async delistSkill(id: string, reason?: string): Promise<ApiSkill> {
    return apiFetch<ApiSkill>(`/api/v1/skills/${id}/delist`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  /**
   * 管理员恢复已下架技能重新上线
   * @param id 技能 ID
   */
  async relistSkill(id: string): Promise<ApiSkill> {
    return apiFetch<ApiSkill>(`/api/v1/skills/${id}/relist`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  },

  /**
   * 管理员彻底删除技能记录
   * @param id 技能 ID
   */
  async deleteSkill(id: string): Promise<{ success: boolean; id: string }> {
    return apiFetch(`/api/v1/skills/${id}`, { method: 'DELETE' });
  },

  /**
   * 查询指定技能链上的所有版本（按时间倒序，最新在前）
   * 已 archive 的旧版本仅 owner / admin 可见
   * @param id 链上任意一节点的技能 ID
   */
  async getSkillVersions(id: string): Promise<ApiSkill[]> {
    return apiFetch<ApiSkill[]>(`/api/v1/skills/${encodeURIComponent(id)}/versions`);
  },

  /**
   * 超级管理员回滚到指定历史版本（仅 super_admin）
   * 当前 approved 版本 archive；目标版本 approved；Git 市场重同步
   * @param id 当前 approved 版本的 ID
   * @param targetVersionId 目标历史版本 ID
   */
  async rollbackSkill(
    id: string,
    targetVersionId: string,
  ): Promise<{ success: boolean; current: ApiSkill; target: ApiSkill }> {
    return apiFetch(`/api/v1/skills/${encodeURIComponent(id)}/rollback`, {
      method: 'POST',
      body: JSON.stringify({ targetVersionId }),
    });
  },

  /**
   * 上报技能社交互动计数（点赞 / 收藏 / 下载）
   * @param id 技能 ID
   * @param metric 计数字段
   * @param delta 增量方向，+1 为新增，-1 为撤销
   */
  async incrementSkillMetric(
    id: string,
    metric: 'likes' | 'stars' | 'downloads',
    delta: number = 1
  ): Promise<ApiSkill> {
    return apiFetch<ApiSkill>(`/api/v1/skills/${id}/metrics`, {
      method: 'PATCH',
      body: JSON.stringify({ metric, delta }),
    });
  },

  /**
   * 回写前端重新体检得到的双引擎综合评分
   * @param id 技能 ID
   * @param score 最新得分
   */
  async updateSkillAuditScore(id: string, score: number): Promise<ApiSkill> {
    return apiFetch<ApiSkill>(`/api/v1/skills/${id}/audit-score`, {
      method: 'PATCH',
      body: JSON.stringify({ score }),
    });
  },

  /**
   * 新增或更新风控规则
   * @param rule 规则数据
   */
  async saveAuditRule(rule: AuditRule): Promise<ApiAuditRule> {
    return apiFetch<ApiAuditRule>('/api/v1/audit/rules', {
      method: 'POST',
      body: JSON.stringify({
        id: rule.id,
        name: rule.name,
        type: rule.type,
        severity: rule.severity,
        category: rule.category,
        description: rule.description,
        pattern: rule.pattern,
        llmPromptTemplate: rule.llmPromptTemplate,
        isEnabled: rule.isEnabled,
      }),
    });
  },

  /**
   * 切换风控规则启用状态
   * @param id 规则 ID
   */
  async toggleAuditRule(id: string): Promise<ApiAuditRule> {
    return apiFetch<ApiAuditRule>(`/api/v1/audit/rules/${id}/toggle`, {
      method: 'POST',
    });
  },

  /**
   * 调用后端双引擎沙箱扫描（正则规则 + 真实 LLM 语义研判）。
   * 注意：该接口只扫描不落库，需用 saveAuditReport 显式保存后，
   * audit_reports 中才有该技能的体检记录，其他地方才能拉取到。
   * @param payload 待审核的代码或 Prompt 全文
   * @param skillId 可选关联技能 ID
   */
  async runSandboxScan(
    payload: string,
    skillId?: string,
  ): Promise<ApiSandboxScanResult> {
    return apiFetch<ApiSandboxScanResult>('/api/v1/audit/sandbox-scan', {
      method: 'POST',
      body: JSON.stringify({ payload, skillId }),
    });
  },

  /**
   * 管理员「保存扫描结果」：把审核工作台刚跑出的体检结果落库并回写 auditScore。
   * @param id 技能 ID
   * @param result 工作台扫描出的 ApiSandboxScanResult（与后端 AuditReportResult 同构）
   */
  async saveAuditReport(
    id: string,
    result: ApiSandboxScanResult,
  ): Promise<ApiSkill> {
    return apiFetch<ApiSkill>(`/api/v1/skills/${id}/audit-report`, {
      method: 'POST',
      body: JSON.stringify({ result }),
    });
  },

  /**
   * 读取 LLM 审核引擎网关配置（API Key 仅返回掩码）
   */
  async getLlmConfig(): Promise<ApiLlmConfig> {
    return apiFetch<ApiLlmConfig>('/api/v1/audit/llm-config');
  },

  /**
   * 保存 LLM 审核引擎网关配置
   * apiKey 传 undefined 表示保持原值，传 null 表示清空凭据
   * @param payload 待更新的配置字段
   */
  async updateLlmConfig(payload: {
    protocol?: 'openai' | 'anthropic';
    baseUrl?: string;
    apiKey?: string | null;
    modelName?: string;
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
    timeoutMs?: number;
    maxRetries?: number;
    isEnabled?: boolean;
  }): Promise<ApiLlmConfig> {
    return apiFetch<ApiLlmConfig>('/api/v1/audit/llm-config', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  /**
   * 触发真实的 LLM 网关连通性测试（由后端发起探测请求）
   */
  async testLlmConfig(): Promise<ApiLlmTestResult> {
    return apiFetch<ApiLlmTestResult>('/api/v1/audit/llm-config/test', {
      method: 'POST',
    });
  },

  /**
   * 删除自定义风控规则（内置预设规则受后端保护）
   * @param id 规则 ID
   */
  async deleteAuditRule(id: string): Promise<{ success: boolean; id: string }> {
    return apiFetch(`/api/v1/audit/rules/${id}`, { method: 'DELETE' });
  },

  /**
   * 变更组织成员角色权限
   * @param userId 目标用户 ID
   * @param role 新角色
   */
  async updateUserRole(userId: string, role: UserRole): Promise<ApiUser> {
    return apiFetch<ApiUser>(`/api/v1/auth/users/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  },

  /**
   * 超级管理员调整指定管理员的菜单级权限（勾选/取消 审核管理、风控中心）
   * @param userId 目标用户 ID
   * @param permissions 菜单权限清单，如 ['audit', 'rules']
   */
  async updateUserMenuPermissions(userId: string, permissions: string[]): Promise<ApiUser> {
    return apiFetch<ApiUser>(`/api/v1/auth/users/${userId}/menu-permissions`, {
      method: 'PATCH',
      body: JSON.stringify({ permissions }),
    });
  },

  /**
   * 调整用户悬赏积分余额
   * @param userId 目标用户 ID
   * @param delta 积分增量，负数为扣减
   */
  async adjustUserPoints(userId: string, delta: number): Promise<ApiUser> {
    return apiFetch<ApiUser>(`/api/v1/auth/users/${userId}/points`, {
      method: 'PATCH',
      body: JSON.stringify({ delta }),
    });
  },

  /**
   * 随机切换当前登录用户的头像
   *
   * 后端按 seed 重新生成头像并落库（含业务表快照），返回最新会话对象。
   * 接口不带 userId：目标恒为登录本人。
   */
  async shuffleMyAvatar(): Promise<ApiUser> {
    return apiFetch<ApiUser>('/api/v1/auth/me/avatar', { method: 'PATCH' });
  },

  /**
   * 获取技能征集需求列表
   */
  async listDemands(): Promise<ApiSkillDemand[]> {
    return apiFetch<ApiSkillDemand[]>('/api/v1/demands');
  },

  /**
   * 查询建议列表：管理员看全部，普通用户只看自己的
   */
  async listFeedback(): Promise<ApiFeedback[]> {
    return apiFetch<ApiFeedback[]>('/api/v1/feedback');
  },

  /**
   * 查询技能分类标签（集市与发布表单数据源；默认仅启用中的）
   */
  async listSkillCategories(): Promise<SkillCategoryItem[]> {
    return apiFetch<SkillCategoryItem[]>('/api/v1/skill-categories');
  },

  /**
   * 查询岗位专家组列表（首页矩阵与技能归属数据源）
   */
  async listExpertDomains(): Promise<ApiExpertDomain[]> {
    return apiFetch<ApiExpertDomain[]>('/api/v1/expert-domains');
  },

  /**
   * 新增岗位专家组（管理员）
   * @param payload 专家组数据
   */
  async createExpertDomain(payload: ExpertDomainPayload): Promise<ApiExpertDomain> {
    return apiFetch<ApiExpertDomain>('/api/v1/expert-domains', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * 更新岗位专家组（管理员）
   * @param id 专家组 key
   * @param payload 待更新字段
   */
  async updateExpertDomain(id: string, payload: ExpertDomainPayload): Promise<ApiExpertDomain> {
    return apiFetch<ApiExpertDomain>(`/api/v1/expert-domains/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  /**
   * 删除岗位专家组（管理员）
   * @param id 专家组 key
   */
  async deleteExpertDomain(id: string): Promise<{ success: boolean }> {
    return apiFetch(`/api/v1/expert-domains/${id}`, { method: 'DELETE' });
  },

  /**
   * 新增技能分类（管理员）
   * @param payload 分类数据
   */
  async createSkillCategory(payload: {
    id: string;
    label: string;
    sortOrder?: number;
    isEnabled?: boolean;
  }): Promise<SkillCategoryItem> {
    return apiFetch<SkillCategoryItem>('/api/v1/skill-categories', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * 更新技能分类（管理员）
   * @param id 分类 key
   * @param payload 待更新字段
   */
  async updateSkillCategory(
    id: string,
    payload: { label?: string; sortOrder?: number; isEnabled?: boolean },
  ): Promise<SkillCategoryItem> {
    return apiFetch<SkillCategoryItem>(`/api/v1/skill-categories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  /**
   * 删除技能分类（管理员）
   * @param id 分类 key
   */
  async deleteSkillCategory(id: string): Promise<{ success: boolean }> {
    return apiFetch(`/api/v1/skill-categories/${id}`, { method: 'DELETE' });
  },

  /**
   * 提交一条建议（需登录）
   * @param payload 建议表单数据
   */
  async createFeedback(payload: {
    title: string;
    content: string;
    category: string;
    rating: number;
  }): Promise<ApiFeedback> {
    return apiFetch<ApiFeedback>('/api/v1/feedback', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * 管理员维护技能的专家组归属（专家组即标签，可属于多个）
   * @param id 技能 ID
   * @param domains 专家组 ID 清单
   */
  async updateSkillExpertDomains(id: string, domains: string[]): Promise<ApiSkill> {
    return apiFetch<ApiSkill>(`/api/v1/skills/${id}/expert-domains`, {
      method: 'PUT',
      body: JSON.stringify({ domains }),
    });
  },

  /**
   * 删除建议：管理员可删任意建议，普通用户只能删自己的
   * @param id 建议 ID
   */
  async deleteFeedback(id: string): Promise<{ success: boolean }> {
    return apiFetch(`/api/v1/feedback/${id}`, { method: 'DELETE' });
  },

  /**
   * 发布新的技能征集需求（后端会在事务内扣减悬赏积分）
   * @param payload 需求表单数据
   */
  async createDemand(payload: {
    title: string;
    description: string;
    targetDomain: string;
    expectedOutput?: string;
    bountyPoints: number;
    deadlineText?: string;
  }): Promise<ApiSkillDemand> {
    return apiFetch<ApiSkillDemand>('/api/v1/demands', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * 管理员审核通过需求，公开至征集广场
   * @param id 需求 ID
   */
  async approveDemand(id: string): Promise<ApiSkillDemand> {
    return apiFetch<ApiSkillDemand>(`/api/v1/demands/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  },

  /**
   * 管理员驳回需求（后端同步退还悬赏积分）
   * @param id 需求 ID
   * @param reason 驳回理由
   */
  async rejectDemand(id: string, reason: string): Promise<ApiSkillDemand> {
    return apiFetch<ApiSkillDemand>(`/api/v1/demands/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  /**
   * 删除需求（未交付的需求后端会退还悬赏积分）
   * @param id 需求 ID
   */
  async deleteDemand(
    id: string
  ): Promise<{ success: boolean; id: string; refunded: number }> {
    return apiFetch(`/api/v1/demands/${id}`, { method: 'DELETE' });
  },

  /**
   * 提交应征方案
   * @param id 需求 ID
   * @param payload 方案说明与关联技能
   */
  async submitDemandCandidate(
    id: string,
    payload: { notes: string; skillId?: string; skillName?: string }
  ): Promise<ApiSkillDemand> {
    return apiFetch<ApiSkillDemand>(`/api/v1/demands/${id}/candidates`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * 验收中选方案，后端把悬赏积分发放给方案提交者
   * @param id 需求 ID
   * @param candidateId 中选方案 ID
   */
  async acceptDemandCandidate(
    id: string,
    candidateId: string
  ): Promise<ApiSkillDemand> {
    return apiFetch<ApiSkillDemand>(
      `/api/v1/demands/${id}/candidates/${candidateId}/accept`,
      { method: 'POST', body: JSON.stringify({}) }
    );
  },
};

/**
 * 静默执行后端写操作：失败时仅打印警告，不阻断前端本地状态更新
 * 用于"乐观更新 + 后端最终一致"模式，保证离线可用性
 * @param task 待执行的后端请求
 * @param label 操作描述，用于日志定位
 */
export async function syncToBackend<T>(
  task: () => Promise<T>,
  label: string
): Promise<T | null> {
  try {
    return await task();
  } catch (error) {
    console.warn(`[SkillHub] 后端同步失败 (${label}):`, (error as Error).message);
    return null;
  }
}
