import http from 'http';
import { Duplex } from 'stream';
import { Request, Response, NextFunction } from 'express';

const TARGET_HOST = 'localhost';
const TARGET_PORT = Number(process.env.FRONTEND_DEV_PORT) || 3003;

const UPSTREAM_DOWN =
    `Vite dev server is not reachable on http://${TARGET_HOST}:${TARGET_PORT}. ` +
    `Start the frontend, or run the backend with NODE_ENV=production to serve the built files.`;

// ECONNREFUSED arrives as an AggregateError with an empty message when the host
// resolves to both ::1 and 127.0.0.1, so fall back to the code.
const describeError = (err: Error & { code?: string }): string =>
    err.message || err.code || String(err);

export const devProxy = (req: Request, res: Response, next: NextFunction) => {
    const upstream = http.request(
        {
            host: TARGET_HOST,
            port: TARGET_PORT,
            method: req.method,
            path: req.originalUrl,
            headers: { ...req.headers, host: `${TARGET_HOST}:${TARGET_PORT}` },
        },
        (upstreamRes) => {
            res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
            upstreamRes.pipe(res);
        }
    );

    upstream.on('error', (err) => {
        if (res.headersSent) {
            res.destroy();
            return;
        }
        console.error(`Dev proxy: ${req.method} ${req.originalUrl} ->`, describeError(err));
        res.status(502).type('text').send(UPSTREAM_DOWN);
    });

    // If the client disconnects mid-flight, stop work upstream too.
    res.on('close', () => upstream.destroy());

    req.pipe(upstream);
};

/**
 * Forwards protocol upgrades, which is how Vite's HMR websocket connects.
 * Register on the http.Server itself — upgrades never reach the express stack.
 */
export const devProxyUpgrade = (req: http.IncomingMessage, socket: Duplex, head: Buffer) => {
    const upstream = http.request({
        host: TARGET_HOST,
        port: TARGET_PORT,
        method: req.method,
        path: req.url,
        headers: { ...req.headers, host: `${TARGET_HOST}:${TARGET_PORT}` },
    });

    upstream.on('upgrade', (upstreamRes, upstreamSocket, upstreamHead) => {
        const statusLine = `HTTP/1.1 ${upstreamRes.statusCode} ${upstreamRes.statusMessage}`;
        const headers = Object.entries(upstreamRes.headers).flatMap(([key, value]) =>
            Array.isArray(value) ? value.map((v) => `${key}: ${v}`) : [`${key}: ${value}`]
        );
        socket.write(`${statusLine}\r\n${headers.join('\r\n')}\r\n\r\n`);

        if (upstreamHead?.length) upstreamSocket.unshift(upstreamHead);
        if (head?.length) socket.unshift(head);

        upstreamSocket.pipe(socket).pipe(upstreamSocket);
    });

    upstream.on('error', (err) => {
        console.error(`Dev proxy upgrade: ${req.url} ->`, describeError(err));
        socket.destroy();
    });

    socket.on('error', () => upstream.destroy());

    upstream.end();
};
