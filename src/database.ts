import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

import 'dotenv/config';

const dbPath = process.env.DATABASE_PATH;

if (!dbPath) {
  console.error("DATABASE_PATH environment variable is not set.");
  process.exit(1);
}

// Ensure the directory for the database file exists
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
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('Database schema initialized or already exists.');
}

initializeDatabase();

export default db;