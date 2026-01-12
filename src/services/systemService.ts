import os from 'os';

export class SystemService {
    static getIpAddress(): string {
        const networkInterfaces = os.networkInterfaces();
        let serverIpAddress = 'Not Found';

        for (const interfaceName in networkInterfaces) {
            const networkInterface = networkInterfaces[interfaceName];
            if (networkInterface) {
                for (const alias of networkInterface) {
                    if (alias.family === 'IPv4' && !alias.internal) {
                        serverIpAddress = alias.address;
                        break;
                    }
                }
            }
            if (serverIpAddress !== 'Not Found') {
                break;
            }
        }

        return serverIpAddress;
    }
}
