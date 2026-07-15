import { Router } from 'express';
import { 
  getProducts, 
  getProductById, 
  getAllProductsAdmin,
  getFeaturedProducts,
  createProduct, 
  updateProduct, 
  updateProductStatus, 
  deleteProduct 
} from '../controllers/product.controller.js';
import { verifyToken, verifyAdmin } from '../middleware/auth.middleware.js';
import { contentModeration } from '../middleware/moderation.middleware.js';

const router = Router();

// Admin-only: fetch all products including private — must be declared BEFORE /:id to avoid route collision
router.get('/admin/all', verifyToken, verifyAdmin, getAllProductsAdmin);

// Public catalog routes
router.get('/', getProducts);
router.get('/featured', getFeaturedProducts);
router.get('/:id', getProductById);

// Admin-secured mutation routes
router.post('/', verifyToken, verifyAdmin, contentModeration, createProduct);
router.put('/:id', verifyToken, verifyAdmin, contentModeration, updateProduct);
router.patch('/:id', verifyToken, verifyAdmin, updateProductStatus);
router.delete('/:id', verifyToken, verifyAdmin, deleteProduct);

export default router;
