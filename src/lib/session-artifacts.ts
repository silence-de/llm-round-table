import type { DecisionSummary } from './decision/types';

export interface TranscriptMessage {
  role: string;
  phase: string;
  content: string;
  displayName?: string | null;
  createdAt?: number | string;
}

export function buildTranscriptMarkdown(input: {
  topic: string;
  status?: string;
  messages: TranscriptMessage[];
}) {
  const topic = input.topic.trim() || 'Untitled session';
  const status = input.status?.trim() || 'unknown';
  const lines = [
    '# Round Table Transcript',
    '',
    `## Topic`,
    topic,
    '',
    '## Meta',
    `- Status: ${status}`,
    `- Messages: ${input.messages.length}`,
    '',
  ];

  if (input.messages.length === 0) {
    lines.push('## Timeline', '', '_No messages captured._');
    return `${lines.join('\n')}\n`;
  }

  lines.push('## Timeline', '');

  for (const message of input.messages) {
    const label = message.displayName?.trim() || message.role;
    lines.push(`### [${message.phase || 'unknown'}] ${label}`);
    if (message.createdAt) {
      lines.push(`- Time: ${formatTimestamp(message.createdAt)}`);
    }
    lines.push('', message.content.trim() || '_Empty_', '');
  }

  return `${lines.join('\n').trim()}\n`;
}

function formatTimestamp(value: number | string) {
  const date = typeof value === 'number' ? new Date(value) : new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

export function buildDecisionSummaryMarkdown(input: {
  topic: string;
  status?: string;
  decisionSummary: DecisionSummary;
}) {
  const topic = input.topic.trim() || 'Untitled session';
  const status = input.status?.trim() || 'unknown';
  const { decisionSummary } = input;
  const lines = [
    '# Round Table Decision Card',
    '',
    '## Topic',
    topic,
    '',
    '## Meta',
    `- Status: ${status}`,
    `- Confidence: ${decisionSummary.confidence}%`,
    '',
    '## Summary',
    decisionSummary.summary || '未生成总结。',
    '',
    '## Recommended Option',
    decisionSummary.recommendedOption || '暂无明确建议',
    '',
    '## Why',
    ...toBulletLines(decisionSummary.why),
    '',
    '## Risks',
    ...toBulletLines(decisionSummary.risks),
    '',
    '## Open Questions',
    ...toBulletLines(decisionSummary.openQuestions),
    '',
    '## Next Actions',
    ...toBulletLines(decisionSummary.nextActions),
  ];

  if (decisionSummary.evidence.length > 0) {
    lines.push('', '## Evidence Links');
    for (const evidence of decisionSummary.evidence) {
      const sources =
        evidence.sourceIds.length > 0
          ? evidence.sourceIds.join(', ')
          : 'no source mapping';
      lines.push(`- ${evidence.claim} (${sources})`);
    }
  }

  return `${lines.join('\n').trim()}\n`;
}

function toBulletLines(items: string[]) {
  return items.length > 0 ? items.map((item) => `- ${item}`) : ['- None'];
}
