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
