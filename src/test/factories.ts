import type {
  AuditRule,
  FeedbackItem,
  SkillDemand,
  SkillItem,
  UserAccount,
} from '../types';
import type {
  ApiAuditRule,
  ApiFeedback,
  ApiSandboxScanResult,
  ApiSkill,
  ApiSkillDemand,
  ApiUser,
} from '../services/api';

/**
 * 测试数据工厂：为领域实体与后端 API 实体提供最小可用样本。
 * 单测里 `makeSkill()` 拿到完整合法对象，需要变体时用 `{...makeSkill(), name: 'x'}` 覆盖。
 */

let seq = 0;
function nextId(prefix: string): string {
  seq += 1;
  return `${prefix}-${seq}`;
}

export function makeApiSkill(overrides: Partial<ApiSkill> = {}): ApiSkill {
  const id = overrides.id ?? nextId('skill');
  return {
    id,
    slug: overrides.slug ?? `@skillhub/demo-${seq}`,
    name: '演示技能',
    version: 'v1.0.0',
    description: '一个用于单测的演示技能',
    category: 'productivity',
    author: '张测试',
    submitterId: 'user-1',
    department: '技术研发中心',
    status: 'approved',
    clients: ['claude'],
    tags: ['demo'],
    downloads: 0,
    likes: 0,
    stars: 0,
    permissions: ['read'],
    installCommands: {
      claude: `claude plugin install ${id}`,
      cursor: `cursor install ${id}`,
      mcp: `mcp add ${id}`,
      cli: `skillhub install ${id}`,
    },
    fileTree: [],
    readme: '## 演示技能\n\n用于测试。',
    expertDomain: 'general',
    expertDomains: ['general'],
    auditScore: 100,
    auditStatus: 'passed',
    reviewedBy: 'admin',
    reviewedAt: '2026-01-01T00:00:00.000Z',
    adminFeedback: null,
    zipFileName: null,
    zipBlob: null,
    parentSkillId: null,
    supersededById: null,
    archivedAt: null,
    supersedeMode: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function makeSkill(overrides: Partial<SkillItem> = {}): SkillItem {
  const slug = overrides.slug ?? `@skillhub/demo-${seq}`;
  const id = overrides.id ?? nextId('skill');
  return {
    id,
    slug,
    name: '演示技能',
    version: 'v1.0.0',
    description: '一个用于单测的演示技能',
    category: 'productivity',
    expertDomain: 'general',
    expertDomains: ['general'],
    clients: ['claude'],
    author: {
      name: '张测试',
      avatar: 'https://api.dicebear.com/10.x/adventurer/svg?seed=7462201',
      department: '技术研发中心',
      verified: false,
    },
    submitterId: 'user-1',
    tags: ['demo'],
    likes: 0,
    stars: 0,
    downloads: 0,
    isLiked: false,
    isStarred: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    status: 'approved',
    parentSkillId: null,
    supersededById: null,
    archivedAt: null,
    supersedeMode: null,
    permissions: ['read'],
    readme: '## 演示技能\n\n用于测试。',
    fileTree: [],
    installCommands: {
      claude: `claude plugin install ${id}`,
      cursor: `cursor install ${id}`,
      mcp: `mcp add ${id}`,
      cli: `skillhub install ${id}`,
    },
    auditResults: {
      overallStatus: 'passed',
      score: 100,
      scannedAt: '2026-01-01T00:00:00.000Z',
      regexResults: [],
      llmResults: [],
      reviewedBy: 'admin',
      reviewedAt: '2026-01-01T00:00:00.000Z',
    },
    ...overrides,
  };
}

export function makeApiUser(overrides: Partial<ApiUser> = {}): ApiUser {
  return {
    id: nextId('user'),
    name: '李测试',
    email: 'li@skillhub.corp',
    employeeId: '7462201',
    loginName: null,
    authProvider: 'password',
    menuPermissions: [],
    role: 'user',
    department: '技术研发中心',
    avatar: 'https://api.dicebear.com/10.x/adventurer/svg?seed=7462201',
    points: 10000,
    ...overrides,
  };
}

export function makeUser(overrides: Partial<UserAccount> = {}): UserAccount {
  return {
    id: nextId('user'),
    name: '李测试',
    email: 'li@skillhub.corp',
    role: 'user',
    avatar: 'https://api.dicebear.com/10.x/adventurer/svg?seed=7462201',
    department: '技术研发中心',
    joinedAt: '2026-01-01',
    points: 10000,
    employeeId: '7462201',
    loginName: null,
    authProvider: 'password',
    menuPermissions: [],
    ...overrides,
  };
}

export function makeApiAuditRule(overrides: Partial<ApiAuditRule> = {}): ApiAuditRule {
  return {
    id: 'rule-reg-1',
    name: '私钥泄露',
    type: 'regex',
    severity: 'high',
    category: 'security',
    description: '检测内嵌私钥',
    pattern: 'PRIVATE\\s+KEY',
    isEnabled: true,
    isPreset: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function makeAuditRule(overrides: Partial<AuditRule> = {}): AuditRule {
  return {
    id: 'rule-reg-1',
    name: '私钥泄露',
    type: 'regex',
    severity: 'high',
    category: 'security',
    description: '检测内嵌私钥',
    pattern: 'PRIVATE\\s+KEY',
    isEnabled: true,
    isPreset: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function makeApiDemand(overrides: Partial<ApiSkillDemand> = {}): ApiSkillDemand {
  return {
    id: nextId('demand'),
    title: '做一个 SQL 查询助手',
    description: '需要支持自然语言转 SQL',
    targetDomain: 'data_analyst',
    expectedOutput: '一个可安装的 Claude 技能',
    bountyPoints: 500,
    deadlineText: '2026-03-01',
    authorId: 'user-2',
    authorName: '王测试',
    authorAvatar: 'https://api.dicebear.com/10.x/adventurer/svg?seed=7462202',
    authorDepartment: '数据分析部',
    status: 'approved',
    rejectReason: null,
    candidates: [],
    reviewedBy: 'admin',
    reviewedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function makeDemand(overrides: Partial<SkillDemand> = {}): SkillDemand {
  return {
    id: nextId('demand'),
    title: '做一个 SQL 查询助手',
    description: '需要支持自然语言转 SQL',
    targetDomain: 'data_analyst',
    expectedOutput: '一个可安装的 Claude 技能',
    bountyPoints: 500,
    deadlineText: '2026-03-01',
    author: {
      id: 'user-2',
      name: '王测试',
      avatar: 'https://api.dicebear.com/10.x/adventurer/svg?seed=7462202',
      department: '数据分析部',
    },
    status: 'approved',
    rejectReason: undefined,
    submissionsCount: 0,
    candidates: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    reviewedBy: 'admin',
    reviewedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function makeApiFeedback(overrides: Partial<ApiFeedback> = {}): ApiFeedback {
  return {
    id: nextId('feedback'),
    title: '希望增加暗色主题',
    content: '夜间使用太刺眼',
    category: 'experience',
    rating: 4,
    submitterId: 'user-1',
    submitterName: '李测试',
    submitterEmployeeId: '7462201',
    submitterAvatar: 'https://api.dicebear.com/10.x/adventurer/svg?seed=7462201',
    submitterDepartment: '技术研发中心',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function makeFeedback(overrides: Partial<FeedbackItem> = {}): FeedbackItem {
  return {
    id: nextId('feedback'),
    userName: '李测试',
    userEmail: '7462201@skillhub.corp',
    category: 'experience',
    rating: 4,
    title: '希望增加暗色主题',
    content: '夜间使用太刺眼',
    createdAt: '2026-01-01T00:00:00.000Z',
    status: 'pending',
    submitterEmployeeId: '7462201',
    submitterDepartment: '技术研发中心',
    submitterAvatar: 'https://api.dicebear.com/10.x/adventurer/svg?seed=7462201',
    ...overrides,
  };
}

export function makeLlmVerdict(): {
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
} {
  return {
    score: 90,
    confidence: 0.92,
    status: 'passed',
    summary: '未发现异常倾向',
    reasoning: ['调用结构清晰', '权限符合最小特权'],
    suggestions: ['保持当前安全规范'],
    engine: 'llm',
    model: 'deepseek-v4',
    latencyMs: 1200,
  };
}

export function makeSandboxScanResult(
  overrides: Partial<ApiSandboxScanResult> = {},
): ApiSandboxScanResult {
  return {
    score: 100,
    status: 'passed',
    durationMs: 320,
    regexHits: [],
    llmVerdict: makeLlmVerdict() as ApiSandboxScanResult['llmVerdict'],
    ...overrides,
  };
}
