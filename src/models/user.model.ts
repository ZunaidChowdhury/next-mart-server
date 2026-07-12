import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  image: string;
  role: 'buyer' | 'admin';
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>({
  name: { 
    type: String, 
    required: true 
  },
  email: { 
    type: String, 
    required: true, 
    unique: true, 
    lowercase: true,
    trim: true
  },
  image: { 
    type: String, 
    default: "" 
  },
  role: { 
    type: String, 
    enum: ['buyer', 'admin'], 
    default: 'buyer' 
  }
}, { 
  timestamps: true 
});

export const User = mongoose.model<IUser>('User', UserSchema);
