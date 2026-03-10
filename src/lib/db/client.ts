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
  decision_type TEXT NOT NULL DEFAULT 'general',
  desired_output TEXT NOT NULL DEFAULT 'recommendation',
  template_id TEXT,
  agenda_config TEXT NOT NULL DEFAULT '{}',
  research_config TEXT NOT NULL DEFAULT '{}',
  parent_session_id TEXT,
  decision_status TEXT NOT NULL DEFAULT 'draft',
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
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS research_sources (
  id TEXT PRIMARY KEY,
  research_run_id TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  domain TEXT NOT NULL DEFAULT '',
  snippet TEXT NOT NULL DEFAULT '',
  score REAL NOT NULL DEFAULT 0,
  selected INTEGER NOT NULL DEFAULT 1,
  quality_flags TEXT NOT NULL DEFAULT '[]',
  published_date TEXT,
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
ensureColumn('sessions', 'decision_type', "TEXT NOT NULL DEFAULT 'general'");
ensureColumn(
  'sessions',
  'desired_output',
  "TEXT NOT NULL DEFAULT 'recommendation'"
);
ensureColumn('sessions', 'template_id', 'TEXT');
ensureColumn('sessions', 'agenda_config', "TEXT NOT NULL DEFAULT '{}'");
ensureColumn('sessions', 'research_config', "TEXT NOT NULL DEFAULT '{}'");
ensureColumn('sessions', 'parent_session_id', 'TEXT');
ensureColumn('sessions', 'decision_status', "TEXT NOT NULL DEFAULT 'draft'");
ensureColumn('sessions', 'usage_input_tokens', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('sessions', 'usage_output_tokens', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('sessions', 'stop_requested', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('interjections', 'control_type', "TEXT NOT NULL DEFAULT 'general'");

export const sqliteDb = sqlite;
export const db = drizzle(sqlite);
