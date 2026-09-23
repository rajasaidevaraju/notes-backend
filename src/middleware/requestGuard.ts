import net from 'net';
import { Request, Response, NextFunction } from 'express';
import { forbidden } from '../errors';

const LOOPBACK_NAMES = new Set(['localhost', '127.0.0.1', '::1']);

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Hostname of a Host header or origin URL, lowercased, IPv6 brackets stripped. */
const hostnameOf = (hostOrUrl: string): string | null => {
    try {
        const url = new URL(hostOrUrl.includes('://') ? hostOrUrl : `http://${hostOrUrl}`);
        return url.hostname.toLowerCase().replace(/^\[(.*)\]$/, '$1');
    } catch {
        return null;
    }
};

/**
 * DNS rebinding makes an attacker's domain resolve to this machine, so the
 * browser treats our responses as same-origin to their page. Their Host
 * header still carries their domain name, though. The app is only ever
 * reached as localhost or by IP, so any other name is refused.
 */
const isAllowedHost = (hostname: string): boolean =>
    LOOPBACK_NAMES.has(hostname) || net.isIP(hostname) !== 0;

/**
 * Blocks two browser-driven attacks on a server that trusts "the request
 * came from localhost":
 *
 * - DNS rebinding (every request): see isAllowedHost.
 * - Cross-site writes (non-GET): any page open in a browser on the host can
 *   fire a simple POST at localhost. Browsers attach Origin to those, so a
 *   state-changing request must come from a page served under the same
 *   hostname. The port is not compared, so the Vite dev server on another
 *   port still works. A request with no Origin is not from a browser page
 *   (curl, scripts) and passes.
 */
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
