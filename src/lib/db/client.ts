import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'round-table.db');
const sqlite = new Database(dbPath);

sqlite.exec(`
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,
  moderator_agent_id TEXT NOT NULL,
  max_debate_rounds INTEGER NOT NULL,
  selected_agent_ids TEXT NOT NULL DEFAULT '[]',
  model_selections TEXT NOT NULL DEFAULT '{}',
  personas TEXT NOT NULL DEFAULT '{}',
  usage_input_tokens INTEGER NOT NULL DEFAULT 0,
  usage_output_tokens INTEGER NOT NULL DEFAULT 0,
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
ensureColumn('sessions', 'personas', "TEXT NOT NULL DEFAULT '{}'");
ensureColumn('sessions', 'usage_input_tokens', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('sessions', 'usage_output_tokens', 'INTEGER NOT NULL DEFAULT 0');

export const sqliteDb = sqlite;
export const db = drizzle(sqlite);
