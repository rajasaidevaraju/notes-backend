import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response } from 'express';
import { db, initializeDatabase } from './database';
import os from 'os'; 
import { error } from 'console';

const app = express();
const port = process.env.PORT || 3000;

const CLIPBOARD_NOTE_TITLE = 'Clipboard';

interface NoteRow {
  id: number;
  title: string;
  content: string | null;
  createdAt: string;
  updatedAt: string;
  hidden: number;
  pinned: number;
}

app.use(express.json());

app.get('/', (req: Request, res: Response) => {
  res.send('Hello from Express with TypeScript and SQLite!');
});

app.get('/server-ip', (req: Request, res: Response) => {
  const networkInterfaces = os.networkInterfaces();
  let serverIpAddress = 'Not Found';

  for (const interfaceName in networkInterfaces) {
    const networkInterface = networkInterfaces[interfaceName];
    if (networkInterface) {
      for (const alias of networkInterface) {
        if (alias.family === 'IPv4' && !alias.internal) {
          serverIpAddress = alias.address;
          break;
        }
      }
    }
    if (serverIpAddress !== 'Not Found') {
      break;
    }
  }

  res.json({ ip: serverIpAddress });
});

app.get('/notes', (req: Request, res: Response) => {
  db.all('SELECT id, title, content, createdAt, updatedAt, pinned,hidden FROM notes WHERE hidden = 0', [], (err: Error | null, rows: NoteRow[]) => {
    if (err) {
      console.error('Error fetching notes:', err.message);
      res.status(500).json({ error: 'Failed to fetch notes' });
      return;
    }
    res.json(rows);
  });
});

app.get('/notes/hidden', (req: Request, res: Response) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authorization header missing or malformed' });
      return;
  }

  const pin = authHeader.split(' ')[1];
  const correctPin = process.env.HIDDEN_NOTES_PIN;

  if (!pin || pin !== correctPin) {
    res.json([]);
    return;
  }

  db.all('SELECT id, title, content, createdAt, updatedAt, pinned, hidden FROM notes WHERE hidden = 1', [], (err, rows: NoteRow[]) => {
    if (err) {
      console.error('Error fetching hidden notes:', err.message);
      res.status(500).json({ error: 'Failed to fetch hidden notes' });
    }else{
      res.json(rows);
    }
    
  });
});

app.post('/notes', (req: Request, res: Response) => {
  const { title, content, pinned, hidden  } = req.body;

  if (!title) {
    res.status(400).json({ error: 'Title is required' });
    return;
  }

  if (title === CLIPBOARD_NOTE_TITLE) {
    res.status(400).json({ error: `Cannot create a note with the reserved title "${CLIPBOARD_NOTE_TITLE}".` });
    return;
  }

  const pinnedValue = pinned ? 1 : 0;
  const hiddenValue = hidden ? 1 : 0;

  db.run('INSERT INTO notes (title, content, pinned, hidden) VALUES (?, ?, ?, ?)', [title, content, pinnedValue, hiddenValue], function (err: Error | null) {
    if (err) {
      console.error('Error creating note:', err.message);
      res.status(500).json({ error: 'Failed to create note' });
      return;
    }
    res.status(201).json({ id: this.lastID, title, content, pinned: pinnedValue });
  });
});

app.put('/notes/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { title, content, pinned, hidden } = req.body;

  if (!title) {
    res.status(400).json({ error: 'Title is required' });
    return;
  }

  db.get('SELECT title FROM notes WHERE id = ?', [id], (err: Error | null, row: NoteRow) => {
    if (err) {
      console.error('Error fetching note:', err.message);
      res.status(500).json({ error: 'Failed to update note' });
      return;
    }

    if (!row) {
      res.status(404).json({ error: 'Note not found' });
      return;
    }
    
    if (row.title === CLIPBOARD_NOTE_TITLE) {
      if (title !== CLIPBOARD_NOTE_TITLE || (typeof pinned !== 'undefined' && pinned !== 1)) {
        res.status(403).json({ error: 'Cannot change title or unpin the special clipboard note.' });
        return;
      }
      db.run('UPDATE notes SET content = ? WHERE id = ?', [content, id], (err: Error | null) => {
        if (err) {
          console.error('Error updating note:', err.message);
          res.status(500).json({ error: 'Failed to update note' });
          return;
        }
        db.get('SELECT id, title, content, createdAt, updatedAt, pinned, hidden FROM notes WHERE id = ?', [id], (err: Error | null, updatedNote: NoteRow) => {
          if (err) {
            console.error('Error fetching updated note:', err.message);
            res.status(500).json({ error: 'Failed to fetch updated note' });
            return;
          }
          res.json(updatedNote);
        });
      });
    } else {
      if (title === CLIPBOARD_NOTE_TITLE) {
        res.status(403).json({ error: `Cannot change note title to the reserved title "${CLIPBOARD_NOTE_TITLE}".` });
        return;
      }

      let query = 'UPDATE notes SET title = ?, content = ?';
      let params: (string | number)[] = [title, content];

      if (typeof pinned !== 'undefined') {
        query += ', pinned = ?';
        params.push(pinned ? 1 : 0);
      }
      if (typeof hidden !== 'undefined') {
        if(row.hidden === 1 && hidden === 0){
          res.status(403).json({error:"Unhide operation requires PIN verification. Use the /notes/:id/unhide endpoint."})
          return;
        }
        query += ', hidden = ?';
        params.push(hidden ? 1 : 0);
      }
      query += ' WHERE id = ?';
      params.push(id);

      db.run(query, params, function (err: Error | null) {
        if (err) {
          console.error('Error updating note:', err.message);
          res.status(500).json({ error: 'Failed to update note' });
          return;
        }
        if (this.changes === 0) {
          res.status(404).json({ error: 'Note not found' });
          return;
        }
        db.get('SELECT id, title, content, createdAt, updatedAt, pinned, hidden FROM notes WHERE id = ?', [id], (err: Error | null, updatedNote: NoteRow) => {
          if (err) {
            console.error('Error fetching updated note:', err.message);
            res.status(500).json({ error: 'Failed to fetch updated note' });
            return;
          }
          res.json(updatedNote);
        });
      });
    }
  });
});

app.put('/notes/:id/unhide', (req: Request, res: Response) => {
  const { id } = req.params;
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authorization header missing or malformed' });
      return;
  }

  const pin = authHeader.split(' ')[1];
  const correctPin = process.env.HIDDEN_NOTES_PIN;

  if (!pin || pin !== correctPin) {
    res.send(403).json({error:"Invalid PIN"});
    return;
  }

  db.get('SELECT id, title, content, createdAt, updatedAt, pinned, hidden FROM notes WHERE id = ?', [id], (err: Error | null, note: NoteRow) => {
    if (err) {
      console.error('Error fetching note for unhide:', err.message);
      return res.status(500).json({ error: 'Failed to unhide note' });
    }
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }
    if (note.hidden==0) {
      return res.status(400).json({ error: 'Note is not hidden' });
    }

    db.run('UPDATE notes SET hidden = 0, updatedAt = CURRENT_TIMESTAMP WHERE id = ?', [id], function (err: Error | null) {
      if (err) {
        console.error('Error unhiding note:', err.message);
        return res.status(500).json({ error: 'Failed to unhide note' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Note not found or already unhidden' });
      }

      
      db.get('SELECT id, title, content, createdAt, updatedAt, pinned, hidden FROM notes WHERE id = ?', [id], (err: Error | null, unhiddenNote: NoteRow) => {
        if (err) {
          console.error('Error fetching unhidden note:', err.message);
          return res.status(500).json({ error: 'Failed to fetch unhidden note' });
        }
        res.json(unhiddenNote);
      });
    });
  });
});

app.delete('/notes/batch', (req: Request, res: Response) => {
  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: 'An array of note IDs is required for batch deletion.' });
    return;
  }

  // Validate IDs and check for clipboard note
  const invalidIds = ids.filter(id => typeof id !== 'number' || !Number.isInteger(id) || id <= 0);
  if (invalidIds.length > 0) {
    res.status(400).json({ error: 'All provided IDs must be positive integers.', invalidIds });
    return;
  }

  // Fetch titles of notes to be deleted to check for the clipboard note
  const placeholders = ids.map(() => '?').join(',');
  db.all(`SELECT id, title FROM notes WHERE id IN (${placeholders})`, ids, (err: Error | null, rows: NoteRow[]) => {
    if (err) {
      console.error('Error checking notes for batch deletion:', err.message);
      res.status(500).json({ error: 'Failed to prepare for batch deletion.' });
      return;
    }

    const notesToDelete = rows.map(row => row.id);
    const clipboardNoteFound = rows.some(row => row.title === CLIPBOARD_NOTE_TITLE);

    if (clipboardNoteFound) {
      res.status(403).json({ error: 'Cannot delete the special clipboard note in a batch operation.' });
      return;

    }

    if (notesToDelete.length === 0) {
      res.status(404).json({ message: 'No valid notes found for deletion.' });
      return;

    }

    
    db.serialize(() => {
      db.run('BEGIN TRANSACTION;');
      const deletePlaceholders = notesToDelete.map(() => '?').join(',');
      db.run(`DELETE FROM notes WHERE id IN (${deletePlaceholders})`, notesToDelete, function (deleteErr: Error | null) {
        if (deleteErr) {
          console.error('Error during batch deletion transaction:', deleteErr.message);
          db.run('ROLLBACK;'); // Rollback on error
          res.status(500).json({ error: 'Failed to perform batch deletion.' });
          return;
        }
        db.run('COMMIT;', (commitErr: Error | null) => {
          if (commitErr) {
            console.error('Error committing batch deletion transaction:', commitErr.message);
            res.status(500).json({ error: 'Failed to finalize batch deletion.' });
            return;
          }
          res.status(200).json({ message: `Successfully deleted ${this.changes} notes.`, deletedIds: notesToDelete });
        });
      });
    });
  });
});

app.delete('/notes/:id', (req: Request, res: Response) => {
  const { id } = req.params;

  db.get('SELECT title FROM notes WHERE id = ?', [id], (err: Error | null, row: NoteRow) => {
    if (err) {
      console.error('Error fetching note:', err.message);
      res.status(500).json({ error: 'Failed to delete note' });
      return;
    }

    if (!row) {
      res.status(404).json({ error: 'Note not found' });
      return;
    }

    if (row.title === CLIPBOARD_NOTE_TITLE) {
      res.status(403).json({ error: 'Cannot delete the special clipboard note.' });
      return;
    }

    db.run('DELETE FROM notes WHERE id = ?', [id], function (err: Error | null) {
      if (err) {
        console.error('Error deleting note:', err.message);
        res.status(500).json({ error: 'Failed to delete note' });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: 'Note not found' });
        return;
      }
      res.status(204).send();
    });
  });
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
  console.log(`SQLite database file: ${process.env.DATABASE_PATH}`);

  initializeDatabase(() => {
    db.get('SELECT id FROM notes WHERE title = ?', [CLIPBOARD_NOTE_TITLE], (err: Error | null, row: NoteRow) => {
      if (err) {
        console.error('Error checking clipboard note:', err.message);
        return;
      }
      if (!row) {
        console.log(`Creating special clipboard note: "${CLIPBOARD_NOTE_TITLE}"`);
        db.run('INSERT INTO notes (title, content, pinned) VALUES (?, ?, ?)', [CLIPBOARD_NOTE_TITLE, '', 1], (err: Error | null) => {
          if (err) {
            console.error('Error creating clipboard note:', err.message);
          }
        });
      } else {
        console.log(`Special clipboard note "${CLIPBOARD_NOTE_TITLE}" already exists.`);
      }
    });
  });
});

process.on('SIGINT', () => {
  db.close((err: Error | null) => {
    if (err) {
      console.error('Error closing SQLite database:', err.message);
    } else {
      console.log('SQLite database connection closed.');
    }
    process.exit(0);
  });
});