import React, { useState } from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Loader2, 
  Terminal, 
  Sparkles, 
  ChevronDown, 
  ChevronUp, 
  ShieldCheck, 
  ShieldAlert, 
  Code, 
  Lightbulb, 
  ExternalLink,
  Bot
} from 'lucide-react';
import { AuditExecutionSummary, AuditItemResult } from '../types';

interface AuditReportInspectorProps {
  summary: AuditExecutionSummary;
  onReScan?: () => void;
  isScanning?: boolean;
  onViewFileInTree?: (filePath: string) => void;
}

export const AuditReportInspector: React.FC<AuditReportInspectorProps> = ({
  summary,
  onReScan,
  isScanning = false,
  onViewFileInTree
}) => {
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [activeEngineTab, setActiveEngineTab] = useState<'all' | 'regex' | 'llm'>('all');

  const toggleExpand = (ruleId: string) => {
    setSelectedRuleId(prev => prev === ruleId ? null : ruleId);
  };

  const getStatusBadge = (status: AuditItemResult['status']) => {
    switch (status) {
      case 'pass':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>核验通过</span>
          </span>
        );
      case 'warning':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>存在告警</span>
          </span>
        );
      case 'fail':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            <span>违规拦截</span>
          </span>
        );
      case 'scanning':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <Loader2 className="w-3.5 h-3.5 text-indigo-600 animate-spin" />
            <span>扫描中</span>
          </span>
        );
    }
  };

  const getSeverityTag = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-200">Critical 致命</span>;
      case 'high':
        return <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-orange-100 text-orange-700 border border-orange-200">High 高危</span>;
      case 'medium':
        return <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">Medium 中等</span>;
      default:
        return <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">Low 提示</span>;
    }
  };

  const regexList = summary.regexResults || [];
  const llmList = summary.llmResults || [];

  const displayList: { item: AuditItemResult; engine: 'regex' | 'llm' }[] = [];
  if (activeEngineTab === 'all' || activeEngineTab === 'regex') {
    regexList.forEach(r => displayList.push({ item: r, engine: 'regex' }));
  }
  if (activeEngineTab === 'all' || activeEngineTab === 'llm') {
    llmList.forEach(r => displayList.push({ item: r, engine: 'llm' }));
  }

  const passedCount = [...regexList, ...llmList].filter(r => r.status === 'pass').length;
  const warnCount = [...regexList, ...llmList].filter(r => r.status === 'warning').length;
  const failCount = [...regexList, ...llmList].filter(r => r.status === 'fail').length;

  return (
    <div className="space-y-6">
      {/* Overview Top Card */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-extrabold text-2xl shadow-2xs ${
              summary.score >= 90 
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                : summary.score >= 60 
                ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                : 'bg-rose-50 text-rose-700 border border-rose-200'
            }`}>
              {summary.score}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-extrabold text-slate-900 tracking-tight">双引擎安全与合规审计报告</h3>
                {summary.overallStatus === 'passed' && (
                  <span className="bg-emerald-50 text-emerald-700 text-xs px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1 font-bold">
                    <ShieldCheck className="w-3.5 h-3.5" /> 准予上线
                  </span>
                )}
                {summary.overallStatus === 'warning' && (
                  <span className="bg-amber-50 text-amber-800 text-xs px-2.5 py-0.5 rounded-full border border-amber-200 flex items-center gap-1 font-bold">
                    <ShieldAlert className="w-3.5 h-3.5" /> 存在告警项
                  </span>
                )}
                {summary.overallStatus === 'failed' && (
                  <span className="bg-rose-50 text-rose-800 text-xs px-2.5 py-0.5 rounded-full border border-rose-200 flex items-center gap-1 font-bold">
                    <ShieldAlert className="w-3.5 h-3.5" /> 严重违规拦截
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                扫描时间: {new Date(summary.scannedAt).toLocaleString('zh-CN')} · 审核人: {summary.reviewedBy || '自动化双引擎系统'}
              </p>
            </div>
          </div>

          {onReScan && (
            <button
              onClick={onReScan}
              disabled={isScanning}
              id="btn-trigger-rescan"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold transition-all shadow-sm disabled:opacity-50"
            >
              {isScanning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>正在深度扫描中...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-indigo-200" />
                  <span>重新执行双引擎体检</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-5 pt-4 border-t border-slate-100 text-xs">
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <span className="text-slate-500 block text-[11px] font-medium">总检测规则</span>
            <span className="text-base font-extrabold text-slate-900 mt-0.5 block">{regexList.length + llmList.length} 项</span>
          </div>
          <div className="bg-emerald-50/80 p-3 rounded-2xl border border-emerald-200">
            <span className="text-emerald-800 block text-[11px] font-medium">通过合格</span>
            <span className="text-base font-extrabold text-emerald-700 mt-0.5 block">{passedCount} 项</span>
          </div>
          <div className="bg-amber-50/80 p-3 rounded-2xl border border-amber-200">
            <span className="text-amber-800 block text-[11px] font-medium">预警建议</span>
            <span className="text-base font-extrabold text-amber-700 mt-0.5 block">{warnCount} 项</span>
          </div>
          <div className="bg-rose-50/80 p-3 rounded-2xl border border-rose-200">
            <span className="text-rose-800 block text-[11px] font-medium">违规拦截</span>
            <span className="text-base font-extrabold text-rose-700 mt-0.5 block">{failCount} 项</span>
          </div>
        </div>

        {summary.adminFeedback && (
          <div className="mt-3.5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-amber-900">管理员终审反馈：</span>
              <span>{summary.adminFeedback}</span>
            </div>
          </div>
        )}
      </div>

      {/* Engine Switcher Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveEngineTab('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
              activeEngineTab === 'all'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            全部规则 ({regexList.length + llmList.length})
          </button>
          <button
            onClick={() => setActiveEngineTab('regex')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
              activeEngineTab === 'regex'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>正则特征引擎 ({regexList.length})</span>
          </button>
          <button
            onClick={() => setActiveEngineTab('llm')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
              activeEngineTab === 'llm'
                ? 'bg-purple-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>LLM 语义安全引擎 ({llmList.length})</span>
          </button>
        </div>

        <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">
          点击任意审核项展开查获细节与源码高亮
        </span>
      </div>

      {/* Rules list */}
      <div className="space-y-3">
        {displayList.map(({ item, engine }) => {
          const isExpanded = selectedRuleId === item.ruleId;
          const isFailedOrWarning = item.status === 'fail' || item.status === 'warning';

          return (
            <div
              key={item.ruleId}
              id={`audit-item-${item.ruleId}`}
              className={`rounded-2xl border transition-all duration-150 overflow-hidden ${
                isExpanded
                  ? 'border-indigo-300 bg-white shadow-md ring-2 ring-indigo-500/20'
                  : isFailedOrWarning
                  ? 'border-amber-200 bg-amber-50/20 hover:border-amber-300'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              {/* Row Bar */}
              <div
                onClick={() => toggleExpand(item.ruleId)}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 select-none"
              >
                <div className="flex items-start sm:items-center gap-3 min-w-0">
                  {getStatusBadge(item.status)}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-900 truncate">
                        {item.ruleName}
                      </span>
                      {getSeverityTag(item.severity)}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        engine === 'regex'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-purple-50 text-purple-700 border border-purple-200'
                      }`}>
                        {engine === 'regex' ? '正则匹配' : '大模型语义'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 mt-1">
                      {item.matchedSummary}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <span className="text-xs text-indigo-600 font-bold">
                    {isExpanded ? '收起详情' : '展开详情'}
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-indigo-600" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  )}
                </div>
              </div>

              {/* Detailed Deep Inspection Drawer */}
              {isExpanded && (
                <div className="p-5 border-t border-slate-100 bg-slate-50 text-xs space-y-3.5">
                  {/* Code snippet location if available */}
                  {item.details.detectedSnippet && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-slate-700 font-bold">
                        <div className="flex items-center gap-1.5">
                          <Code className="w-3.5 h-3.5 text-rose-500" />
                          <span>命中风险代码片段</span>
                          {item.details.filePath && (
                            <span className="font-mono text-slate-800 bg-slate-200 px-2 py-0.5 rounded text-[11px]">
                              {item.details.filePath}{item.details.line ? `:${item.details.line}` : ''}
                            </span>
                          )}
                        </div>
                        {item.details.filePath && onViewFileInTree && (
                          <button
                            onClick={() => onViewFileInTree(item.details.filePath!)}
                            className="text-indigo-600 hover:underline flex items-center gap-1 font-semibold"
                          >
                            在文件树定位 <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <div className="p-3 rounded-xl bg-slate-900 text-rose-300 font-mono text-xs overflow-x-auto border border-rose-900/60 shadow-inner">
                        <code>{item.details.detectedSnippet}</code>
                      </div>
                    </div>
                  )}

                  {/* Risk Explanation */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-slate-900">
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                      <span>风险隐患解析</span>
                    </div>
                    <p className="text-slate-700 leading-relaxed bg-white p-3 rounded-xl border border-slate-200">
                      {item.details.riskExplanation}
                    </p>
                  </div>

                  {/* AI Reasoning (for LLM rules or deep checks) */}
                  {item.details.aiReasoning && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-purple-800">
                        <Bot className="w-3.5 h-3.5 text-purple-600" />
                        <span>大模型深度推导与语义评语 (AI Reasoning)</span>
                      </div>
                      <div className="text-slate-800 leading-relaxed bg-purple-50/70 p-3 rounded-xl border border-purple-200">
                        {item.details.aiReasoning}
                      </div>
                    </div>
                  )}

                  {/* Remediation Suggestion */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                      <Lightbulb className="w-3.5 h-3.5 text-emerald-600" />
                      <span>官方整改与修复建议</span>
                    </div>
                    <p className="text-slate-800 leading-relaxed bg-emerald-50/70 p-3 rounded-xl border border-emerald-200">
                      {item.details.remediationSuggestion}
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
