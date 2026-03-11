import { AGENT_CATALOG, getModelId } from '@/lib/agents/registry';
import { resolvePersonaText } from '@/lib/agents/persona-presets';
import type { PersonaSelection, SessionAgent } from '@/lib/agents/types';
import { apiError } from '@/lib/api/errors';
import type { DecisionBrief, DiscussionAgenda } from '@/lib/decision/types';
import {
  DEFAULT_DECISION_BRIEF,
  DEFAULT_DISCUSSION_AGENDA,
  normalizeDecisionBrief,
  normalizeDiscussionAgenda,
} from '@/lib/decision/utils';
import {
  appendMessage,
  appendSessionEvent,
  createSession,
  drainPendingInterjections,
  getSessionDetail,
  isSessionStopRequested,
  replaceResearchSources,
  requestSessionStop,
  updateSessionUsage,
  updateSessionStatus,
  upsertDecisionSummary,
  upsertMinutes,
  upsertResearchRun,
} from '@/lib/db/repository';
import { DiscussionOrchestrator } from '@/lib/orchestrator/orchestrator';
import { buildResumePlan } from '@/lib/orchestrator/resume';
import type { ResearchConfig } from '@/lib/search/types';
import { normalizeResearchConfig } from '@/lib/search/utils';
import { encodeSSE } from '@/lib/sse/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await req.json()) as {
    topic?: string;
    brief?: Partial<DecisionBrief>;
    agenda?: Partial<DiscussionAgenda>;
    researchConfig?: Partial<ResearchConfig>;
    agentIds?: string[];
    modelSelections?: Record<string, string>;
    personaSelections?: Record<string, PersonaSelection>;
    personas?: Record<string, string>;
    moderatorAgentId?: string;
    maxDebateRounds?: number;
    parentSessionId?: string | null;
    resumeFromSessionId?: string | null;
    carryForwardMode?: 'all_open' | 'high_priority_only';
  };
  const {
    topic: rawTopic,
    brief: rawBrief,
    agenda: rawAgenda,
    researchConfig: rawResearchConfig,
    agentIds: rawAgentIds,
    modelSelections = {},
    personaSelections = {},
    personas = {},
    moderatorAgentId = 'claude',
    maxDebateRounds: rawMaxDebateRounds = 2,
    parentSessionId = null,
    resumeFromSessionId = null,
    carryForwardMode = 'high_priority_only',
  } = body;
  const brief = normalizeDecisionBrief({
    ...DEFAULT_DECISION_BRIEF,
    ...rawBrief,
    topic: rawBrief?.topic ?? rawTopic,
  });
  const agenda = normalizeDiscussionAgenda({
    ...DEFAULT_DISCUSSION_AGENDA,
    ...rawAgenda,
  });
  const researchConfig = normalizeResearchConfig(rawResearchConfig);
  const topic = brief.topic;
  const agentIds = Array.isArray(rawAgentIds) ? rawAgentIds : [];
  const normalizedCarryForwardMode =
    carryForwardMode === 'high_priority_only'
      ? 'high_priority_only'
      : 'all_open';
  const normalizedMaxDebateRounds = Number.isFinite(rawMaxDebateRounds)
    ? Math.max(1, Math.min(5, Math.floor(rawMaxDebateRounds)))
    : 2;

  if (!topic || !agentIds?.length) {
    return apiError(400, 'INVALID_INPUT', 'topic and agentIds required');
  }

  if (!id || id === '_') {
    return apiError(400, 'INVALID_INPUT', 'invalid session id');
  }

  // Build session agents from catalog, skipping those without API keys
  const agents: SessionAgent[] = [];
  const resolvedModelSelections: Record<string, string> = {};
  const resolvedPersonaSelections: Record<string, PersonaSelection> = {};
  const resolvedPersonas: Record<string, string> = {};
  for (const agentId of agentIds) {
    const definition = AGENT_CATALOG.find((a) => a.id === agentId);
    if (!definition) continue;
    // Skip if API key is missing
    if (!process.env[definition.envKeyName]) continue;
    const selectedModelId = modelSelections[agentId];
    const personaSelection = personaSelections[agentId];
    const persona = resolvePersonaText(personaSelection, personas[agentId]);
    agents.push({ definition, selectedModelId, personaSelection, persona });
    // Use getModelId to validate and sanitize any legacy/migrated model IDs before persisting
    resolvedModelSelections[agentId] = getModelId(definition, selectedModelId);
    if (personaSelection?.presetId || personaSelection?.customNote) {
      resolvedPersonaSelections[agentId] = personaSelection;
    }
    if (persona) {
      resolvedPersonas[agentId] = persona;
    }
  }

  // Ensure moderator is included
  if (!agents.find((a) => a.definition.id === moderatorAgentId)) {
    const moderatorDef = AGENT_CATALOG.find((a) => a.id === moderatorAgentId);
    if (moderatorDef && process.env[moderatorDef.envKeyName]) {
      const selectedModelId = modelSelections[moderatorAgentId];
      const personaSelection = personaSelections[moderatorAgentId];
      const persona = resolvePersonaText(
        personaSelection,
        personas[moderatorAgentId]
      );
      agents.unshift({
        definition: moderatorDef,
        selectedModelId,
        personaSelection,
        persona,
      });
      resolvedModelSelections[moderatorAgentId] = getModelId(moderatorDef, selectedModelId);
      if (personaSelection?.presetId || personaSelection?.customNote) {
        resolvedPersonaSelections[moderatorAgentId] = personaSelection;
      }
      if (persona) {
        resolvedPersonas[moderatorAgentId] = persona;
      }
    }
  }

  const participantCount = agents.filter(
    (a) => a.definition.id !== moderatorAgentId
  ).length;
  const hasModerator = agents.some((a) => a.definition.id === moderatorAgentId);
  if (!hasModerator || participantCount === 0) {
    return apiError(
      400,
      'AUTH_MISSING_KEY',
      'No runnable agent set. Ensure moderator and at least one participant have valid API keys.',
      { moderatorAgentId, participantCount }
    );
  }

  const normalizedParentSessionId = parentSessionId ?? resumeFromSessionId ?? null;
  const parentDetail = normalizedParentSessionId
    ? await getSessionDetail(normalizedParentSessionId)
    : null;
  const resumeDetail = resumeFromSessionId
    ? await getSessionDetail(resumeFromSessionId)
    : null;
  if (resumeFromSessionId && !resumeDetail) {
    return apiError(404, 'NOT_FOUND', 'resume source session not found');
  }
  if (
    resumeDetail &&
    !['failed', 'stopped'].includes(resumeDetail.session.status)
  ) {
    return apiError(
      409,
      'CONFLICT',
      'only failed or stopped sessions can be resumed'
    );
  }
  const resumePlan = resumeDetail ? buildResumePlan(resumeDetail) : undefined;
  const resumeState = resumePlan?.state;
  const resumeSnapshot = resumePlan?.snapshot;
  const parentContext = parentDetail
    ? [
        `这是一个 follow-up 讨论，延续自历史会话「${parentDetail.session.topic}」。`,
        parentDetail.decisionSummary?.summary
          ? `上次结论摘要：${parentDetail.decisionSummary.summary}`
          : '',
        parentDetail.decisionSummary?.recommendedOption
          ? `上次推荐方向：${parentDetail.decisionSummary.recommendedOption}`
          : '',
        parentDetail.minutes?.content
          ? `上次纪要要点：${parentDetail.minutes.content.slice(0, 300)}`
          : '',
        resumeState?.parentContextAddendum
          ? `恢复策略：${resumeState.parentContextAddendum}`
          : '',
      ]
        .filter(Boolean)
        .join('\n')
    : undefined;

  const followUpResult = await createSession({
    id,
    brief,
    agenda,
    moderatorAgentId,
    maxDebateRounds: normalizedMaxDebateRounds,
    selectedAgentIds: agents.map((a) => a.definition.id),
    modelSelections: resolvedModelSelections,
    personaSelections: resolvedPersonaSelections,
    personas: resolvedPersonas,
    researchConfig,
    parentSessionId: normalizedParentSessionId,
    resumedFromSessionId: resumeFromSessionId,
    resumeSnapshot: resumeSnapshot ?? null,
    carryForwardMode: normalizedCarryForwardMode,
  });
  if (normalizedParentSessionId) {
    await appendSessionEvent(id, {
      type: 'follow_up_inherited',
      message: `carry-forward mode: ${normalizedCarryForwardMode}`,
      metadata: {
        parentSessionId: normalizedParentSessionId,
        carryForwardMode: normalizedCarryForwardMode,
        inheritedActionCount: followUpResult.inheritedActionCount,
        skippedReason: followUpResult.skippedReason,
      },
    });
  }
  if (resumeSnapshot) {
    await appendSessionEvent(id, {
      type: 'resume_started',
      message: `resumed from ${resumeSnapshot.sourceSessionId}`,
      metadata: resumeSnapshot as unknown as Record<string, unknown>,
    });
  }

  const orchestrator = new DiscussionOrchestrator({
    sessionId: id,
    topic,
    brief,
    agenda,
    researchConfig,
    agents,
    moderatorAgentId,
    maxDebateRounds: normalizedMaxDebateRounds,
    parentContext,
    resumeState,
    drainInterjections: ({ phase, round }) =>
      drainPendingInterjections({ sessionId: id, phase, round }),
    shouldStop: () => isSessionStopRequested(id),
    onMessagePersist: (message) =>
      appendMessage({
        sessionId: id,
        role: message.role,
        agentId: message.agentId,
        displayName: message.displayName,
        phase: message.phase,
        round: message.round,
        content: message.content,
      }),
    onSummaryPersist: (summary) => upsertMinutes(id, summary),
    onDecisionSummaryPersist: (summary) => upsertDecisionSummary(id, summary),
    onResearchRunPersist: async (run) => {
      await upsertResearchRun(id, run);
    },
    onResearchSourcesPersist: (researchRunId, sources) =>
      replaceResearchSources(researchRunId, sources),
    onUsagePersist: (usage) =>
      updateSessionUsage(id, {
        inputDelta: usage.inputTokens ?? 0,
        outputDelta: usage.outputTokens ?? 0,
      }),
    onSessionEventPersist: (event) => appendSessionEvent(id, event),
  });

  const encoder = new TextEncoder();
  const onAbort = () => {
    void requestSessionStop(id);
  };
  req.signal.addEventListener('abort', onAbort);

  const stream = new ReadableStream({
    async start(controller) {
      try {
        if (resumeSnapshot) {
          controller.enqueue(
            encoder.encode(
              encodeSSE({
                type: 'resume_snapshot',
                content: JSON.stringify(resumeSnapshot),
                timestamp: Date.now(),
              })
            )
          );
        }
        for await (const event of orchestrator.run()) {
          controller.enqueue(encoder.encode(encodeSSE(event)));
        }
        const stopped = await isSessionStopRequested(id);
        await updateSessionStatus(id, stopped ? 'stopped' : 'completed');
      } catch (error) {
        const stopped = await isSessionStopRequested(id);
        await updateSessionStatus(id, stopped ? 'stopped' : 'failed');
        await appendSessionEvent(id, {
          type: 'provider_error',
          message: error instanceof Error ? error.message : String(error),
        });
        const errorEvent = encodeSSE({
          type: 'agent_error',
          content: error instanceof Error ? error.message : String(error),
          timestamp: Date.now(),
        });
        controller.enqueue(encoder.encode(errorEvent));
      } finally {
        req.signal.removeEventListener('abort', onAbort);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
