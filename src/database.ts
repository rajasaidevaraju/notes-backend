import Database from 'better-sqlite3';
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
// SQLite ships with FK enforcement off; without this, ON DELETE CASCADE
// (checklist_items, tracker_entries) silently leaves orphan rows
db.pragma('foreign_keys = ON');

function addColumnIfNotExists(tableName: string, columnName: string, columnDef: string): void {
  const tableInfo = db.prepare(`PRAGMA table_info(${tableName})`).all() as any[];
  const exists = tableInfo.some(row => row.name === columnName);

  if (!exists) {
    console.log(`Column "${columnName}" does not exist in ${tableName}. Adding it now...`);
    db.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`).run();
    console.log(`Column "${columnName}" added to ${tableName}.`);
  }
}

// Same shape as Date#toISOString(), so SQL defaults and app-written
// timestamps sort and parse identically.
const ISO_NOW = `(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

/**
 * Rows written before the app set its own timestamps got SQLite's
 * CURRENT_TIMESTAMP ("YYYY-MM-DD HH:MM:SS", UTC but zone-less). JS parses
 * that as local time and it string-sorts wrong against ISO values, so rewrite
 * it as ISO. Idempotent: only non-ISO rows match.
 */
function normalizeTimestamps(tableName: string, columns: string[]): void {
  for (const column of columns) {
    db.prepare(
      `UPDATE ${tableName} SET ${column} = strftime('%Y-%m-%dT%H:%M:%fZ', ${column})
       WHERE ${column} NOT LIKE '%T%' AND strftime('%Y-%m-%dT%H:%M:%fZ', ${column}) IS NOT NULL`
    ).run();
  }
}

/** Throws on failure; the caller decides whether that is fatal. */
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


export const dbQuery = (sql: string, params: any[] = []): any[] => {
  return db.prepare(sql).all(...params) as any[];
};

export const dbGet = (sql: string, params: any[] = []): any => {
  return db.prepare(sql).get(...params);
};

export const dbRun = (sql: string, params: any[] = []): { lastID: number; changes: number } => {
  const result = db.prepare(sql).run(...params);
  return {
    lastID: Number(result.lastInsertRowid),
    changes: result.changes
  };
};

/**
 * Runs fn in a transaction: atomic, and rolled back if fn throws. Because
 * everything inside is synchronous, no other request can interleave.
 */
export const tx = <T>(fn: () => T): T => db.transaction(fn)();

/**
 * Partial update: sets updatedAt plus every column whose value is not
 * undefined, so omitting a field always means "leave it alone". Booleans are
 * stored as 0/1. `table` and the column names are trusted identifiers.
 */
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

export { db, initializeDatabase };
