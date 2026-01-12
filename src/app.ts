import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cookieParser from 'cookie-parser';
import { db, initializeDatabase } from './database';

import { pinRateLimiter } from './middleware/rateLimiter';
import { requireAuth } from './middleware/auth';
//import { delayMiddleware } from './middleware/delay';

import * as AuthController from './controllers/authController';
import * as NotesController from './controllers/notesController';
import * as ChecklistController from './controllers/checklistController';
import * as ContentController from './controllers/contentController';
import * as SystemController from './controllers/systemController';

import { CLIPBOARD_NOTE_TITLE } from './constants';
import { NoteRow } from './types/notes';

const app = express();
const port = process.env.PORT || 3001;

app.use(express.json());
app.use(cookieParser());
//app.use(delayMiddleware); 


app.get('/', SystemController.getHomePage);
app.get('/health', SystemController.getHealth);
app.get('/server-ip', SystemController.getServerIp);

app.post('/auth', pinRateLimiter, AuthController.login);
app.get('/auth/status', AuthController.getStatus);
app.post('/logout', AuthController.logout);

app.get('/notes', NotesController.getAllVisibleNotes);
app.get('/notes/hidden', requireAuth, NotesController.getHiddenNotes);
app.post('/notes', NotesController.createNote);
app.put('/notes/:id', NotesController.updateNote);
app.delete('/notes/:id', NotesController.deleteNote);
app.delete('/content/batch', ContentController.deleteBatchContent);

app.get('/checklists', ChecklistController.getAllVisibleChecklists);
app.get('/checklists/hidden', requireAuth, ChecklistController.getHiddenChecklists);
app.post('/checklists', ChecklistController.createChecklist);
app.put('/checklists/:id', ChecklistController.updateChecklist);
app.delete('/checklists/:id', ChecklistController.deleteChecklist);

app.post('/checklists/:id/items', ChecklistController.addItem);
app.put('/checklists/items/:itemId', ChecklistController.updateItem);
app.delete('/checklists/items/:itemId', ChecklistController.deleteItem);

app.get('/content', ContentController.getAllContent);
app.get('/content/hidden', requireAuth, ContentController.getHiddenContent);


app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);

  initializeDatabase(db, () => {
    db.get('SELECT id FROM notes WHERE title = ?', [CLIPBOARD_NOTE_TITLE], (err: Error | null, row: NoteRow) => {
      if (err) {
        return console.error('Error checking clipboard note:', err.message);
      }
      if (!row) {
        console.log(`Creating special clipboard note: "${CLIPBOARD_NOTE_TITLE}"`);
        const now = new Date().toISOString();
        db.run('INSERT INTO notes (title, content, pinned, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)', [CLIPBOARD_NOTE_TITLE, '', 1, now, now], (err: Error | null) => {
          if (err) {
            console.error('Error creating clipboard note:', err.message);
          }
        });
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