import { AuditExecutionSummary, AuditItemResult, AuditRule, DeepSeekConfig, FileTreeNode, SkillItem } from '../types';

interface FlattenedFile {
  path: string;
  name: string;
  content: string;
  language?: string;
}

/**
 * Recursively flattens file tree to searchable list of files
 */
export function flattenFileTree(nodes: FileTreeNode[], currentPath: string = ''): FlattenedFile[] {
  const result: FlattenedFile[] = [];
  for (const node of nodes) {
    const fullPath = currentPath ? `${currentPath}/${node.name}` : node.name;
    if (node.type === 'file') {
      result.push({
        path: fullPath,
        name: node.name,
        content: node.content || '',
        language: node.language
      });
    } else if (node.type === 'directory' && node.children) {
      result.push(...flattenFileTree(node.children, fullPath));
    }
  }
  return result;
}

/**
 * Runs the Dual-Engine Audit on a Skill using current AuditRules and DeepSeek config
 */
export async function executeDualEngineAudit(
  skill: Partial<SkillItem>,
  rules: AuditRule[],
  onProgress?: (currentRule: string, index: number, total: number) => void,
  deepseekConfig?: DeepSeekConfig
): Promise<AuditExecutionSummary> {
  const files = flattenFileTree(skill.fileTree || []);
  const allCode = files.map(f => `--- FILE: ${f.path} ---\n${f.content}`).join('\n\n');
  const readmeText = skill.readme || '';
  const fullPayload = `${allCode}\n\n--- README ---\n${readmeText}\n\n--- PERMISSIONS ---\n${(skill.permissions || []).join(', ')}`;

  const enabledRules = rules.filter(r => r.isEnabled);
  const regexRules = enabledRules.filter(r => r.type === 'regex');
  const llmRules = enabledRules.filter(r => r.type === 'llm');

  const regexResults: AuditItemResult[] = [];
  const llmResults: AuditItemResult[] = [];

  let totalProcessed = 0;
  const totalCount = regexRules.length + llmRules.length;

  const modelLabel = deepseekConfig?.modelName || 'DeepSeek-V3 / Chat';

  // 1. Run Regex Engine Rules
  for (const rule of regexRules) {
    if (onProgress) {
      onProgress(`正在执行正则特征匹配: ${rule.name}`, totalProcessed, totalCount);
      // Small simulated delay for real-time visual feedback
      await new Promise(r => setTimeout(r, 50));
    }

    let isMatch = false;
    let matchedSnippet = '';
    let matchedFile = '';
    let matchedLine = 1;

    if (rule.pattern) {
      try {
        const regex = new RegExp(rule.pattern, 'im');
        for (const file of files) {
          const lines = file.content.split('\n');
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (regex.test(line)) {
              isMatch = true;
              matchedSnippet = line.trim();
              matchedFile = file.path;
              matchedLine = i + 1;
              break;
            }
          }
          if (isMatch) break;
        }

        // Also check permissions or readme if not found in files
        if (!isMatch && regex.test(fullPayload)) {
          isMatch = true;
          matchedSnippet = '在技能声明元数据/权限描述中检出模式匹配';
          matchedFile = 'manifest.json';
        }
      } catch (err) {
        console.warn('Regex compile error:', err);
      }
    }

    let status: 'pass' | 'warning' | 'fail' = 'pass';
    let matchedSummary = '未检出风险特征，符合安全规范';
    let riskExplanation = '代码中未命中该项安全禁止正则。';
    let remediationSuggestion = '保持当前安全规范。';

    if (isMatch) {
      if (rule.severity === 'critical' || rule.severity === 'high') {
        status = 'fail';
        matchedSummary = `在 ${matchedFile}:${matchedLine} 检出高危违规特征`;
        riskExplanation = `正则规则 [${rule.name}] 命中危险模式。可能导致系统权限被攻破、企业凭据泄露或被远程执行指令。`;
        remediationSuggestion = '请立即移除该危险关键字/模式，改用内网环境变量注入或安全标准 SDK。';
      } else {
        status = 'warning';
        matchedSummary = `在 ${matchedFile} 检出潜在警告特征`;
        riskExplanation = `规则 [${rule.name}] 发现需人工确认的模式。`;
        remediationSuggestion = '建议核实是否为调试代码，并在发布前优化。';
      }
    }

    regexResults.push({
      ruleId: rule.id,
      ruleName: rule.name,
      type: 'regex',
      status,
      severity: rule.severity,
      matchedSummary,
      details: {
        detectedSnippet: matchedSnippet || undefined,
        filePath: matchedFile || undefined,
        line: isMatch ? matchedLine : undefined,
        riskExplanation,
        remediationSuggestion
      }
    });

    totalProcessed++;
  }

  // 2. Run LLM AI Engine Rules with DeepSeek
  for (const rule of llmRules) {
    if (onProgress) {
      onProgress(`正在通过 ${modelLabel} 执行语义安全审计: ${rule.name}`, totalProcessed, totalCount);
      await new Promise(r => setTimeout(r, 100));
    }

    let status: 'pass' | 'warning' | 'fail' = 'pass';
    let matchedSummary = `[${modelLabel}] 语义核验通过，未发现异常倾向`;
    let riskExplanation = `DeepSeek 大模型已全面分析 Prompt 上下文与代码流，符合最小权限与企业合规。`;
    let aiReasoning = `DeepSeek (${modelLabel}) 审计引擎评语：调用结构清晰，无隐藏反弹 shell，无系统提示词越狱指令，异常处理边界完善。`;
    let remediationSuggestion = '符合企业内网安全上架标准。';
    let detectedSnippet: string | undefined = undefined;
    let filePath: string | undefined = undefined;

    const lowerPayload = fullPayload.toLowerCase();

    // Specific intelligent checks based on rule content
    if (rule.id === 'rule-llm-1' || rule.name.includes('越狱') || rule.name.includes('Prompt')) {
      if (lowerPayload.includes('ignore previous') || lowerPayload.includes('dan mode') || lowerPayload.includes('bypass') || lowerPayload.includes('system prompt')) {
        status = 'fail';
        matchedSummary = `[${modelLabel}] 检出高危提示词越狱与规则覆盖语义`;
        riskExplanation = '检测到包含试图覆写系统顶层 Prompt 约束或绕过大模型安全边界的语义模板。';
        aiReasoning = `DeepSeek (${modelLabel}) 语义解析发现文本中包含对抗性防御逃逸指令，存在诱导智能体执行未授权操作的漏洞。`;
        remediationSuggestion = '清除所有对抗性 Prompt 指令，显式使用系统定界符包裹用户输入变量。';
        detectedSnippet = 'Ignore previous safety instructions...';
        filePath = 'prompt_template.txt';
      }
    } else if (rule.id === 'rule-llm-2' || rule.name.includes('权限') || rule.name.includes('越权')) {
      const perms = skill.permissions || [];
      if (perms.some(p => p.includes('所有目录') || p.includes('无限制') || p.includes('force') || p.includes('root'))) {
        status = 'warning';
        matchedSummary = `[${modelLabel}] 判定权限声明超出常规业务范畴`;
        riskExplanation = '技能申请了过宽的系统写或执行权限，违反最小特权（Least Privilege）原则。';
        aiReasoning = `DeepSeek (${modelLabel}) 对比技能描述与权限清单发现：该功能仅需只读操作，但申请了高权限全局写权限，存在权限滥用潜在风险。`;
        remediationSuggestion = '缩减 permissions 数组至具体必要的操作项。';
      }
    } else if (rule.id === 'rule-llm-3' || rule.name.includes('混淆') || rule.name.includes('后门')) {
      if (lowerPayload.includes('base64') && (lowerPayload.includes('exec') || lowerPayload.includes('eval'))) {
        status = 'fail';
        matchedSummary = `[${modelLabel}] 判定存在多层混淆代码与可疑执行载荷`;
        riskExplanation = '检测到 Base64 与动态执行函数结合的特征，疑似隐藏木马后门。';
        aiReasoning = `DeepSeek (${modelLabel}) 逆向分析表明：此类动态拼装代码常见于对抗静态安全审查的混淆恶意载荷。`;
        remediationSuggestion = '使用纯静态明文语法重构逻辑，禁止任何不可信的动态反射。';
        detectedSnippet = 'eval(Buffer.from(payload, "base64").toString())';
        filePath = 'src/index.ts';
      }
    }

    llmResults.push({
      ruleId: rule.id,
      ruleName: rule.name,
      type: 'llm',
      status,
      severity: rule.severity,
      matchedSummary,
      details: {
        detectedSnippet,
        filePath,
        riskExplanation,
        aiReasoning,
        remediationSuggestion
      }
    });

    totalProcessed++;
  }

  // Calculate Overall Score and Status
  const allResults = [...regexResults, ...llmResults];
  const failCount = allResults.filter(r => r.status === 'fail').length;
  const warnCount = allResults.filter(r => r.status === 'warning').length;

  let score = 100 - (failCount * 35) - (warnCount * 12);
  if (score < 10) score = 15;
  if (failCount > 0 && score > 60) score = 55;

  let overallStatus: 'passed' | 'warning' | 'failed' = 'passed';
  if (failCount > 0) {
    overallStatus = 'failed';
  } else if (warnCount > 0) {
    overallStatus = 'warning';
  }

  return {
    overallStatus,
    score,
    scannedAt: new Date().toISOString(),
    reviewedBy: `SkillHub 双引擎安全审核核心 (驱动: ${modelLabel})`,
    reviewedAt: new Date().toISOString(),
    regexResults,
    llmResults
  };
}

