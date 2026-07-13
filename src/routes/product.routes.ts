import { Router } from 'express';
import { 
  getProducts, 
  getProductById, 
  createProduct, 
  updateProduct, 
  updateProductStatus, 
  deleteProduct 
} from '../controllers/product.controller.js';
import { verifyToken, verifyAdmin } from '../middleware/auth.middleware.js';
import { contentModeration } from '../middleware/moderation.middleware.js';

const router = Router();

router.get('/', getProducts);
router.get('/:id', getProductById);

// Admin-secured mutation routes
router.post('/', verifyToken, verifyAdmin, contentModeration, createProduct);
router.put('/:id', verifyToken, verifyAdmin, contentModeration, updateProduct);
router.patch('/:id/status', verifyToken, verifyAdmin, updateProductStatus);
router.delete('/:id', verifyToken, verifyAdmin, deleteProduct);

export default router;
