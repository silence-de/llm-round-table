'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { PixelAgentAvatar } from '@/components/discussion/pixel-agent-avatar';
import { MarkdownContent } from '@/components/ui/markdown-content';

interface ModeratorMessage {
  content: string;
  phase: string;
}

const PHASE_LABELS: Record<string, string> = {
  opening: '开场',
  analysis: '分析',
  summary: '会议纪要',
};

export function ModeratorPanel({
  messages,
}: {
  messages: ModeratorMessage[];
}) {
  if (messages.length === 0) return null;

  return (
    <Card className="rt-panel-strong">
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <PixelAgentAvatar
            seed="moderator"
            color="var(--rt-warning-state)"
            size={34}
            sprite="/sprites/fallback.svg"
          />
          主持人 (Moderator)
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        <ScrollArea className="max-h-[500px]">
          {messages.map((msg, i) => (
            <div key={i}>
              {i > 0 && <Separator className="my-3" />}
              <div className="mb-1">
                <span className="text-xs font-medium rt-warning">
                  {PHASE_LABELS[msg.phase] ?? msg.phase}
                </span>
              </div>
              <MarkdownContent
                content={msg.content}
                streaming={
                  i === messages.length - 1 && msg.content.length > 0
                }
                className="text-sm"
              />
            </div>
          ))}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
