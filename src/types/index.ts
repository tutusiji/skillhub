export type UserRole = 'developer' | 'admin' | 'security_officer';

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
  department: string;
  joinedAt: string;
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
