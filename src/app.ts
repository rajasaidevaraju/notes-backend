import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cookieParser from 'cookie-parser';
import { db, initializeDatabase } from './database';

import { pinRateLimiter } from './middleware/rateLimiter';
//import { delayMiddleware } from './middleware/delay';

import * as AuthController from './controllers/authController';
import * as NotesController from './controllers/notesController';
import * as SystemController from './controllers/systemController';

import { CLIPBOARD_NOTE_TITLE } from './constants';
import { NoteRow } from './types/notes';

const app = express();
const port = process.env.PORT || 3001;

app.use(express.json());
app.use(cookieParser());
//app.use(delayMiddleware); 


app.get('/', SystemController.getHomePage);
app.get('/server-ip', SystemController.getServerIp);

app.post('/auth', pinRateLimiter ,AuthController.login);
app.get('/auth/status', AuthController.getStatus);
app.post('/logout', AuthController.logout);

app.get('/notes', NotesController.getAllVisibleNotes);
app.get('/notes/hidden', NotesController.getHiddenNotes);
app.post('/notes', NotesController.createNote);
app.put('/notes/:id', NotesController.updateNote);
app.delete('/notes/:id', NotesController.deleteNote);
app.delete('/notes/batch', NotesController.deleteBatchNotes);


app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
  
  initializeDatabase(db,() => {
    db.get('SELECT id FROM notes WHERE title = ?', [CLIPBOARD_NOTE_TITLE], (err: Error | null, row: NoteRow) => {
      if (err) {
        return console.error('Error checking clipboard note:', err.message);
      }
      if (!row) {
        console.log(`Creating special clipboard note: "${CLIPBOARD_NOTE_TITLE}"`);
        db.run('INSERT INTO notes (title, content, pinned) VALUES (?, ?, ?)', [CLIPBOARD_NOTE_TITLE, '', 1], (err: Error | null) => {
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