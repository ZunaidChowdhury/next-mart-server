import dotenv from 'dotenv';
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;
const PORT = process.env.PORT || '5000';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

if (!MONGODB_URI) {
  throw new Error('❌ MONGODB_URI environment variable is missing');
}

if (!STRIPE_SECRET_KEY) {
  console.warn('⚠️  STRIPE_SECRET_KEY not set — checkout will be unavailable');
}

if (!STRIPE_WEBHOOK_SECRET) {
  console.warn('⚠️  STRIPE_WEBHOOK_SECRET not set — webhooks will be unavailable');
}

export const env = {
  MONGODB_URI,
  PORT,
  FRONTEND_URL,
  JWT_SECRET,
  STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET
};
