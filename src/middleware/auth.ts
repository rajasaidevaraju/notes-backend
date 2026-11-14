import { Request, Response, NextFunction } from 'express';
import { unauthorized } from '../errors';
import { env } from '../config/env';

export const isAuthenticated = (req: Request): boolean => {
    return req.cookies?.auth_pin === env.hiddenNotesPin;
};

export const requireAuth = (req: Request, _res: Response, next: NextFunction) => {
    if (!isAuthenticated(req)) {
        return next(unauthorized('Unauthorized'));
    }

    next();
};
