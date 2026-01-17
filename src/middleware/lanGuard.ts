
import { Request, Response, NextFunction } from 'express';
import { getLanStatus } from '../services/lanService';

export const lanGuard = (req: Request, res: Response, next: NextFunction) => {
    const forwarded = req.headers['x-forwarded-for'];
    const remoteAddress = req.socket.remoteAddress;
    const reqIp = req.ip;

    const realIp = typeof forwarded === 'string'
        ? forwarded.split(',')[0].trim()
        : (reqIp || remoteAddress || '');

    const ip = realIp.replace(/^::ffff:/, '');

    const isLocalhost =
        ip === '::1' ||
        ip === '127.0.0.1' ||
        ip === 'localhost';

    if (isLocalhost) {
        return next();
    }

    const { enabled } = getLanStatus();

    if (enabled) {
        return next();
    }

    res.status(403).json({ error: 'Access restricted to localhost. Enable LAN sharing from the host device.' });
};
