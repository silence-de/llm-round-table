'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { AgentMessage } from '@/stores/discussion-store';
import { PixelAgentAvatar } from '@/components/discussion/pixel-agent-avatar';

interface AgentCardProps {
  agentId: string;
  displayName: string;
  color: string;
  message?: AgentMessage;
}

export function AgentCard({ displayName, color, message }: AgentCardProps) {
  return (
    <Card className="flex h-full min-h-[240px] flex-col border-cyan-300/25 bg-cyan-950/5">
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <PixelAgentAvatar seed={displayName} color={color} size={34} />
          {displayName}
          {message?.isStreaming && (
            <span className="ml-auto text-xs text-muted-foreground animate-pulse">
              输出中...
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 px-4 pb-3">
        <ScrollArea className="h-full max-h-[300px]">
          {message ? (
            <div className="text-sm whitespace-pre-wrap leading-relaxed">
              {message.content}
              {message.isStreaming && (
                <span className="inline-block w-1.5 h-4 bg-foreground/70 animate-pulse ml-0.5" />
              )}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground italic">
              等待发言...
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
