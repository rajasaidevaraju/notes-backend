import express from 'express';
import { pinRateLimiter } from '../middleware/rateLimiter';
import * as AuthController from '../controllers/auth';

const router = express.Router();

router.post('/auth', pinRateLimiter, AuthController.login);
router.get('/auth/status', AuthController.getStatus);
router.post('/logout', AuthController.logout);

export default router;
