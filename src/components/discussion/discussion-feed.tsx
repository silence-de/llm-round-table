'use client';

import { useState, useRef, useEffect, useCallback, type UIEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MessageSquare, Copy, Check } from 'lucide-react';
import { MarkdownContent } from '@/components/ui/markdown-content';
import { PixelAgentAvatar } from '@/components/discussion/pixel-agent-avatar';

export interface FeedMessage {
  id: string;
  role: 'agent' | 'moderator';
  phase: string;
  content: string;
  displayName: string;
  agentId?: string;
  color?: string;
  sprite?: string;
  isStreaming?: boolean;
}

interface DiscussionFeedProps {
  messages: FeedMessage[];
  autoScroll?: boolean;
  onScrolledUp?: () => void;
  onScrolledToBottom?: () => void;
  emptyLabel?: string;
  className?: string;
}

// ─── Phase label helper ────────────────────────────────────────────────────────

function phaseLabel(phase: string): string {
  if (!phase) return '';
  if (phase === 'opening') return 'Opening';
  if (phase === 'closing' || phase === 'summary') return 'Closing Summary';
  if (phase === 'research') return 'Research Phase';
  const roundMatch = phase.match(/(\d+)/);
  if (roundMatch) return `Round ${roundMatch[1]}`;
  return phase.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function phaseOrder(phase: string): number {
  if (phase === 'research') return 0;
  if (phase === 'opening') return 1;
  const m = phase.match(/(\d+)/);
  if (m) return 10 + parseInt(m[1], 10);
  if (phase === 'closing' || phase === 'summary') return 99;
  return 50;
}

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingDots({ color }: { color: string }) {
  return (
    <div className="flex items-center gap-1 py-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: color }}
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.18 }}
        />
      ))}
    </div>
  );
}

// ─── Feed component ────────────────────────────────────────────────────────────

export function DiscussionFeed({
  messages,
  autoScroll = true,
  onScrolledUp,
  onScrolledToBottom,
  emptyLabel = '等待会议开始…',
  className,
}: DiscussionFeedProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!autoScroll) return;
    // Use scrollTop on the container — avoids scrollIntoView bleeding out to parent/body
    const el = containerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, autoScroll]);

  const handleScroll = useCallback(
    (e: UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      const distToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (distToBottom > 64) {
        onScrolledUp?.();
      } else {
        onScrolledToBottom?.();
      }
    },
    [onScrolledUp, onScrolledToBottom]
  );

  return (
    <div ref={containerRef} className={`overflow-y-auto ${className}`} onScroll={handleScroll}>
      {messages.length === 0 ? (
        <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border rt-surface rt-border-soft">
            <MessageSquare className="h-5 w-5 rt-text-dim" />
          </div>
          <p className="text-sm rt-text-dim">{emptyLabel}</p>
        </div>
      ) : (
        <div className="py-2">
          <AnimatePresence initial={false}>
            {messages.map((msg, idx) => {
              const prev = messages[idx - 1];
              const next = messages[idx + 1];

              const phaseChanged = !prev || prev.phase !== msg.phase;
              const showSeparator =
                phaseChanged &&
                idx > 0 &&
                phaseOrder(msg.phase) !== phaseOrder(prev?.phase ?? '');

              const isFirst =
                !prev || prev.displayName !== msg.displayName || prev.role !== msg.role || phaseChanged;
              const isLast =
                !next || next.displayName !== msg.displayName || next.role !== msg.role || next.phase !== msg.phase;

              return (
                <motion.div
                  key={msg.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                >
                  {showSeparator && <PhaseSeparator phase={msg.phase} />}
                  <FeedBubble message={msg} showHeader={isFirst} roundBottom={isLast} />
                </motion.div>
              );
            })}
          </AnimatePresence>
          <div className="h-4" />
        </div>
      )}
    </div>
  );
}

// ─── Phase transition separator ────────────────────────────────────────────────

function PhaseSeparator({ phase }: { phase: string }) {
  const label = phaseLabel(phase);
  const isDebate = /\d/.test(phase);
  const isClosing = phase === 'closing' || phase === 'summary';

  return (
    <div className="relative flex items-center gap-3 px-5 py-3">
      <div className="flex-1 border-t border-dashed rt-border-soft" />
      <span
        className={[
          'shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-medium tracking-wide',
          isDebate
            ? 'border-[color-mix(in_srgb,var(--rt-live-state)_30%,transparent)] bg-[color-mix(in_srgb,var(--rt-live-state)_8%,transparent)] text-[color-mix(in_srgb,var(--rt-live-state)_85%,var(--foreground))]'
            : isClosing
              ? 'border-[color-mix(in_srgb,var(--rt-warning-state)_30%,transparent)] bg-[color-mix(in_srgb,var(--rt-warning-state)_8%,transparent)] text-[color-mix(in_srgb,var(--rt-warning-state)_85%,var(--foreground))]'
              : 'rt-border-soft rt-surface rt-text-dim',
        ].join(' ')}
      >
        {label}
      </span>
      <div className="flex-1 border-t border-dashed rt-border-soft" />
    </div>
  );
}

// ─── Live streaming dot ────────────────────────────────────────────────────────

function LiveDot({ color }: { color: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="relative flex h-1.5 w-1.5">
        <span
          className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
          style={{ backgroundColor: color }}
        />
        <span
          className="relative inline-flex rounded-full h-1.5 w-1.5"
          style={{ backgroundColor: color }}
        />
      </span>
    </span>
  );
}

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyButton({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = () => {
    if (!navigator.clipboard) return;
    void navigator.clipboard.writeText(content).then(() => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setCopied(true);
      timerRef.current = setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <button
      onClick={handleCopy}
      className="absolute -top-1.5 right-2 z-10 flex h-6 w-6 items-center justify-center rounded-md border rt-surface opacity-0 transition-[opacity,transform,box-shadow] duration-150 ease-out group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 hover:scale-[1.03] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--rt-live-state)] [@media(pointer:coarse)]:opacity-100"
      aria-label="Copy message"
      title="Copy message"
    >
      {copied
        ? <Check className="h-3 w-3 text-[var(--rt-live-state)]" />
        : <Copy className="h-3 w-3 rt-text-dim" />}
    </button>
  );
}

// ─── Individual message bubble ────────────────────────────────────────────────

function FeedBubble({
  message,
  showHeader,
  roundBottom,
}: {
  message: FeedMessage;
  showHeader: boolean;
  roundBottom: boolean;
}) {
  const isModerator = message.role === 'moderator';
  const accentColor =
    message.color ?? (isModerator ? 'var(--rt-warning-state)' : 'var(--rt-text-muted)');

  // Moderator: full-width left-border card with subtle purple tint
  if (isModerator) {
    return (
      <div className={`px-4 ${showHeader ? 'pt-3' : 'pt-0.5'}`}>
        {showHeader && (
          <div className="mb-1.5 flex items-center gap-2">
            <span
              className="h-1.5 w-1.5 rounded-full shrink-0"
              style={{ backgroundColor: accentColor }}
            />
            <span
              className="text-xs font-semibold"
              style={{ color: accentColor }}
            >
              {message.displayName}
            </span>
            <span className="text-[10px] rt-text-dim font-medium">Moderator</span>
            {message.isStreaming && <LiveDot color={accentColor} />}
          </div>
        )}
        <div className="relative group">
          <div
            className={[
              'px-4 py-3 text-sm border-l-2',
              'border-l-[color-mix(in_srgb,var(--rt-hh6-primary)_35%,transparent)]',
              'bg-[color-mix(in_srgb,var(--rt-hh6-primary)_5%,transparent)] backdrop-blur-md',
              showHeader ? 'rounded-tr-2xl rounded-br-xl' : 'rounded-r-xl',
              roundBottom ? 'rounded-br-2xl' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {message.isStreaming && message.content.length === 0 ? (
              <TypingDots color="var(--rt-hh6-primary)" />
            ) : (
              <MarkdownContent
                content={message.content}
                streaming={message.isStreaming}
                className="text-sm"
              />
            )}
          </div>
          <CopyButton content={message.content} />
        </div>
      </div>
    );
  }

  // Agent: avatar + chat bubble
  return (
    <div className={`flex gap-3 px-4 ${showHeader ? 'pt-4' : 'pt-0.5'}`}>
      {/* Avatar column — slightly smaller (28px) */}
      <div className="w-7 shrink-0">
        {showHeader &&
          (message.sprite ? (
            <PixelAgentAvatar
              seed={message.displayName}
              color={message.color ?? '#888'}
              sprite={message.sprite}
              size={28}
            />
          ) : (
            <div
              className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white"
              style={{ backgroundColor: accentColor }}
            >
              {message.displayName.slice(0, 2)}
            </div>
          ))}
      </div>

      {/* Message body */}
      <div className="min-w-0 flex-1">
        {showHeader && (
          <div className="mb-1.5 flex items-baseline gap-2">
            <span
              className="text-[13px] font-semibold leading-none"
              style={{ color: accentColor }}
            >
              {message.displayName}
            </span>
            <span className="text-[10px] rt-text-dim">
              {phaseLabel(message.phase)}
            </span>
            {message.isStreaming && <LiveDot color={accentColor} />}
          </div>
        )}

        <div className="relative group">
          <div
            className={[
              'px-4 py-3 text-sm rt-surface border',
              showHeader ? 'rounded-t-2xl' : 'rounded-t-sm',
              roundBottom ? 'rounded-b-2xl' : 'rounded-b-sm',
              message.isStreaming
                ? 'shadow-[0_0_12px_color-mix(in_srgb,var(--rt-live-state)_18%,transparent)]'
                : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {message.isStreaming && message.content.length === 0 ? (
              <TypingDots color={accentColor} />
            ) : (
              <MarkdownContent
                content={message.content}
                streaming={message.isStreaming}
                className="text-sm"
              />
            )}
          </div>
          <CopyButton content={message.content} />
        </div>
      </div>
    </div>
  );
}
