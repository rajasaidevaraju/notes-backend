import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response } from 'express';
import db from './database';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req: Request, res: Response) => {
  res.send('Hello from Express with TypeScript and SQLite!');
});

app.get('/notes', (req: Request, res: Response) => {
  try {
    const notes = db.prepare('SELECT id, title, content, createdAt, updatedAt, pinned FROM notes').all();
    res.json(notes);
  } catch (error: any) {
    console.error('Error fetching notes:', error.message);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

app.post('/notes', (req: Request, res: Response) => {
  const { title, content, pinned } = req.body;

  if (!title) {
    res.status(400).json({ error: 'Title is required' });
    return;
  }

  const pinnedValue = pinned ? 1 : 0;

  try {
    const stmt = db.prepare('INSERT INTO notes (title, content, pinned) VALUES (?, ?, ?)');
    const info = stmt.run(title, content, pinnedValue);
    res.status(201).json({ id: info.lastInsertRowid, title, content, pinned: pinnedValue });
    return;
  } catch (error: any) {
    console.error('Error creating note:', error.message);
    res.status(500).json({ error: 'Failed to create note' });
    return;
  }
});

app.put('/notes/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { title, content, pinned } = req.body;

  if (!title) {
    res.status(400).json({ error: 'Title is required' });
    return;
  }

  let pinnedUpdateClause = '';
  let params: (string | number)[] = [title, content];

  if (typeof pinned !== 'undefined') {
    pinnedUpdateClause = ', pinned = ?';
    params.push(pinned ? 1 : 0);
  }

  params.push(id);

  try {
    const stmt = db.prepare(`UPDATE notes SET title = ?, content = ? ${pinnedUpdateClause} WHERE id = ?`);
    const info = stmt.run(...params);

    if (info.changes === 0) {
      res.status(404).json({ error: 'Note not found' });
      return;
    }

    const updatedNote = db.prepare('SELECT id, title, content, createdAt, updatedAt, pinned FROM notes WHERE id = ?').get(id);
    res.json(updatedNote);
    return;
  } catch (error: any) {
    console.error('Error updating note:', error.message);
    res.status(500).json({ error: 'Failed to update note' });
    return;
  }
});

app.delete('/notes/:id', (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const stmt = db.prepare('DELETE FROM notes WHERE id = ?');
    const info = stmt.run(id);

    if (info.changes === 0) {
      res.status(404).json({ error: 'Note not found' });
      return;
    }

    res.status(204).send();
    return;
  } catch (error: any) {
    console.error('Error deleting note:', error.message);
    res.status(500).json({ error: 'Failed to delete note' });
    return;
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
  console.log(`SQLite database file: ${process.env.DATABASE_PATH}`);
});

process.on('SIGINT', () => {
  db.close();
  console.log('SQLite database connection closed.');
  process.exit(0);
});
