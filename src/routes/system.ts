import express from 'express';
import { requireLocal } from '../middleware/localOnly';
import * as SystemController from '../controllers/system';

const router = express.Router();

router.get('/lan/status', SystemController.getLanSharingStatus);
router.post('/lan/enable', requireLocal, SystemController.enableLanSharing);
router.post('/lan/disable', requireLocal, SystemController.disableLanSharing);

export default router;
