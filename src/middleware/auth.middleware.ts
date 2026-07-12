import { Request, Response, NextFunction } from 'express';
import { jwtVerify } from 'jose';
import { env } from '../config/env.js';
import type { IUserPayload } from '../types/express.js';

export async function verifyToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Unauthorized: Missing or malformed token' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    if (!env.JWT_SECRET) {
      throw new Error('JWT_SECRET is not configured');
    }

    const secretKey = new TextEncoder().encode(env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secretKey);

    req.user = payload as IUserPayload;

    next();
  } catch (error: any) {
    res.status(401).json({ 
      message: 'Unauthorized: Invalid, expired, or malformed token',
      error: error.message 
    });
  }
}

export function verifyBuyer(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized: Session not verified' });
    return;
  }

  if (req.user.role !== 'buyer') {
    res.status(403).json({ message: 'Forbidden: Buyer access required' });
    return;
  }

  next();
}

export function verifyAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized: Session not verified' });
    return;
  }

  if (req.user.role !== 'admin') {
    res.status(403).json({ message: 'Forbidden: Admin access required' });
    return;
  }

  next();
}
