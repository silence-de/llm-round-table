import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  topic: text('topic').notNull(),
  moderatorAgentId: text('moderator_agent_id').notNull(),
  maxDebateRounds: integer('max_debate_rounds').notNull(),
  selectedAgentIds: text('selected_agent_ids').notNull().default('[]'),
  modelSelections: text('model_selections').notNull().default('{}'),
  personaSelections: text('persona_selections').notNull().default('{}'),
  personas: text('personas').notNull().default('{}'),
  usageInputTokens: integer('usage_input_tokens').notNull().default(0),
  usageOutputTokens: integer('usage_output_tokens').notNull().default(0),
  stopRequested: integer('stop_requested').notNull().default(0),
  status: text('status').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  role: text('role').notNull(),
  agentId: text('agent_id'),
  displayName: text('display_name'),
  phase: text('phase').notNull(),
  round: integer('round'),
  content: text('content').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export const minutes = sqliteTable('minutes', {
  sessionId: text('session_id').primaryKey(),
  content: text('content').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

export const interjections = sqliteTable('interjections', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  content: text('content').notNull(),
  phaseHint: text('phase_hint'),
  roundHint: integer('round_hint'),
  consumed: integer('consumed').notNull().default(0),
  consumedPhase: text('consumed_phase'),
  consumedRound: integer('consumed_round'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  consumedAt: integer('consumed_at', { mode: 'timestamp_ms' }),
});
