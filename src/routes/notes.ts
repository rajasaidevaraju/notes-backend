import express from 'express';
import { requireAuth } from '../middleware/auth';
import * as NotesController from '../controllers/notes';

const router = express.Router();

router.get('/', NotesController.getAllVisibleNotes);
router.get('/hidden', requireAuth, NotesController.getHiddenNotes);
router.get('/archived', NotesController.getArchivedNotes);
router.post('/', NotesController.createNote);
router.put('/:id', NotesController.updateNote);
router.delete('/:id', NotesController.deleteNote);

export default router;
