import net from 'net';
import { Request, Response, NextFunction } from 'express';
import { forbidden } from '../errors';

const LOOPBACK_NAMES = new Set(['localhost', '127.0.0.1', '::1']);

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const hostnameOf = (hostOrUrl: string): string | null => {
    try {
        const url = new URL(hostOrUrl.includes('://') ? hostOrUrl : `http://${hostOrUrl}`);
        return url.hostname.toLowerCase().replace(/^\[(.*)\]$/, '$1');
    } catch {
        return null;
    }
};

// Blocks DNS rebinding: the app is only reached as localhost or by IP.
const isAllowedHost = (hostname: string): boolean =>
    LOOPBACK_NAMES.has(hostname) || net.isIP(hostname) !== 0;

export const requestGuard = (req: Request, _res: Response, next: NextFunction) => {
    const host = req.headers.host ? hostnameOf(req.headers.host) : null;

    if (req.headers.host && (!host || !isAllowedHost(host))) {
        return next(forbidden(`Host "${req.headers.host}" is not allowed.`));
    }

    const origin = req.headers.origin;
    if (!SAFE_METHODS.has(req.method) && origin && hostnameOf(origin) !== host) {
        return next(forbidden('Cross-origin requests are not allowed.'));
    }

    next();
};
