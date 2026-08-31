import os from 'os';

export function getIpAddress(): string {
    const networkInterfaces = os.networkInterfaces();

    for (const interfaceName in networkInterfaces) {
        for (const alias of networkInterfaces[interfaceName] ?? []) {
            if (alias.family === 'IPv4' && !alias.internal) {
                return alias.address;
            }
        }
    }

    return 'Not Found';
}
