import { and, asc, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db, sqliteDb } from './client';
import { interjections, messages, minutes, sessions } from './schema';

export async function createSession(input: {
  id: string;
  topic: string;
  moderatorAgentId: string;
  maxDebateRounds: number;
  selectedAgentIds: string[];
  modelSelections: Record<string, string>;
  personas: Record<string, string>;
}) {
  const now = new Date();
  await db.insert(sessions).values({
    id: input.id,
    topic: input.topic,
    moderatorAgentId: input.moderatorAgentId,
    maxDebateRounds: input.maxDebateRounds,
    selectedAgentIds: JSON.stringify(input.selectedAgentIds),
    modelSelections: JSON.stringify(input.modelSelections),
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

  const sessionInterjections = await db
    .select()
    .from(interjections)
    .where(eq(interjections.sessionId, sessionId))
    .orderBy(asc(interjections.createdAt));

  return {
    session,
    messages: sessionMessages,
    minutes: sessionMinutes ?? null,
    interjections: sessionInterjections,
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
  phaseHint?: string;
  roundHint?: number;
}

export async function enqueueInterjection(input: {
  sessionId: string;
  content: string;
  phaseHint?: string;
  roundHint?: number;
}) {
  const id = nanoid();
  await db.insert(interjections).values({
    id,
    sessionId: input.sessionId,
    content: input.content,
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
         FROM interjections
         WHERE session_id = ? AND consumed = 0
         ORDER BY created_at ASC`
      )
      .all(input.sessionId) as Array<{
      id: string;
      content: string;
      created_at: number;
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
      phaseHint: row.phase_hint ?? undefined,
      roundHint: row.round_hint ?? undefined,
    }));
  });

  return tx();
}
