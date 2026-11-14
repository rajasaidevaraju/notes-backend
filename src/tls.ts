import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import forge from 'node-forge';
import type { TlsConfig } from './config/env';

const LEAF_VALIDITY_MS = 30 * 24 * 60 * 60 * 1000;
const LEAF_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const POLL_INTERVAL_MS = 5_000;

export interface Ca {
    cert: forge.pki.Certificate;
    key: forge.pki.rsa.PrivateKey;
    notAfter: Date;
    fingerprint256: string;
}

export interface Leaf {
    key: string;
    cert: string;
    ips: string[];
    issuedAt: number;
}

export function loadCa({ caKeyPath, caCertPath }: TlsConfig): Ca {
    const certPem = fs.readFileSync(caCertPath, 'utf8');
    const keyPem = fs.readFileSync(caKeyPath, 'utf8');

    let x509: crypto.X509Certificate;
    let privateKey: crypto.KeyObject;
    try {
        x509 = new crypto.X509Certificate(certPem);
        privateKey = crypto.createPrivateKey(keyPem);
    } catch (err) {
        throw new Error(`Could not parse TLS CA files (${caCertPath}, ${caKeyPath}): ${(err as Error).message}`);
    }

    if (!x509.ca) throw new Error(`${caCertPath} is not a CA certificate (basicConstraints CA:TRUE missing).`);
    if (!x509.checkPrivateKey(privateKey)) throw new Error(`${caKeyPath} does not match ${caCertPath}.`);
    
    if (privateKey.asymmetricKeyType !== 'rsa') {
        throw new Error(`TLS CA key must be RSA (got ${privateKey.asymmetricKeyType}).`);
    }

    const notAfter = new Date(x509.validTo);
    if (notAfter.getTime() <= Date.now()) throw new Error(`TLS CA certificate expired on ${x509.validTo}.`);

    const pkcs8 = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;

    return {
        cert: forge.pki.certificateFromPem(certPem),
        key: forge.pki.privateKeyFromPem(pkcs8) as forge.pki.rsa.PrivateKey,
        notAfter,
        fingerprint256: x509.fingerprint256,
    };
}

const isPrivateV4 = (ip: string): boolean => {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
};

export const lanIps = (): string[] =>
    [...new Set(
        Object.values(os.networkInterfaces())
            .flat()
            .filter((a): a is os.NetworkInterfaceInfo =>
                !!a && a.family === 'IPv4' && !a.internal && isPrivateV4(a.address))
            .map((a) => a.address)
    )].sort();

function buildLeaf(ca: Ca, ips: string[], privateKey: crypto.KeyObject): Leaf {
    const keyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
    const key = forge.pki.privateKeyFromPem(keyPem) as forge.pki.rsa.PrivateKey;

    const now = Date.now();
    const cert = forge.pki.createCertificate();
    cert.publicKey = forge.pki.setRsaPublicKey(key.n, key.e);
    cert.serialNumber = '01' + crypto.randomBytes(15).toString('hex');
    cert.validity.notBefore = new Date(now - 60_000);
    cert.validity.notAfter = new Date(Math.min(now + LEAF_VALIDITY_MS, ca.notAfter.getTime()));
    cert.setSubject([{ name: 'commonName', value: 'notes' }]);
    cert.setIssuer(ca.cert.subject.attributes);

    const extensions: any[] = [
        { name: 'basicConstraints', cA: false },
        { name: 'keyUsage', critical: true, digitalSignature: true, keyEncipherment: true },
        { name: 'extKeyUsage', serverAuth: true },
        {
            name: 'subjectAltName',
            altNames: [
                { type: 2, value: 'localhost' },
                ...['127.0.0.1', ...ips].map((ip) => ({ type: 7, ip })),
            ],
        },
        { name: 'subjectKeyIdentifier' },
    ];
    const caSki = ca.cert.getExtension('subjectKeyIdentifier') as { subjectKeyIdentifier?: string } | undefined;
    if (caSki?.subjectKeyIdentifier) {
        extensions.push({
            name: 'authorityKeyIdentifier',
            keyIdentifier: forge.util.hexToBytes(caSki.subjectKeyIdentifier),
        });
    }
    cert.setExtensions(extensions);
    cert.sign(ca.key, forge.md.sha256.create());

    return { key: keyPem, cert: forge.pki.certificateToPem(cert), ips, issuedAt: now };
}

const RSA_OPTIONS = { modulusLength: 2048 } as const;

export function issueLeaf(ca: Ca, ips: string[]): Leaf {
    const { privateKey } = crypto.generateKeyPairSync('rsa', RSA_OPTIONS);
    return buildLeaf(ca, ips, privateKey);
}

async function issueLeafAsync(ca: Ca, ips: string[]): Promise<Leaf> {
    const privateKey = await new Promise<crypto.KeyObject>((resolve, reject) =>
        crypto.generateKeyPair('rsa', RSA_OPTIONS, (err, _pub, priv) => (err ? reject(err) : resolve(priv)))
    );
    return buildLeaf(ca, ips, privateKey);
}


export function startCertRotation(
    ca: Ca,
    initial: Leaf,
    apply: (leaf: Leaf) => void
): () => void {
    let current = initial;
    let busy = false;

    const timer = setInterval(async () => {
        if (busy) return;
        const ips = lanIps();
        const ipsChanged = ips.join() !== current.ips.join();
        if (!ipsChanged && Date.now() - current.issuedAt < LEAF_MAX_AGE_MS) return;

        busy = true;
        try {
            const leaf = await issueLeafAsync(ca, ips);
            apply(leaf);
            current = leaf;
            console.log(`TLS certificate re-issued for ${describeIps(ips)}.`);
        } catch (err) {
            console.error('TLS certificate re-issue failed; keeping the previous one:', err);
        } finally {
            busy = false;
        }
    }, POLL_INTERVAL_MS);
    timer.unref();

    return () => clearInterval(timer);
}

export const describeIps = (ips: string[]): string =>
    ips.length ? ips.join(', ') : 'localhost only (no private LAN IP)';
