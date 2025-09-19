import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import {initializeDatabase} from './../src/database'
const testDbPath = path.join(__dirname, '..', 'data', 'test.db');

const testDbDirectory = path.dirname(testDbPath);
if (!fs.existsSync(testDbDirectory)) {
  fs.mkdirSync(testDbDirectory, { recursive: true });
}

const testDb = new sqlite3.Database(testDbPath, (err: Error | null) => {
  if (err) {
    console.error('Error opening test SQLite database:', err.message);
    process.exit(1);
  }
  console.log('Connected to test SQLite database.');
});

const dummyNotes = [
  {
    title: 'Welcome Note',
    content: 'This is a welcome note for testing purposes.',
    createdAt: '2025-08-01 10:00:00',
    updatedAt: '2025-08-01 10:00:00',
    pinned: 1,
    hidden: 0,
  },
  {
    title: 'Hidden Note',
    content: 'This note is hidden and should only appear in hidden notes API.',
    createdAt: '2025-08-02 12:30:00',
    updatedAt: '2025-08-02 12:30:00',
    pinned: 0,
    hidden: 1,
  },
  {
    title: 'Project Ideas',
    content: 'List of project ideas:\n1. Build a task manager\n2. Create a blog platform\n3. Develop a chatbot',
    createdAt: '2025-08-03 09:15:00',
    updatedAt: '2025-08-03 09:15:00',
    pinned: 0,
    hidden: 0,
  },
  {
    title: 'Meeting Notes',
    content: 'Meeting with team on 2025-08-04. Discussed project timelines and resource allocation.',
    createdAt: '2025-08-04 14:20:00',
    updatedAt: '2025-08-05 16:45:00',
    pinned: 1,
    hidden: 0,
  },
  {
    title: 'Clipboard',
    content: 'Temporary content copied to clipboard.',
    createdAt: '2025-08-05 08:00:00',
    updatedAt: '2025-08-05 08:00:00',
    pinned: 1,
    hidden: 0,
  },
  {
    title: 'A'.repeat(255),
    content: 'This note has an extremely long title to test maximum title length constraints in the database or UI rendering. '.repeat(10),
    createdAt: '2025-08-06 15:00:00',
    updatedAt: '2025-08-06 15:00:00',
    pinned: 0,
    hidden: 0,
  },
  {
    title: 'Large Content Note',
    content: 'This is a very large note to test content size limits. '.repeat(100) + '\nAdditional data: ' + 'X'.repeat(50),
    createdAt: '2025-08-07 09:30:00',
    updatedAt: '2025-08-07 09:30:00',
    pinned: 0,
    hidden: 1,
  },
  {
    title: 'Edge Case Date Note',
    content: 'Testing with an extreme future date to check timestamp handling.',
    createdAt: '9999-12-31 23:59:59',
    updatedAt: '9999-12-31 23:59:59',
    pinned: 1,
    hidden: 0,
  },
  {
    title: 'Unicode and Special Characters',
    content: 'This note contains special characters: 😊🚀\nUnicode: 日本語, 中文, Русский\nSymbols: @#$%^&*()',
    createdAt: '2025-08-08 11:11:11',
    updatedAt: '2025-08-08 11:11:11',
    pinned: 0,
    hidden: 0,
  },
  {
    title: '',
    content: 'This note has an empty title to test how the system handles missing or empty title fields.',
    createdAt: '2025-08-09 12:00:00',
    updatedAt: '2025-08-09 12:00:00',
    pinned: 0,
    hidden: 1,
  }
];

function populateTestDatabase() {

  initializeDatabase(testDb,() => {
    console.log('Test database schema initialized.');

    testDb.run(`DELETE FROM notes`, function (err) {
      if (err) {
        console.error('Error clearing table:', err.message);
        testDb.close();
        return;
      }
      console.log(`All rows deleted from notes table. Rows affected: ${this.changes}`);

      testDb.run('INSERT INTO notes (title, content, pinned) VALUES (?, ?, ?)', ['Clipboard', '', 1], (err: Error | null) => {
        if (err) {
          console.error('Error creating clipboard note:', err.message);
          testDb.close();
          return;
        }
        console.log('Inserted Clipboard note.');

        const insertStmt = testDb.prepare(
          'INSERT OR IGNORE INTO notes (title, content, createdAt, updatedAt, pinned, hidden) VALUES (?, ?, ?, ?, ?, ?)'
        );

        let completed = 0;
        const total = dummyNotes.length;

        dummyNotes.forEach((note) => {
          insertStmt.run(note.title, note.content, note.createdAt, note.updatedAt, note.pinned, note.hidden, (err: Error | null) => {
            if (err) {
              console.error(`Error inserting note "${note.title}":`, err.message);
            } else {
              console.log(`Inserted note: "${note.title}"`);
            }
            completed++;
            if (completed === total) {
              insertStmt.finalize((err: Error | null) => {
                if (err) {
                  console.error('Error finalizing insert statement:', err.message);
                }
                testDb.close((err: Error | null) => {
                  if (err) {
                    console.error('Error closing test SQLite database:', err.message);
                  } else {
                    console.log('Test database population complete. Connection closed.');
                  }
                });
              });
            }
          });
        });
      });
    });
  });
}

populateTestDatabase();