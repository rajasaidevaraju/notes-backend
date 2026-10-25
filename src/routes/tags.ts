import express from 'express';
import * as TagController from '../controllers/tag';

const router = express.Router();

router.get('/', TagController.getTags);
router.post('/', TagController.createTag);
router.put('/:id', TagController.renameTag);
router.delete('/:id', TagController.deleteTag);

export default router;
