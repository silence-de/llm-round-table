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

export const taskLedgerCheckpoints = sqliteTable('task_ledger_checkpoints', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  phase: text('phase').notNull(),
  ledgerVersion: integer('ledger_version').notNull().default(1),
  ledgerJson: text('ledger_json').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export const ledgerValidationMetrics = sqliteTable('ledger_validation_metrics', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  coverageRate: real('coverage_rate').notNull().default(0),
  coveredCount: integer('covered_count').notNull().default(0),
  totalCount: integer('total_count').notNull().default(0),
  coveragePassed: integer('coverage_passed').notNull().default(0),
  riskCount: integer('risk_count').notNull().default(0),
  highSeverityCount: integer('high_severity_count').notNull().default(0),
  overallPassed: integer('overall_passed').notNull().default(0),
  evaluatedAt: integer('evaluated_at', { mode: 'timestamp_ms' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export const judgeEvaluations = sqliteTable('judge_evaluations', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  summaryVersion: integer('summary_version').notNull().default(1),
  passedCount: integer('passed_count').notNull().default(0),
  totalDimensions: integer('total_dimensions').notNull().default(4),
  overallPassed: integer('overall_passed').notNull().default(0),
  gate: text('gate').notNull().default('PASS'),           // 'PASS' | 'REWRITE' | 'ESCALATE'
  rewriteInstructionsJson: text('rewrite_instructions_json').notNull().default('[]'),
  escalateReason: text('escalate_reason').notNull().default(''),
  dimensionsJson: text('dimensions_json').notNull().default('[]'),
  // ops calibration fields (T3-4)
  humanReviewResult: text('human_review_result'),         // 'PASS' | 'FAIL' | null
  humanReviewerId: text('human_reviewer_id'),
  reviewedAt: integer('reviewed_at', { mode: 'timestamp_ms' }),
  agreement: integer('agreement'),                        // 1 = agree, 0 = disagree, null = not reviewed
  evaluatedAt: integer('evaluated_at', { mode: 'timestamp_ms' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export const summaryVersions = sqliteTable('summary_versions', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  version: integer('version').notNull().default(1),
  summaryJson: text('summary_json').notNull(),
  rewriteTriggered: integer('rewrite_triggered').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

// ── Topic 6: Decision Memory Tables ───────────────────────────────

export const sessionReflections = sqliteTable('session_reflections', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().unique(),
  generatedAt: integer('generated_at', { mode: 'timestamp_ms' }).notNull(),
  decisionSummary: text('decision_summary').notNull().default(''),
  assumptionsJson: text('assumptions_json').notNull().default('[]'),
  evidenceGapsJson: text('evidence_gaps_json').notNull().default('[]'),
  forecastItemsJson: text('forecast_items_json').notNull().default('[]'),
  lessonsCandidateJson: text('lessons_candidate_json').notNull().default('[]'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

export const lessons = sqliteTable('lessons', {
  id: text('id').primaryKey(),
  rule: text('rule').notNull(),
  applicabilityConditions: text('applicability_conditions').notNull().default(''),
  evidenceBasisJson: text('evidence_basis_json').notNull().default('[]'),
  patternCount: integer('pattern_count').notNull().default(1),
  reviewAfterSessions: integer('review_after_sessions').notNull().default(5),
  autoFlagIfContradicted: integer('auto_flag_if_contradicted').notNull().default(1),
  conflictMarker: text('conflict_marker'),
  status: text('status').notNull().default('candidate'), // candidate | active | expired | contradicted
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});
