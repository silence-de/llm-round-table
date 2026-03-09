import type { StreamChunk } from '../llm/types';
import type { SSEEvent } from '../sse/types';

interface AgentStream {
  agentId: string;
  stream: AsyncIterable<StreamChunk>;
  timeoutMs?: number;
}

export async function* multiplexStreams(
  agentStreams: AgentStream[]
): AsyncIterable<SSEEvent> {
  type PendingResult = {
    agentId: string;
    result: IteratorResult<StreamChunk>;
  };

  const iterators = new Map<string, AsyncIterator<StreamChunk>>();
  const timeouts = new Map<string, number | undefined>();
  const pending = new Map<string, Promise<PendingResult>>();

  // Initialize all iterators
  for (const { agentId, stream, timeoutMs } of agentStreams) {
    const iterator = stream[Symbol.asyncIterator]();
    iterators.set(agentId, iterator);
    timeouts.set(agentId, timeoutMs);

    yield { type: 'agent_start', agentId, timestamp: Date.now() };

    pending.set(
      agentId,
      nextWithTimeout(agentId, iterator, timeouts.get(agentId))
    );
  }

  // Race all streams and yield events as they arrive
  while (pending.size > 0) {
    const { agentId, result } = await Promise.race(pending.values());

    if (result.done) {
      pending.delete(agentId);
      yield { type: 'agent_done', agentId, timestamp: Date.now() };
      continue;
    }

    const chunk = result.value;

    if (chunk.type === 'text_delta') {
      yield {
        type: 'agent_token',
        agentId,
        content: chunk.content,
        timestamp: Date.now(),
      };
    } else if (chunk.type === 'error') {
      yield {
        type: 'agent_error',
        agentId,
        content: chunk.content,
        timestamp: Date.now(),
      };
      pending.delete(agentId);
      continue;
    } else if (chunk.type === 'done') {
      pending.delete(agentId);
      yield { type: 'agent_done', agentId, timestamp: Date.now() };
      continue;
    }

    // Queue the next read
    const iterator = iterators.get(agentId)!;
    pending.set(
      agentId,
      nextWithTimeout(agentId, iterator, timeouts.get(agentId))
    );
  }
}

async function nextWithTimeout(
  agentId: string,
  iterator: AsyncIterator<StreamChunk>,
  timeoutMs?: number
): Promise<{ agentId: string; result: IteratorResult<StreamChunk> }> {
  if (!timeoutMs || timeoutMs <= 0) {
    const result = await iterator.next();
    return { agentId, result };
  }

  const timeoutResult = new Promise<{ agentId: string; result: IteratorResult<StreamChunk> }>(
    (resolve) => {
      const timer = setTimeout(() => {
        resolve({
          agentId,
          result: {
            done: false,
            value: {
              type: 'error',
              content: `Agent timed out after ${Math.round(timeoutMs / 1000)}s`,
            },
          },
        });
      }, timeoutMs);

      iterator
        .next()
        .then((result) => {
          clearTimeout(timer);
          resolve({ agentId, result });
        })
        .catch((error) => {
          clearTimeout(timer);
          resolve({
            agentId,
            result: {
              done: false,
              value: {
                type: 'error',
                content: error instanceof Error ? error.message : String(error),
              },
            },
          });
        });
    }
  );

  return timeoutResult;
}
