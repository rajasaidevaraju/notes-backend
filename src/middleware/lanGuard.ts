
import { Request, Response, NextFunction } from 'express';
import { getLanStatus } from '../services/lanService';

export const lanGuard = (req: Request, res: Response, next: NextFunction) => {
    // Trust only the real TCP peer address — this server is the network edge
    // (no reverse proxy), so X-Forwarded-For here is attacker-controlled and
    // must never be used to decide localhost access.
    const ip = (req.socket.remoteAddress || '').replace(/^::ffff:/, '');

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
