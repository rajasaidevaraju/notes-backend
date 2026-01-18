import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cookieParser from 'cookie-parser';
import { db, initializeDatabase, dbGet, dbRun } from './database';

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

import { NoteService } from './services/noteService';

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

  initializeDatabase(async (err: Error | null) => {
    if (err) {
      return console.error('Database initialization failed:', err.message);
    }

    await NoteService.initializeClipboardNote();
  });
});
server.on('error', (err) => {
  console.error('Server failed to start:', err);
});

process.on('SIGINT', () => {
  try {
    db.close();
    console.log('sqlite database connection closed.');
  } catch (err: any) {
    console.error('Error closing sqlite database:', err.message);
  }
  process.exit(0);
});
