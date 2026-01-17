import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cookieParser from 'cookie-parser';
import { db, initializeDatabase } from './database';

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
});


import { lanGuard } from './middleware/lanGuard';
import { pinRateLimiter } from './middleware/rateLimiter';
import { requireAuth } from './middleware/auth';

import * as AuthController from './controllers/authController';
import * as NotesController from './controllers/notesController';
import * as ChecklistController from './controllers/checklistController';
import * as ContentController from './controllers/contentController';
import * as SystemController from './controllers/systemController';

import { CLIPBOARD_NOTE_TITLE } from './constants';
import { NoteRow } from './types/notes';

const app = express();
const port = process.env.PORT || 3001;

app.set('trust proxy', true);
app.use(express.json());
app.use(cookieParser());
//app.use(delayMiddleware); 

app.use(lanGuard);

import { createProxyMiddleware } from 'http-proxy-middleware';

const api = express.Router();

api.get('/', SystemController.getHomePage);
api.get('/health', SystemController.getHealth);
api.get('/server-ip', SystemController.getServerIp);
api.get('/system/lan/status', SystemController.getLanSharingStatus);
api.post('/system/lan/enable', SystemController.enableLanSharing);
api.post('/system/lan/disable', SystemController.disableLanSharing);

api.post('/auth', pinRateLimiter, AuthController.login);
api.get('/auth/status', AuthController.getStatus);
api.post('/logout', AuthController.logout);

api.get('/notes', NotesController.getAllVisibleNotes);
api.get('/notes/hidden', requireAuth, NotesController.getHiddenNotes);
api.post('/notes', NotesController.createNote);
api.put('/notes/:id', NotesController.updateNote);
api.delete('/notes/:id', NotesController.deleteNote);
api.delete('/content/batch', ContentController.deleteBatchContent);

api.get('/checklists', ChecklistController.getAllVisibleChecklists);
api.get('/checklists/hidden', requireAuth, ChecklistController.getHiddenChecklists);
api.post('/checklists', ChecklistController.createChecklist);
api.put('/checklists/:id', ChecklistController.updateChecklist);
api.delete('/checklists/:id', ChecklistController.deleteChecklist);

api.post('/checklists/:id/items', ChecklistController.addItem);
api.put('/checklists/items/:itemId', ChecklistController.updateItem);
api.delete('/checklists/items/:itemId', ChecklistController.deleteItem);

api.get('/content', ContentController.getAllContent);
api.get('/content/hidden', requireAuth, ContentController.getHiddenContent);

app.use('/api', api);

const frontendProxy = createProxyMiddleware({
  target: 'http://localhost:3003',
  changeOrigin: true,
  ws: true,
});

app.use(frontendProxy);


const server = app.listen(port, () => {
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
server.on('error', (err) => {
  console.error('Server failed to start:', err);
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