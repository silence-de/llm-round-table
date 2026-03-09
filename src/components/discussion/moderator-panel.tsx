'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { PixelAgentAvatar } from '@/components/discussion/pixel-agent-avatar';

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
    <Card className="border-amber-200/50 bg-[linear-gradient(180deg,rgba(255,246,221,.9),rgba(255,237,193,.65))] dark:bg-amber-950/20">
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <PixelAgentAvatar seed="moderator" color="#f59e0b" size={34} />
          主持人 (Moderator)
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        <ScrollArea className="max-h-[500px]">
          {messages.map((msg, i) => (
            <div key={i}>
              {i > 0 && <Separator className="my-3" />}
              <div className="mb-1">
                <span className="text-xs font-medium text-amber-600">
                  {PHASE_LABELS[msg.phase] ?? msg.phase}
                </span>
              </div>
              <div className="text-sm whitespace-pre-wrap leading-relaxed">
                {msg.content}
                {i === messages.length - 1 &&
                  msg.content.length > 0 &&
                  !msg.content.endsWith('\n') && (
                    <span className="inline-block w-1.5 h-4 bg-foreground/70 animate-pulse ml-0.5" />
                  )}
              </div>
            </div>
          ))}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
