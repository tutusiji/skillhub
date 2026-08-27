/**
 * 用户角色三级模型
 * super_admin 超级管理员：唯一可委任管理员的角色，其余权限与 admin 相同
 * admin 管理员：技能审核、风控配置、需求审批
 * user 普通用户：检索、发布需求、揭榜、安装插件
 */
export type UserRole = 'super_admin' | 'admin' | 'user';

/** 账号来源渠道：自助注册 / 内部 IAM 单点登录开号 */
export type AuthProvider = 'password' | 'oss';

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
  department: string;
  joinedAt: string;
  points: number; // 奖励积分，初始 10,000
  title?: string;
  /** 员工工号，普通用户的登录标识；超级管理员为空 */
  employeeId?: string | null;
  /** 专用登录名，仅超级管理员有值 (admin) */
  loginName?: string | null;
  /** 账号来源渠道 */
  authProvider?: AuthProvider;
  /** 菜单级权限清单 ['audit', 'rules']；超管恒拥有全部（判定时兜底） */
  menuPermissions?: string[];
}

/** 可勾选的菜单权限键：'audit' 审核管理 / 'rules' 风控中心 */
export type MenuPermissionKey = 'audit' | 'rules';

/** 技能分类标签（集市 tab 与发布表单下拉的数据源，后端可管理） */
export interface SkillCategoryItem {
  id: string;
  label: string;
  sortOrder: number;
  isEnabled: boolean;
}

export type ExpertDomain = 
  | 'all'
  | 'ui_ux'          // UI/UX 设计师
  | 'pm'             // 产品经理
  | 'fullstack'      // 全栈开发
  | 'algorithm_ai'   // 算法与 AI 工程师
  | 'hardware_iot'   // 硬件工程师 / 物联网
  | 'qa_test'        // 测试与质量工程师
  | 'devops'         // 运维与 DevOps
  | 'data_analyst'   // 数据分析与 BI
  | 'general';       // 通用与协作

export interface ExpertDomainInfo {
  id: ExpertDomain;
  name: string;
  shortLabel: string;
  description: string;
  iconName: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  border?: string;
  bg?: string;
  text?: string;
}

export type SkillCategory = 
  | 'database' 
  | 'devops' 
  | 'mcp' 
  | 'security' 
  | 'coding' 
  | 'productivity' 
  | 'data' 
  | 'agent';

export type ClientPlatform = 'claude' | 'cursor' | 'mcp' | 'open-webui' | 'chatgpt' | 'copilot';

export type AuditStatus = 'passed' | 'warning' | 'failed' | 'scanning' | 'pending';

export type RuleSeverity = 'critical' | 'high' | 'medium' | 'low';

export type RuleType = 'regex' | 'llm';

export interface AuditRule {
  id: string;
  name: string;
  type: RuleType;
  severity: RuleSeverity;
  category: 'security' | 'privacy' | 'compliance' | 'stability' | 'performance';
  description: string;
  pattern?: string; // For Regex rules
  llmPromptTemplate?: string; // For LLM rules
  isEnabled: boolean;
  isPreset: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuditItemDetail {
  detectedSnippet?: string;
  filePath?: string;
  line?: number;
  riskExplanation: string;
  aiReasoning?: string;
  remediationSuggestion: string;
  matchScore?: number;
}

export interface AuditItemResult {
  ruleId: string;
  ruleName: string;
  type: RuleType;
  status: 'pass' | 'warning' | 'fail' | 'scanning';
  severity: RuleSeverity;
  matchedSummary: string;
  details: AuditItemDetail;
}

export interface AuditExecutionSummary {
  overallStatus: AuditStatus;
  score: number; // 0-100
  scannedAt: string;
  regexResults: AuditItemResult[];
  llmResults: AuditItemResult[];
  adminFeedback?: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface FileTreeNode {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number; // bytes
  language?: string;
  content?: string;
  children?: FileTreeNode[];
}

export interface SkillItem {
  id: string;
  slug: string; // e.g. @skillhub/sql-agent
  name: string;
  version: string;
  description: string;
  category: SkillCategory;
  expertDomain?: ExpertDomain; // 适用专家组/岗位（主领域）
  /** 归属的专家组清单（标签概念，可属于多个），由管理员在专家组管理中维护 */
  expertDomains?: string[];
  /** 上传时的原始 ZIP（base64，仅前端提交链路使用，不落前端缓存） */
  zipBufferBase64?: string;
  /** 上传时的原始 ZIP 文件名 */
  zipFileName?: string;
  clients: ClientPlatform[];
  author: {
    name: string;
    avatar: string;
    department: string;
    verified: boolean;
  };
  /**
   * 提交者的用户 ID（由后端从登录会话写入）
   * 判定「我的提交」必须用它：作者姓名可重名、也曾被前端伪造传入
   */
  submitterId?: string;
  tags: string[];
  likes: number;
  stars: number;
  downloads: number;
  isLiked?: boolean;
  isStarred?: boolean;
  createdAt: string;
  updatedAt: string;
  status: 'approved' | 'pending' | 'rejected' | 'scanning' | 'offline';
  permissions: string[];
  readme: string;
  fileTree: FileTreeNode[];
  installCommands: {
    claude: string;
    cursor: string;
    mcp: string;
    cli: string;
    openWebUI?: string;
  };
  auditResults: AuditExecutionSummary;
}

export interface SkillDemandCandidate {
  id: string;
  skillId?: string;
  skillName: string;
  submitterId: string;
  submitterName: string;
  submitterAvatar: string;
  submittedAt: string;
  notes: string;
  status: 'pending' | 'accepted' | 'rejected';
}

export interface SkillDemand {
  id: string;
  title: string;
  description: string;
  targetDomain: ExpertDomain;
  expectedOutput: string;
  bountyPoints: number; // 最低 100 积分
  deadlineText: string; // 默认 '永久有效'
  author: {
    id: string;
    name: string;
    avatar: string;
    department: string;
  };
  status: 'pending' | 'approved' | 'open' | 'rejected' | 'fulfilled' | 'closed';
  rejectReason?: string;
  submissionsCount: number;
  candidates?: SkillDemandCandidate[];
  createdAt: string;
  updatedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface FeedbackItem {
  id: string;
  userName: string;
  userEmail: string;
  category: 'feature' | 'bug' | 'security' | 'experience' | 'other';
  rating: number; // 1-5
  title: string;
  content: string;
  createdAt: string;
  status: 'pending' | 'reviewed' | 'resolved';
  /** 提交者工号（建议管理页展示用） */
  submitterEmployeeId?: string;
  /** 提交者部门 */
  submitterDepartment?: string;
  /** 提交者头像 */
  submitterAvatar?: string;
}

export interface DeepSeekConfig {
  baseUrl: string;
  apiKey: string;
  modelName: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  lastTestedAt?: string;
  testStatus?: 'success' | 'failed' | 'untested';
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
}
