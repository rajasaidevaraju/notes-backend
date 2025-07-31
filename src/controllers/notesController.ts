import { Request, Response } from 'express';
import { db } from '../database';
import { NoteRow } from '../types/notes';
import { CLIPBOARD_NOTE_TITLE } from '../constants';
import { RunResult } from 'sqlite3';

export const getAllVisibleNotes = (req: Request, res: Response) => {
  db.all('SELECT id, title, content, createdAt, updatedAt, pinned, hidden FROM notes WHERE hidden = 0', [], (err: Error | null, rows: NoteRow[]) => {
    if (err) {
      console.error('Error fetching notes:', err.message);
      res.status(500).json({ error: 'Failed to fetch notes' });
      return;
    }
    res.json(rows);
    return;
  });
};

export const getHiddenNotes = (req: Request, res: Response) => {
  const cookiePin = req.cookies?.auth_pin;
  const correctPin = process.env.HIDDEN_NOTES_PIN;

  if (!cookiePin || cookiePin !== correctPin) {
    res.status(403).json({ error: 'Unauthorized' });
    return;
  }

  db.all('SELECT id, title, content, createdAt, updatedAt, pinned, hidden FROM notes WHERE hidden = 1', [], (err, rows: NoteRow[]) => {
    if (err) {
      console.error('Error fetching hidden notes:', err.message);
      res.status(500).json({ error: 'Failed to fetch hidden notes' });
      return;
    }
    res.json(rows);
    return;
  });
};

export const createNote = (req: Request, res: Response) => {
  const { title, content, pinned, hidden } = req.body;

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
    db.get('SELECT * FROM notes WHERE id = ?', [this.lastID], (err: Error | null, newNote: NoteRow) => {
        if(err) {
            res.status(500).json({ error: 'Failed to retrieve created note.' });
            return;
        }
        res.status(201).json(newNote);
    });
  });
};

export const updateNote = (req: Request, res: Response) => {
    const { id } = req.params;
    const { title, content, pinned, hidden } = req.body;

    if (!title) {
        res.status(400).json({ error: 'Title is required' });
        return;
    }

    db.get('SELECT title, hidden FROM notes WHERE id = ?', [id], (err: Error | null, row: NoteRow) => {
        if (err) {
            res.status(500).json({ error: 'Failed to update note' });
            return;
        }
        if (!row) {
            res.status(404).json({ error: 'Note not found' });
            return;
        }

        if (row.hidden === 1 ) {
            const cookiePin = req.cookies?.auth_pin;
            const correctPin = process.env.HIDDEN_NOTES_PIN;
            if (!cookiePin || cookiePin !== correctPin) {
                res.status(403).json({ error: 'Unauthorized. Valid PIN required to modify a hidden note.' });
                return;
            }
        }

        if (row.title === CLIPBOARD_NOTE_TITLE) {
            if (title !== CLIPBOARD_NOTE_TITLE || (typeof pinned !== 'undefined' && pinned !== 1)) {
                res.status(403).json({ error: 'Cannot change title or unpin the special clipboard note.' });
                return;
            }
            db.run('UPDATE notes SET content = ? WHERE id = ?', [content, id], handleUpdateResponse(req, res, id));
            return;
        } else {
            if (title === CLIPBOARD_NOTE_TITLE) {
                res.status(403).json({ error: `Cannot change note title to the reserved title "${CLIPBOARD_NOTE_TITLE}".` });
                return;
            }

            let query = 'UPDATE notes SET title = ?, content = ?';
            let params: (string | number | boolean | null)[] = [title, content];
            if (typeof pinned !== 'undefined') {
                query += ', pinned = ?';
                params.push(pinned ? 1 : 0);
            }
            if (typeof hidden !== 'undefined') {
                query += ', hidden = ?';
                params.push(hidden ? 1 : 0);
            }
            query += ' WHERE id = ?';
            params.push(id);

            db.run(query, params, handleUpdateResponse(req, res, id));
        }
    });
};

export const deleteNote = (req: Request, res: Response) => {
  const { id } = req.params;

  db.get('SELECT title, hidden FROM notes WHERE id = ?', [id], (err: Error | null, row: NoteRow) => {
    if (err) {
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
    if (row.hidden === 1) {
      const cookiePin = req.cookies?.auth_pin;
      const correctPin = process.env.HIDDEN_NOTES_PIN;
      if (!cookiePin || cookiePin !== correctPin) {
        res.status(403).json({ error: 'Unauthorized. Valid PIN required to delete a hidden note.' });
        return;
      }
    }

    db.run('DELETE FROM notes WHERE id = ?', [id], function (err: Error | null) {
      if (err) {
        res.status(500).json({ error: 'Failed to delete note' });
        return;
      }
      res.status(204).send();
    });
  });
};

export const deleteBatchNotes = (req: Request, res: Response) => {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
        res.status(400).json({ error: 'An array of note IDs is required.' });
        return;
    }

    const placeholders = ids.map(() => '?').join(',');
    db.all(`SELECT id, title, hidden FROM notes WHERE id IN (${placeholders})`, ids, (err: Error | null, rows: NoteRow[]) => {
        if (err) {
            res.status(500).json({ error: 'Failed to fetch notes for deletion.' });
            return;
        }

        const hasHiddenNote = rows.some(row => row.hidden === 1);
        if (hasHiddenNote) {
            const cookiePin = req.cookies?.auth_pin;
            const correctPin = process.env.HIDDEN_NOTES_PIN;
            if (!cookiePin || cookiePin !== correctPin) {
                res.status(403).json({ error: 'Unauthorized. Valid PIN required to delete a hidden note.' });
                return;
            }
        }

        const clipboardNote = rows.find(row => row.title === CLIPBOARD_NOTE_TITLE);
        if(clipboardNote) {
            res.status(403).json({ error: `Cannot delete the special clipboard note (ID: ${clipboardNote.id}).` });
            return;
        }

        const deletePlaceholders = ids.map(() => '?').join(',');
        db.run(`DELETE FROM notes WHERE id IN (${deletePlaceholders})`, ids, function (err: Error | null) {
            if (err) {
                res.status(500).json({ error: 'Failed to delete notes.' });
                return;
            }
            res.status(200).json({ message: `Successfully deleted ${this.changes} notes.` });
        });
    });
};

const handleUpdateResponse = (req: Request, res: Response, id: string | number) => {
  return function (this: RunResult, err: Error | null) {
    if (err) {
      res.status(500).json({ error: 'Failed to update note' });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: 'Note not found' });
      return;
    }
    db.get('SELECT id, title, content, createdAt, updatedAt, pinned, hidden FROM notes WHERE id = ?', [id], (err: Error | null, updatedNote: NoteRow) => {
      if (err) {
        res.status(500).json({ error: 'Failed to fetch updated note' });
        return;
      }
      res.json(updatedNote);
    });
  };
};
