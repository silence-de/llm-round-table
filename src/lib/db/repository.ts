import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { PersonaSelection } from '../agents/types';
import type {
  ActionItem,
  ActionItemStatus,
  ActionStats,
  DecisionClaim,
  DecisionBrief,
  DecisionControlType,
  DecisionStatus,
  DecisionSummary,
  DiscussionAgenda,
} from '../decision/types';
import {
  normalizeActionItemStatus,
  normalizeDecisionStatus,
  normalizePersistedDecisionSummary,
} from '../decision/utils';
import type {
  ResearchConfig,
  ResearchEvaluation,
  ResearchRunDetail,
  ResearchRunStatus,
  ResearchSource,
} from '../search/types';
import { normalizeResearchConfig } from '../search/utils';
import type {
  DiscussionResumeSnapshot,
  DiscussionSessionEvent,
} from '../orchestrator/types';
import { DiscussionPhase } from '../orchestrator/types';
import { db, sqliteDb } from './client';
import {
  actionItems,
  claimSourceLinks,
  decisionClaims,
  decisionSummaries,
  interjections,
  messages,
  minutes,
  researchRuns,
  researchSources,
  sessionEvents,
  sessions,
} from './schema';

export async function createSession(input: {
  id: string;
  brief?: DecisionBrief;
  agenda?: DiscussionAgenda;
  topic?: string;
  moderatorAgentId: string;
  maxDebateRounds: number;
  selectedAgentIds: string[];
  modelSelections: Record<string, string>;
  personaSelections: Record<string, PersonaSelection>;
  personas: Record<string, string>;
  researchConfig?: ResearchConfig;
  parentSessionId?: string | null;
  resumedFromSessionId?: string | null;
  resumeSnapshot?: DiscussionResumeSnapshot | null;
  carryForwardMode?: 'all_open' | 'high_priority_only';
  decisionStatus?: DecisionStatus;
}): Promise<{
  inheritedActionCount: number;
  skippedReason: string[];
}> {
  const now = new Date();
  const brief = input.brief ?? {
    topic: input.topic ?? '',
    goal: '',
    background: '',
    constraints: '',
    decisionType: 'general',
    desiredOutput: 'recommendation',
    templateId: null,
  };
  const agenda = input.agenda ?? {
    focalQuestions: '',
    requiredDimensions: '',
    requireResearch: true,
    requestRecommendation: true,
  };
  const researchConfig = normalizeResearchConfig(input.researchConfig);
  await db.insert(sessions).values({
    id: input.id,
    topic: brief.topic,
    goal: brief.goal,
    background: brief.background,
    constraints: brief.constraints,
    decisionType: brief.decisionType,
    desiredOutput: brief.desiredOutput,
    templateId: brief.templateId ?? null,
    agendaConfig: JSON.stringify(agenda),
    researchConfig: JSON.stringify(researchConfig),
    parentSessionId: input.parentSessionId ?? null,
    resumedFromSessionId: input.resumedFromSessionId ?? null,
    resumeSnapshot: input.resumeSnapshot
      ? JSON.stringify(input.resumeSnapshot)
      : null,
    decisionStatus: normalizeDecisionStatus(input.decisionStatus),
    moderatorAgentId: input.moderatorAgentId,
    maxDebateRounds: input.maxDebateRounds,
    selectedAgentIds: JSON.stringify(input.selectedAgentIds),
    modelSelections: JSON.stringify(input.modelSelections),
    personaSelections: JSON.stringify(input.personaSelections),
    personas: JSON.stringify(input.personas),
    stopRequested: 0,
    status: 'running',
    createdAt: now,
    updatedAt: now,
  });

  if (input.parentSessionId) {
    return carryForwardOpenActionItems(
      input.parentSessionId,
      input.id,
      input.carryForwardMode ?? 'high_priority_only'
    );
  }

  return {
    inheritedActionCount: 0,
    skippedReason: [],
  };
}

export async function updateSessionStatus(
  sessionId: string,
  status: 'running' | 'completed' | 'failed' | 'stopped'
) {
  await db
    .update(sessions)
    .set({ status, updatedAt: new Date() })
    .where(eq(sessions.id, sessionId));
}

export async function updateSessionDecisionStatus(
  sessionId: string,
  decisionStatus: DecisionStatus
) {
  await db
    .update(sessions)
    .set({
      decisionStatus: normalizeDecisionStatus(decisionStatus),
      updatedAt: new Date(),
    })
    .where(eq(sessions.id, sessionId));
}

export async function updateSessionReview(
  sessionId: string,
  input: {
    decisionStatus?: DecisionStatus;
    retrospectiveNote?: string;
    outcomeSummary?: string;
    actualOutcome?: string;
    outcomeConfidence?: number;
  }
) {
  await db
    .update(sessions)
    .set({
      ...(input.decisionStatus
        ? { decisionStatus: normalizeDecisionStatus(input.decisionStatus) }
        : {}),
      ...(input.retrospectiveNote !== undefined
        ? { retrospectiveNote: input.retrospectiveNote.trim() }
        : {}),
      ...(input.outcomeSummary !== undefined
        ? { outcomeSummary: input.outcomeSummary.trim() }
        : {}),
      ...(input.actualOutcome !== undefined
        ? { actualOutcome: input.actualOutcome.trim() }
        : {}),
      ...(input.outcomeConfidence !== undefined
        ? {
            outcomeConfidence: normalizeOutcomeConfidence(input.outcomeConfidence),
          }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(sessions.id, sessionId));
}

export async function appendMessage(input: {
  sessionId: string;
  role: 'agent' | 'moderator' | 'user' | 'system';
  agentId?: string;
  displayName?: string;
  phase: string;
  round?: number;
  content: string;
}) {
  await db.insert(messages).values({
    id: nanoid(),
    sessionId: input.sessionId,
    role: input.role,
    agentId: input.agentId,
    displayName: input.displayName,
    phase: input.phase,
    round: input.round,
    content: input.content,
    createdAt: new Date(),
  });
}

export async function upsertMinutes(sessionId: string, content: string) {
  const now = new Date();
  const existing = await db
    .select({ sessionId: minutes.sessionId })
    .from(minutes)
    .where(eq(minutes.sessionId, sessionId))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(minutes)
      .set({ content, updatedAt: now })
      .where(eq(minutes.sessionId, sessionId));
    return;
  }

  await db.insert(minutes).values({
    sessionId,
    content,
    createdAt: now,
    updatedAt: now,
  });
}

export async function upsertDecisionSummary(
  sessionId: string,
  summary: DecisionSummary
) {
  const now = new Date();
  const serialized = JSON.stringify(summary);
  const existing = await db
    .select({ sessionId: decisionSummaries.sessionId })
    .from(decisionSummaries)
    .where(eq(decisionSummaries.sessionId, sessionId))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(decisionSummaries)
      .set({ content: serialized, updatedAt: now })
      .where(eq(decisionSummaries.sessionId, sessionId));
    await syncGeneratedActionItems(sessionId, summary.nextActions);
    await replaceDecisionClaims(sessionId, summary.evidence);
    return;
  }

  await db.insert(decisionSummaries).values({
    sessionId,
    content: serialized,
    createdAt: now,
    updatedAt: now,
  });

  await syncGeneratedActionItems(sessionId, summary.nextActions);
  await replaceDecisionClaims(sessionId, summary.evidence);
}

export async function upsertResearchRun(
  sessionId: string,
  run: {
    status: ResearchRunStatus;
    queryPlan: string[];
    searchConfig: ResearchConfig;
    summary: string;
    evaluation: ResearchEvaluation | null;
    incrementRerunCount?: boolean;
  }
) {
  const now = new Date();
  const existing = await db
    .select({ id: researchRuns.id, rerunCount: researchRuns.rerunCount })
    .from(researchRuns)
    .where(eq(researchRuns.sessionId, sessionId))
    .limit(1);

  const payload = {
    sessionId,
    status: run.status,
    queryPlan: JSON.stringify(run.queryPlan),
    searchConfig: JSON.stringify(run.searchConfig),
    summary: run.summary,
    evaluation: run.evaluation ? JSON.stringify(run.evaluation) : null,
    ...(run.incrementRerunCount ? { rerunCount: 1 } : {}),
    updatedAt: now,
  };

  if (existing.length > 0) {
    const updatePayload = run.incrementRerunCount
      ? {
          ...payload,
          rerunCount: (existing[0].rerunCount ?? 0) + 1,
        }
      : payload;
    await db
      .update(researchRuns)
      .set(updatePayload)
      .where(eq(researchRuns.id, existing[0].id));
    return existing[0].id;
  }

  await db.insert(researchRuns).values({
    id: sessionId,
    ...payload,
    rerunCount: run.incrementRerunCount ? 1 : 0,
    createdAt: now,
  });
  return sessionId;
}

export async function replaceResearchSources(
  researchRunId: string,
  sourcesToPersist: ResearchSource[]
) {
  const tx = sqliteDb.transaction(() => {
    sqliteDb
      .prepare('DELETE FROM research_sources WHERE research_run_id = ?')
      .run(researchRunId);

    if (sourcesToPersist.length === 0) {
      return;
    }

    const stmt = sqliteDb.prepare(`
      INSERT INTO research_sources (
        id,
        research_run_id,
        title,
        url,
        domain,
        snippet,
        score,
        selected,
        pinned,
        rank,
        excluded_reason,
        stale,
        quality_flags,
        published_date,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const now = Date.now();

    for (const source of sourcesToPersist) {
      stmt.run(
        source.id,
        researchRunId,
        source.title,
        source.url,
        source.domain,
        source.snippet,
        source.score,
        source.selected ? 1 : 0,
        source.pinned ? 1 : 0,
        source.rank,
        source.excludedReason ?? '',
        source.stale ? 1 : 0,
        JSON.stringify(source.qualityFlags),
        source.publishedDate ?? null,
        now
      );
    }
  });

  tx();
}

export async function getSessionResearch(
  sessionId: string
): Promise<ResearchRunDetail | null> {
  const [run] = await db
    .select()
    .from(researchRuns)
    .where(eq(researchRuns.sessionId, sessionId))
    .limit(1);

  if (!run) return null;

  const rows = await db
    .select()
    .from(researchSources)
    .where(eq(researchSources.researchRunId, run.id))
    .orderBy(asc(researchSources.rank), asc(researchSources.createdAt));

  return {
    id: run.id,
    sessionId: run.sessionId,
    status: run.status as ResearchRunStatus,
    queryPlan: parseJsonArray(run.queryPlan),
    searchConfig: normalizeResearchConfig(parseJsonObject(run.searchConfig)),
    summary: run.summary,
    rerunCount: run.rerunCount ?? 0,
    evaluation: run.evaluation
      ? (parseJsonObject(run.evaluation) as ResearchEvaluation)
      : null,
    sources: rows.map((row) => ({
      id: row.id,
      title: row.title,
      url: row.url,
      domain: row.domain,
      snippet: row.snippet,
      score: Number(row.score ?? 0),
      selected: (row.selected ?? 0) === 1,
      pinned: (row.pinned ?? 0) === 1,
      rank: Number(row.rank ?? 0),
      excludedReason: row.excludedReason ?? '',
      stale: (row.stale ?? 0) === 1,
      qualityFlags: parseJsonArray(row.qualityFlags),
      publishedDate: row.publishedDate ?? undefined,
    })),
    createdAt: normalizeDateLike(run.createdAt),
    updatedAt: normalizeDateLike(run.updatedAt),
  };
}

export async function updateResearchSource(
  sessionId: string,
  sourceId: string,
  patch: {
    selected?: boolean;
    pinned?: boolean;
    excludedReason?: string;
    rank?: number;
  }
) {
  const run = await getSessionResearch(sessionId);
  if (!run) return null;

  const updatePayload: Record<string, unknown> = {};
  if (patch.selected !== undefined) {
    updatePayload.selected = patch.selected ? 1 : 0;
    if (patch.selected) {
      updatePayload.excludedReason = '';
    } else if (patch.excludedReason === undefined) {
      updatePayload.excludedReason = 'manual_exclude';
    }
  }
  if (patch.pinned !== undefined) {
    updatePayload.pinned = patch.pinned ? 1 : 0;
  }
  if (patch.excludedReason !== undefined) {
    const normalizedReason = patch.excludedReason.trim();
    updatePayload.excludedReason = normalizedReason;
    if (normalizedReason) {
      updatePayload.selected = 0;
    }
  }
  if (patch.rank !== undefined) {
    updatePayload.rank = Math.max(1, Math.min(50, Math.round(patch.rank)));
  }
  if (Object.keys(updatePayload).length === 0) {
    return run.sources.find((source) => source.id === sourceId) ?? null;
  }

  await db
    .update(researchSources)
    .set(updatePayload as Partial<typeof researchSources.$inferInsert>)
    .where(
      and(
        eq(researchSources.id, sourceId),
        eq(researchSources.researchRunId, run.id)
      )
    );

  const refreshed = await getSessionResearch(sessionId);
  return refreshed?.sources.find((source) => source.id === sourceId) ?? null;
}

export async function getSessionDetail(sessionId: string) {
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (!session) {
    return null;
  }

  const sessionMessages = await db
    .select()
    .from(messages)
    .where(eq(messages.sessionId, sessionId))
    .orderBy(asc(messages.createdAt));

  const [sessionMinutes] = await db
    .select()
    .from(minutes)
    .where(eq(minutes.sessionId, sessionId))
    .limit(1);

  const [sessionDecisionSummary] = await db
    .select()
    .from(decisionSummaries)
    .where(eq(decisionSummaries.sessionId, sessionId))
    .limit(1);
  const researchRun = await getSessionResearch(sessionId);

  const sessionInterjections = await db
    .select()
    .from(interjections)
    .where(eq(interjections.sessionId, sessionId))
    .orderBy(asc(interjections.createdAt));
  const sessionActionItems = await listActionItems(sessionId);
  const decisionClaims = await listDecisionClaims(sessionId);
  const degradeEvents = await listSessionEvents(sessionId, ['agent_degraded']);
  const resumeEvents = await listSessionEvents(sessionId, [
    'resume_preview',
    'resume_started',
  ]);

  const parentSession = session.parentSessionId
    ? (
        await db
          .select({
            id: sessions.id,
            topic: sessions.topic,
            templateId: sessions.templateId,
            decisionType: sessions.decisionType,
            decisionStatus: sessions.decisionStatus,
            createdAt: sessions.createdAt,
          })
          .from(sessions)
          .where(eq(sessions.id, session.parentSessionId))
          .limit(1)
      )[0] ?? null
    : null;

  const childSessions = await db
    .select({
      id: sessions.id,
      topic: sessions.topic,
      templateId: sessions.templateId,
      decisionType: sessions.decisionType,
      decisionStatus: sessions.decisionStatus,
      createdAt: sessions.createdAt,
    })
    .from(sessions)
    .where(eq(sessions.parentSessionId, sessionId))
    .orderBy(asc(sessions.createdAt));

  const normalizedDecisionSummary = sessionDecisionSummary
    ? normalizePersistedDecisionSummary(
        JSON.parse(sessionDecisionSummary.content) as DecisionSummary,
        researchRun?.sources ?? []
      )
    : null;
  const actionStats = summarizeActionItems(sessionActionItems);
  const unresolvedEvidence =
    normalizedDecisionSummary?.evidence
      .filter(
        (evidence) =>
          evidence.sourceIds.length === 0 ||
          (evidence.unresolvedSourceIndices?.length ?? 0) > 0
      )
      .map((evidence) => ({
        claim: evidence.claim,
        sourceIds: evidence.sourceIds,
        unresolvedSourceIndices: evidence.unresolvedSourceIndices ?? [],
        gapReason: evidence.gapReason ?? '',
      })) ?? [];

  return {
    session,
    messages: sessionMessages,
    minutes: sessionMinutes ?? null,
    decisionSummary: normalizedDecisionSummary,
    researchRun,
    interjections: sessionInterjections,
    actionItems: sessionActionItems,
    actionStats,
    decisionClaims,
    unresolvedEvidence,
    resumeMeta:
      session.resumedFromSessionId || session.resumeSnapshot
        ? {
            resumedFromSessionId: session.resumedFromSessionId ?? null,
            snapshot: session.resumeSnapshot
              ? normalizeResumeSnapshot(parseJsonObject(session.resumeSnapshot))
              : null,
            events: resumeEvents,
          }
        : null,
    degradeEvents,
    parentSession,
    childSessions,
  };
}

export async function listSessions() {
  return db.select().from(sessions).orderBy(asc(sessions.createdAt));
}

export async function getOperationalSummary(limit = 20) {
  const recentSessions = await db
    .select({
      id: sessions.id,
      status: sessions.status,
      createdAt: sessions.createdAt,
      usageInputTokens: sessions.usageInputTokens,
      usageOutputTokens: sessions.usageOutputTokens,
    })
    .from(sessions)
    .orderBy(desc(sessions.createdAt))
    .limit(Math.max(1, Math.min(200, Math.round(limit))));

  if (recentSessions.length === 0) {
    return {
      sessionsAnalyzed: 0,
      metrics: {
        timeoutRate: 0,
        resumeSuccessRate: 0,
        agentDegradedRate: 0,
      },
      providerHotspots: [],
      recentFailures: [],
    };
  }

  const sessionIds = recentSessions.map((session) => session.id);
  const events = await db
    .select()
    .from(sessionEvents)
    .where(inArray(sessionEvents.sessionId, sessionIds));

  const timeoutEvents = events.filter((event) => event.type === 'timeout');
  const degradedEvents = events.filter((event) => event.type === 'agent_degraded');
  const resumeStarted = events.filter((event) => event.type === 'resume_started');
  const resumedSessionIds = new Set(resumeStarted.map((event) => event.sessionId));
  const resumedSuccess = recentSessions.filter(
    (session) => resumedSessionIds.has(session.id) && session.status === 'completed'
  ).length;

  const providerCounts = new Map<string, number>();
  for (const event of events) {
    if (!event.provider) continue;
    providerCounts.set(event.provider, (providerCounts.get(event.provider) ?? 0) + 1);
  }

  return {
    sessionsAnalyzed: recentSessions.length,
    metrics: {
      timeoutRate: toPercent(timeoutEvents.length, recentSessions.length),
      resumeSuccessRate: toPercent(resumedSuccess, Math.max(1, resumedSessionIds.size)),
      agentDegradedRate: toPercent(degradedEvents.length, recentSessions.length),
    },
    providerHotspots: Array.from(providerCounts.entries())
      .map(([provider, count]) => ({ provider, count }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 5),
    recentFailures: recentSessions
      .filter((session) => session.status === 'failed')
      .slice(0, 5)
      .map((session) => ({
        sessionId: session.id,
        status: session.status,
        createdAt: normalizeDateLike(session.createdAt),
      })),
  };
}

export async function getSessionStatus(sessionId: string) {
  const [session] = await db
    .select({ status: sessions.status })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);
  return session?.status;
}

export async function appendSessionEvent(
  sessionId: string,
  event: DiscussionSessionEvent
) {
  await db.insert(sessionEvents).values({
    id: nanoid(),
    sessionId,
    type: event.type,
    provider: event.provider,
    modelId: event.modelId,
    phase: event.phase,
    agentId: event.agentId,
    timeoutType: event.timeoutType,
    message: event.message ?? '',
    metadata: JSON.stringify(event.metadata ?? {}),
    createdAt: new Date(),
  });
}

export async function listSessionEvents(
  sessionId: string,
  types?: DiscussionSessionEvent['type'][]
) {
  const rows =
    types && types.length > 0
      ? await db
          .select()
          .from(sessionEvents)
          .where(
            and(
              eq(sessionEvents.sessionId, sessionId),
              inArray(sessionEvents.type, types)
            )
          )
          .orderBy(asc(sessionEvents.createdAt))
      : await db
          .select()
          .from(sessionEvents)
          .where(eq(sessionEvents.sessionId, sessionId))
          .orderBy(asc(sessionEvents.createdAt));

  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    provider: row.provider ?? undefined,
    modelId: row.modelId ?? undefined,
    phase: row.phase ?? undefined,
    agentId: row.agentId ?? undefined,
    timeoutType: row.timeoutType ?? undefined,
    message: row.message,
    metadata: parseJsonObject(row.metadata),
    createdAt: normalizeDateLike(row.createdAt),
  }));
}

export async function deleteSession(sessionId: string) {
  const claims = await listDecisionClaims(sessionId);
  if (claims.length > 0) {
    await db
      .delete(claimSourceLinks)
      .where(inArray(claimSourceLinks.claimId, claims.map((claim) => claim.id)));
  }
  await db.delete(decisionClaims).where(eq(decisionClaims.sessionId, sessionId));
  await db.delete(sessionEvents).where(eq(sessionEvents.sessionId, sessionId));
  await db.delete(interjections).where(eq(interjections.sessionId, sessionId));
  await db.delete(messages).where(eq(messages.sessionId, sessionId));
  await db.delete(minutes).where(eq(minutes.sessionId, sessionId));
  await db
    .delete(decisionSummaries)
    .where(eq(decisionSummaries.sessionId, sessionId));
  const run = await getSessionResearch(sessionId);
  if (run) {
    await db
      .delete(researchSources)
      .where(eq(researchSources.researchRunId, run.id));
    await db.delete(researchRuns).where(eq(researchRuns.id, run.id));
  }
  await db.delete(actionItems).where(eq(actionItems.sessionId, sessionId));
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

export async function updateSessionUsage(
  sessionId: string,
  usage: { inputDelta?: number; outputDelta?: number }
) {
  const [current] = await db
    .select({
      usageInputTokens: sessions.usageInputTokens,
      usageOutputTokens: sessions.usageOutputTokens,
    })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (!current) return;

  await db
    .update(sessions)
    .set({
      usageInputTokens: Math.max(
        0,
        (current.usageInputTokens ?? 0) + (usage.inputDelta ?? 0)
      ),
      usageOutputTokens: Math.max(
        0,
        (current.usageOutputTokens ?? 0) + (usage.outputDelta ?? 0)
      ),
      updatedAt: new Date(),
    })
    .where(eq(sessions.id, sessionId));
}

export async function listRoundMessages(sessionId: string, phase: string, round: number) {
  return db
    .select()
    .from(messages)
    .where(and(eq(messages.sessionId, sessionId), eq(messages.phase, phase), eq(messages.round, round)));
}

export async function requestSessionStop(sessionId: string) {
  await db
    .update(sessions)
    .set({
      stopRequested: 1,
      status: 'stopped',
      updatedAt: new Date(),
    })
    .where(and(eq(sessions.id, sessionId), eq(sessions.status, 'running')));
}

export async function isSessionStopRequested(sessionId: string): Promise<boolean> {
  const [row] = await db
    .select({ stopRequested: sessions.stopRequested })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  return (row?.stopRequested ?? 0) === 1;
}

export interface InterjectionRecord {
  id: string;
  content: string;
  createdAt: number;
  controlType: DecisionControlType;
  phaseHint?: string;
  roundHint?: number;
}

export async function listActionItems(sessionId: string): Promise<ActionItem[]> {
  const rows = await db
    .select()
    .from(actionItems)
    .where(eq(actionItems.sessionId, sessionId))
    .orderBy(asc(actionItems.sortOrder), asc(actionItems.createdAt));

  return rows.map((row) => ({
    id: row.id,
    sourceActionId: row.sourceActionId ?? null,
    content: row.content,
    status: normalizeActionItemStatus(row.status),
    source:
      row.source === 'carried_forward' ? 'carried_forward' : 'generated',
    carriedFromSessionId: row.carriedFromSessionId ?? null,
    note: row.note ?? '',
    owner: row.owner ?? '',
    dueAt:
      row.dueAt !== null && row.dueAt !== undefined
        ? normalizeDateLike(row.dueAt)
        : null,
    verifiedAt:
      row.verifiedAt !== null && row.verifiedAt !== undefined
        ? normalizeDateLike(row.verifiedAt)
        : null,
    verificationNote: row.verificationNote ?? '',
    priority: normalizeActionPriority(row.priority),
    sortOrder: row.sortOrder ?? 0,
    createdAt: normalizeDateLike(row.createdAt),
    updatedAt: normalizeDateLike(row.updatedAt),
  }));
}

export async function updateActionItem(
  sessionId: string,
  itemId: string,
  input: {
    status?: ActionItemStatus;
    note?: string;
    owner?: string;
    dueAt?: number | string | null;
    verifiedAt?: number | string | null;
    verificationNote?: string;
    priority?: 'low' | 'medium' | 'high';
  }
) {
  const [current] = await db
    .select({ status: actionItems.status })
    .from(actionItems)
    .where(and(eq(actionItems.id, itemId), eq(actionItems.sessionId, sessionId)))
    .limit(1);
  if (!current) {
    return;
  }

  const normalizedStatus = input.status
    ? normalizeActionItemStatus(input.status)
    : undefined;
  const normalizedVerifiedAt =
    input.verifiedAt !== undefined
      ? normalizeOptionalDate(input.verifiedAt)
      : undefined;
  const statusChanged = normalizedStatus
    ? normalizeActionItemStatus(current.status) !== normalizedStatus
    : false;

  await db
    .update(actionItems)
    .set({
      ...(normalizedStatus ? { status: normalizedStatus } : {}),
      ...(input.note !== undefined ? { note: input.note.trim() } : {}),
      ...(input.owner !== undefined ? { owner: input.owner.trim() } : {}),
      ...(input.dueAt !== undefined
        ? { dueAt: normalizeOptionalDate(input.dueAt) }
        : {}),
      ...(input.verificationNote !== undefined
        ? { verificationNote: input.verificationNote.trim() }
        : {}),
      ...(input.priority !== undefined
        ? { priority: normalizeActionPriority(input.priority) }
        : {}),
      ...(normalizedStatus === 'verified'
        ? { verifiedAt: normalizedVerifiedAt ?? new Date() }
        : statusChanged
          ? { verifiedAt: null }
          : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(actionItems.id, itemId), eq(actionItems.sessionId, sessionId)));
}

export async function enqueueInterjection(input: {
  sessionId: string;
  content: string;
  controlType?: DecisionControlType;
  phaseHint?: string;
  roundHint?: number;
}) {
  const id = nanoid();
  await db.insert(interjections).values({
    id,
    sessionId: input.sessionId,
    content: input.content,
    controlType: input.controlType ?? 'general',
    phaseHint: input.phaseHint,
    roundHint: input.roundHint,
    consumed: 0,
    createdAt: new Date(),
  });
  return id;
}

export async function drainPendingInterjections(input: {
  sessionId: string;
  phase: string;
  round?: number;
}): Promise<InterjectionRecord[]> {
  const tx = sqliteDb.transaction(() => {
    const rows = sqliteDb
      .prepare(
        `SELECT id, content, created_at, phase_hint, round_hint
               , control_type
         FROM interjections
         WHERE session_id = ? AND consumed = 0
         ORDER BY created_at ASC`
      )
      .all(input.sessionId) as Array<{
      id: string;
      content: string;
      created_at: number;
      control_type: string;
      phase_hint: string | null;
      round_hint: number | null;
    }>;

    if (rows.length > 0) {
      const stmt = sqliteDb.prepare(
        `UPDATE interjections
         SET consumed = 1,
             consumed_phase = ?,
             consumed_round = ?,
             consumed_at = ?
         WHERE id = ?`
      );
      const now = Date.now();
      for (const row of rows) {
        stmt.run(input.phase, input.round ?? null, now, row.id);
      }
    }

    return rows.map((row) => ({
      id: row.id,
      content: row.content,
      createdAt: row.created_at,
      controlType: (row.control_type ?? 'general') as DecisionControlType,
      phaseHint: row.phase_hint ?? undefined,
      roundHint: row.round_hint ?? undefined,
    }));
  });

  return tx();
}

async function syncGeneratedActionItems(sessionId: string, nextActions: string[]) {
  const normalized = nextActions
    .map((item) => item.trim())
    .filter(Boolean);
  const existing = await listActionItems(sessionId);
  const existingGeneratedByContent = new Map(
    existing
      .filter((item) => item.source === 'generated')
      .map((item) => [item.content, item])
  );
  const now = new Date();

  for (const [index, content] of normalized.entries()) {
    const matched = existingGeneratedByContent.get(content);
    if (matched) {
      await db
        .update(actionItems)
        .set({ sortOrder: index, updatedAt: now })
        .where(eq(actionItems.id, matched.id));
      continue;
    }

    const actionId = nanoid();
    await db.insert(actionItems).values({
      id: actionId,
      sessionId,
      sourceActionId: actionId,
      content,
      status: 'pending',
      source: 'generated',
      carriedFromSessionId: null,
      note: '',
      owner: '',
      dueAt: null,
      verifiedAt: null,
      verificationNote: '',
      priority: 'medium',
      sortOrder: index,
      createdAt: now,
      updatedAt: now,
    });
  }
}

function buildActionFingerprint(item: Pick<ActionItem, 'content' | 'owner' | 'dueAt'>) {
  const normalizedDueAt =
    item.dueAt !== null && item.dueAt !== undefined
      ? normalizeOptionalDate(item.dueAt)?.getTime() ?? 'none'
      : 'none';
  return `${item.content.trim().toLowerCase()}::${item.owner.trim().toLowerCase()}::${normalizedDueAt}`;
}

export async function previewFollowUpCarryForward(
  parentSessionId: string,
  mode: 'all_open' | 'high_priority_only'
) {
  const parentItems = await listActionItems(parentSessionId);
  const openItems = parentItems
    .filter((item) => item.status !== 'verified' && item.status !== 'discarded')
    .filter((item) => (mode === 'high_priority_only' ? item.priority === 'high' : true));

  const deduped = new Map<string, ActionItem>();
  const skippedReason: string[] = [];

  for (const item of openItems) {
    const sourceKey = item.sourceActionId?.trim() || item.id;
    const fingerprint = buildActionFingerprint(item);
    const key = `source:${sourceKey}`;
    if (deduped.has(key)) {
      skippedReason.push(`duplicate sourceActionId: ${sourceKey}`);
      continue;
    }

    const fingerprintKey = `fingerprint:${fingerprint}`;
    if (deduped.has(fingerprintKey)) {
      skippedReason.push(`duplicate fingerprint: ${item.content}`);
      continue;
    }

    deduped.set(key, item);
    deduped.set(fingerprintKey, item);
  }

  const carryItems = Array.from(
    new Map(
      Array.from(deduped.entries())
        .filter(([key]) => key.startsWith('source:'))
        .map((entry) => [entry[1].id, entry[1]])
    ).values()
  );

  return {
    carryItems,
    inheritedActionCount: carryItems.length,
    skippedReason,
  };
}

async function carryForwardOpenActionItems(
  parentSessionId: string,
  sessionId: string,
  mode: 'all_open' | 'high_priority_only'
) {
  const { carryItems, inheritedActionCount, skippedReason } =
    await previewFollowUpCarryForward(parentSessionId, mode);

  if (carryItems.length === 0) {
    return {
      inheritedActionCount: 0,
      skippedReason,
    };
  }

  const now = new Date();
  for (const [index, item] of carryItems.entries()) {
    await db.insert(actionItems).values({
      id: nanoid(),
      sessionId,
      sourceActionId: item.sourceActionId ?? item.id,
      content: item.content,
      status: item.status === 'in_progress' ? 'in_progress' : 'pending',
      source: 'carried_forward',
      carriedFromSessionId: parentSessionId,
      note: item.note,
      owner: item.owner,
      dueAt: normalizeOptionalDate(item.dueAt),
      verifiedAt: null,
      verificationNote: item.verificationNote,
      priority: item.priority,
      sortOrder: index,
      createdAt: now,
      updatedAt: now,
    });
  }

  return {
    inheritedActionCount,
    skippedReason,
  };
}

async function replaceDecisionClaims(
  sessionId: string,
  evidence: DecisionSummary['evidence']
) {
  const tx = sqliteDb.transaction(() => {
    const existingClaims = sqliteDb
      .prepare('SELECT id FROM decision_claims WHERE session_id = ?')
      .all(sessionId) as Array<{ id: string }>;

    if (existingClaims.length > 0) {
      const deleteLinks = sqliteDb.prepare(
        'DELETE FROM claim_source_links WHERE claim_id = ?'
      );
      for (const claim of existingClaims) {
        deleteLinks.run(claim.id);
      }
    }

    sqliteDb
      .prepare('DELETE FROM decision_claims WHERE session_id = ?')
      .run(sessionId);

    if (!Array.isArray(evidence) || evidence.length === 0) return;

    const insertClaim = sqliteDb.prepare(`
      INSERT INTO decision_claims (id, session_id, claim, kind, gap_reason, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const insertLink = sqliteDb.prepare(`
      INSERT INTO claim_source_links (id, claim_id, source_id, created_at)
      VALUES (?, ?, ?, ?)
    `);
    const now = Date.now();

    for (const entry of evidence) {
      const claimId = nanoid();
      insertClaim.run(
        claimId,
        sessionId,
        entry.claim.trim(),
        'evidence',
        entry.gapReason?.trim() ?? '',
        now
      );
      for (const sourceId of entry.sourceIds) {
        insertLink.run(nanoid(), claimId, sourceId, now);
      }
    }
  });

  tx();
}

export async function listDecisionClaims(sessionId: string): Promise<DecisionClaim[]> {
  const claimRows = await db
    .select()
    .from(decisionClaims)
    .where(eq(decisionClaims.sessionId, sessionId))
    .orderBy(asc(decisionClaims.createdAt));

  if (claimRows.length === 0) return [];

  const linkRows = await db
    .select()
    .from(claimSourceLinks)
    .where(
      inArray(
        claimSourceLinks.claimId,
        claimRows.map((claim) => claim.id)
      )
    );

  const sourceMap = new Map<string, string[]>();
  for (const row of linkRows) {
    const existing = sourceMap.get(row.claimId) ?? [];
    existing.push(row.sourceId);
    sourceMap.set(row.claimId, existing);
  }

  return claimRows.map((row) => ({
    id: row.id,
    sessionId: row.sessionId,
    claim: row.claim,
    kind: 'evidence',
    sourceIds: sourceMap.get(row.id) ?? [],
    gapReason: row.gapReason?.trim() ?? '',
    createdAt: normalizeDateLike(row.createdAt),
  }));
}

function parseJsonArray(value?: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeActionPriority(value?: string | null): ActionItem['priority'] {
  if (value === 'low' || value === 'high') return value;
  return 'medium';
}

function summarizeActionItems(items: ActionItem[]): ActionStats {
  const now = Date.now();
  const stats: ActionStats = {
    total: items.length,
    pending: 0,
    inProgress: 0,
    verified: 0,
    discarded: 0,
    overdue: 0,
  };

  for (const item of items) {
    const status = normalizeActionItemStatus(item.status);
    if (status === 'pending') stats.pending += 1;
    if (status === 'in_progress') stats.inProgress += 1;
    if (status === 'verified') stats.verified += 1;
    if (status === 'discarded') stats.discarded += 1;

    if (
      (status === 'pending' || status === 'in_progress') &&
      item.dueAt !== null &&
      item.dueAt !== undefined
    ) {
      const dueTs = normalizeOptionalDate(item.dueAt)?.getTime();
      if (dueTs && dueTs < now) {
        stats.overdue += 1;
      }
    }
  }

  return stats;
}

function normalizeOutcomeConfidence(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeOptionalDate(value: number | string | null | undefined) {
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return new Date(value);
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toPercent(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return Math.max(0, Math.min(100, Math.round((numerator / denominator) * 100)));
}

function normalizeResumeSnapshot(value: unknown): DiscussionResumeSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const nextPhase = record.nextPhase;
  let normalizedNextPhase: DiscussionResumeSnapshot['nextPhase'] | null = null;
  if (nextPhase === DiscussionPhase.OPENING) {
    normalizedNextPhase = DiscussionPhase.OPENING;
  } else if (nextPhase === DiscussionPhase.INITIAL_RESPONSES) {
    normalizedNextPhase = DiscussionPhase.INITIAL_RESPONSES;
  } else if (nextPhase === DiscussionPhase.ANALYSIS) {
    normalizedNextPhase = DiscussionPhase.ANALYSIS;
  } else if (nextPhase === DiscussionPhase.SUMMARY) {
    normalizedNextPhase = DiscussionPhase.SUMMARY;
  }

  if (!normalizedNextPhase) {
    return null;
  }
  return {
    sourceSessionId:
      typeof record.sourceSessionId === 'string' ? record.sourceSessionId : '',
    nextPhase: normalizedNextPhase,
    nextRound: Number.isFinite(Number(record.nextRound))
      ? Number(record.nextRound)
      : 0,
    inherited: Array.isArray(record.inherited)
      ? record.inherited
          .map((item) => (typeof item === 'string' ? item : ''))
          .filter(Boolean)
      : [],
    discarded: Array.isArray(record.discarded)
      ? record.discarded
          .map((item) => (typeof item === 'string' ? item : ''))
          .filter(Boolean)
      : [],
    reason: typeof record.reason === 'string' ? record.reason : '',
  };
}

function parseJsonObject(value?: string | null) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeDateLike(value: unknown) {
  if (value instanceof Date) {
    return value.getTime();
  }
  return typeof value === 'string' || typeof value === 'number'
    ? value
    : Date.now();
}
