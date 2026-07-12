import dotenv from 'dotenv';
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;
const PORT = process.env.PORT || '5000';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET;

if (!MONGODB_URI) {
  throw new Error('❌ MONGODB_URI environment variable is missing');
}

export const env = {
  MONGODB_URI,
  PORT,
  FRONTEND_URL,
  JWT_SECRET
};
