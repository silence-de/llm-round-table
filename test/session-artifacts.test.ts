import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTranscriptMarkdown } from '@/lib/session-artifacts';

test('buildTranscriptMarkdown renders topic, status, message count, and timeline', () => {
  const markdown = buildTranscriptMarkdown({
    topic: '  产品功能补齐  ',
    status: 'completed',
    messages: [
      {
        role: 'moderator',
        phase: 'summary',
        content: '形成了明确结论。',
        displayName: 'Moderator',
        createdAt: 1_700_000_000_000,
      },
      {
        role: 'user',
        phase: 'analysis',
        content: '请补充风险项。',
        displayName: 'User',
      },
    ],
  });

  assert.match(markdown, /# Round Table Transcript/);
  assert.match(markdown, /## Topic\n产品功能补齐/);
  assert.match(markdown, /- Status: completed/);
  assert.match(markdown, /- Messages: 2/);
  assert.match(markdown, /### \[summary\] Moderator/);
  assert.match(markdown, /### \[analysis\] User/);
  assert.match(markdown, /形成了明确结论。/);
});

test('buildTranscriptMarkdown handles empty transcript state', () => {
  const markdown = buildTranscriptMarkdown({
    topic: '',
    messages: [],
  });

  assert.match(markdown, /Untitled session/);
  assert.match(markdown, /_No messages captured._/);
});
