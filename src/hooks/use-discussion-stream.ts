'use client';

import { useCallback, useRef } from 'react';
import { nanoid } from 'nanoid';
import type { PersonaSelection } from '@/lib/agents/types';
import type {
  ActionItem,
  DecisionBrief,
  DecisionControlType,
  DiscussionAgenda,
} from '@/lib/decision/types';
import type { ResearchConfig, ResearchRunDetail, ResearchSource } from '@/lib/search/types';
import { useDiscussionStore } from '@/stores/discussion-store';
import type { SSEEvent } from '@/lib/sse/types';

export function useDiscussionStream() {
  const store = useDiscussionStore();
  const abortRef = useRef<AbortController | null>(null);
  const watchdogRef = useRef<number | null>(null);

  const startDiscussion = useCallback(
    async (params: {
      topic: string;
      brief?: Partial<DecisionBrief>;
      agenda?: Partial<DiscussionAgenda>;
      researchConfig?: Partial<ResearchConfig>;
      agentIds: string[];
      modelSelections?: Record<string, string>;
      personaSelections?: Record<string, PersonaSelection>;
      personas?: Record<string, string>;
      moderatorAgentId?: string;
      maxDebateRounds?: number;
      parentSessionId?: string | null;
      resumeFromSessionId?: string | null;
      carryForwardMode?: 'all_open' | 'high_priority_only';
    }) => {
      store.reset();
      store.setRunning(true);
      const sessionId = nanoid();
      store.setSessionId(sessionId);

      abortRef.current = new AbortController();

      try {
        let lastEventAt = Date.now();
        watchdogRef.current = window.setInterval(() => {
          const state = useDiscussionStore.getState();
          if (!state.isRunning) return;
          if (Date.now() - lastEventAt > 30_000) {
            state.setError(
              'Connection to the discussion stream looks interrupted. Please refresh and use resume if needed.'
            );
          }
        }, 5_000);

        const response = await fetch(`/api/sessions/${sessionId}/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
          signal: abortRef.current.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(await extractErrorMessage(response));
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
              lastEventAt = Date.now();
              handleEvent(event);
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
        if (watchdogRef.current !== null) {
          window.clearInterval(watchdogRef.current);
          watchdogRef.current = null;
        }
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

  const sendStructuredInterjection = useCallback(
    async (params: { content: string; controlType: DecisionControlType }) => {
      const state = useDiscussionStore.getState();
      if (!state.sessionId || !state.isRunning || !params.content.trim()) return false;

      const response = await fetch(
        `/api/sessions/${state.sessionId}/interjections`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: params.content.trim(),
            controlType: params.controlType,
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

  return { startDiscussion, stopDiscussion, sendInterjection, sendStructuredInterjection };
}

function handleEvent(event: SSEEvent) {
  // Always read the latest store state via getState() to avoid stale closures.
  const s = useDiscussionStore.getState();

  switch (event.type) {
    case 'phase_change':
      if (event.phase) s.setPhase(event.phase);
      if (event.round !== undefined) s.setRound(event.round);
      break;

    case 'agent_start':
      if (event.agentId) {
        s.startAgent(event.agentId, useDiscussionStore.getState().phase);
      }
      break;

    case 'agent_token':
      if (event.agentId && event.content) {
        s.appendAgentToken(event.agentId, event.content);
      }
      break;

    case 'agent_done':
      if (event.agentId) s.finalizeAgent(event.agentId);
      break;

    case 'agent_error':
      if (event.agentId) s.finalizeAgent(event.agentId);
      s.setError(event.content ?? 'Discussion failed.');
      break;

    case 'agent_degraded':
      if (event.agentId) {
        s.addDegradedAgent(event.agentId);
      }
      if (event.content) {
        s.setError(event.content);
      }
      break;

    case 'moderator_start':
      s.startModerator(useDiscussionStore.getState().phase);
      break;

    case 'moderator_token':
      if (event.content) s.appendModeratorToken(event.content);
      break;

    case 'moderator_done':
      s.finalizeModerator();
      break;

    case 'discussion_complete': {
      const completedSessionId = useDiscussionStore.getState().sessionId;
      s.setRunning(false);
      if (completedSessionId) {
        void hydrateSessionArtifactsFromSession(completedSessionId);
      }
      break;
    }

    case 'heartbeat':
      break;

    case 'resume_snapshot':
      if (event.content) {
        try {
          s.setResumeSnapshot(JSON.parse(event.content));
        } catch {
          // ignore malformed snapshot payload
        }
      }
      break;

    case 'user_interjection':
      if (event.content) {
        s.addInterjection({
          content: event.content,
          phase: event.phase,
          round: event.round,
        });
      }
      break;

    case 'research_start':
      s.setResearchStatus('running');
      break;

    case 'research_result':
      if (event.content) {
        try {
          const sources = JSON.parse(event.content) as ResearchSource[];
          s.addResearchSources(sources);
        } catch {
          // ignore malformed research result
        }
      }
      break;

    case 'research_complete':
      if (event.content) {
        const status = event.meta?.status;
        s.setResearchStatus(status === 'partial' ? 'partial' : 'completed');
        s.setResearchBriefText(event.content);
      } else {
        s.setResearchStatus('skipped');
      }
      break;

    case 'research_failed':
      s.setResearchStatus('failed');
      if (event.content) {
        s.setError(event.content);
      }
      break;
  }
}

async function hydrateSessionArtifactsFromSession(sessionId: string) {
  if (!sessionId) return;

  try {
    const response = await fetch(`/api/sessions/${sessionId}`);
    if (!response.ok) return;
    const data = (await response.json()) as {
      session?: {
        usageInputTokens?: number;
        usageOutputTokens?: number;
        retrospectiveNote?: string;
        outcomeSummary?: string;
      };
      decisionSummary?: import('@/lib/decision/types').DecisionSummary | null;
      actionItems?: ActionItem[];
      researchRun?: ResearchRunDetail | null;
    };
    if (useDiscussionStore.getState().sessionId !== sessionId) {
      return;
    }
    useDiscussionStore.getState().setUsage({
      inputTokens: data.session?.usageInputTokens ?? 0,
      outputTokens: data.session?.usageOutputTokens ?? 0,
    });
    useDiscussionStore.getState().setDecisionSummary(data.decisionSummary ?? null);
    useDiscussionStore.getState().setActionItems(data.actionItems ?? []);
    useDiscussionStore.getState().setReview({
      retrospectiveNote: data.session?.retrospectiveNote ?? '',
      outcomeSummary: data.session?.outcomeSummary ?? '',
    });
    useDiscussionStore.getState().setResearchRun(data.researchRun ?? null);
  } catch {
    // ignore post-run usage hydration errors
  }
}

async function extractErrorMessage(response: Response): Promise<string> {
  try {
    const text = await response.text();
    if (!text) {
      return `HTTP ${response.status}: ${response.statusText}`;
    }

    const parsed = JSON.parse(text) as { error?: string };
    if (parsed && typeof parsed === 'object') {
      const code =
        'code' in parsed && typeof parsed.code === 'string'
          ? parsed.code
          : '';
      const error = parsed.error || text;
      return code ? `[${code}] ${error}` : error;
    }
    return text;
  } catch {
    return `HTTP ${response.status}: ${response.statusText}`;
  }
}
