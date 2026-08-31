import { describe, expect, it } from 'vitest';
import { mapApiSkill, mapApiUser, mapAuditRule, mapApiFeedback, mapApiDemand } from '../api';
import {
  makeApiSkill,
  makeApiUser,
  makeApiAuditRule,
  makeApiDemand,
  makeApiFeedback,
} from '../../test/factories';

/**
 * 后端实体 → 前端类型映射器单测。
 * 映射器是纯函数，直接测真实实现（不 mock api 模块）。
 * 覆盖默认值兜底、权威字段优先（auditStatus > score）、头像派生、文件树归一化等关键契约。
 */

describe('mapApiSkill', () => {
  it('映射完整技能字段', () => {
    const api = makeApiSkill({
      id: 'skill-1',
      slug: '@skillhub/sql-agent',
      name: 'SQL 助手',
      version: 'v2.1.0',
      category: 'database',
      status: 'approved',
      clients: ['claude', 'cursor'],
      tags: ['sql', 'db'],
      likes: 3,
      stars: 2,
      downloads: 10,
      permissions: ['read', 'write'],
      expertDomain: 'data_analyst',
      expertDomains: ['data_analyst', 'general'],
      auditScore: 92,
      auditStatus: 'warning',
      reviewedBy: 'admin',
      reviewedAt: '2026-02-01T00:00:00.000Z',
      adminFeedback: '请补充测试用例',
      readme: '自定义 readme 正文',
      installCommands: {
        claude: 'claude plugin install @skillhub/sql-agent',
        cursor: 'cursor install sql-agent',
        mcp: 'mcp add sql-agent',
        cli: 'skillhub install sql-agent',
      },
    });
    const mapped = mapApiSkill(api);
    expect(mapped.id).toBe('skill-1');
    expect(mapped.slug).toBe('@skillhub/sql-agent');
    expect(mapped.version).toBe('v2.1.0');
    expect(mapped.author).toMatchObject({ name: '张测试', department: '技术研发中心', verified: false });
    expect(mapped.expertDomain).toBe('data_analyst');
    expect(mapped.expertDomains).toEqual(['data_analyst', 'general']);
    // auditStatus 是权威判定，优先于按分数推断
    expect(mapped.auditResults.overallStatus).toBe('warning');
    expect(mapped.auditResults.score).toBe(92);
    expect(mapped.auditResults.adminFeedback).toBe('请补充测试用例');
    expect(mapped.readme).toBe('自定义 readme 正文');
    expect(mapped.installCommands.claude).toContain('claude plugin install');
    // 原始 ZIP 文件名透传
    expect(mapped.zipFileName).toBeUndefined();
  });

  it('缺失可选字段时应用默认值（版本/clients/未体检）', () => {
    const mapped = mapApiSkill(
      makeApiSkill({
        version: undefined,
        clients: undefined,
        auditScore: undefined,
        auditStatus: undefined,
        submitterId: undefined,
      }),
    );
    expect(mapped.version).toBe('v1.0.0');
    expect(mapped.clients).toEqual(['claude']);
    // 未体检不虚构分数：score 为 null、overallStatus 为 pending
    expect(mapped.auditResults.score).toBeNull();
    expect(mapped.auditResults.overallStatus).toBe('pending');
    expect(mapped.submitterId).toBeUndefined();
    expect(mapped.parentSkillId).toBeNull();
    expect(mapped.archivedAt).toBeNull();
  });

  it('无 auditStatus 时按 auditScore 阈值推断 overallStatus', () => {
    expect(mapApiSkill(makeApiSkill({ auditScore: 95, auditStatus: undefined })).auditResults.overallStatus).toBe('passed');
    expect(mapApiSkill(makeApiSkill({ auditScore: 75, auditStatus: undefined })).auditResults.overallStatus).toBe('warning');
    expect(mapApiSkill(makeApiSkill({ auditScore: 40, auditStatus: undefined })).auditResults.overallStatus).toBe('failed');
  });

  it('头像为空时按作者名派生头像 URL', () => {
    const mapped = mapApiSkill(makeApiSkill({ avatar: '', author: '王测试' }));
    expect(mapped.author.avatar).toBe(
      'https://api.dicebear.com/10.x/adventurer/svg?seed=' + encodeURIComponent('王测试'),
    );
  });

  it('已有头像原样保留', () => {
    const mapped = mapApiSkill(makeApiSkill({ avatar: 'https://cdn.corp.com/uploads/a.png' }));
    expect(mapped.author.avatar).toBe('https://cdn.corp.com/uploads/a.png');
  });

  it('递归归一化文件树：补 id/path、默认 type=file', () => {
    const mapped = mapApiSkill(
      makeApiSkill({
        fileTree: [
          {
            name: 'src',
            type: 'directory',
            children: [
              { name: 'index.ts', type: 'file', content: 'export {}' },
              { name: 'bin', type: 'directory', children: [{ name: 'run.sh', type: 'file' }] },
            ],
          },
          { name: 'SKILL.md', content: '# hi' },
        ],
      }),
    );
    expect(mapped.fileTree).toHaveLength(2);
    const src = mapped.fileTree[0];
    expect(src).toMatchObject({ name: 'src', type: 'directory', path: 'src', id: 'src:0' });
    expect(src.children![0]).toMatchObject({ name: 'index.ts', path: 'src/index.ts', id: 'src/index.ts:0' });
    expect(src.children![1].children![0]).toMatchObject({ name: 'run.sh', path: 'src/bin/run.sh' });
    // 未声明 type 的节点按 file 处理
    expect(mapped.fileTree[1]).toMatchObject({ name: 'SKILL.md', type: 'file', path: 'SKILL.md', id: 'SKILL.md:1' });
  });
});

describe('mapApiUser', () => {
  it('保留工号/角色/积分，归一化 authProvider 为 oss', () => {
    const mapped = mapApiUser(makeApiUser({ authProvider: 'oss', points: 8888, role: 'admin' }));
    expect(mapped.employeeId).toBe('7462201');
    expect(mapped.authProvider).toBe('oss');
    expect(mapped.role).toBe('admin');
    expect(mapped.points).toBe(8888);
    expect(mapped.joinedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(mapped.menuPermissions).toEqual([]);
  });

  it('未知 authProvider 归一化为 password，积分缺省 10000', () => {
    const mapped = mapApiUser(makeApiUser({ authProvider: 'weird', points: undefined }));
    expect(mapped.authProvider).toBe('password');
    expect(mapped.points).toBe(10000);
  });

  it('头像为空时按身份派生（工号优先）', () => {
    const mapped = mapApiUser(makeApiUser({ avatar: '', loginName: 'admin' }));
    expect(mapped.avatar).toBe('https://api.dicebear.com/10.x/adventurer/svg?seed=7462201');
  });
});

describe('mapAuditRule', () => {
  it('保留 pattern/llmPromptTemplate/开关/预设标记', () => {
    const mapped = mapAuditRule(makeApiAuditRule());
    expect(mapped).toMatchObject({
      id: 'rule-reg-1',
      name: '私钥泄露',
      type: 'regex',
      severity: 'high',
      category: 'security',
      pattern: 'PRIVATE\\s+KEY',
      isEnabled: true,
      isPreset: true,
    });
    expect(mapped.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(mapped.updatedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('description 缺省为空字符串', () => {
    expect(mapAuditRule(makeApiAuditRule({ description: undefined })).description).toBe('');
  });
});

describe('mapApiFeedback', () => {
  it('按工号拼企业邮箱，状态恒为 pending', () => {
    const mapped = mapApiFeedback(makeApiFeedback());
    expect(mapped.userEmail).toBe('7462201@skillhub.corp');
    expect(mapped.status).toBe('pending');
    expect(mapped.category).toBe('experience');
    expect(mapped.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(mapped.submitterAvatar).toContain('/svg?seed=');
  });

  it('未知分类回退为 feature，无工号时邮箱为空', () => {
    const mapped = mapApiFeedback(makeApiFeedback({ category: 'nonsense', submitterEmployeeId: null }));
    expect(mapped.category).toBe('feature');
    expect(mapped.userEmail).toBe('');
  });
});

describe('mapApiDemand', () => {
  it('deadline 缺省「永久有效」，无候选时计数为 0', () => {
    const mapped = mapApiDemand(makeApiDemand({ deadlineText: undefined, candidates: undefined }));
    expect(mapped.deadlineText).toBe('永久有效');
    expect(mapped.submissionsCount).toBe(0);
    expect(mapped.candidates).toEqual([]);
    expect(mapped.author).toMatchObject({ name: '王测试', department: '数据分析部' });
    expect(mapped.rejectReason).toBeUndefined();
  });

  it('已验收需求带应征候选透传', () => {
    const candidate = {
      id: 'c1',
      skillId: 'skill-9',
      skillName: 'SQL 助手',
      submitterId: 'u1',
      submitterName: '赵应征',
      submitterAvatar: '',
      submittedAt: '2026-01-02T00:00:00.000Z',
      notes: '完整方案',
      status: 'accepted' as const,
    };
    const mapped = mapApiDemand(makeApiDemand({ status: 'fulfilled', candidates: [candidate] }));
    expect(mapped.status).toBe('fulfilled');
    expect(mapped.submissionsCount).toBe(1);
    expect(mapped.candidates![0]).toMatchObject({ skillName: 'SQL 助手', status: 'accepted' });
  });
});
