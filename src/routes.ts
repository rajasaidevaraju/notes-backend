import express from 'express';

import { pinRateLimiter } from './middleware/rateLimiter';
import { requireAuth } from './middleware/auth';

import * as AuthController from './controllers/authController';
import * as NotesController from './controllers/notesController';
import * as ChecklistController from './controllers/checklistController';
import * as TrackerController from './controllers/trackerController';
import * as ContentController from './controllers/contentController';
import * as SystemController from './controllers/systemController';

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

api.get('/trackers', TrackerController.getAllVisibleTrackers);
api.get('/trackers/hidden', requireAuth, TrackerController.getHiddenTrackers);
api.post('/trackers', TrackerController.createTracker);
api.post('/trackers/import', TrackerController.importTracker);
api.put('/trackers/:id', TrackerController.updateTracker);
api.delete('/trackers/:id', TrackerController.deleteTracker);

api.post('/trackers/:id/entries', TrackerController.addEntry);
api.put('/trackers/entries/:entryId', TrackerController.updateEntry);

api.get('/content', ContentController.getAllContent);
api.get('/content/hidden', requireAuth, ContentController.getHiddenContent);

export default api;
