import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

const configuredDbPath = process.env.ROUND_TABLE_DB_PATH?.trim();
const dataDir = process.env.ROUND_TABLE_DATA_DIR?.trim()
  ? path.resolve(process.env.ROUND_TABLE_DATA_DIR)
  : path.join(process.cwd(), 'data');
const dbPath = configuredDbPath
  ? path.resolve(configuredDbPath)
  : path.join(dataDir, 'round-table.db');
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const sqlite = new Database(dbPath);

sqlite.exec(`
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,
  goal TEXT NOT NULL DEFAULT '',
  background TEXT NOT NULL DEFAULT '',
  constraints TEXT NOT NULL DEFAULT '',
  time_horizon TEXT NOT NULL DEFAULT '',
  non_negotiables TEXT NOT NULL DEFAULT '',
  acceptable_downside TEXT NOT NULL DEFAULT '',
  review_at TEXT,
  decision_type TEXT NOT NULL DEFAULT 'general',
  desired_output TEXT NOT NULL DEFAULT 'recommendation',
  template_id TEXT,
  agenda_config TEXT NOT NULL DEFAULT '{}',
  research_config TEXT NOT NULL DEFAULT '{}',
  parent_session_id TEXT,
  resumed_from_session_id TEXT,
  resume_snapshot TEXT,
  decision_status TEXT NOT NULL DEFAULT 'draft',
  retrospective_note TEXT NOT NULL DEFAULT '',
  outcome_summary TEXT NOT NULL DEFAULT '',
  actual_outcome TEXT NOT NULL DEFAULT '',
  outcome_confidence INTEGER NOT NULL DEFAULT 0,
  moderator_agent_id TEXT NOT NULL,
  max_debate_rounds INTEGER NOT NULL,
  selected_agent_ids TEXT NOT NULL DEFAULT '[]',
  model_selections TEXT NOT NULL DEFAULT '{}',
  persona_selections TEXT NOT NULL DEFAULT '{}',
  personas TEXT NOT NULL DEFAULT '{}',
  usage_input_tokens INTEGER NOT NULL DEFAULT 0,
  usage_output_tokens INTEGER NOT NULL DEFAULT 0,
  stop_requested INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  agent_id TEXT,
  display_name TEXT,
  phase TEXT NOT NULL,
  round INTEGER,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS minutes (
  session_id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS decision_summaries (
  session_id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  predicted_confidence INTEGER NOT NULL DEFAULT 0,
  supported_only INTEGER NOT NULL DEFAULT 0,
  evidence_source_count INTEGER NOT NULL DEFAULT 0,
  unsupported_claim_count INTEGER NOT NULL DEFAULT 0,
  unresolved_evidence_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS research_runs (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  status TEXT NOT NULL,
  query_plan TEXT NOT NULL DEFAULT '[]',
  search_config TEXT NOT NULL DEFAULT '{}',
  summary TEXT NOT NULL DEFAULT '',
  evaluation TEXT,
  rerun_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS research_sources (
  id TEXT PRIMARY KEY,
  research_run_id TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'research',
  verification_profile TEXT,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  domain TEXT NOT NULL DEFAULT '',
  snippet TEXT NOT NULL DEFAULT '',
  score REAL NOT NULL DEFAULT 0,
  selected INTEGER NOT NULL DEFAULT 1,
  pinned INTEGER NOT NULL DEFAULT 0,
  rank INTEGER NOT NULL DEFAULT 0,
  excluded_reason TEXT NOT NULL DEFAULT '',
  stale INTEGER NOT NULL DEFAULT 0,
  quality_flags TEXT NOT NULL DEFAULT '[]',
  published_date TEXT,
  captured_at INTEGER,
  snapshot_path TEXT,
  claim_hint TEXT,
  note TEXT,
  verification_notes TEXT NOT NULL DEFAULT '[]',
  verified_fields TEXT NOT NULL DEFAULT '[]',
  extraction_method TEXT,
  extraction_quality TEXT,
  capture_status TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS action_items (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  source_action_id TEXT,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  source TEXT NOT NULL DEFAULT 'generated',
  carried_from_session_id TEXT,
  note TEXT NOT NULL DEFAULT '',
  owner TEXT NOT NULL DEFAULT '',
  due_at INTEGER,
  verified_at INTEGER,
  verification_note TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'medium',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS decision_claims (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  claim TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'evidence',
  gap_reason TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS claim_source_links (
  id TEXT PRIMARY KEY,
  claim_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS session_events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  type TEXT NOT NULL,
  provider TEXT,
  model_id TEXT,
  phase TEXT,
  agent_id TEXT,
  timeout_type TEXT,
  message TEXT NOT NULL DEFAULT '',
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS interjections (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  content TEXT NOT NULL,
  control_type TEXT NOT NULL DEFAULT 'general',
  phase_hint TEXT,
  round_hint INTEGER,
  consumed INTEGER NOT NULL DEFAULT 0,
  consumed_phase TEXT,
  consumed_round INTEGER,
  created_at INTEGER NOT NULL,
  consumed_at INTEGER
);

CREATE TABLE IF NOT EXISTS agent_reply_artifacts (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  phase TEXT NOT NULL,
  round INTEGER,
  schema_version TEXT NOT NULL,
  artifact_json TEXT NOT NULL,
  parse_success INTEGER NOT NULL,
  citation_resolve_rate REAL,
  warnings TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_artifact_session_agent ON agent_reply_artifacts(session_id, agent_id);
CREATE INDEX IF NOT EXISTS idx_artifact_phase_round ON agent_reply_artifacts(phase, round);

CREATE TABLE IF NOT EXISTS task_ledger_checkpoints (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  phase TEXT NOT NULL,
  ledger_version INTEGER NOT NULL DEFAULT 1,
  ledger_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ledger_checkpoints_session ON task_ledger_checkpoints(session_id);

CREATE TABLE IF NOT EXISTS ledger_validation_metrics (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  coverage_rate REAL NOT NULL DEFAULT 0,
  covered_count INTEGER NOT NULL DEFAULT 0,
  total_count INTEGER NOT NULL DEFAULT 0,
  coverage_passed INTEGER NOT NULL DEFAULT 0,
  risk_count INTEGER NOT NULL DEFAULT 0,
  high_severity_count INTEGER NOT NULL DEFAULT 0,
  overall_passed INTEGER NOT NULL DEFAULT 0,
  evaluated_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ledger_validation_session ON ledger_validation_metrics(session_id);

CREATE TABLE IF NOT EXISTS judge_evaluations (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  summary_version INTEGER NOT NULL DEFAULT 1,
  passed_count INTEGER NOT NULL DEFAULT 0,
  total_dimensions INTEGER NOT NULL DEFAULT 4,
  overall_passed INTEGER NOT NULL DEFAULT 0,
  dimensions_json TEXT NOT NULL DEFAULT '[]',
  evaluated_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS summary_versions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  summary_json TEXT NOT NULL,
  rewrite_triggered INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_judge_evaluations_session ON judge_evaluations(session_id);
CREATE INDEX IF NOT EXISTS idx_summary_versions_session ON summary_versions(session_id);
`);

// Lightweight in-place migrations for existing local DB files.
const ensureColumn = (table: string, column: string, definition: string) => {
  const columns = sqlite
    .prepare(`PRAGMA table_info(${table})`)
    .all() as Array<{ name: string }>;
  if (!columns.some((c) => c.name === column)) {
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
};

ensureColumn('sessions', 'selected_agent_ids', "TEXT NOT NULL DEFAULT '[]'");
ensureColumn('sessions', 'model_selections', "TEXT NOT NULL DEFAULT '{}'");
ensureColumn('sessions', 'persona_selections', "TEXT NOT NULL DEFAULT '{}'");
ensureColumn('sessions', 'personas', "TEXT NOT NULL DEFAULT '{}'");
ensureColumn('sessions', 'goal', "TEXT NOT NULL DEFAULT ''");
ensureColumn('sessions', 'background', "TEXT NOT NULL DEFAULT ''");
ensureColumn('sessions', 'constraints', "TEXT NOT NULL DEFAULT ''");
ensureColumn('sessions', 'time_horizon', "TEXT NOT NULL DEFAULT ''");
ensureColumn('sessions', 'non_negotiables', "TEXT NOT NULL DEFAULT ''");
ensureColumn('sessions', 'acceptable_downside', "TEXT NOT NULL DEFAULT ''");
ensureColumn('sessions', 'review_at', 'TEXT');
ensureColumn('sessions', 'decision_type', "TEXT NOT NULL DEFAULT 'general'");
ensureColumn(
  'sessions',
  'desired_output',
  "TEXT NOT NULL DEFAULT 'recommendation'"
);
ensureColumn('sessions', 'template_id', 'TEXT');
ensureColumn('sessions', 'agenda_config', "TEXT NOT NULL DEFAULT '{}'");
ensureColumn('sessions', 'research_config', "TEXT NOT NULL DEFAULT '{}'");
ensureColumn(
  'decision_summaries',
  'predicted_confidence',
  'INTEGER NOT NULL DEFAULT 0'
);
ensureColumn(
  'decision_summaries',
  'supported_only',
  'INTEGER NOT NULL DEFAULT 0'
);
ensureColumn(
  'decision_summaries',
  'evidence_source_count',
  'INTEGER NOT NULL DEFAULT 0'
);
ensureColumn(
  'decision_summaries',
  'unsupported_claim_count',
  'INTEGER NOT NULL DEFAULT 0'
);
ensureColumn(
  'decision_summaries',
  'unresolved_evidence_count',
  'INTEGER NOT NULL DEFAULT 0'
);
ensureColumn('sessions', 'parent_session_id', 'TEXT');
ensureColumn('sessions', 'resumed_from_session_id', 'TEXT');
ensureColumn('sessions', 'resume_snapshot', 'TEXT');
ensureColumn('sessions', 'decision_status', "TEXT NOT NULL DEFAULT 'draft'");
ensureColumn('sessions', 'retrospective_note', "TEXT NOT NULL DEFAULT ''");
ensureColumn('sessions', 'outcome_summary', "TEXT NOT NULL DEFAULT ''");
ensureColumn('sessions', 'actual_outcome', "TEXT NOT NULL DEFAULT ''");
ensureColumn('sessions', 'outcome_confidence', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('sessions', 'usage_input_tokens', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('sessions', 'usage_output_tokens', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('sessions', 'stop_requested', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('interjections', 'control_type', "TEXT NOT NULL DEFAULT 'general'");
ensureColumn('research_runs', 'rerun_count', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('research_sources', 'source_type', "TEXT NOT NULL DEFAULT 'research'");
ensureColumn('research_sources', 'pinned', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('research_sources', 'rank', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('research_sources', 'excluded_reason', "TEXT NOT NULL DEFAULT ''");
ensureColumn('research_sources', 'stale', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('research_sources', 'captured_at', 'INTEGER');
ensureColumn('research_sources', 'snapshot_path', 'TEXT');
ensureColumn('research_sources', 'verification_profile', 'TEXT');
ensureColumn('research_sources', 'claim_hint', 'TEXT');
ensureColumn('research_sources', 'note', 'TEXT');
ensureColumn(
  'research_sources',
  'verification_notes',
  "TEXT NOT NULL DEFAULT '[]'"
);
ensureColumn(
  'research_sources',
  'verified_fields',
  "TEXT NOT NULL DEFAULT '[]'"
);
ensureColumn('research_sources', 'extraction_method', 'TEXT');
ensureColumn('research_sources', 'extraction_quality', 'TEXT');
ensureColumn('research_sources', 'capture_status', 'TEXT');
ensureColumn('action_items', 'owner', "TEXT NOT NULL DEFAULT ''");
ensureColumn('action_items', 'source_action_id', 'TEXT');
ensureColumn('action_items', 'due_at', 'INTEGER');
ensureColumn('action_items', 'verified_at', 'INTEGER');
ensureColumn(
  'action_items',
  'verification_note',
  "TEXT NOT NULL DEFAULT ''"
);
ensureColumn('action_items', 'priority', "TEXT NOT NULL DEFAULT 'medium'");
ensureColumn('decision_claims', 'gap_reason', "TEXT NOT NULL DEFAULT ''");

// task_ledger_checkpoints is created fresh, no migrations needed yet

export const sqliteDb = sqlite;
export const db = drizzle(sqlite);
