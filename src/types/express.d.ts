import { JWTPayload } from 'jose';

export interface IUserPayload extends JWTPayload {
  id: string;
  email: string;
  role: 'buyer' | 'admin';
}

declare global {
  namespace Express {
    interface Request {
      user?: IUserPayload;
    }
  }
}
