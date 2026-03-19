import fs from 'node:fs';
import path from 'node:path';
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
  buildDecisionConfidenceMeta,
  normalizeActionItemStatus,
  normalizeDecisionBrief,
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
import {
  attachCitationLabels,
  buildResearchSummaryText,
  evaluateResearchQuality,
  findResearchSourceByCitation,
  getResearchSourceCitationLabel,
} from '../search/utils';
import type {
  DiscussionResumeSnapshot,
  DiscussionSessionEvent,
} from '../orchestrator/types';
import { DiscussionPhase } from '../orchestrator/types';
import type { SessionVerificationMeta } from '../session/types';
import { db, sqliteDb } from './client';
import {
  actionItems,
  agentReplyArtifacts,
  claimSourceLinks,
  decisionClaims,
  decisionSummaries,
  interjections,
  judgeEvaluations,
  ledgerValidationMetrics,
  messages,
  minutes,
  researchRuns,
  researchSources,
  sessionEvents,
  sessions,
  summaryVersions,
  taskLedgerCheckpoints,
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
    timeHorizon: '',
    nonNegotiables: '',
    acceptableDownside: '',
    reviewAt: '',
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
    timeHorizon: brief.timeHorizon,
    nonNegotiables: brief.nonNegotiables,
    acceptableDownside: brief.acceptableDownside,
    reviewAt: brief.reviewAt || null,
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
  // Compute and freeze adjustedConfidence at write time so the stored value
  // does not drift as research sources change after the session completes.
  const researchRun = await getSessionResearch(sessionId);
  const confidenceMeta = buildDecisionConfidenceMeta(
    summary.rawConfidence ?? summary.confidence,
    summary.evidence ?? [],
    researchRun?.sources ?? []
  );
  const enrichedSummary: DecisionSummary = {
    ...summary,
    adjustedConfidence: confidenceMeta.adjustedConfidence,
    confidenceFrozenAt: Date.now(),
  };
  const serialized = JSON.stringify(enrichedSummary);
  const analytics = buildDecisionSummaryAnalytics(enrichedSummary);
  const existing = await db
    .select({ sessionId: decisionSummaries.sessionId })
    .from(decisionSummaries)
    .where(eq(decisionSummaries.sessionId, sessionId))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(decisionSummaries)
      .set({
        content: serialized,
        predictedConfidence: analytics.predictedConfidence,
        supportedOnly: analytics.supportedOnly ? 1 : 0,
        evidenceSourceCount: analytics.evidenceSourceCount,
        unsupportedClaimCount: analytics.unsupportedClaimCount,
        unresolvedEvidenceCount: analytics.unresolvedEvidenceCount,
        updatedAt: now,
      })
      .where(eq(decisionSummaries.sessionId, sessionId));
    await syncGeneratedActionItems(sessionId, enrichedSummary.nextActions);
    await replaceDecisionClaims(sessionId, enrichedSummary.evidence);
    return;
  }

  await db.insert(decisionSummaries).values({
    sessionId,
    content: serialized,
    predictedConfidence: analytics.predictedConfidence,
    supportedOnly: analytics.supportedOnly ? 1 : 0,
    evidenceSourceCount: analytics.evidenceSourceCount,
    unsupportedClaimCount: analytics.unsupportedClaimCount,
    unresolvedEvidenceCount: analytics.unresolvedEvidenceCount,
    createdAt: now,
    updatedAt: now,
  });

  await syncGeneratedActionItems(sessionId, enrichedSummary.nextActions);
  await replaceDecisionClaims(sessionId, enrichedSummary.evidence);
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
        source_type,
        verification_profile,
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
        captured_at,
        snapshot_path,
        claim_hint,
        note,
        verification_notes,
        verified_fields,
        extraction_method,
        extraction_quality,
        capture_status,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const now = Date.now();

    for (const source of sourcesToPersist) {
      stmt.run(
        source.id,
        researchRunId,
        source.sourceType ?? 'research',
        source.verificationProfile ?? null,
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
        normalizeOptionalDate(source.capturedAt)?.getTime() ?? null,
        source.snapshotPath ?? null,
        source.claimHint ?? null,
        source.note ?? null,
        JSON.stringify(source.verificationNotes ?? []),
        JSON.stringify(source.verifiedFields ?? []),
        source.extractionMethod ?? null,
        source.extractionQuality ?? null,
        source.captureStatus ?? null,
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
    sources: attachCitationLabels(
      rows.map((row) => ({
        id: row.id,
        sourceType:
          row.sourceType === 'browser_verification'
            ? 'browser_verification'
            : 'research',
        verificationProfile: row.verificationProfile ?? undefined,
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
        capturedAt:
          row.capturedAt !== null && row.capturedAt !== undefined
            ? normalizeDateLike(row.capturedAt)
            : undefined,
        snapshotPath: row.snapshotPath ?? undefined,
        claimHint: row.claimHint ?? undefined,
        note: row.note ?? undefined,
        verificationNotes: parseJsonArray(row.verificationNotes),
        verifiedFields: parseVerifiedFields(row.verifiedFields),
        extractionMethod:
          row.extractionMethod === 'playwright_dom' ||
          row.extractionMethod === 'fetch_html_fallback'
            ? row.extractionMethod
            : undefined,
        extractionQuality:
          row.extractionQuality === 'high' ||
          row.extractionQuality === 'medium' ||
          row.extractionQuality === 'low'
            ? row.extractionQuality
            : undefined,
        captureStatus:
          row.captureStatus === 'screenshot' || row.captureStatus === 'snapshot_fallback'
            ? row.captureStatus
            : undefined,
      }))
    ),
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

export async function appendVerifiedResearchSource(
  sessionId: string,
  source: ResearchSource
) {
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);
  if (!session) {
    return null;
  }

  const existingRun = await getSessionResearch(sessionId);
  if (!existingRun) {
    await upsertResearchRun(sessionId, {
      status: 'partial',
      queryPlan: [],
      searchConfig: normalizeResearchConfig(parseJsonObject(session.researchConfig)),
      summary: '',
      evaluation: null,
    });
  }

  const run = await getSessionResearch(sessionId);
  if (!run) return null;

  const nextRank =
    Math.max(0, ...run.sources.map((item) => Number(item.rank ?? 0))) + 1;
  const nextSources = [...run.sources, { ...source, rank: nextRank }];
  const brief = normalizeDecisionBrief({
    topic: session.topic,
    goal: session.goal,
    background: session.background,
    constraints: session.constraints,
    timeHorizon: session.timeHorizon,
    nonNegotiables: session.nonNegotiables,
    acceptableDownside: session.acceptableDownside,
    reviewAt: session.reviewAt ?? '',
    decisionType: session.decisionType as DecisionBrief['decisionType'],
    desiredOutput: session.desiredOutput as DecisionBrief['desiredOutput'],
    templateId: session.templateId ?? null,
  });
  const summary = buildResearchSummaryText(nextSources, brief.topic);
  const evaluation = evaluateResearchQuality({
    brief,
    queryPlan: run.queryPlan,
    sources: nextSources.filter((item) => item.selected),
  });

  await upsertResearchRun(sessionId, {
    status: run.status === 'completed' ? 'completed' : 'partial',
    queryPlan: run.queryPlan,
    searchConfig: run.searchConfig,
    summary,
    evaluation,
  });
  await replaceResearchSources(run.id, nextSources);
  return getSessionResearch(sessionId);
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
  const parentReviewComparison = parentSession?.id
    ? await getParentReviewComparison(parentSession.id, parentSession.topic)
    : null;

  const baseDecisionSummary = sessionDecisionSummary
    ? normalizePersistedDecisionSummary(
        JSON.parse(sessionDecisionSummary.content) as DecisionSummary,
        researchRun?.sources ?? [],
        {
          topic: session.topic,
          goal: session.goal,
          background: session.background,
          constraints: session.constraints,
          timeHorizon: session.timeHorizon,
          nonNegotiables: session.nonNegotiables,
          acceptableDownside: session.acceptableDownside,
          reviewAt: session.reviewAt ?? '',
          decisionType: session.decisionType as DecisionBrief['decisionType'],
          desiredOutput: session.desiredOutput as DecisionBrief['desiredOutput'],
          templateId: session.templateId ?? null,
        }
      )
    : null;
  const confidenceMeta =
    baseDecisionSummary
      ? (baseDecisionSummary.adjustedConfidence !== undefined
          ? {
              // Use persisted value — don't recompute to avoid drift over time
              rawConfidence: baseDecisionSummary.rawConfidence ?? baseDecisionSummary.confidence,
              adjustedConfidence: baseDecisionSummary.adjustedConfidence,
              totalPenalty: Math.max(0, (baseDecisionSummary.rawConfidence ?? baseDecisionSummary.confidence) - baseDecisionSummary.adjustedConfidence),
              adjustments: [],
              evidenceBackedClaims: baseDecisionSummary.evidence.filter(e => e.sourceIds.length > 0).length,
              unsupportedClaims: baseDecisionSummary.evidence.filter(e => e.sourceIds.length === 0).length,
              citedSources: 0,
              citedDomains: 0,
              staleSources: 0,
            }
          : buildDecisionConfidenceMeta(
              baseDecisionSummary.rawConfidence ?? baseDecisionSummary.confidence,
              baseDecisionSummary.evidence,
              researchRun?.sources ?? []
            )
        )
      : null;
  const calibrationContext = await getSessionCalibrationContext(
    session.id,
    session.templateId ?? null,
    session.decisionType
  );
  const normalizedDecisionSummary = baseDecisionSummary;
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
    confidenceMeta,
    verificationMeta: buildSessionVerificationMeta(researchRun?.sources ?? []),
    researchRun,
    interjections: sessionInterjections,
    actionItems: sessionActionItems,
    actionStats,
    decisionClaims,
    unresolvedEvidence,
    calibrationContext,
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
    parentReviewComparison,
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
      templateId: sessions.templateId,
      outcomeConfidence: sessions.outcomeConfidence,
      outcomeSummary: sessions.outcomeSummary,
      actualOutcome: sessions.actualOutcome,
      selectedAgentIds: sessions.selectedAgentIds,
      modelSelections: sessions.modelSelections,
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
        unresolvedEvidenceRate: 0,
      },
      researchBudget: {
        reruns: 0,
        recentQueries: 0,
        providerErrors: 0,
      },
      providerHotspots: [],
      degradedAgentSessions: [],
      unresolvedEvidenceSessions: [],
      calibration: {
        reviewedSessions: 0,
        averagePredictedConfidence: 0,
        averageOutcomeConfidence: 0,
        averageOverconfidence: 0,
        averageCalibrationGap: 0,
        sourcedVsUnsourcedOutcomeGap: {
          sourcedAverage: 0,
          unsourcedAverage: 0,
          delta: 0,
        },
        templateHitRates: [],
        agentModelOverconfidence: [],
        overconfidenceTrend: [],
      },
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
  const providerErrorEvents = events.filter((event) => event.type === 'provider_error');
  const resumeStarted = events.filter((event) => event.type === 'resume_started');
  const resumedSessionIds = new Set(resumeStarted.map((event) => event.sessionId));
  const resumedSuccess = recentSessions.filter(
    (session) => resumedSessionIds.has(session.id) && session.status === 'completed'
  ).length;
  const degradedSessionCounts = new Map<string, number>();
  for (const event of degradedEvents) {
    degradedSessionCounts.set(
      event.sessionId,
      (degradedSessionCounts.get(event.sessionId) ?? 0) + 1
    );
  }

  const providerCounts = new Map<string, number>();
  for (const event of events) {
    if (!event.provider) continue;
    providerCounts.set(event.provider, (providerCounts.get(event.provider) ?? 0) + 1);
  }

  const unresolvedEvidenceSessions = [];
  const calibrationRows: Array<{
    sessionId: string;
    createdAt: number | string;
    templateId: string;
    predictedConfidence: number;
    outcomeConfidence: number;
    supportedOnly: boolean;
  }> = [];
  const calibrationAgentModelRows: Array<{
    agentId: string;
    modelId: string;
    outcomeConfidence: number;
    delta: number;
  }> = [];
  const summaryRows =
    sessionIds.length > 0
      ? await db
          .select({
            sessionId: decisionSummaries.sessionId,
            content: decisionSummaries.content,
            predictedConfidence: decisionSummaries.predictedConfidence,
            supportedOnly: decisionSummaries.supportedOnly,
            evidenceSourceCount: decisionSummaries.evidenceSourceCount,
            unsupportedClaimCount: decisionSummaries.unsupportedClaimCount,
            unresolvedEvidenceCount: decisionSummaries.unresolvedEvidenceCount,
          })
          .from(decisionSummaries)
          .where(inArray(decisionSummaries.sessionId, sessionIds))
      : [];
  const summaryBySessionId = new Map(
    summaryRows.map((row) => [
      row.sessionId,
      toDecisionSummaryAnalytics(row),
    ])
  );
  const researchRunRows =
    sessionIds.length > 0
      ? await db
          .select({
            sessionId: researchRuns.sessionId,
            rerunCount: researchRuns.rerunCount,
            queryPlan: researchRuns.queryPlan,
          })
          .from(researchRuns)
          .where(inArray(researchRuns.sessionId, sessionIds))
      : [];
  const researchBudget = researchRunRows.reduce(
    (acc, row) => {
      acc.reruns += row.rerunCount ?? 0;
      acc.recentQueries += parseJsonArray(row.queryPlan).length;
      return acc;
    },
    {
      reruns: 0,
      recentQueries: 0,
      providerErrors: providerErrorEvents.length,
    }
  );

  for (const session of recentSessions) {
    const parsedSummary = summaryBySessionId.get(session.id) ?? null;
    if (!parsedSummary) continue;

    if (parsedSummary.unresolvedEvidenceCount > 0) {
      unresolvedEvidenceSessions.push({
        sessionId: session.id,
        unresolvedEvidenceCount: parsedSummary.unresolvedEvidenceCount,
        createdAt: normalizeDateLike(session.createdAt),
      });
    }
    const hasReview =
      (session.outcomeConfidence ?? 0) > 0 ||
      Boolean(session.actualOutcome?.trim()) ||
      Boolean(session.outcomeSummary?.trim());
    if (!hasReview) continue;
    calibrationRows.push({
      sessionId: session.id,
      createdAt: normalizeDateLike(session.createdAt),
      templateId: session.templateId ?? 'none',
      predictedConfidence: parsedSummary.predictedConfidence,
      outcomeConfidence: session.outcomeConfidence ?? 0,
      supportedOnly: parsedSummary.supportedOnly,
    });
    const selectedAgentIds = parseJsonArray(session.selectedAgentIds).filter(
      (value): value is string => typeof value === 'string' && value.length > 0
    );
    const modelSelections = parseJsonStringRecord(session.modelSelections);
    const delta = Math.max(
      0,
      parsedSummary.predictedConfidence - (session.outcomeConfidence ?? 0)
    );
    for (const agentId of selectedAgentIds) {
      calibrationAgentModelRows.push({
        agentId,
        modelId: modelSelections[agentId] ?? 'default',
        outcomeConfidence: session.outcomeConfidence ?? 0,
        delta,
      });
    }
  }
  const calibration = summarizeCalibration(calibrationRows, calibrationAgentModelRows);

  return {
    sessionsAnalyzed: recentSessions.length,
    metrics: {
      timeoutRate: toPercent(timeoutEvents.length, recentSessions.length),
      resumeSuccessRate: toPercent(resumedSuccess, Math.max(1, resumedSessionIds.size)),
      agentDegradedRate: toPercent(degradedEvents.length, recentSessions.length),
      unresolvedEvidenceRate: toPercent(
        unresolvedEvidenceSessions.length,
        recentSessions.length
      ),
    },
    researchBudget,
    providerHotspots: Array.from(providerCounts.entries())
      .map(([provider, count]) => ({ provider, count }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 5),
    degradedAgentSessions: recentSessions
      .filter((session) => degradedSessionCounts.has(session.id))
      .slice(0, 5)
      .map((session) => ({
        sessionId: session.id,
        status: session.status,
        createdAt: normalizeDateLike(session.createdAt),
        degradedEventCount: degradedSessionCounts.get(session.id) ?? 0,
      })),
    unresolvedEvidenceSessions: unresolvedEvidenceSessions.slice(0, 5),
    calibration,
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

export async function getCalibrationDashboard(input?: {
  window?: '30d' | '90d' | '180d' | 'all';
  decisionType?: string | null;
  templateId?: string | null;
}) {
  const window = input?.window ?? '90d';
  const windowDays =
    window === '30d' ? 30 : window === '90d' ? 90 : window === '180d' ? 180 : null;
  const now = Date.now();

  const sessionRows = await db
    .select({
      id: sessions.id,
      createdAt: sessions.createdAt,
      templateId: sessions.templateId,
      decisionType: sessions.decisionType,
      outcomeConfidence: sessions.outcomeConfidence,
      outcomeSummary: sessions.outcomeSummary,
      actualOutcome: sessions.actualOutcome,
      modelSelections: sessions.modelSelections,
      selectedAgentIds: sessions.selectedAgentIds,
      summaryContent: decisionSummaries.content,
      predictedConfidence: decisionSummaries.predictedConfidence,
      supportedOnly: decisionSummaries.supportedOnly,
      evidenceSourceCount: decisionSummaries.evidenceSourceCount,
      unsupportedClaimCount: decisionSummaries.unsupportedClaimCount,
      unresolvedEvidenceCount: decisionSummaries.unresolvedEvidenceCount,
    })
    .from(sessions)
    .leftJoin(decisionSummaries, eq(decisionSummaries.sessionId, sessions.id))
    .orderBy(desc(sessions.createdAt));

  const filteredRows = sessionRows.filter((row) => {
    if (windowDays !== null) {
      const createdAt = new Date(row.createdAt).getTime();
      if (Number.isFinite(createdAt) && now - createdAt > windowDays * 24 * 60 * 60 * 1000) {
        return false;
      }
    }
    if (input?.decisionType && row.decisionType !== input.decisionType) return false;
    if (input?.templateId && (row.templateId ?? 'none') !== input.templateId) return false;
    return true;
  });

  const calibrationRows: Array<{
    sessionId: string;
    createdAt: number | string;
    templateId: string;
    decisionType: string;
    predictedConfidence: number;
    outcomeConfidence: number;
    supportedOnly: boolean;
  }> = [];
  const agentModelRows: Array<{
    agentId: string;
    modelId: string;
    outcomeConfidence: number;
    delta: number;
  }> = [];

  for (const row of filteredRows) {
    const parsedSummary = toDecisionSummaryAnalytics(row);
    if (!parsedSummary) continue;
    const hasReview =
      (row.outcomeConfidence ?? 0) > 0 ||
      Boolean(row.actualOutcome?.trim()) ||
      Boolean(row.outcomeSummary?.trim());
    if (!hasReview) continue;

    calibrationRows.push({
      sessionId: row.id,
      createdAt: normalizeDateLike(row.createdAt),
      templateId: row.templateId ?? 'none',
      decisionType: row.decisionType,
      predictedConfidence: parsedSummary.predictedConfidence,
      outcomeConfidence: row.outcomeConfidence ?? 0,
      supportedOnly: parsedSummary.supportedOnly,
    });

    const selectedAgentIds = parseJsonArray(row.selectedAgentIds).filter(
      (value): value is string => typeof value === 'string' && value.length > 0
    );
    const modelSelections = parseJsonStringRecord(row.modelSelections);
    const delta = Math.max(
      0,
      parsedSummary.predictedConfidence - (row.outcomeConfidence ?? 0)
    );
    for (const agentId of selectedAgentIds) {
      agentModelRows.push({
        agentId,
        modelId: modelSelections[agentId] ?? 'default',
        outcomeConfidence: row.outcomeConfidence ?? 0,
        delta,
      });
    }
  }

  if (calibrationRows.length === 0) {
    return {
      window,
      reviewedSessions: 0,
      averagePredictedConfidence: 0,
      averageOutcomeConfidence: 0,
      averageOverconfidence: 0,
      averageCalibrationGap: 0,
      sampleLabel: 'insufficient',
      sampleNote: 'No reviewed sessions yet. Treat confidence as model output, not calibrated evidence.',
      minimumReliableSample: 12,
      byTemplate: [],
      byDecisionType: [],
      sourcedVsUnsourced: {
        sourcedSessions: 0,
        unsourcedSessions: 0,
        sourcedAverage: 0,
        unsourcedAverage: 0,
        delta: 0,
      },
      agentModelDrift: [],
      timeline: [],
      confidencePenaltyGuidance: [
        '暂无复盘数据，当前 confidence 主要来自模型判断。',
      ],
      mostReliableTemplate: '',
      largestBlindSpot: '',
    };
  }

  const byTemplate = summarizeCalibrationBuckets(
    calibrationRows,
    (row) => row.templateId
  );
  const byDecisionType = summarizeCalibrationBuckets(
    calibrationRows,
    (row) => row.decisionType
  );
  const sourcedRows = calibrationRows.filter((row) => row.supportedOnly);
  const unsourcedRows = calibrationRows.filter((row) => !row.supportedOnly);
  const averagePredictedConfidence = average(
    calibrationRows.map((row) => row.predictedConfidence)
  );
  const averageOutcomeConfidence = average(
    calibrationRows.map((row) => row.outcomeConfidence)
  );
  const averageOverconfidence = Math.round(
    average(
      calibrationRows.map((row) =>
        Math.max(0, row.predictedConfidence - row.outcomeConfidence)
      )
    )
  );
  const averageCalibrationGap = Math.round(
    average(
      calibrationRows.map((row) =>
        Math.abs(row.predictedConfidence - row.outcomeConfidence)
      )
    )
  );
  const agentModelDrift = summarizeAgentModelDrift(agentModelRows);
  const mostReliableTemplate = byTemplate[0]?.key ?? '';
  const largestBlindSpot =
    byDecisionType
      .filter((item) => item.averageOverconfidence > 0)
      .sort((left, right) => right.averageOverconfidence - left.averageOverconfidence)[0]
      ?.key ?? '';
  const sampleAssessment = assessCalibrationSample(calibrationRows.length);

  return {
    window,
    reviewedSessions: calibrationRows.length,
    averagePredictedConfidence,
    averageOutcomeConfidence,
    averageOverconfidence,
    averageCalibrationGap,
    sampleLabel: sampleAssessment.label,
    sampleNote: sampleAssessment.note,
    minimumReliableSample: sampleAssessment.minimumReliableSample,
    byTemplate: byTemplate.map((item) => ({
      templateId: item.key,
      reviewedSessions: item.reviewedSessions,
      averagePredictedConfidence: item.averagePredictedConfidence,
      averageOutcomeConfidence: item.averageOutcomeConfidence,
      averageOverconfidence: item.averageOverconfidence,
      hitRate: item.hitRate,
    })),
    byDecisionType: byDecisionType.map((item) => ({
      decisionType: item.key,
      reviewedSessions: item.reviewedSessions,
      averagePredictedConfidence: item.averagePredictedConfidence,
      averageOutcomeConfidence: item.averageOutcomeConfidence,
      averageOverconfidence: item.averageOverconfidence,
      hitRate: item.hitRate,
    })),
    sourcedVsUnsourced: {
      sourcedSessions: sourcedRows.length,
      unsourcedSessions: unsourcedRows.length,
      sourcedAverage: average(sourcedRows.map((row) => row.outcomeConfidence)),
      unsourcedAverage: average(unsourcedRows.map((row) => row.outcomeConfidence)),
      delta:
        sourcedRows.length > 0 && unsourcedRows.length > 0
          ? average(sourcedRows.map((row) => row.outcomeConfidence)) -
            average(unsourcedRows.map((row) => row.outcomeConfidence))
          : 0,
    },
    agentModelDrift,
    timeline: [...calibrationRows]
      .sort(
        (left, right) =>
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      )
      .slice(0, 12)
      .map((row) => ({
        sessionId: row.sessionId,
        createdAt: row.createdAt,
        predictedConfidence: row.predictedConfidence,
        outcomeConfidence: row.outcomeConfidence,
        delta: Math.abs(row.predictedConfidence - row.outcomeConfidence),
        templateId: row.templateId,
        decisionType: row.decisionType,
      })),
    confidencePenaltyGuidance: buildConfidencePenaltyGuidance({
      averageOverconfidence,
      averageCalibrationGap,
      sourcedDelta:
        sourcedRows.length > 0 && unsourcedRows.length > 0
          ? average(sourcedRows.map((row) => row.outcomeConfidence)) -
            average(unsourcedRows.map((row) => row.outcomeConfidence))
          : 0,
    }),
    mostReliableTemplate,
    largestBlindSpot,
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
    deleteSnapshotFiles(run.sources);
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
      row.source === 'carried_forward'
        ? 'carried_forward'
        : row.source === 'archived_generated'
          ? 'archived_generated'
          : 'generated',
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
  const normalized = Array.from(
    new Set(
      nextActions
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
  const existing = await listActionItems(sessionId);
  const existingGeneratedByContent = new Map(
    existing
      .filter(
        (item) => item.source === 'generated' || item.source === 'archived_generated'
      )
      .map((item) => [item.content, item])
  );
  const normalizedSet = new Set(normalized);
  const now = new Date();

  for (const [index, content] of normalized.entries()) {
    const matched = existingGeneratedByContent.get(content);
    if (matched) {
      await db
        .update(actionItems)
        .set({ sortOrder: index, source: 'generated', updatedAt: now })
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

  for (const item of existing) {
    if (item.source !== 'generated') continue;
    if (normalizedSet.has(item.content)) continue;
    if (wasActionItemManuallyEdited(item)) continue;
    await db
      .update(actionItems)
      .set({
        source: 'archived_generated',
        updatedAt: now,
      })
      .where(eq(actionItems.id, item.id));
  }
}

function buildActionFingerprint(item: Pick<ActionItem, 'content' | 'owner' | 'dueAt'>) {
  const normalizedDueAt =
    item.dueAt !== null && item.dueAt !== undefined
      ? normalizeOptionalDate(item.dueAt)?.getTime() ?? 'none'
      : 'none';
  return `${item.content.trim().toLowerCase()}::${item.owner.trim().toLowerCase()}::${normalizedDueAt}`;
}

function wasActionItemManuallyEdited(item: ActionItem) {
  return (
    item.status !== 'pending' ||
    item.note.trim().length > 0 ||
    item.owner.trim().length > 0 ||
    Boolean(item.dueAt) ||
    item.verificationNote.trim().length > 0 ||
    item.priority !== 'medium'
  );
}

async function getParentReviewComparison(
  sessionId: string,
  topicOverride?: string
): Promise<{
  sessionId: string;
  topic: string;
  recommendedOption: string;
  predictedConfidence: number;
  outcomeSummary: string;
  actualOutcome: string;
  outcomeConfidence: number;
  retrospectiveNote: string;
} | null> {
  const [parentSession] = await db
    .select({
      id: sessions.id,
      topic: sessions.topic,
      outcomeSummary: sessions.outcomeSummary,
      actualOutcome: sessions.actualOutcome,
      outcomeConfidence: sessions.outcomeConfidence,
      retrospectiveNote: sessions.retrospectiveNote,
    })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);
  if (!parentSession) return null;

  const [summaryRow] = await db
    .select()
    .from(decisionSummaries)
    .where(eq(decisionSummaries.sessionId, sessionId))
    .limit(1);
  if (!summaryRow) return null;

  const normalized = normalizePersistedDecisionSummary(
    JSON.parse(summaryRow.content) as DecisionSummary
  );
  return {
    sessionId,
    topic: topicOverride ?? parentSession.topic,
    recommendedOption: normalized.recommendedOption,
    predictedConfidence: normalized.confidence,
    outcomeSummary: parentSession.outcomeSummary ?? '',
    actualOutcome: parentSession.actualOutcome ?? '',
    outcomeConfidence: parentSession.outcomeConfidence ?? 0,
    retrospectiveNote: parentSession.retrospectiveNote ?? '',
  };
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
    parentReviewComparison: await getParentReviewComparison(parentSessionId),
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
  const researchRun = sqliteDb
    .prepare('SELECT id FROM research_runs WHERE session_id = ? LIMIT 1')
    .get(sessionId) as { id: string } | undefined;
  const researchSourceRows = researchRun
    ? (sqliteDb
        .prepare(
          'SELECT id, rank FROM research_sources WHERE research_run_id = ? ORDER BY rank ASC, created_at ASC'
        )
        .all(researchRun.id) as Array<{ id: string; rank: number }>)
    : [];
  const researchSources = attachCitationLabels(
    researchSourceRows.map((row) => ({
      id: row.id,
      rank: Number(row.rank ?? 0),
      title: '',
      url: '',
      domain: '',
      snippet: '',
      score: 0,
      selected: true,
      pinned: false,
      stale: false,
      qualityFlags: [],
    }))
  );

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
        const resolved = findResearchSourceByCitation(sourceId, researchSources);
        if (!resolved) continue;
        insertLink.run(nanoid(), claimId, resolved.id, now);
      }
    }
  });

  tx();
}

export async function listDecisionClaims(sessionId: string): Promise<DecisionClaim[]> {
  const researchRun = await getSessionResearch(sessionId);
  const labelBySourceId = new Map(
    (researchRun?.sources ?? []).map((source) => [
      source.id,
      source.citationLabel ?? getResearchSourceCitationLabel(source),
    ])
  );
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
    sourceIds: (sourceMap.get(row.id) ?? [])
      .map((sourceId) => labelBySourceId.get(sourceId))
      .filter((sourceId): sourceId is string => Boolean(sourceId)),
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

function parseVerifiedFields(value?: string | null) {
  return parseJsonArray(value)
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const candidate = item as Record<string, unknown>;
      const confidence = candidate.confidence;
      if (
        typeof candidate.label !== 'string' ||
        typeof candidate.value !== 'string' ||
        (confidence !== 'high' && confidence !== 'medium' && confidence !== 'low')
      ) {
        return null;
      }
      return {
        label: candidate.label,
        value: candidate.value,
        confidence,
      };
    })
    .filter(
      (
        item
      ): item is {
        label: string;
        value: string;
        confidence: 'high' | 'medium' | 'low';
      } => Boolean(item)
    );
}

function parseJsonStringRecord(value?: string | null) {
  const parsed = parseJsonObject(value);
  return Object.fromEntries(
    Object.entries(parsed).filter(
      ([key, item]) => typeof key === 'string' && typeof item === 'string'
    )
  ) as Record<string, string>;
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

function summarizeCalibration(
  rows: Array<{
    sessionId: string;
    createdAt: number | string;
    templateId: string;
    predictedConfidence: number;
    outcomeConfidence: number;
    supportedOnly: boolean;
  }>,
  agentModelRows: Array<{
    agentId: string;
    modelId: string;
    outcomeConfidence: number;
    delta: number;
  }>
) {
  if (rows.length === 0) {
    return {
      reviewedSessions: 0,
      averagePredictedConfidence: 0,
      averageOutcomeConfidence: 0,
      averageOverconfidence: 0,
      averageCalibrationGap: 0,
      sourcedVsUnsourcedOutcomeGap: {
        sourcedAverage: 0,
        unsourcedAverage: 0,
        delta: 0,
      },
      templateHitRates: [],
      agentModelOverconfidence: [],
      overconfidenceTrend: [],
    };
  }

  const totalOverconfidence = rows.reduce(
    (sum, row) => sum + Math.max(0, row.predictedConfidence - row.outcomeConfidence),
    0
  );
  const totalGap = rows.reduce(
    (sum, row) => sum + Math.abs(row.predictedConfidence - row.outcomeConfidence),
    0
  );

  const templateMap = new Map<
    string,
    { total: number; hits: number }
  >();
  for (const row of rows) {
    const current = templateMap.get(row.templateId) ?? { total: 0, hits: 0 };
    current.total += 1;
    if (row.outcomeConfidence >= 60) {
      current.hits += 1;
    }
    templateMap.set(row.templateId, current);
  }

  const sourced = rows.filter((row) => row.supportedOnly);
  const unsourced = rows.filter((row) => !row.supportedOnly);
  const sourcedAverage = average(sourced.map((row) => row.outcomeConfidence));
  const unsourcedAverage = average(unsourced.map((row) => row.outcomeConfidence));
  const agentModelMap = new Map<
    string,
    {
      agentId: string;
      modelId: string;
      reviewedSessions: number;
      deltaTotal: number;
      outcomeTotal: number;
    }
  >();
  for (const row of agentModelRows) {
    const key = `${row.agentId}::${row.modelId}`;
    const current = agentModelMap.get(key) ?? {
      agentId: row.agentId,
      modelId: row.modelId,
      reviewedSessions: 0,
      deltaTotal: 0,
      outcomeTotal: 0,
    };
    current.reviewedSessions += 1;
    current.deltaTotal += row.delta;
    current.outcomeTotal += row.outcomeConfidence;
    agentModelMap.set(key, current);
  }

  return {
    reviewedSessions: rows.length,
    averagePredictedConfidence: average(rows.map((row) => row.predictedConfidence)),
    averageOutcomeConfidence: average(rows.map((row) => row.outcomeConfidence)),
    averageOverconfidence: Math.round(totalOverconfidence / rows.length),
    averageCalibrationGap: Math.round(totalGap / rows.length),
    sourcedVsUnsourcedOutcomeGap: {
      sourcedAverage,
      unsourcedAverage,
      delta: sourced.length > 0 && unsourced.length > 0 ? sourcedAverage - unsourcedAverage : 0,
    },
    templateHitRates: Array.from(templateMap.entries())
      .map(([templateId, value]) => ({
        templateId,
        reviewedSessions: value.total,
        hitRate: toPercent(value.hits, value.total),
      }))
      .sort((left, right) => right.hitRate - left.hitRate)
      .slice(0, 5),
    agentModelOverconfidence: Array.from(agentModelMap.values())
      .map((value) => ({
        agentId: value.agentId,
        modelId: value.modelId,
        reviewedSessions: value.reviewedSessions,
        averageDelta: Math.round(value.deltaTotal / value.reviewedSessions),
        averageOutcomeConfidence: Math.round(
          value.outcomeTotal / value.reviewedSessions
        ),
      }))
      .sort((left, right) => right.averageDelta - left.averageDelta)
      .slice(0, 6),
    overconfidenceTrend: [...rows]
      .sort(
        (left, right) =>
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      )
      .slice(0, 6)
      .map((row) => ({
        sessionId: row.sessionId,
        createdAt: row.createdAt,
        predictedConfidence: row.predictedConfidence,
        outcomeConfidence: row.outcomeConfidence,
        delta: row.predictedConfidence - row.outcomeConfidence,
      })),
  };
}

function summarizeCalibrationBuckets<T extends { predictedConfidence: number; outcomeConfidence: number }>(
  rows: T[],
  getKey: (row: T) => string
) {
  const buckets = new Map<
    string,
    {
      reviewedSessions: number;
      predicted: number[];
      outcome: number[];
      overconfidence: number[];
      hits: number;
    }
  >();

  for (const row of rows) {
    const key = getKey(row);
    const current = buckets.get(key) ?? {
      reviewedSessions: 0,
      predicted: [],
      outcome: [],
      overconfidence: [],
      hits: 0,
    };
    current.reviewedSessions += 1;
    current.predicted.push(row.predictedConfidence);
    current.outcome.push(row.outcomeConfidence);
    current.overconfidence.push(
      Math.max(0, row.predictedConfidence - row.outcomeConfidence)
    );
    if (row.outcomeConfidence >= 60) current.hits += 1;
    buckets.set(key, current);
  }

  return Array.from(buckets.entries())
    .map(([key, value]) => ({
      key,
      reviewedSessions: value.reviewedSessions,
      averagePredictedConfidence: average(value.predicted),
      averageOutcomeConfidence: average(value.outcome),
      averageOverconfidence: Math.round(average(value.overconfidence)),
      hitRate: toPercent(value.hits, value.reviewedSessions),
    }))
    .sort((left, right) => right.hitRate - left.hitRate)
    .slice(0, 8);
}

function summarizeAgentModelDrift(
  rows: Array<{
    agentId: string;
    modelId: string;
    outcomeConfidence: number;
    delta: number;
  }>
) {
  const agentModelMap = new Map<
    string,
    {
      agentId: string;
      modelId: string;
      reviewedSessions: number;
      deltaTotal: number;
      outcomeTotal: number;
    }
  >();

  for (const row of rows) {
    const key = `${row.agentId}::${row.modelId}`;
    const current = agentModelMap.get(key) ?? {
      agentId: row.agentId,
      modelId: row.modelId,
      reviewedSessions: 0,
      deltaTotal: 0,
      outcomeTotal: 0,
    };
    current.reviewedSessions += 1;
    current.deltaTotal += row.delta;
    current.outcomeTotal += row.outcomeConfidence;
    agentModelMap.set(key, current);
  }

  return Array.from(agentModelMap.values())
    .map((value) => ({
      agentId: value.agentId,
      modelId: value.modelId,
      reviewedSessions: value.reviewedSessions,
      averageDelta: Math.round(value.deltaTotal / value.reviewedSessions),
      averageOutcomeConfidence: Math.round(
        value.outcomeTotal / value.reviewedSessions
      ),
    }))
    .sort((left, right) => right.averageDelta - left.averageDelta)
    .slice(0, 10);
}

function buildConfidencePenaltyGuidance(input: {
  averageOverconfidence: number;
  averageCalibrationGap: number;
  sourcedDelta: number;
}) {
  const guidance: string[] = [];
  if (input.averageOverconfidence >= 15) {
    guidance.push('当前系统整体偏乐观，建议默认保留更大的人工折扣。');
  } else {
    guidance.push('当前 overconfidence 可控，但高分建议仍应优先核验红线条件。');
  }
  if (input.averageCalibrationGap >= 20) {
    guidance.push('预测与实际落差较大，优先查看 revisit trigger 与 pre-mortem。');
  }
  if (input.sourcedDelta > 0) {
    guidance.push('有证据支撑的会话表现更稳，优先补足 unsupported claims。');
  } else if (input.sourcedDelta < 0) {
    guidance.push('证据数量不等于证据质量，来源集中或过时会抵消核验收益。');
  } else {
    guidance.push('当前 sourced vs unsourced 差异不明显，继续积累 outcome review 数据。');
  }
  return guidance;
}

async function getSessionCalibrationContext(
  currentSessionId: string,
  templateId: string | null,
  decisionType: string
) {
  const rows = await db
    .select({
      id: sessions.id,
      templateId: sessions.templateId,
      decisionType: sessions.decisionType,
      outcomeConfidence: sessions.outcomeConfidence,
      outcomeSummary: sessions.outcomeSummary,
      actualOutcome: sessions.actualOutcome,
      content: decisionSummaries.content,
      predictedConfidence: decisionSummaries.predictedConfidence,
      supportedOnly: decisionSummaries.supportedOnly,
      evidenceSourceCount: decisionSummaries.evidenceSourceCount,
      unsupportedClaimCount: decisionSummaries.unsupportedClaimCount,
      unresolvedEvidenceCount: decisionSummaries.unresolvedEvidenceCount,
    })
    .from(sessions)
    .leftJoin(decisionSummaries, eq(decisionSummaries.sessionId, sessions.id));

  const relevantRows = rows
    .filter((row) => row.id !== currentSessionId && Boolean(row.content))
    .filter((row) =>
      templateId ? row.templateId === templateId : row.decisionType === decisionType
    )
    .filter(
      (row) =>
        (row.outcomeConfidence ?? 0) > 0 ||
        Boolean(row.outcomeSummary?.trim()) ||
        Boolean(row.actualOutcome?.trim())
    );

  if (relevantRows.length === 0) {
    return {
      reviewedSessions: 0,
      averageOverconfidence: 0,
      templateHitRate: 0,
      penalty: 0,
      basedOn: templateId ? 'template' : 'decisionType',
    };
  }

  const metrics = relevantRows
    .map((row) => {
      const parsed = toDecisionSummaryAnalytics(row);
      if (!parsed) return null;
      const predictedConfidence = parsed.predictedConfidence;
      const outcomeConfidence = row.outcomeConfidence ?? 0;
      return {
        predictedConfidence,
        outcomeConfidence,
        overconfidence: Math.max(0, predictedConfidence - outcomeConfidence),
      };
    })
    .filter(
      (
        metric
      ): metric is {
        predictedConfidence: number;
        outcomeConfidence: number;
        overconfidence: number;
      } => Boolean(metric)
    );
  if (metrics.length === 0) {
    return {
      reviewedSessions: 0,
      averageOverconfidence: 0,
      templateHitRate: 0,
      penalty: 0,
      basedOn: templateId ? 'template' : 'decisionType',
    };
  }
  const averageOverconfidence = average(
    metrics.map((metric) => metric.overconfidence)
  );
  const templateHitRate = toPercent(
    metrics.filter((metric) => metric.outcomeConfidence >= 60).length,
    metrics.length
  );
  const penalty =
    metrics.length >= 2
      ? Math.min(
          14,
          Math.round(averageOverconfidence / 2.5) +
            (templateHitRate < 50 ? 3 : templateHitRate < 65 ? 1 : 0)
        )
      : 0;

  return {
    reviewedSessions: metrics.length,
    averageOverconfidence,
    templateHitRate,
    penalty,
    basedOn: templateId ? 'template' : 'decisionType',
  };
}

function buildDecisionSummaryAnalytics(summary: DecisionSummary) {
  const evidence = Array.isArray(summary.evidence) ? summary.evidence : [];
  let unresolvedEvidenceCount = 0;
  let unsupportedClaimCount = 0;
  const citedSourceIds = new Set<string>();

  for (const item of evidence) {
    const sourceIds = item.sourceIds.filter((value) => value.trim().length > 0);
    const unresolvedSourceIndices = item.unresolvedSourceIndices ?? [];
    if (sourceIds.length === 0) {
      unsupportedClaimCount += 1;
    }
    if (sourceIds.length === 0 || unresolvedSourceIndices.length > 0) {
      unresolvedEvidenceCount += 1;
    }
    for (const sourceId of sourceIds) {
      citedSourceIds.add(sourceId);
    }
  }

  return {
    predictedConfidence: normalizeConfidenceValue(
      summary.rawConfidence ?? summary.confidence
    ),
    supportedOnly: unsupportedClaimCount === 0,
    evidenceSourceCount: citedSourceIds.size,
    unsupportedClaimCount,
    unresolvedEvidenceCount,
  };
}

function parseDecisionSummaryAnalytics(content?: string | null) {
  if (!content) return null;
  try {
    const parsed = JSON.parse(content) as DecisionSummary;
    return buildDecisionSummaryAnalytics(parsed);
  } catch {
    return null;
  }
}

function toDecisionSummaryAnalytics(row: {
  summaryContent?: string | null;
  content?: string | null;
  predictedConfidence?: number | null;
  supportedOnly?: number | null;
  evidenceSourceCount?: number | null;
  unsupportedClaimCount?: number | null;
  unresolvedEvidenceCount?: number | null;
}) {
  const predictedConfidence = Number(row.predictedConfidence ?? 0);
  const supportedOnly = Number(row.supportedOnly ?? 0);
  const evidenceSourceCount = Number(row.evidenceSourceCount ?? 0);
  const unsupportedClaimCount = Number(row.unsupportedClaimCount ?? 0);
  const unresolvedEvidenceCount = Number(row.unresolvedEvidenceCount ?? 0);

  if (
    predictedConfidence > 0 ||
    evidenceSourceCount > 0 ||
    unsupportedClaimCount > 0 ||
    unresolvedEvidenceCount > 0
  ) {
    return {
      predictedConfidence,
      supportedOnly: supportedOnly === 1,
      evidenceSourceCount,
      unsupportedClaimCount,
      unresolvedEvidenceCount,
    };
  }

  return parseDecisionSummaryAnalytics(row.summaryContent ?? row.content);
}

function buildSessionVerificationMeta(
  sources: ResearchSource[]
): SessionVerificationMeta | null {
  const verificationSources = sources.filter(
    (source) => source.sourceType === 'browser_verification'
  );
  if (verificationSources.length === 0) return null;

  const extractedSources = verificationSources.filter(
    (source) => (source.verifiedFields?.length ?? 0) > 0
  ).length;
  const manualReviewRequiredSources = verificationSources.filter(
    (source) =>
      source.qualityFlags.includes('manual_review_required') ||
      (source.verifiedFields?.length ?? 0) === 0
  ).length;

  return {
    capturedSources: verificationSources.length,
    extractedSources,
    manualReviewRequiredSources,
    semantics: ['captured', 'extracted', 'manual_review'],
  };
}

function assessCalibrationSample(reviewedSessions: number) {
  const minimumReliableSample = 12;
  if (reviewedSessions < 4) {
    return {
      label: 'insufficient' as const,
      note: 'Very low sample size. Treat these numbers as anecdotal checks, not calibration.',
      minimumReliableSample,
    };
  }
  if (reviewedSessions < minimumReliableSample) {
    return {
      label: 'emerging' as const,
      note: 'Early trend only. Keep outcome reviews coming before drawing strong conclusions.',
      minimumReliableSample,
    };
  }
  if (reviewedSessions < 24) {
    return {
      label: 'directional' as const,
      note: 'Directional signal is available, but template and model deltas still need manual judgment.',
      minimumReliableSample,
    };
  }
  return {
    label: 'stable' as const,
    note: 'Sample size is large enough to treat this as a useful operating signal, not proof.',
    minimumReliableSample,
  };
}

function deleteSnapshotFiles(sources: ResearchSource[]) {
  for (const source of sources) {
    if (!source.snapshotPath) continue;
    try {
      const resolvedPath = path.resolve(source.snapshotPath);
      if (fs.existsSync(resolvedPath)) {
        fs.unlinkSync(resolvedPath);
      }
    } catch {
      // ignore snapshot cleanup failures
    }
  }
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function normalizeConfidenceValue(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 40;
  return Math.max(0, Math.min(100, Math.round(numeric)));
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

// ── Agent Reply Artifacts ──────────────────────────────────────────

export async function upsertAgentReplyArtifact(input: {
  sessionId: string;
  agentId: string;
  phase: string;
  round?: number | null;
  schemaVersion: string;
  artifactJson: string;
  parseSuccess: boolean;
  citationResolveRate?: number | null;
  warnings?: string[];
}) {
  const now = new Date();
  const existing = db
    .select()
    .from(agentReplyArtifacts)
    .where(
      and(
        eq(agentReplyArtifacts.sessionId, input.sessionId),
        eq(agentReplyArtifacts.agentId, input.agentId),
        eq(agentReplyArtifacts.phase, input.phase)
      )
    )
    .all()
    .find((row) => (row.round ?? null) === (input.round ?? null));

  if (existing) {
    db.update(agentReplyArtifacts)
      .set({
        schemaVersion: input.schemaVersion,
        artifactJson: input.artifactJson,
        parseSuccess: input.parseSuccess ? 1 : 0,
        citationResolveRate: input.citationResolveRate ?? null,
        warnings: JSON.stringify(input.warnings ?? []),
      })
      .where(eq(agentReplyArtifacts.id, existing.id))
      .run();
    return existing.id;
  }

  const id = nanoid();
  db.insert(agentReplyArtifacts)
    .values({
      id,
      sessionId: input.sessionId,
      agentId: input.agentId,
      phase: input.phase,
      round: input.round ?? null,
      schemaVersion: input.schemaVersion,
      artifactJson: input.artifactJson,
      parseSuccess: input.parseSuccess ? 1 : 0,
      citationResolveRate: input.citationResolveRate ?? null,
      warnings: JSON.stringify(input.warnings ?? []),
      createdAt: now,
    })
    .run();
  return id;
}

export async function getAgentReplyArtifact(
  sessionId: string,
  agentId: string,
  phase: string,
  round?: number | null
) {
  const rows = db
    .select()
    .from(agentReplyArtifacts)
    .where(
      and(
        eq(agentReplyArtifacts.sessionId, sessionId),
        eq(agentReplyArtifacts.agentId, agentId),
        eq(agentReplyArtifacts.phase, phase)
      )
    )
    .all();
  return rows.find((row) => (row.round ?? null) === (round ?? null)) ?? null;
}

export async function listAgentReplyArtifacts(
  sessionId: string,
  phase?: string,
  round?: number | null
) {
  const conditions = [eq(agentReplyArtifacts.sessionId, sessionId)];
  if (phase) {
    conditions.push(eq(agentReplyArtifacts.phase, phase));
  }
  const rows = db
    .select()
    .from(agentReplyArtifacts)
    .where(and(...conditions))
    .orderBy(asc(agentReplyArtifacts.createdAt))
    .all();

  if (round !== undefined && round !== null) {
    return rows.filter((row) => row.round === round);
  }
  return rows;
}

export async function upsertLedgerCheckpoint(input: {
  sessionId: string;
  phase: string;
  ledgerVersion: number;
  ledgerJson: string;
}): Promise<void> {
  const id = nanoid();
  await db.insert(taskLedgerCheckpoints).values({
    id,
    sessionId: input.sessionId,
    phase: input.phase,
    ledgerVersion: input.ledgerVersion,
    ledgerJson: input.ledgerJson,
    createdAt: new Date(),
  });
}

export async function getLatestLedgerCheckpoint(sessionId: string) {
  const rows = await db
    .select()
    .from(taskLedgerCheckpoints)
    .where(eq(taskLedgerCheckpoints.sessionId, sessionId))
    .orderBy(desc(taskLedgerCheckpoints.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function listLedgerCheckpoints(sessionId: string) {
  return db
    .select()
    .from(taskLedgerCheckpoints)
    .where(eq(taskLedgerCheckpoints.sessionId, sessionId))
    .orderBy(asc(taskLedgerCheckpoints.createdAt));
}

export async function recordLedgerValidationMetric(input: {
  sessionId: string;
  coverageRate: number;
  coveredCount: number;
  totalCount: number;
  coveragePassed: boolean;
  riskCount: number;
  highSeverityCount: number;
  overallPassed: boolean;
  evaluatedAt: number;
}): Promise<void> {
  const id = nanoid();
  await db.insert(ledgerValidationMetrics).values({
    id,
    sessionId: input.sessionId,
    coverageRate: input.coverageRate,
    coveredCount: input.coveredCount,
    totalCount: input.totalCount,
    coveragePassed: input.coveragePassed ? 1 : 0,
    riskCount: input.riskCount,
    highSeverityCount: input.highSeverityCount,
    overallPassed: input.overallPassed ? 1 : 0,
    evaluatedAt: new Date(input.evaluatedAt),
    createdAt: new Date(),
  });
}

export async function recordJudgeEvaluation(input: {
  sessionId: string;
  summaryVersion: number;
  passedCount: number;
  totalDimensions: number;
  overallPassed: boolean;
  gate: string;
  rewriteInstructionsJson: string;
  escalateReason: string;
  dimensionsJson: string;
  evaluatedAt: number;
}): Promise<void> {
  const id = nanoid();
  await db.insert(judgeEvaluations).values({
    id,
    sessionId: input.sessionId,
    summaryVersion: input.summaryVersion,
    passedCount: input.passedCount,
    totalDimensions: input.totalDimensions,
    overallPassed: input.overallPassed ? 1 : 0,
    gate: input.gate,
    rewriteInstructionsJson: input.rewriteInstructionsJson,
    escalateReason: input.escalateReason,
    dimensionsJson: input.dimensionsJson,
    evaluatedAt: new Date(input.evaluatedAt),
    createdAt: new Date(),
  });
}

export async function recordJudgeHumanReview(input: {
  judgeEvaluationId: string;
  humanReviewResult: 'PASS' | 'FAIL';
  humanReviewerId: string;
  agreement: boolean;
}): Promise<void> {
  await db
    .update(judgeEvaluations)
    .set({
      humanReviewResult: input.humanReviewResult,
      humanReviewerId: input.humanReviewerId,
      reviewedAt: new Date(),
      agreement: input.agreement ? 1 : 0,
    })
    .where(eq(judgeEvaluations.id, input.judgeEvaluationId));
}

export async function listJudgeEvaluationsForCalibration(sessionId?: string) {
  const rows = await db
    .select()
    .from(judgeEvaluations)
    .where(sessionId ? eq(judgeEvaluations.sessionId, sessionId) : undefined)
    .orderBy(desc(judgeEvaluations.createdAt));
  return rows.map((r) => ({
    ...r,
    rewriteInstructions: JSON.parse(r.rewriteInstructionsJson ?? '[]') as string[],
    dimensions: JSON.parse(r.dimensionsJson ?? '[]'),
    overallPassed: r.overallPassed === 1,
    agreement: r.agreement === null ? null : r.agreement === 1,
  }));
}

export async function upsertSummaryVersion(input: {
  sessionId: string;
  version: number;
  summaryJson: string;
  rewriteTriggered: boolean;
}): Promise<void> {
  const id = nanoid();
  await db.insert(summaryVersions).values({
    id,
    sessionId: input.sessionId,
    version: input.version,
    summaryJson: input.summaryJson,
    rewriteTriggered: input.rewriteTriggered ? 1 : 0,
    createdAt: new Date(),
  });
}

export async function listSummaryVersions(sessionId: string) {
  return db
    .select()
    .from(summaryVersions)
    .where(eq(summaryVersions.sessionId, sessionId))
    .orderBy(asc(summaryVersions.version));
}
