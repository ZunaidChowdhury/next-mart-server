import mongoose, { Schema, Document } from 'mongoose';

export interface IFeature {
  name: string;
  value: string;
}

export interface ISpecification {
  name: string;
  value: string;
}

export interface IReview {
  user: mongoose.Types.ObjectId;
  userName: string;
  comment: string;
  createdAt: Date;
}

export interface IProduct extends Omit<Document, 'model'> {
  title: string;
  overview: string;
  description: string;
  images: string[];
  originalPrice: number;
  salePrice: number;
  rating: number;
  ratedBy: number;
  featuredPosition: number | null;
  brandName: string;
  availableStatus: 'in-stock' | 'out-of-stock';
  soldQuantity: number;
  variation: string[];
  model?: string;
  coreFeatures: IFeature[];
  specification: ISpecification[];
  reviews: IReview[];
  categories: string[];
  addedBy?: string;
  isPrivate: boolean;
  stockCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>({
  title: { 
    type: String, 
    required: true, 
    trim: true,
    index: true 
  },
  overview: { 
    type: String, 
    required: true 
  },
  description: { 
    type: String, 
    required: true 
  },
  images: [{ 
    type: String, 
    required: true 
  }],
  originalPrice: { 
    type: Number, 
    required: true 
  },
  salePrice: { 
    type: Number, 
    required: true 
  },
  rating: { 
    type: Number, 
    default: 0 
  },
  ratedBy: { 
    type: Number, 
    default: 0 
  },
  featuredPosition: { 
    type: Number, 
    default: null 
  },
  brandName: { 
    type: String, 
    required: true,
    index: true 
  },
  availableStatus: { 
    type: String, 
    enum: ['in-stock', 'out-of-stock'], 
    default: 'in-stock' 
  },
  soldQuantity: { 
    type: Number, 
    default: 0 
  },
  variation: [{ 
    type: String 
  }],
  model: { 
    type: String 
  },
  coreFeatures: [{
    name: { type: String, required: true },
    value: { type: String, required: true }
  }],
  specification: [{
    name: { type: String, required: true },
    value: { type: String, required: true }
  }],
  reviews: [{
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true },
    comment: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  }],
  categories: [{ 
    type: String, 
    required: true,
    index: true 
  }],
  addedBy: {
    type: String
  },
  isPrivate: { 
    type: Boolean, 
    default: false 
  },
  stockCount: { 
    type: Number, 
    required: true, 
    default: 0 
  }
}, { 
  timestamps: true,
  collection: 'product'
});

// Text Index for full-text search capabilities across multiple catalog fields
ProductSchema.index({ title: 'text', brandName: 'text', overview: 'text' });

export const Product = mongoose.model<IProduct>('Product', ProductSchema);
