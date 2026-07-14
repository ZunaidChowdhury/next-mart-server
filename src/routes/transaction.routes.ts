import { Router } from 'express';
import { createCheckoutSession } from '../controllers/transaction.controller.js';
import { verifyToken, verifyBuyer } from '../middleware/auth.middleware.js';

const router = Router();

// POST /api/checkout/create-session
router.post('/create-session', verifyToken, verifyBuyer, createCheckoutSession);

export default router;
