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

function addColumnIfNotExists(tableName: string, columnName: string, columnDef: string): void {
  const tableInfo = db.prepare(`PRAGMA table_info(${tableName})`).all() as any[];
  const exists = tableInfo.some(row => row.name === columnName);

  if (!exists) {
    console.log(`Column "${columnName}" does not exist in ${tableName}. Adding it now...`);
    db.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`).run();
    console.log(`Column "${columnName}" added to ${tableName}.`);
  }
}

function initializeDatabase(callback: (err: Error | null) => void) {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
        pinned INTEGER DEFAULT 0,
        hidden INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS checklists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
        pinned INTEGER DEFAULT 0,
        hidden INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS checklist_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        checklistId INTEGER,
        content TEXT NOT NULL,
        checked INTEGER DEFAULT 0,
        position INTEGER DEFAULT 0,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (checklistId) REFERENCES checklists(id) ON DELETE CASCADE
      );
    `);

    console.log('Database schema initialized or already exists.');

    addColumnIfNotExists('notes', 'pinned', 'INTEGER DEFAULT 0');
    addColumnIfNotExists('notes', 'hidden', 'INTEGER DEFAULT 0');
    addColumnIfNotExists('checklists', 'pinned', 'INTEGER DEFAULT 0');
    addColumnIfNotExists('checklists', 'hidden', 'INTEGER DEFAULT 0');

    callback(null);
  } catch (err) {
    console.error('Error initializing database:', err);
    callback(err as Error);
  }
}

export const dbQuery = async (sql: string, params: any[] = []): Promise<any[]> => {
  return db.prepare(sql).all(...params) as any[];
};

export const dbGet = async (sql: string, params: any[] = []): Promise<any> => {
  return db.prepare(sql).get(...params);
};

export const dbRun = async (sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> => {
  const result = db.prepare(sql).run(...params);
  return {
    lastID: Number(result.lastInsertRowid),
    changes: result.changes
  };
};

export { db, initializeDatabase };