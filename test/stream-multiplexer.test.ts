import test from 'node:test';
import assert from 'node:assert/strict';
import { multiplexStreams } from '@/lib/orchestrator/stream-multiplexer';

test('multiplexer uses startup timeout for first token and idle timeout afterwards', async () => {
  async function* delayedAgent() {
    await sleep(25);
    yield { type: 'text_delta' as const, content: 'hello' };
    await sleep(90);
    yield { type: 'text_delta' as const, content: 'late' };
    yield { type: 'done' as const, content: '' };
  }

  const events = [];
  for await (const event of multiplexStreams([
    {
      agentId: 'agent-a',
      stream: delayedAgent(),
      startupTimeoutMs: 80,
      idleTimeoutMs: 40,
    },
  ])) {
    events.push(event);
  }

  assert.equal(events[0]?.type, 'agent_start');
  assert.equal(events[1]?.type, 'agent_token');
  assert.match(events[2]?.content ?? '', /timed out/i);
});

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
