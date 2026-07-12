import mongoose from 'mongoose';
import { env } from './env.js';

let isConnected = false;

export const connectDB = async (): Promise<void> => {
  mongoose.set('strictQuery', true);

  if (isConnected) {
    console.log('🔌 Using existing database connection');
    return;
  }

  try {
    const db = await mongoose.connect(env.MONGODB_URI);
    isConnected = db.connections[0].readyState === 1;
    console.log('🎯 MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    if (!process.env.VERCEL) {
      process.exit(1);
    }
    throw error;
  }
};
