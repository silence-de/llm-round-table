import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  topic: text('topic').notNull(),
  goal: text('goal').notNull().default(''),
  background: text('background').notNull().default(''),
  constraints: text('constraints').notNull().default(''),
  timeHorizon: text('time_horizon').notNull().default(''),
  nonNegotiables: text('non_negotiables').notNull().default(''),
  acceptableDownside: text('acceptable_downside').notNull().default(''),
  reviewAt: text('review_at'),
  decisionType: text('decision_type').notNull().default('general'),
  desiredOutput: text('desired_output').notNull().default('recommendation'),
  templateId: text('template_id'),
  agendaConfig: text('agenda_config').notNull().default('{}'),
  researchConfig: text('research_config').notNull().default('{}'),
  parentSessionId: text('parent_session_id'),
  resumedFromSessionId: text('resumed_from_session_id'),
  resumeSnapshot: text('resume_snapshot'),
  decisionStatus: text('decision_status').notNull().default('draft'),
  retrospectiveNote: text('retrospective_note').notNull().default(''),
  outcomeSummary: text('outcome_summary').notNull().default(''),
  actualOutcome: text('actual_outcome').notNull().default(''),
  outcomeConfidence: integer('outcome_confidence').notNull().default(0),
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
  predictedConfidence: integer('predicted_confidence').notNull().default(0),
  supportedOnly: integer('supported_only').notNull().default(0),
  evidenceSourceCount: integer('evidence_source_count').notNull().default(0),
  unsupportedClaimCount: integer('unsupported_claim_count').notNull().default(0),
  unresolvedEvidenceCount: integer('unresolved_evidence_count').notNull().default(0),
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
  rerunCount: integer('rerun_count').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

export const researchSources = sqliteTable('research_sources', {
  id: text('id').primaryKey(),
  researchRunId: text('research_run_id').notNull(),
  sourceType: text('source_type').notNull().default('research'),
  verificationProfile: text('verification_profile'),
  title: text('title').notNull(),
  url: text('url').notNull(),
  domain: text('domain').notNull().default(''),
  snippet: text('snippet').notNull().default(''),
  score: real('score').notNull().default(0),
  selected: integer('selected').notNull().default(1),
  pinned: integer('pinned').notNull().default(0),
  rank: integer('rank').notNull().default(0),
  excludedReason: text('excluded_reason').notNull().default(''),
  stale: integer('stale').notNull().default(0),
  qualityFlags: text('quality_flags').notNull().default('[]'),
  publishedDate: text('published_date'),
  capturedAt: integer('captured_at', { mode: 'timestamp_ms' }),
  snapshotPath: text('snapshot_path'),
  claimHint: text('claim_hint'),
  note: text('note'),
  verificationNotes: text('verification_notes').notNull().default('[]'),
  verifiedFields: text('verified_fields').notNull().default('[]'),
  extractionMethod: text('extraction_method'),
  extractionQuality: text('extraction_quality'),
  captureStatus: text('capture_status'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export const actionItems = sqliteTable('action_items', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  sourceActionId: text('source_action_id'),
  content: text('content').notNull(),
  status: text('status').notNull().default('pending'),
  source: text('source').notNull().default('generated'),
  carriedFromSessionId: text('carried_from_session_id'),
  note: text('note').notNull().default(''),
  owner: text('owner').notNull().default(''),
  dueAt: integer('due_at', { mode: 'timestamp_ms' }),
  verifiedAt: integer('verified_at', { mode: 'timestamp_ms' }),
  verificationNote: text('verification_note').notNull().default(''),
  priority: text('priority').notNull().default('medium'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

export const decisionClaims = sqliteTable('decision_claims', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  claim: text('claim').notNull(),
  kind: text('kind').notNull().default('evidence'),
  gapReason: text('gap_reason').notNull().default(''),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export const claimSourceLinks = sqliteTable('claim_source_links', {
  id: text('id').primaryKey(),
  claimId: text('claim_id').notNull(),
  sourceId: text('source_id').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export const sessionEvents = sqliteTable('session_events', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  type: text('type').notNull(),
  provider: text('provider'),
  modelId: text('model_id'),
  phase: text('phase'),
  agentId: text('agent_id'),
  timeoutType: text('timeout_type'),
  message: text('message').notNull().default(''),
  metadata: text('metadata').notNull().default('{}'),
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

export const agentReplyArtifacts = sqliteTable('agent_reply_artifacts', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  agentId: text('agent_id').notNull(),
  phase: text('phase').notNull(),
  round: integer('round'),
  schemaVersion: text('schema_version').notNull(),
  artifactJson: text('artifact_json').notNull(),
  parseSuccess: integer('parse_success').notNull(),
  citationResolveRate: real('citation_resolve_rate'),
  warnings: text('warnings').notNull().default('[]'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});
