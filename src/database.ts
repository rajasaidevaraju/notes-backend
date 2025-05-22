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

function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
      pinned INTEGER DEFAULT 0
    );
  `);
  console.log('Database schema initialized or already exists.');

  // Check if 'pinned' column exists, and add it if not
  try {
    db.prepare("SELECT pinned FROM notes LIMIT 1").get();
  } catch (error: any) {
    if (error.message.includes('no such column: pinned')) {
      console.log('Column "pinned" does not exist. Adding it now...');
      db.exec(`ALTER TABLE notes ADD COLUMN pinned INTEGER DEFAULT 0`);
      console.log('Column "pinned" added successfully with default value 0.');
    } else {
      console.error('Error checking for "pinned" column:', error.message);
    }
  }
}

initializeDatabase();

export default db;
