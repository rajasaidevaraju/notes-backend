import fs from 'fs';
import dotenv from 'dotenv';

// Single source of truth for configuration: every other module imports `env`
// from here instead of reading process.env. Validation runs once, on first
// import, and throws with every problem listed so a bad .env fails fast.
dotenv.config();

type NodeEnv = 'production' | 'development';

export interface TlsConfig {
    caKeyPath: string;
    caCertPath: string;
}

export interface Env {
    nodeEnv: NodeEnv;
    isProduction: boolean;
    port: number;
    databasePath: string;
    hiddenNotesPin: string;
    frontendDevPort: number;
    tls: TlsConfig | null;
}

const NODE_ENVS: readonly NodeEnv[] = ['production', 'development'];

function readEnv(source: NodeJS.ProcessEnv): Env {
    const errors: string[] = [];

    const str = (name: string): string | undefined => {
        const value = source[name]?.trim();
        return value ? value : undefined;
    };

    const portVar = (name: string, fallback: number): number => {
        const raw = str(name);
        if (raw === undefined) return fallback;
        const value = Number(raw);
        if (!Number.isInteger(value) || value < 1 || value > 65535) {
            errors.push(`${name} must be an integer between 1 and 65535 (got "${raw}").`);
            return fallback;
        }
        return value;
    };

    const readableFile = (name: string, filePath: string): void => {
        try {
            fs.accessSync(filePath, fs.constants.R_OK);
            if (!fs.statSync(filePath).isFile()) {
                errors.push(`${name} must point to a file (got "${filePath}").`);
            }
        } catch {
            errors.push(`${name} file is missing or unreadable: "${filePath}".`);
        }
    };

    const rawNodeEnv = str('NODE_ENV') ?? 'development';
    let nodeEnv: NodeEnv = 'development';
    if (NODE_ENVS.includes(rawNodeEnv as NodeEnv)) {
        nodeEnv = rawNodeEnv as NodeEnv;
    } else {
        errors.push(`NODE_ENV must be one of ${NODE_ENVS.join(', ')} (got "${rawNodeEnv}").`);
    }
    const isProduction = nodeEnv === 'production';

    const port = portVar('PORT', 3002);
    const frontendDevPort = portVar('FRONTEND_DEV_PORT', 3003);

    const databasePath = str('DATABASE_PATH') ?? '';
    if (!databasePath) errors.push('DATABASE_PATH must be set.');

    const hiddenNotesPin = source.HIDDEN_NOTES_PIN ?? '';
    if (hiddenNotesPin.length !== 4) {
        errors.push('HIDDEN_NOTES_PIN must be set to a 4-character value.');
    }

    const caKeyPath = str('TLS_CA_KEY');
    const caCertPath = str('TLS_CA_CERT');
    let tls: TlsConfig | null = null;

    if (caKeyPath && caCertPath) {
        readableFile('TLS_CA_KEY', caKeyPath);
        readableFile('TLS_CA_CERT', caCertPath);
        tls = { caKeyPath, caCertPath };
    } else if (caKeyPath || caCertPath) {
        errors.push('TLS_CA_KEY and TLS_CA_CERT must be set together.');
    } else if (isProduction) {
        errors.push('TLS_CA_KEY and TLS_CA_CERT are required when NODE_ENV=production.');
    }

    if (errors.length) {
        throw new Error(
            `Invalid environment configuration; refusing to start:\n  - ${errors.join('\n  - ')}`
        );
    }

    return { nodeEnv, isProduction, port, databasePath, hiddenNotesPin, frontendDevPort, tls };
}

export const env: Readonly<Env> = Object.freeze(readEnv(process.env));
