import { Request, Response } from 'express';
import { User } from '../models/user.model.js';

export async function addToWishlist(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    const { productId } = req.body;
    if (!productId) {
      res.status(400).json({ message: 'productId is required' });
      return;
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    if (!user.wishlist.includes(productId)) {
      user.wishlist.push(productId);
      await user.save();
    }

    res.status(200).json({ wishlist: user.wishlist });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to add to wishlist', error: error.message });
  }
}

export async function removeFromWishlist(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    const { productId } = req.params;

    const user = await User.findById(req.user.id);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    user.wishlist = user.wishlist.filter((id) => id.toString() !== productId);
    await user.save();

    res.status(200).json({ wishlist: user.wishlist });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to remove from wishlist', error: error.message });
  }
}

export async function getWishlist(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const user = await User.findById(req.user.id).populate('wishlist');
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    res.status(200).json({ wishlist: user.wishlist });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to fetch wishlist', error: error.message });
  }
}
