import { Router } from 'express';
import { syncUserSession, getMe } from '../controllers/auth.controller.js';
import { verifyToken } from '../middleware/auth.middleware.js';

const router = Router();

router.post('/sync', syncUserSession);
router.get('/me', verifyToken, getMe);

export default router;
