
import fs from 'fs';
import path from 'path';
import { Request, Response, NextFunction } from 'express';
import { getLanStatus } from '../services/lan';
import { isRequestLocal } from './localOnly';

const LAN_BLOCKED_MESSAGE =
    'Access restricted to localhost. Enable LAN sharing from the host device.';

const DENIED_PAGE = path.join(__dirname, '../../public/denied.html');

let deniedHtml: string | null = null;
try {
    deniedHtml = fs.readFileSync(DENIED_PAGE, 'utf8');
} catch (err) {
    console.error(`Failed to load ${DENIED_PAGE}; LAN block will return JSON.`, err);
}

export const lanGuard = (req: Request, res: Response, next: NextFunction) => {
    if (isRequestLocal(req)) {
        return next();
    }

    const { enabled } = getLanStatus();

    if (enabled) {
        return next();
    }
    
    if (deniedHtml) {
        res.status(403).type('html').send(deniedHtml);
        return;
    }

    res.status(403).json({ error: LAN_BLOCKED_MESSAGE });
};
