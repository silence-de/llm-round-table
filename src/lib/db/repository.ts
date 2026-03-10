import { and, asc, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { PersonaSelection } from '../agents/types';
import type {
  DecisionBrief,
  DecisionControlType,
  DecisionStatus,
  DecisionSummary,
  DiscussionAgenda,
} from '../decision/types';
import {
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
import { db, sqliteDb } from './client';
import {
  decisionSummaries,
  interjections,
  messages,
  minutes,
  researchRuns,
  researchSources,
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
  decisionStatus?: DecisionStatus;
}) {
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
    return;
  }

  await db.insert(decisionSummaries).values({
    sessionId,
    content: serialized,
    createdAt: now,
    updatedAt: now,
  });
}

export async function upsertResearchRun(
  sessionId: string,
  run: {
    status: ResearchRunStatus;
    queryPlan: string[];
    searchConfig: ResearchConfig;
    summary: string;
    evaluation: ResearchEvaluation | null;
  }
) {
  const now = new Date();
  const existing = await db
    .select({ id: researchRuns.id })
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
    updatedAt: now,
  };

  if (existing.length > 0) {
    await db
      .update(researchRuns)
      .set(payload)
      .where(eq(researchRuns.id, existing[0].id));
    return existing[0].id;
  }

  await db.insert(researchRuns).values({
    id: sessionId,
    ...payload,
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
        quality_flags,
        published_date,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    .orderBy(asc(researchSources.createdAt));

  return {
    id: run.id,
    sessionId: run.sessionId,
    status: run.status as ResearchRunStatus,
    queryPlan: parseJsonArray(run.queryPlan),
    searchConfig: normalizeResearchConfig(parseJsonObject(run.searchConfig)),
    summary: run.summary,
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
      qualityFlags: parseJsonArray(row.qualityFlags),
      publishedDate: row.publishedDate ?? undefined,
    })),
    createdAt: normalizeDateLike(run.createdAt),
    updatedAt: normalizeDateLike(run.updatedAt),
  };
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

  return {
    session,
    messages: sessionMessages,
    minutes: sessionMinutes ?? null,
    decisionSummary: sessionDecisionSummary
      ? normalizePersistedDecisionSummary(
          JSON.parse(sessionDecisionSummary.content) as DecisionSummary,
          researchRun?.sources ?? []
        )
      : null,
    researchRun,
    interjections: sessionInterjections,
    parentSession,
    childSessions,
  };
}

export async function listSessions() {
  return db.select().from(sessions).orderBy(asc(sessions.createdAt));
}

export async function getSessionStatus(sessionId: string) {
  const [session] = await db
    .select({ status: sessions.status })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);
  return session?.status;
}

export async function deleteSession(sessionId: string) {
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

function parseJsonArray(value?: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
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
