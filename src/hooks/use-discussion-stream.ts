'use client';

import { useCallback, useRef } from 'react';
import { nanoid } from 'nanoid';
import { useDiscussionStore } from '@/stores/discussion-store';
import type { SSEEvent } from '@/lib/sse/types';

export function useDiscussionStream() {
  const store = useDiscussionStore();
  const abortRef = useRef<AbortController | null>(null);

  const startDiscussion = useCallback(
    async (params: {
      topic: string;
      agentIds: string[];
      modelSelections?: Record<string, string>;
      personas?: Record<string, string>;
      moderatorAgentId?: string;
      maxDebateRounds?: number;
    }) => {
      store.reset();
      store.setRunning(true);
      const sessionId = nanoid();
      store.setSessionId(sessionId);

      abortRef.current = new AbortController();

      try {
        const response = await fetch(`/api/sessions/${sessionId}/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
          signal: abortRef.current.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() || '';

          for (const part of parts) {
            if (!part.startsWith('data: ')) continue;
            try {
              const event: SSEEvent = JSON.parse(part.slice(6));
              handleEvent(event, store);
            } catch {
              // Skip malformed events
            }
          }
        }
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          store.setError(
            error instanceof Error ? error.message : String(error)
          );
        }
      } finally {
        store.setRunning(false);
      }
    },
    [store]
  );

  const stopDiscussion = useCallback(() => {
    const { sessionId } = useDiscussionStore.getState();
    if (sessionId) {
      void fetch(`/api/sessions/${sessionId}/stop`, {
        method: 'POST',
        keepalive: true,
      }).catch(() => undefined);
    }
    abortRef.current?.abort();
    store.setRunning(false);
  }, [store]);

  const sendInterjection = useCallback(
    async (content: string) => {
      const state = useDiscussionStore.getState();
      if (!state.sessionId || !state.isRunning || !content.trim()) return false;

      const response = await fetch(
        `/api/sessions/${state.sessionId}/interjections`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: content.trim(),
            phase: state.phase,
            round: state.round,
          }),
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || `HTTP ${response.status}`);
      }

      return true;
    },
    []
  );

  return { startDiscussion, stopDiscussion, sendInterjection };
}

function handleEvent(
  event: SSEEvent,
  store: ReturnType<typeof useDiscussionStore.getState>
) {
  switch (event.type) {
    case 'phase_change':
      if (event.phase) store.setPhase(event.phase);
      if (event.round !== undefined) store.setRound(event.round);
      break;

    case 'agent_start':
      if (event.agentId) {
        const phase = useDiscussionStore.getState().phase;
        store.startAgent(event.agentId, phase);
      }
      break;

    case 'agent_token':
      if (event.agentId && event.content) {
        store.appendAgentToken(event.agentId, event.content);
      }
      break;

    case 'agent_done':
      if (event.agentId) store.finalizeAgent(event.agentId);
      break;

    case 'agent_error':
      if (event.agentId) {
        store.finalizeAgent(event.agentId);
      }
      break;

    case 'moderator_start': {
      const phase = useDiscussionStore.getState().phase;
      store.startModerator(phase);
      break;
    }

    case 'moderator_token':
      if (event.content) store.appendModeratorToken(event.content);
      break;

    case 'moderator_done':
      store.finalizeModerator();
      break;

    case 'discussion_complete':
      store.setRunning(false);
      void hydrateUsageFromSession(store);
      break;

    case 'user_interjection':
      if (event.content) {
        store.addInterjection({
          content: event.content,
          phase: event.phase,
          round: event.round,
        });
      }
      break;
  }
}

async function hydrateUsageFromSession(
  store: ReturnType<typeof useDiscussionStore.getState>
) {
  const sessionId = useDiscussionStore.getState().sessionId;
  if (!sessionId) return;

  try {
    const response = await fetch(`/api/sessions/${sessionId}`);
    if (!response.ok) return;
    const data = (await response.json()) as {
      session?: { usageInputTokens?: number; usageOutputTokens?: number };
    };
    store.setUsage({
      inputTokens: data.session?.usageInputTokens ?? 0,
      outputTokens: data.session?.usageOutputTokens ?? 0,
    });
  } catch {
    // ignore post-run usage hydration errors
  }
}
