import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  topic: text('topic').notNull(),
  goal: text('goal').notNull().default(''),
  background: text('background').notNull().default(''),
  constraints: text('constraints').notNull().default(''),
  decisionType: text('decision_type').notNull().default('general'),
  desiredOutput: text('desired_output').notNull().default('recommendation'),
  templateId: text('template_id'),
  agendaConfig: text('agenda_config').notNull().default('{}'),
  researchConfig: text('research_config').notNull().default('{}'),
  parentSessionId: text('parent_session_id'),
  decisionStatus: text('decision_status').notNull().default('draft'),
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

export const decisionSummaries = sqliteTable('decision_summaries', {
  sessionId: text('session_id').primaryKey(),
  content: text('content').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

export const researchRuns = sqliteTable('research_runs', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  status: text('status').notNull(),
  queryPlan: text('query_plan').notNull().default('[]'),
  searchConfig: text('search_config').notNull().default('{}'),
  summary: text('summary').notNull().default(''),
  evaluation: text('evaluation'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

export const researchSources = sqliteTable('research_sources', {
  id: text('id').primaryKey(),
  researchRunId: text('research_run_id').notNull(),
  title: text('title').notNull(),
  url: text('url').notNull(),
  domain: text('domain').notNull().default(''),
  snippet: text('snippet').notNull().default(''),
  score: real('score').notNull().default(0),
  selected: integer('selected').notNull().default(1),
  qualityFlags: text('quality_flags').notNull().default('[]'),
  publishedDate: text('published_date'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export const interjections = sqliteTable('interjections', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  content: text('content').notNull(),
  controlType: text('control_type').notNull().default('general'),
  phaseHint: text('phase_hint'),
  roundHint: integer('round_hint'),
  consumed: integer('consumed').notNull().default(0),
  consumedPhase: text('consumed_phase'),
  consumedRound: integer('consumed_round'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  consumedAt: integer('consumed_at', { mode: 'timestamp_ms' }),
});
