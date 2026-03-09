import { and, asc, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from './client';
import { messages, minutes, sessions } from './schema';

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

  return {
    session,
    messages: sessionMessages,
    minutes: sessionMinutes ?? null,
  };
}

export async function listSessions() {
  return db.select().from(sessions).orderBy(asc(sessions.createdAt));
}

export async function deleteSession(sessionId: string) {
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
