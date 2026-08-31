import express from 'express';
import { requireAuth } from '../middleware/auth';
import * as ChecklistController from '../controllers/checklist';

const router = express.Router();

router.get('/', ChecklistController.getAllVisibleChecklists);
router.get('/hidden', requireAuth, ChecklistController.getHiddenChecklists);
router.get('/archived', ChecklistController.getArchivedChecklists);
router.post('/', ChecklistController.createChecklist);
router.put('/:id', ChecklistController.updateChecklist);
router.delete('/:id', ChecklistController.deleteChecklist);

router.post('/:id/items', ChecklistController.addItem);
router.put('/items/:itemId', ChecklistController.updateItem);
router.delete('/items/:itemId', ChecklistController.deleteItem);

export default router;
