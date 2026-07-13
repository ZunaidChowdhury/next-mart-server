import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import authRoutes from './routes/auth.routes.js';
import productRoutes from './routes/product.routes.js';

// Connect to Database
connectDB();

const app = express();
const PORT = env.PORT;
const FRONTEND_URL = env.FRONTEND_URL;

// Middlewares
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);

// Health Check Route
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

