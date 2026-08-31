import express from 'express';
import { requireAuth } from '../middleware/auth';
import * as TrackerController from '../controllers/tracker';

const router = express.Router();

router.get('/', TrackerController.getAllVisibleTrackers);
router.get('/hidden', requireAuth, TrackerController.getHiddenTrackers);
router.get('/archived', TrackerController.getArchivedTrackers);
router.post('/', TrackerController.createTracker);
router.post('/import', TrackerController.importTracker);
router.put('/:id', TrackerController.updateTracker);
router.delete('/:id', TrackerController.deleteTracker);

router.post('/:id/entries', TrackerController.addEntry);
router.put('/entries/:entryId', TrackerController.updateEntry);

export default router;
