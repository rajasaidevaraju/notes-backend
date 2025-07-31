import { Request, Response, NextFunction } from 'express';

export const delayMiddleware = (req: Request, res: Response, next: NextFunction) => {
  setTimeout(() => {
    next();
  }, 300);
};