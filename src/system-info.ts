import cockpit from 'cockpit';
import { Interface } from './interfaces.js';
import { ServerTime } from '../pkg/lib/serverTime.js';

export interface SystemInfo {
    hostname: string;
    prettyHostname?: string;
    staticHostname?: string;
    defaultInterface: string | null;
    ntpServers: string[];
}

export class SystemInfoService {
    private hostnameClient?: any;
    private hostnameProxy?: any;
    private serverTime?: any;

    async getHostnameInfo(): Promise<{ hostname: string; prettyHostname?: string; staticHostname?: string }> {
        try {
            // Create D-Bus client for hostname1 service
            this.hostnameClient = cockpit.dbus('org.freedesktop.hostname1');
            this.hostnameProxy = this.hostnameClient.proxy('org.freedesktop.hostname1', '/org/freedesktop/hostname1');

            // Wait for proxy to be ready
            await new Promise<void>((resolve, reject) => {
                this.hostnameProxy.wait(() => {
                    if (this.hostnameProxy.valid) {
                        resolve();
                    } else {
                        reject(new Error('Failed to connect to hostname1 service'));
                    }
                });
            });

            const hostnameData = this.hostnameProxy.data;
            return {
                hostname: hostnameData.Hostname || '',
                prettyHostname: hostnameData.PrettyHostname || undefined,
                staticHostname: hostnameData.StaticHostname || undefined
            };
        } catch (error) {
            console.warn('Failed to get hostname via D-Bus:', error);
            return { hostname: '' };
        }
    }

    getFormattedHostname(hostnameInfo: { hostname: string; prettyHostname?: string; staticHostname?: string }): string {
        const { hostname, prettyHostname, staticHostname } = hostnameInfo;

        if (prettyHostname && staticHostname && staticHostname !== prettyHostname) {
            return `${prettyHostname} (${staticHostname})`;
        } else if (staticHostname) {
            return staticHostname;
        }

        return hostname || '';
    }

    async getDefaultInterface(interfaces: Interface[]): Promise<string | null> {
        try {
            // Get default route to find primary interface
            const result = await cockpit.spawn(['ip', 'route', 'show', 'default'], { err: 'message' });
            const lines = result.split('\n');

            for (const line of lines) {
                const match = line.match(/default via .+ dev (\S+)/);
                if (match) {
                    const interfaceName = match[1];
                    // Verify this interface exists in our NetworkManager interfaces
                    const found = interfaces.find(iface => iface.Name === interfaceName);
                    if (found) {
                        return interfaceName;
                    }
                }
            }
        } catch (error) {
            console.warn('Failed to get default route:', error);
        }

        // Fallback: find first active interface
        const activeInterface = interfaces.find(iface =>
            iface.Device && iface.Device.State === 100 // NM_DEVICE_STATE_ACTIVATED
        );

        return activeInterface ? activeInterface.Name : null;
    }

    async getNtpServers(): Promise<string[]> {
        try {
            // Initialize ServerTime if not already done
            if (!this.serverTime) {
                this.serverTime = new ServerTime();
            }

            // Use ServerTime's get_custom_ntp function to get NTP servers
            const customNtp = await this.serverTime.get_custom_ntp();

            if (customNtp && customNtp.servers && Array.isArray(customNtp.servers)) {
                // Filter out empty strings and return the servers
                return customNtp.servers.filter(server => server && server.trim().length > 0);
            }
        } catch (error) {
            console.warn('Failed to get NTP servers via ServerTime:', error);
        }

        return [];
    }

    async getSystemInfo(interfaces: Interface[]): Promise<SystemInfo> {
        const [hostnameInfo, defaultInterface, ntpServers] = await Promise.all([
            this.getHostnameInfo(),
            this.getDefaultInterface(interfaces),
            this.getNtpServers()
        ]);

        return {
            hostname: this.getFormattedHostname(hostnameInfo),
            prettyHostname: hostnameInfo.prettyHostname,
            staticHostname: hostnameInfo.staticHostname,
            defaultInterface,
            ntpServers
        };
    }

    close() {
        if (this.hostnameClient) {
            this.hostnameClient.close();
        }
        if (this.serverTime) {
            this.serverTime.close();
        }
    }
}

export const systemInfoService = new SystemInfoService();
