import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import authRoutes from './routes/auth.routes.js';
import productRoutes from './routes/product.routes.js';
import transactionRoutes from './routes/transaction.routes.js';
import adminRoutes from './routes/admin.routes.js';
import wishlistRoutes from './routes/wishlist.routes.js';

const app = express();
const PORT = env.PORT;
const FRONTEND_URL = env.FRONTEND_URL;

// Middlewares
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true
}));
app.use(express.json({
  verify: (req: any, res, buf) => {
    req.rawBody = buf;
  }
}));

// Ensure DB is connected before API routes — /health bypasses this
async function ensureDB(req: any, res: any, next: any) {
  if (mongoose.connection.readyState === 1) return next();
  try {
    await connectDB();
    next();
  } catch {
    res.status(503).json({ message: 'Database unavailable' });
  }
}
app.use('/api', ensureDB);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/checkout', transactionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/wishlist', wishlistRoutes);

// Global error handler
app.use((err: any, req: any, res: any, next: any) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Internal server error', error: err.message });
});

// Health Check Route (no DB needed)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'NextMart API is active'
  });
});

// Start Server locally
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 NextMart backend server running on port ${PORT}`);
  });
}

export default app;

