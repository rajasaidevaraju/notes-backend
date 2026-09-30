import Database, { Statement } from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import 'dotenv/config';

const dbPath = process.env.DATABASE_PATH;

if (!dbPath) {
  console.error("DATABASE_PATH environment variable is not set.");
  process.exit(1);
}

const dbDirectory = path.dirname(dbPath);
if (!fs.existsSync(dbDirectory)) {
  fs.mkdirSync(dbDirectory, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

function columnsOf(tableName: string): Set<string> {
  const tableInfo = db.prepare(`PRAGMA table_info(${tableName})`).all() as any[];
  return new Set(tableInfo.map(row => row.name));
}

function addColumnIfNotExists(tableName: string, columnName: string, columnDef: string): void {
  if (!columnsOf(tableName).has(columnName)) {
    console.log(`Column "${columnName}" does not exist in ${tableName}. Adding it now...`);
    db.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`).run();
    console.log(`Column "${columnName}" added to ${tableName}.`);
  }
}

const ISO_NOW = `(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

function normalizeTimestamps(tableName: string, columns: string[]): void {
  const existing = columnsOf(tableName);
  for (const column of columns.filter(c => existing.has(c))) {
    db.prepare(
      `UPDATE ${tableName} SET ${column} = strftime('%Y-%m-%dT%H:%M:%fZ', ${column})
       WHERE ${column} NOT LIKE '%T%' AND strftime('%Y-%m-%dT%H:%M:%fZ', ${column}) IS NOT NULL`
    ).run();
  }
}

function initializeDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT,
      createdAt TEXT DEFAULT ${ISO_NOW},
      updatedAt TEXT DEFAULT ${ISO_NOW},
      pinned INTEGER DEFAULT 0,
      hidden INTEGER DEFAULT 0,
      archived INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS checklists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      createdAt TEXT DEFAULT ${ISO_NOW},
      updatedAt TEXT DEFAULT ${ISO_NOW},
      pinned INTEGER DEFAULT 0,
      hidden INTEGER DEFAULT 0,
      archived INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS checklist_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      checklistId INTEGER,
      content TEXT NOT NULL,
      checked INTEGER DEFAULT 0,
      position INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT ${ISO_NOW},
      updatedAt TEXT DEFAULT ${ISO_NOW},
      FOREIGN KEY (checklistId) REFERENCES checklists(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS trackers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      unit TEXT,
      createdAt TEXT DEFAULT ${ISO_NOW},
      updatedAt TEXT DEFAULT ${ISO_NOW},
      pinned INTEGER DEFAULT 0,
      hidden INTEGER DEFAULT 0,
      archived INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS tracker_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trackerId INTEGER,
      value TEXT NOT NULL,
      recordedAt TEXT DEFAULT ${ISO_NOW},
      FOREIGN KEY (trackerId) REFERENCES trackers(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_tracker_entries_tracker_time
      ON tracker_entries(trackerId, recordedAt DESC);

    CREATE INDEX IF NOT EXISTS idx_checklist_items_checklist_position
      ON checklist_items(checklistId, position);
  `);

  console.log('Database schema initialized or already exists.');

  addColumnIfNotExists('notes', 'pinned', 'INTEGER DEFAULT 0');
  addColumnIfNotExists('notes', 'hidden', 'INTEGER DEFAULT 0');
  addColumnIfNotExists('notes', 'archived', 'INTEGER DEFAULT 0');
  addColumnIfNotExists('checklists', 'pinned', 'INTEGER DEFAULT 0');
  addColumnIfNotExists('checklists', 'hidden', 'INTEGER DEFAULT 0');
  addColumnIfNotExists('checklists', 'archived', 'INTEGER DEFAULT 0');
  addColumnIfNotExists('trackers', 'archived', 'INTEGER DEFAULT 0');

  tx(() => {
    for (const table of ['notes', 'checklists', 'trackers', 'checklist_items']) {
      normalizeTimestamps(table, ['createdAt', 'updatedAt']);
    }
    normalizeTimestamps('tracker_entries', ['recordedAt']);
  });
}

const STATEMENT_CACHE_SIZE = 100;
const statementCache = new Map<string, Statement>();

const prepare = (sql: string): Statement => {
  let stmt = statementCache.get(sql);
  if (stmt) {
    statementCache.delete(sql);
  } else {
    stmt = db.prepare(sql);
    if (statementCache.size >= STATEMENT_CACHE_SIZE) {
      statementCache.delete(statementCache.keys().next().value!);
    }
  }
  statementCache.set(sql, stmt);
  return stmt;
};

export const dbQuery = (sql: string, params: any[] = []): any[] => {
  return prepare(sql).all(...params) as any[];
};

export const dbGet = (sql: string, params: any[] = []): any => {
  return prepare(sql).get(...params);
};

export const dbRun = (sql: string, params: any[] = []): { lastID: number; changes: number } => {
  const result = prepare(sql).run(...params);
  return {
    lastID: Number(result.lastInsertRowid),
    changes: result.changes
  };
};

export const tx = <T>(fn: () => T): T => db.transaction(fn)();

export const updateRow = (table: string, id: number, columns: Record<string, unknown>): void => {
  const set = Object.entries(columns).filter(([, value]) => typeof value !== 'undefined');
  const assignments = ['updatedAt = ?', ...set.map(([column]) => `${column} = ?`)];
  const params = [
    new Date().toISOString(),
    ...set.map(([, value]) => (typeof value === 'boolean' ? Number(value) : value)),
    id,
  ];

  dbRun(`UPDATE ${table} SET ${assignments.join(', ')} WHERE id = ?`, params);
};

export interface ContentCounts {
  hidden: number;
  archived: number;
}

export const COUNT_COLUMNS =
  'COALESCE(SUM(hidden = 1 AND archived = 0), 0) AS hidden, COALESCE(SUM(archived = 1), 0) AS archived';

export { db, initializeDatabase };
