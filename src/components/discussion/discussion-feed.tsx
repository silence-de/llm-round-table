'use client';

import { useRef, useEffect, useCallback, type UIEvent } from 'react';
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

export function DiscussionFeed({
  messages,
  autoScroll = true,
  onScrolledUp,
  onScrolledToBottom,
  emptyLabel = '等待会议开始…',
  className,
}: DiscussionFeedProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when new messages arrive (if auto-scroll is active).
  useEffect(() => {
    if (!autoScroll) return;
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
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
    <div className={`overflow-y-auto ${className}`} onScroll={handleScroll}>
      {messages.length === 0 ? (
        <div className="flex h-full min-h-[200px] items-center justify-center">
          <p className="text-sm rt-text-dim">{emptyLabel}</p>
        </div>
      ) : (
        <div className="py-2">
          {messages.map((msg, idx) => {
            const prev = messages[idx - 1];
            const next = messages[idx + 1];
            const isFirst =
              !prev || prev.displayName !== msg.displayName || prev.role !== msg.role;
            const isLast =
              !next || next.displayName !== msg.displayName || next.role !== msg.role;
            return (
              <FeedBubble
                key={msg.id}
                message={msg}
                showHeader={isFirst}
                roundBottom={isLast}
              />
            );
          })}
          <div ref={bottomRef} className="h-2" />
        </div>
      )}
    </div>
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

  return (
    <div className={`flex gap-3 px-4 ${showHeader ? 'pt-4' : 'pt-0.5'}`}>
      {/* Avatar column — always reserves 32px, only renders avatar on first bubble */}
      <div className="w-8 shrink-0">
        {showHeader &&
          (message.sprite ? (
            <PixelAgentAvatar
              seed={message.displayName}
              color={message.color ?? '#888'}
              sprite={message.sprite}
              size={32}
            />
          ) : (
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold uppercase text-white"
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
            {isModerator && (
              <span className="text-[10px] uppercase tracking-[0.15em] rt-text-dim">MC</span>
            )}
            <span className="text-[10px] uppercase tracking-[0.12em] rt-text-dim">
              {message.phase}
            </span>
            {message.isStreaming && (
              <span className="animate-pulse text-[10px] rt-text-muted">• 输出中</span>
            )}
          </div>
        )}

        {/* Bubble */}
        <div
          className={[
            'px-3.5 py-2.5 text-sm',
            isModerator
              ? 'border border-[color-mix(in_srgb,var(--rt-warning-state)_28%,transparent)] bg-[color-mix(in_srgb,var(--rt-warning-state)_9%,transparent)]'
              : 'rt-surface border border-[color-mix(in_srgb,var(--rt-live-state)_18%,transparent)]',
            showHeader ? 'rounded-t-2xl' : 'rounded-t-sm',
            roundBottom ? 'rounded-b-2xl' : 'rounded-b-sm',
            message.isStreaming
              ? 'shadow-[0_0_14px_color-mix(in_srgb,var(--rt-live-state)_18%,transparent)]'
              : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <MarkdownContent
            content={message.content}
            streaming={message.isStreaming}
            className="text-sm"
          />
        </div>
      </div>
    </div>
  );
}
