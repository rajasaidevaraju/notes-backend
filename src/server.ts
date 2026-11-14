import http from 'http';
import https from 'https';
import net from 'net';
import { Duplex } from 'stream';
import type { Express } from 'express';
import type { Env } from './config/env';
import { isRequestLocal } from './middleware/localOnly';
import { loadCa, issueLeaf, lanIps, startCertRotation, describeIps } from './tls';

type UpgradeHandler = (req: http.IncomingMessage, socket: Duplex, head: Buffer) => void;

export interface RunningServer {
    close(done: () => void): void;
}

interface StartOptions {
    port: number;
    tls: Env['tls'];
    onUpgrade?: UpgradeHandler;
    onError: (err: Error) => void;
}

export function startServer(app: Express, options: StartOptions): RunningServer {
    return options.tls ? startDualProtocol(app, options) : startPlainHttp(app, options);
}

function startPlainHttp(app: Express, { port, onUpgrade, onError }: StartOptions): RunningServer {
    const server = http.createServer(app);
    if (onUpgrade) server.on('upgrade', onUpgrade);
    server.on('error', onError);
    server.listen(port, () => {
        console.log(`Server is running on http://localhost:${port} (TLS disabled)`);
    });

    return {
        close(done) {
            server.close(() => done());
            server.closeIdleConnections();
        },
    };
}

const TLS_HANDSHAKE_RECORD = 0x16;
const FIRST_BYTE_TIMEOUT_MS = 10_000;


function startDualProtocol(app: Express, { port, tls, onUpgrade, onError }: StartOptions): RunningServer {
    const ca = loadCa(tls!);
    const leaf = issueLeaf(ca, lanIps());

    const httpsServer = https.createServer({ key: leaf.key, cert: leaf.cert }, app);
    const httpServer = http.createServer((req, res) => {
        if (isRequestLocal(req)) {
            app(req, res);
            return;
        }
        const host = req.headers.host;
        if (!host) {
            res.writeHead(400, { 'Content-Type': 'text/plain' }).end('Missing Host header.');
            return;
        }
        res.writeHead(308, { Location: `https://${host}${req.url ?? '/'}` }).end();
    });

    if (onUpgrade) {
        httpsServer.on('upgrade', onUpgrade);
        httpServer.on('upgrade', (req, socket, head) => {
            if (isRequestLocal(req)) onUpgrade(req, socket, head);
            else socket.destroy();
        });
    }

    const stopRotation = startCertRotation(ca, leaf, (next) => {
        httpsServer.setSecureContext({ key: next.key, cert: next.cert });
    });

    const mux = net.createServer((socket) => {
        const dropEarly = () => socket.destroy();
        socket.on('error', dropEarly);
        socket.setTimeout(FIRST_BYTE_TIMEOUT_MS, dropEarly);

        socket.once('data', (chunk: Buffer) => {
            socket.removeListener('error', dropEarly);
            socket.setTimeout(0);
            socket.pause();
            socket.unshift(chunk);
            const target = chunk[0] === TLS_HANDSHAKE_RECORD ? httpsServer : httpServer;
            target.emit('connection', socket);
            process.nextTick(() => socket.resume());
        });
    });

    mux.on('error', onError);
    mux.listen(port, () => {
        httpServer.emit('listening');
        httpsServer.emit('listening');

        console.log(`Server is running on http://localhost:${port}`);
        console.log(`LAN (HTTPS): ${leaf.ips.map((ip) => `https://${ip}:${port}`).join(', ') || describeIps(leaf.ips)}`);
        console.log(`TLS CA fingerprint (SHA-256): ${ca.fingerprint256}`);
    });

    return {
        close(done) {
            stopRotation();
            mux.close(() => done());
            httpServer.close();
            httpsServer.close();
        },
    };
}
