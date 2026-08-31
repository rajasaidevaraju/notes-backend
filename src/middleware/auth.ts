import { Request, Response, NextFunction } from 'express';
import { forbidden } from '../errors';

export const isAuthenticated = (req: Request): boolean => {
    const correctPin = process.env.HIDDEN_NOTES_PIN;
    return Boolean(correctPin) && req.cookies?.auth_pin === correctPin;
};

export const requireAuth = (req: Request, _res: Response, next: NextFunction) => {
    if (!isAuthenticated(req)) {
        return next(forbidden('Unauthorized'));
    }

    next();
};
