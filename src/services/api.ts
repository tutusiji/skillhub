import type {
  AuditRule,
  ClientPlatform,
  FileTreeNode,
  RuleSeverity,
  RuleType,
  SkillCategory,
  SkillItem,
  UserAccount,
  UserRole,
} from '../types';

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
  auditScore?: number;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  adminFeedback?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export function mapApiSkill(skill: ApiSkill): SkillItem {
  const score = skill.auditScore ?? 100;
  return {
    id: skill.id,
    slug: skill.slug,
    name: skill.name,
    version: skill.version ?? 'v1.0.0',
    description: skill.description,
    category: skill.category as SkillCategory,
    clients: (skill.clients ?? ['claude']) as ClientPlatform[],
    author: {
      name: skill.author,
      avatar: skill.avatar ?? 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
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
    readme: skill.description,
    fileTree: normalizeFileTree(skill.fileTree ?? []),
    installCommands: skill.installCommands,
    auditResults: {
      overallStatus: score >= 90 ? 'passed' : score >= 70 ? 'warning' : 'failed',
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
    role: user.role as UserRole,
    avatar: user.avatar ?? 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    department: user.department,
    joinedAt: new Date().toISOString().split('T')[0],
    points: user.points ?? 10000,
  };
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

export const api = {
  async listSkills(): Promise<ApiSkill[]> {
    return apiFetch<ApiSkill[]>('/api/v1/skills');
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
  async login(email: string, password: string): Promise<{ token: string; user: ApiUser }> {
    return apiFetch('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },
  async register(payload: {
    name: string;
    email: string;
    password: string;
    department: string;
    role: UserRole;
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
    fileTree?: unknown[];
  }): Promise<ApiSkill> {
    return apiFetch<ApiSkill>('/api/v1/skills/upload', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
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
