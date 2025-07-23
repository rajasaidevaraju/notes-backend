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

function initializeDatabase(callback: () => void) {
  db.run(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
      pinned INTEGER DEFAULT 0,
      hidden INTEGER DEFAULT 0
    );
  `, (err: Error | null) => {
    if (err) {
      console.error('Error creating table:', err.message);
      callback();
      return;
    }
    console.log('Database schema initialized or already exists.');
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='notes'", (err: Error | null, row: any) => {
      if (err) {
        console.error('Error checking table existence:', err.message);
        callback();
        return;
      }
      if (!row) {
        console.error('Table "notes" does not exist after creation attempt.');
        callback();
        return;
      }
      db.all("PRAGMA table_info(notes)", (err: Error | null, rows: any[]) => {
        if (err || !rows) {
          console.error('Error checking table schema:', err ? err.message : 'No rows returned');
          callback();
          return;
        }
        const hasPinned = rows.some(row => row.name === 'pinned');
        if (!hasPinned) {
          console.log('Column "pinned" does not exist. Adding it now...');
          db.run(`ALTER TABLE notes ADD COLUMN pinned INTEGER DEFAULT 0`, (err: Error | null) => {
            if (err) {
              console.error('Error adding pinned column:', err.message);
            } else {
              console.log('Column "pinned" added successfully with default value 0.');
            }
            callback();
          });
        } else {
          callback();
        }
        const hasHidden = rows.some(row => row.name === 'hidden');
        if (!hasHidden) {
          console.log('Column "hidden" does not exist. Adding it now...');
          db.run(`ALTER TABLE notes ADD COLUMN hidden INTEGER DEFAULT 0`, (err: Error | null) => {
            if (err) {
              console.error('Error adding hidden column:', err.message);
            } else {
              console.log('Column "hidden" added successfully with default value 0.');
            }
            callback();
          });
        } else {
          callback();
        }
      });
    });
  });
}

export { db, initializeDatabase };