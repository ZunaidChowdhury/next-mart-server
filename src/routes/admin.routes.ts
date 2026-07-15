import { Router } from 'express';
import { getAdminStats, getAllOrders, updateOrderStatus } from '../controllers/admin.controller.js';
import { verifyToken, verifyAdmin } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/stats', verifyToken, verifyAdmin, getAdminStats);
router.get('/orders', verifyToken, verifyAdmin, getAllOrders);
router.patch('/orders/:id/status', verifyToken, verifyAdmin, updateOrderStatus);

export default router;
