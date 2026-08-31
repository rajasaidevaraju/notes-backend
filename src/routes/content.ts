import express from 'express';
import { requireAuth } from '../middleware/auth';
import * as ContentController from '../controllers/content';

const router = express.Router();

router.get('/', ContentController.getAllContent);
router.get('/hidden', requireAuth, ContentController.getHiddenContent);
router.get('/archived', ContentController.getArchivedContent);
router.delete('/batch', ContentController.deleteBatchContent);

export default router;
