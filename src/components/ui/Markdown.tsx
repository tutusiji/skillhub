import { isValidElement } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * 安全的 Markdown 渲染组件（react-markdown + remark-gfm）。
 *
 * 安全契约：内容来自用户上传的技能包 README.md / SKILL.md，属于不可信输入，
 * 因此**不启用 rehype-raw、不使用 dangerouslySetInnerHTML**——react-markdown
 * 默认把 Markdown 里的原始 HTML 当纯文本转义，注入的 <script> 不会成为 DOM
 * 元素、更不会执行。表格 / 任务列表 / 删除线等 GFM 扩展由 remark-gfm 提供。
 *
 * 样式：跟随详情页卡片基调（text-slate-800 正文、font-semibold 标题），代码块
 * 用深色底 + 语言标签 + 横向滚动（避免宽内容把页面撑出横向滚动），表格外包
 * overflow-x-auto 容器。
 */

const COMPONENTS: Components = {
  // 标题：首元素去掉上边距（卡片内第一行不悬空）
  h1: ({ children }) => (
    <h1 className="mt-5 mb-3 text-xl font-semibold leading-snug text-slate-900 first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-6 mb-2 text-lg font-semibold leading-snug text-slate-900 first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-5 mb-2 text-base font-semibold leading-snug text-slate-900 first:mt-0">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="mt-4 mb-1.5 text-sm font-semibold leading-snug text-slate-900 first:mt-0">
      {children}
    </h4>
  ),

  p: ({ children }) => (
    <p className="my-3 text-sm leading-relaxed text-slate-800">{children}</p>
  ),

  strong: ({ children }) => (
    <strong className="font-semibold text-slate-900">{children}</strong>
  ),

  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-blue-600 underline decoration-blue-300 underline-offset-2 hover:text-blue-700"
    >
      {children}
    </a>
  ),

  // 图片：不可信 src，浏览器不会对 img 执行脚本；限宽防溢出
  img: ({ src, alt }) => (
    <img
      src={src}
      alt={alt ?? ''}
      loading="lazy"
      className="my-3 h-auto max-w-full rounded-lg border border-slate-200"
    />
  ),

  ul: ({ children }) => (
    <ul className="my-3 list-disc space-y-1 pl-6 text-slate-800">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-3 list-decimal space-y-1 pl-6 text-slate-800">{children}</ol>
  ),
  // GFM 任务列表的 li 带 task-list-item 类，去掉项目符号（复选框自带的圆点）
  li: ({ className, children }) => (
    <li className={className?.includes('task-list-item') ? 'list-none' : undefined}>
      {children}
    </li>
  ),
  // GFM 任务列表复选框：readOnly 抑制「受控 input 无 onChange」告警
  input: ({ type, checked, disabled }) =>
    type === 'checkbox' ? (
      <input
        type="checkbox"
        checked={!!checked}
        disabled={disabled}
        readOnly
        className="mr-2 h-3.5 w-3.5 rounded accent-blue-600 align-middle"
      />
    ) : null,

  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-4 border-slate-200 pl-4 text-sm italic text-slate-600">
      {children}
    </blockquote>
  ),

  hr: () => <hr className="my-5 border-slate-200" />,

  code: ({ node, className, children }) => {
    // react-markdown v10 不再给 code 传 `inline`，用 node.position 跨行判断块级：
    // 带 language-* 的是围栏块；无语言标注的围栏块（``` 裸块）position 一定跨行，
    // 而行内代码在同一行。行内代码浅灰底 + 小圆角，块级代码只设等宽字色、
    // 深色容器由外层 pre 提供。
    const lang = /language-([\w-]+)/.exec(className ?? '')?.[1];
    const startLine = node?.position?.start?.line;
    const endLine = node?.position?.end?.line;
    const isBlock =
      !!lang ||
      (typeof startLine === 'number' &&
        typeof endLine === 'number' &&
        startLine !== endLine);
    if (isBlock) {
      return (
        <code className="font-mono text-[12.5px] leading-relaxed text-slate-100">
          {children}
        </code>
      );
    }
    return (
      <code className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[12px] text-rose-600">
        {children}
      </code>
    );
  },

  pre: ({ children }) => {
    // pre 的 children 是 code 元素，其 props 保留原始 className（language-xxx），
    // 直接从这里取语言标签，比经 code 渲染器透传更可靠。
    const codeProps = isValidElement(children)
      ? (children.props as { className?: string })
      : undefined;
    const lang = /language-([\w-]+)/.exec(codeProps?.className ?? '')?.[1];
    return (
      <div className="my-3 overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
        {lang && (
          <div className="border-b border-slate-800 bg-slate-800/50 px-3 py-1.5">
            <span className="font-mono text-[11px] tracking-wide text-slate-400">{lang}</span>
          </div>
        )}
        <pre className="overflow-x-auto p-3.5">{children}</pre>
      </div>
    );
  },

  // 表格：外包横向滚动容器，宽表在窄屏下页内滚动而非撑破页面
  table: ({ children }) => (
    <div className="my-3 w-full overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-slate-50">{children}</thead>,
  th: ({ children }) => (
    <th className="whitespace-nowrap border border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-slate-200 px-3 py-1.5 align-top text-slate-800">{children}</td>
  ),
};

interface MarkdownProps {
  /** 待渲染的 Markdown 原文 */
  content: string;
}

/**
 * Markdown 内容渲染入口。
 *
 * @param content Markdown 原文（README.md / SKILL.md 正文或 readme 摘要）
 */
export function Markdown({ content }: MarkdownProps) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
      {content}
    </ReactMarkdown>
  );
}
