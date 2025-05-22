import dotenv from 'dotenv';
dotenv.config(); 

import express, { Request, Response } from 'express';
import db from './database'; 

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json()); 

app.get('/', (req, res) => {
  res.send('Hello from Express with TypeScript and SQLite!');
});

app.get('/notes', (req, res) => {
  try {
    const notes = db.prepare('SELECT * FROM notes').all();
    res.json(notes);
  } catch (error: any) {
    console.error('Error fetching notes:', error.message);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

app.post('/notes', (req, res) => {
  const { title, content } = req.body;
  if (!title) {
    res.status(400).json({ error: 'Title is required' });
  }
  try {
    const stmt = db.prepare('INSERT INTO notes (title, content) VALUES (?, ?)');
    const info = stmt.run(title, content);
    res.status(201).json({ id: info.lastInsertRowid, title, content });
  } catch (error: any) {
    console.error('Error creating note:', error.message);
    res.status(500).json({ error: 'Failed to create note' });
  }
});

app.put('/notes/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { title, content } = req.body;

  if (!title) {
     res.status(400).json({ error: 'Title is required' });
     return;
  }

  try {
    const stmt = db.prepare('UPDATE notes SET title = ?, content = ? WHERE id = ?');
    const info = stmt.run(title, content, id);

    if (info.changes === 0) {
       res.status(404).json({ error: 'Note not found' });
       return;
    }

    res.json({ id: Number(id), title, content });
  } catch (error: any) {
    console.error('Error updating note:', error.message);
    res.status(500).json({ error: 'Failed to update note' });
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
  } catch (error: any) {
    console.error('Error deleting note:', error.message);
    res.status(500).json({ error: 'Failed to delete note' });
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