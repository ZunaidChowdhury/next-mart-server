import { Request, Response, NextFunction } from 'express';

const BANNED_KEYWORDS = [
  'adult', 'restricted', 'illegal', 'prohibited', 'weapon', 'drug', 'toxic'
];

export function contentModeration(req: Request, res: Response, next: NextFunction): void {
  const { title, overview, description } = req.body;

  const contentToInspect = `${title || ''} ${overview || ''} ${description || ''}`.toLowerCase();

  for (const keyword of BANNED_KEYWORDS) {
    if (contentToInspect.includes(keyword)) {
      res.status(400).json({ 
        message: 'Content contains restricted keywords. Product upload rejected.' 
      });
      return;
    }
  }

  next();
}
