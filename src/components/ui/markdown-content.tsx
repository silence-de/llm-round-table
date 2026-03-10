'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

// Custom component map — uses rt-* CSS variables so it naturally adapts to the dark theme.
const components: Components = {
  // ── Headings ──────────────────────────────────────────────────────────────
  h1: ({ children }) => (
    <h1 className="mb-3 mt-5 text-xl font-bold leading-tight rt-text-strong first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-2 mt-4 text-base font-bold leading-tight rt-text-strong first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-1.5 mt-3 text-sm font-semibold leading-snug rt-text-strong first:mt-0">
      {children}
    </h3>
  ),

  // ── Paragraph ─────────────────────────────────────────────────────────────
  p: ({ children }) => (
    <p className="mb-2 last:mb-0 leading-7 rt-text-strong">{children}</p>
  ),

  // ── Strong / Em ───────────────────────────────────────────────────────────
  strong: ({ children }) => (
    <strong className="font-semibold rt-text-strong">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic rt-text-muted">{children}</em>
  ),

  // ── Lists ─────────────────────────────────────────────────────────────────
  ul: ({ children }) => (
    <ul className="mb-2 ml-4 list-disc space-y-1 last:mb-0">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-2 ml-4 list-decimal space-y-1 last:mb-0">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="leading-6 rt-text-strong">{children}</li>
  ),

  // ── Inline Code ───────────────────────────────────────────────────────────
  code: ({ inline, children, ...props }: { inline?: boolean; children?: React.ReactNode; className?: string }) =>
    inline ? (
      <code
        className="rounded px-1 py-0.5 font-mono text-[0.82em] bg-[color-mix(in_srgb,var(--rt-live-state)_14%,transparent)] rt-text-strong"
        {...props}
      >
        {children}
      </code>
    ) : (
      <code className="font-mono text-[0.82em] rt-text-strong" {...props}>
        {children}
      </code>
    ),

  // ── Code Block ────────────────────────────────────────────────────────────
  pre: ({ children }) => (
    <pre className="mb-3 overflow-x-auto rounded-lg border rt-border-soft bg-[color-mix(in_srgb,var(--rt-hh6-primary)_10%,transparent)] p-3 font-mono text-xs leading-relaxed rt-text-strong last:mb-0">
      {children}
    </pre>
  ),

  // ── Blockquote ────────────────────────────────────────────────────────────
  blockquote: ({ children }) => (
    <blockquote className="mb-2 border-l-2 border-[color-mix(in_srgb,var(--rt-live-state)_50%,transparent)] pl-3 rt-text-muted last:mb-0">
      {children}
    </blockquote>
  ),

  // ── Table ─────────────────────────────────────────────────────────────────
  table: ({ children }) => (
    <div className="mb-3 w-full overflow-x-auto last:mb-0">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="border-b rt-border-soft bg-[color-mix(in_srgb,var(--rt-live-state)_8%,transparent)]">
      {children}
    </thead>
  ),
  tbody: ({ children }) => <tbody className="divide-y rt-border-soft">{children}</tbody>,
  tr: ({ children }) => <tr className="transition-colors">{children}</tr>,
  th: ({ children }) => (
    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.16em] rt-text-muted">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 text-sm leading-relaxed rt-text-strong">{children}</td>
  ),

  // ── Horizontal Rule ───────────────────────────────────────────────────────
  hr: () => <hr className="my-3 rt-border-soft" />,

  // ── Link ──────────────────────────────────────────────────────────────────
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="underline underline-offset-2 rt-text-strong hover:opacity-80"
    >
      {children}
    </a>
  ),
};

interface MarkdownContentProps {
  content: string;
  /** Show a blinking cursor at the end (for streaming) */
  streaming?: boolean;
  className?: string;
}

export function MarkdownContent({ content, streaming, className }: MarkdownContentProps) {
  // Append block cursor character during streaming so it flows naturally inside
  // the last rendered paragraph rather than needing a separate DOM element.
  const text = streaming ? `${content}▋` : content;

  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
