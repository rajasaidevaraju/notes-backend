import os from 'os';

// Android lists virtual/cellular interfaces alongside Wi-Fi, 
// so taking the first external IPv4 can report an unreachable address.
function interfacePriority(name: string): number {
    if (/^(wlan|wl|eth|en|ap|swlan)/i.test(name)) return 0;
    if (/^(r_rmnet|rmnet|ccmni|pdp|wwan|tun|dummy|v4-|vgate)/i.test(name)) return 2;
    return 1;
}

export function getIpAddress(): string {
    const networkInterfaces = os.networkInterfaces();
    let best: { address: string; priority: number } | null = null;

    for (const interfaceName in networkInterfaces) {
        const priority = interfacePriority(interfaceName);
        for (const alias of networkInterfaces[interfaceName] ?? []) {
            if (alias.family === 'IPv4' && !alias.internal && (!best || priority < best.priority)) {
                best = { address: alias.address, priority };
            }
        }
    }

    return best?.address ?? 'Not Found';
}
