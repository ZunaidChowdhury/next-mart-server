import { Request, Response } from 'express';
import { SignJWT } from 'jose';
import { env } from '../config/env.js';
import { User } from '../models/user.model.js';

export async function syncUserSession(req: Request, res: Response): Promise<void> {
  const { name, email, image } = req.body;

  if (!email || !name) {
    res.status(400).json({ message: 'Missing name or email in payload' });
    return;
  }

  try {
    let user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      // Determine role: make first user in database or matching ADMIN_EMAIL env variable the admin
      const isFirstUser = (await User.countDocuments({})) === 0;
      const adminEmail = process.env.ADMIN_EMAIL;
      const isAdminEmail = adminEmail && email.toLowerCase() === adminEmail.toLowerCase();
      const role = (isFirstUser || isAdminEmail) ? 'admin' : 'buyer';

      user = new User({
        name,
        email,
        image: image || '',
        role
      });
      await user.save();
    } else {
      // Update existing user details if they have changed
      user.name = name;
      if (image) {
        user.image = image;
      }
      await user.save();
    }

    if (!env.JWT_SECRET) {
      throw new Error('JWT_SECRET is not configured');
    }

    const secretKey = new TextEncoder().encode(env.JWT_SECRET);
    const token = await new SignJWT({ id: user._id.toString(), email: user.email, role: user.role })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(secretKey);

    res.status(200).json({ user, token });
  } catch (error: any) {
    res.status(500).json({ message: 'Error syncing session', error: error.message });
  }
}

export async function getMe(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized: Session details missing' });
      return;
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    res.status(200).json({ user });
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching profile', error: error.message });
  }
}
