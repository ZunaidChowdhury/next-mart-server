import { Router } from 'express';
import { createCheckoutSession, handleStripeWebhook, getCheckoutSessionDetails } from '../controllers/transaction.controller.js';
import { verifyToken, verifyBuyer } from '../middleware/auth.middleware.js';

const router = Router();

// POST /api/checkout/create-session
router.post('/create-session', verifyToken, verifyBuyer, createCheckoutSession);

// POST /api/checkout/webhook
router.post('/webhook', handleStripeWebhook);

// GET /api/checkout/session/:sessionId
router.get('/session/:sessionId', verifyToken, verifyBuyer, getCheckoutSessionDetails);

export default router;
