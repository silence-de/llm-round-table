import type { ActionItem, DecisionSummary } from './decision/types';

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

export function buildExecutionChecklistMarkdown(input: {
  topic: string;
  status?: string;
  actionItems: ActionItem[];
}) {
  const sortedItems = [...input.actionItems].sort(compareActionItemsForExport);
  const topic = input.topic.trim() || 'Untitled session';
  const status = input.status?.trim() || 'unknown';
  const lines = [
    '# Round Table Execution Checklist',
    '',
    '## Topic',
    topic,
    '',
    '## Meta',
    `- Status: ${status}`,
    `- Items: ${sortedItems.length}`,
    '',
    '## Checklist',
  ];

  if (sortedItems.length === 0) {
    lines.push('', '_No action items captured._');
    return `${lines.join('\n').trim()}\n`;
  }

  for (const item of sortedItems) {
    const mark =
      item.status === 'verified'
        ? '[x]'
        : item.status === 'discarded'
          ? '[-]'
          : '[ ]';
    const meta = [
      `status=${item.status}`,
      `priority=${item.priority}`,
      item.owner ? `owner=${item.owner}` : '',
      item.dueAt ? `due=${formatTimestamp(item.dueAt)}` : '',
      item.verifiedAt ? `verifiedAt=${formatTimestamp(item.verifiedAt)}` : '',
      `source=${item.source}`,
      item.carriedFromSessionId ? `from=${item.carriedFromSessionId}` : '',
    ]
      .filter(Boolean)
      .join(', ');
    lines.push('', `- ${mark} ${item.content}`);
    lines.push(`  - ${meta}`);
    if (item.note.trim()) {
      lines.push(`  - note: ${item.note.trim()}`);
    }
    if (item.verificationNote.trim()) {
      lines.push(`  - verification: ${item.verificationNote.trim()}`);
    }
  }

  return `${lines.join('\n').trim()}\n`;
}

function compareActionItemsForExport(left: ActionItem, right: ActionItem) {
  const priorityOrder = { high: 0, medium: 1, low: 2 } as const;
  const leftPriority = priorityOrder[left.priority] ?? 1;
  const rightPriority = priorityOrder[right.priority] ?? 1;
  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority;
  }

  const leftDue = toTimestamp(left.dueAt, Number.POSITIVE_INFINITY);
  const rightDue = toTimestamp(right.dueAt, Number.POSITIVE_INFINITY);
  if (leftDue !== rightDue) {
    return leftDue - rightDue;
  }

  const leftCreatedAt = toTimestamp(left.createdAt, Number.POSITIVE_INFINITY);
  const rightCreatedAt = toTimestamp(right.createdAt, Number.POSITIVE_INFINITY);
  return leftCreatedAt - rightCreatedAt;
}

function toTimestamp(
  value: number | string | null | undefined,
  fallback: number
) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.getTime();
}
