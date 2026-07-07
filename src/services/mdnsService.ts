import { Bonjour, Service } from 'bonjour-service';

let bonjour: Bonjour | null = null;
let service: Service | null = null;

export const MdnsService = {

    start(port: number): void {
        const isProduction = process.env.NODE_ENV === 'production';
        const host = isProduction
            ? (process.env.MDNS_HOST || 'notes.local')
            : 'notesdev.local';

        try {
            bonjour = new Bonjour();
            service = bonjour.publish({
                name: isProduction ? 'Notes' : 'Notes (dev)',
                type: 'http',
                port,
                host,
            });

            service.on('up', () => {
                console.log(`mDNS: advertising as http://${host}:${port}`);
            });
            service.on('error', (err: Error) => {
                console.error('mDNS advertising error:', err.message);
            });
        } catch (err: any) {
            console.error('Failed to start mDNS advertising:', err.message);
        }
    },

    stop(): void {
        try {
            service?.stop?.();
            bonjour?.destroy();
        } catch (err: any) {
            console.error('Error stopping mDNS advertising:', err.message);
        } finally {
            service = null;
            bonjour = null;
        }
    },
};
