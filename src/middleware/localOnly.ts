import { Request, Response, NextFunction } from 'express';
import { forbidden } from '../errors';


export const isRequestLocal = (req: Request): boolean => {
    const ip = (req.socket.remoteAddress || '').replace(/^::ffff:/, '');
    return ip === '::1' || ip === '127.0.0.1' || ip === 'localhost';
};

export const requireLocal = (req: Request, _res: Response, next: NextFunction) => {
    if (!isRequestLocal(req)) {
        return next(forbidden('Only localhost can enable/disable LAN sharing.'));
    }

    next();
};
