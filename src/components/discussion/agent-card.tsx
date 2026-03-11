'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AgentMessage } from '@/stores/discussion-store';
import { PixelAgentAvatar } from '@/components/discussion/pixel-agent-avatar';
import { MarkdownContent } from '@/components/ui/markdown-content';

interface AgentCardProps {
  agentId: string;
  displayName: string;
  color: string;
  sprite?: string;
  accentGlow?: string;
  message?: AgentMessage;
}

export function AgentCard({
  displayName,
  color,
  sprite,
  accentGlow,
  message,
}: AgentCardProps) {
  const isSpeaking = Boolean(message?.isStreaming);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!message?.isStreaming) return;
    const el = viewportRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    });
  }, [message?.content, message?.isStreaming]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      className="h-full"
    >
      <Card
        className={`flex h-full min-h-[268px] flex-col transition-all duration-300 ${
          isSpeaking
            ? 'rt-border-strong bg-[color-mix(in_srgb,var(--rt-live-state)_12%,transparent)]'
            : 'rt-border-soft bg-[color-mix(in_srgb,var(--rt-live-state)_6%,transparent)]'
        }`}
        style={
          isSpeaking
            ? {
                boxShadow: `0 0 0 1px ${accentGlow ?? color}, 0 0 30px ${(accentGlow ?? color)}55`,
              }
            : undefined
        }
      >
        <CardHeader className="px-4 pb-2 pt-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <PixelAgentAvatar
              seed={displayName}
              color={color}
              sprite={sprite}
              size={34}
            />
            <div className="min-w-0">
              <div className="truncate text-base font-semibold rt-text-strong">
                {displayName}
              </div>
              <div className="text-[10px] uppercase tracking-[0.2em] rt-text-muted">
                {message?.phase ?? 'awaiting turn'}
              </div>
            </div>
            {message?.isStreaming && (
              <span className="ml-auto flex items-center gap-[3px]">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="inline-block h-1 w-1 rounded-full bg-current rt-text-muted"
                    animate={{ opacity: [0.25, 1, 0.25] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.18, ease: 'easeInOut' }}
                  />
                ))}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 px-4 pb-3">
          <div ref={viewportRef} className="h-full max-h-[320px] overflow-auto pr-1">
            {message ? (
              <MarkdownContent
                content={message.content}
                streaming={message.isStreaming}
                className="text-sm"
              />
            ) : (
              <div className="text-sm italic rt-text-dim">等待发言...</div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
