import sqlite3 from 'sqlite3';
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

const db = new sqlite3.Database(dbPath, (err: Error | null) => {
  if (err) {
    console.error('Error opening SQLite database:', err.message);
    process.exit(1);
  }
});

function addColumnIfNotExists(db: sqlite3.Database, tableName: string, columnName: string, columnDef: string): Promise<void> {
  return new Promise((resolve, reject) => {
    db.all(`PRAGMA table_info(${tableName})`, (err, rows: any[]) => {
      if (err) return reject(err);
      const exists = rows.some(row => row.name === columnName);
      if (!exists) {
        console.log(`Column "${columnName}" does not exist in ${tableName}. Adding it now...`);
        db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`, (err) => {
          if (err) return reject(err);
          console.log(`Column "${columnName}" added to ${tableName}.`);
          resolve();
        });
      } else {
        resolve();
      }
    });
  });
}

function initializeDatabase(db: sqlite3.Database, callback: (err: Error | null) => void) {
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
  `, (err: Error | null) => {
    if (err) {
      console.error('Error creating tables:', err.message);
      callback(err);
      return;
    }
    console.log('Database schema initialized or already exists.');

    const migrations = [
      addColumnIfNotExists(db, 'notes', 'pinned', 'INTEGER DEFAULT 0'),
      addColumnIfNotExists(db, 'notes', 'hidden', 'INTEGER DEFAULT 0'),
      addColumnIfNotExists(db, 'checklists', 'pinned', 'INTEGER DEFAULT 0'),
      addColumnIfNotExists(db, 'checklists', 'hidden', 'INTEGER DEFAULT 0'),
    ];

    Promise.all(migrations)
      .then(() => callback(null))
      .catch(err => {
        console.error('Error performing migrations:', err);
        callback(err);
      });
  });
}

export const dbQuery = (sql: string, params: any[] = []): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

export const dbGet = (sql: string, params: any[] = []): Promise<any> => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

export const dbRun = (sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

export { db, initializeDatabase };