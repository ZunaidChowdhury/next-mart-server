import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Middlewares
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true
}));
app.use(express.json());

// Health Check Route
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'NextMart API is active'
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 NextMart backend server running on port ${PORT}`);
});
