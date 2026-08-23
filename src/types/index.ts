export type UserRole = 'super_admin' | 'admin' | 'developer';

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
  expertDomain?: ExpertDomain; // 适用专家组/岗位
  clients: ClientPlatform[];
  author: {
    name: string;
    avatar: string;
    department: string;
    verified: boolean;
  };
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
