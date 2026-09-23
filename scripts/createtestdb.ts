import path from 'path';
import fs from 'fs';

// Populate a dedicated test database with fixtures. The db module opens
// DATABASE_PATH the moment it loads, so point it at the test file *before*
// requiring it (require, not import, to guarantee this runs first).
const testDbPath = path.join(__dirname, '..', 'data', 'test.db');
fs.mkdirSync(path.dirname(testDbPath), { recursive: true });
process.env.DATABASE_PATH = testDbPath;

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { db, initializeDatabase } = require('../src/database');

interface DummyNote {
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  pinned: number;
  hidden: number;
}

const dummyNotes: DummyNote[] = [
  {
    title: 'Welcome Note',
    content: 'This is a welcome note for testing purposes.',
    createdAt: '2025-08-01T10:00:00.000Z',
    updatedAt: '2025-08-01T10:00:00.000Z',
    pinned: 1,
    hidden: 0,
  },
  {
    title: 'Hidden Note',
    content: 'This note is hidden and should only appear in hidden notes API.',
    createdAt: '2025-08-02T12:30:00.000Z',
    updatedAt: '2025-08-02T12:30:00.000Z',
    pinned: 0,
    hidden: 1,
  },
  {
    title: 'Project Ideas',
    content: 'List of project ideas:\n1. Build a task manager\n2. Create a blog platform\n3. Develop a chatbot',
    createdAt: '2025-08-03T09:15:00.000Z',
    updatedAt: '2025-08-03T09:15:00.000Z',
    pinned: 0,
    hidden: 0,
  },
  {
    title: 'Meeting Notes',
    content: 'Meeting with team on 2025-08-04. Discussed project timelines and resource allocation.',
    createdAt: '2025-08-04T14:20:00.000Z',
    updatedAt: '2025-08-05T16:45:00.000Z',
    pinned: 1,
    hidden: 0,
  },
  {
    title: 'Clipboard',
    content: 'Temporary content copied to clipboard.',
    createdAt: '2025-08-05T08:00:00.000Z',
    updatedAt: '2025-08-05T08:00:00.000Z',
    pinned: 1,
    hidden: 0,
  },
  {
    title: 'Unicode and Special Characters',
    content: 'This note contains special characters: 😊🚀\nUnicode: 日本語, 中文, Русский\nSymbols: @#$%^&*()',
    createdAt: '2025-08-08T11:11:11.000Z',
    updatedAt: '2025-08-08T11:11:11.000Z',
    pinned: 0,
    hidden: 0,
  },
];

try {
  initializeDatabase();
} catch (err: any) {
  console.error('Failed to initialize test database:', err.message);
  process.exit(1);
}

try {
  db.prepare('DELETE FROM notes').run();

  const insert = db.prepare(
    'INSERT INTO notes (title, content, createdAt, updatedAt, pinned, hidden) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const insertMany = db.transaction((notes: DummyNote[]) => {
    for (const n of notes) {
      insert.run(n.title, n.content, n.createdAt, n.updatedAt, n.pinned, n.hidden);
    }
  });
  insertMany(dummyNotes);

  console.log(`Test database populated with ${dummyNotes.length} notes at ${testDbPath}`);
} catch (e: any) {
  console.error('Error populating test database:', e.message);
  process.exitCode = 1;
} finally {
  db.close();
}
