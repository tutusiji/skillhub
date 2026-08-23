import { ExpertDomain, ExpertDomainInfo } from '../types';

export const EXPERT_DOMAINS: ExpertDomainInfo[] = [
  {
    id: 'all',
    name: '全部专家组',
    shortLabel: '全部岗位',
    description: '查看全领域技能、插件扩展与征集需求',
    iconName: 'LayoutGrid',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-700',
    badgeBorder: 'border-slate-200'
  },
  {
    id: 'fullstack',
    name: '全栈与后端开发',
    shortLabel: '全栈开发',
    description: 'API 编排、微服务治理、框架脚手架、数据库诊断与重构',
    iconName: 'Code2',
    badgeBg: 'bg-blue-50',
    badgeText: 'text-blue-700',
    badgeBorder: 'border-blue-200'
  },
  {
    id: 'ui_ux',
    name: 'UI/UX 体验设计',
    shortLabel: 'UI 设计师',
    description: 'Figma 插件、Design Tokens、Tailwind 样式转化、色彩与可访问性审查',
    iconName: 'Palette',
    badgeBg: 'bg-fuchsia-50',
    badgeText: 'text-fuchsia-700',
    badgeBorder: 'border-fuchsia-200'
  },
  {
    id: 'pm',
    name: '产品经理与规划',
    shortLabel: '产品经理',
    description: 'PRD 智能拆解、用户故事整理、流程图 Mermaid 生成、竞品知识萃取',
    iconName: 'KanbanSquare',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-800',
    badgeBorder: 'border-amber-200'
  },
  {
    id: 'algorithm_ai',
    name: '算法与 AI 工程师',
    shortLabel: '算法工程师',
    description: 'Prompt 评估、RAG 向量微调、模型量化测评、深度推理链调优',
    iconName: 'Cpu',
    badgeBg: 'bg-purple-50',
    badgeText: 'text-purple-700',
    badgeBorder: 'border-purple-200'
  },
  {
    id: 'hardware_iot',
    name: '硬件与嵌入式 IoT',
    shortLabel: '硬件工程师',
    description: '串口 Hex 协议抓包、固件日志解析、MCU 寄存器配置、硬件驱动调试',
    iconName: 'HardDrive',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-700',
    badgeBorder: 'border-emerald-200'
  },
  {
    id: 'qa_test',
    name: '测试与质量保障',
    shortLabel: '测试工程师',
    description: '边界值自动化用例生成、Playwright/Cypress 脚本生成、压力测试调优',
    iconName: 'CheckCheck',
    badgeBg: 'bg-cyan-50',
    badgeText: 'text-cyan-700',
    badgeBorder: 'border-cyan-200'
  },
  {
    id: 'devops',
    name: '运维与 DevOps / SRE',
    shortLabel: '运维开发',
    description: 'K8s 故障排查、CI/CD 流水线构建、Nginx 反代配置、监控告警规则',
    iconName: 'Server',
    badgeBg: 'bg-indigo-50',
    badgeText: 'text-indigo-700',
    badgeBorder: 'border-indigo-200'
  },
  {
    id: 'data_analyst',
    name: '数据分析与 BI',
    shortLabel: '数据分析师',
    description: '复杂 SQL 调优、Pandas 数据清洗、Tableau/Metabase 图表生成',
    iconName: 'BarChart3',
    badgeBg: 'bg-rose-50',
    badgeText: 'text-rose-700',
    badgeBorder: 'border-rose-200'
  },
  {
    id: 'general',
    name: '通用办公与协作',
    shortLabel: '通用协作',
    description: '文档总结、多语言翻译、会议纪要提取、知识库问答',
    iconName: 'Sparkles',
    badgeBg: 'bg-slate-50',
    badgeText: 'text-slate-700',
    badgeBorder: 'border-slate-200'
  }
];

export const getExpertDomainInfo = (id?: ExpertDomain): ExpertDomainInfo => {
  if (!id || id === 'all') return EXPERT_DOMAINS[0];
  const found = EXPERT_DOMAINS.find(d => d.id === id);
  return found || EXPERT_DOMAINS[0];
};

export const getExpertDomainMeta = getExpertDomainInfo;
