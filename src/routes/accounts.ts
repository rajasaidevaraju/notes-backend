import express from 'express';
import * as AccountController from '../controllers/account';

const router = express.Router();

router.get('/', AccountController.getAccounts);
router.post('/', AccountController.createAccount);
router.put('/:id', AccountController.updateAccount);
router.delete('/:id', AccountController.deleteAccount);

router.post('/groups', AccountController.createGroup);
router.put('/groups/:id', AccountController.renameGroup);
router.delete('/groups/:id', AccountController.deleteGroup);

export default router;
