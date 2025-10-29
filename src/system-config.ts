import cockpit from 'cockpit';
import { Interface } from '../pkg/networkmanager/interfaces.js';
import { ServerTime } from '../pkg/lib/serverTime.js';
import { Model } from './model-context';

export interface SystemInfo {
    hostname: string;
    prettyHostname?: string | undefined;
    staticHostname?: string | undefined;
    dhcpHostname: string;
    defaultInterface: string | null;
    ntpServers: string[];
}

export class SystemConfigurationService {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private hostnameClient?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private hostnameProxy?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private serverTime?: any;

    async getHostnameInfo(): Promise<{ hostname: string; prettyHostname?: string; staticHostname?: string }> {
        try {
            // Create D-Bus client for hostname1 service
            this.hostnameClient = cockpit.dbus('org.freedesktop.hostname1');
            this.hostnameProxy = this.hostnameClient.proxy('org.freedesktop.hostname1', '/org/freedesktop/hostname1');

            // Wait for proxy to be ready
            await new Promise<void>((resolve, reject) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (this.hostnameProxy as any).wait(() => {
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

    async getDhcpHostname(interfaces: Interface[]): Promise<string> {
        try {
            // Get the default interface
            const defaultInterface = await this.getDefaultInterface(interfaces);
            if (!defaultInterface) {
                return '';
            }

            // Find the interface object
            const iface = interfaces.find(i => i.Name === defaultInterface);
            if (!iface || !iface.Device || !iface.Device.ActiveConnection) {
                return '';
            }

            // Get IP4Config from the active connection
            const activeConnection = iface.Device.ActiveConnection;
            if (!activeConnection.Ip4Config) {
                return '';
            }

            // Create NetworkManager D-Bus client
            const nmClient = cockpit.dbus('org.freedesktop.NetworkManager');
            // Ip4Config is actually a D-Bus path string, not the config object
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const ip4ConfigProxy = nmClient.proxy('org.freedesktop.NetworkManager.IP4Config', activeConnection.Ip4Config as any as string);

            // Wait for proxy to be ready
            await new Promise<void>((resolve, reject) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (ip4ConfigProxy as any).wait(() => {
                    if (ip4ConfigProxy.valid) {
                        resolve();
                    } else {
                        reject(new Error('Failed to connect to IP4Config'));
                    }
                });
            });

            // Get DHCP options
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const dhcpOptions = (ip4ConfigProxy.data as any).DhcpOptions || {};

            // DHCP option 12 is the hostname option
            const dhcpHostname = dhcpOptions['12'] || '';

            nmClient.close();
            return dhcpHostname;
        } catch (error) {
            console.warn('Failed to get DHCP hostname:', error);
            return '';
        }
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
                return customNtp.servers.filter((server: string) => server && server.trim().length > 0);
            }
        } catch (error) {
            console.warn('Failed to get NTP servers via ServerTime:', error);
        }

        return [];
    }

    async getSystemInfo(interfaces: Interface[]): Promise<SystemInfo> {
        const [hostnameInfo, defaultInterface, ntpServers, dhcpHostname] = await Promise.all([
            this.getHostnameInfo(),
            this.getDefaultInterface(interfaces),
            this.getNtpServers(),
            this.getDhcpHostname(interfaces)
        ]);

        return {
            hostname: this.getFormattedHostname(hostnameInfo),
            prettyHostname: hostnameInfo.prettyHostname,
            staticHostname: hostnameInfo.staticHostname,
            dhcpHostname,
            defaultInterface,
            ntpServers
        };
    }

      async setHostname(hostname: string): Promise<void> {
        if (!hostname || !hostname.trim()) {
            throw new Error('Hostname cannot be empty');
        }

        try {
            // Create D-Bus client for hostname1 service with superuser options
            const hostnameClient = cockpit.dbus('org.freedesktop.hostname1', { superuser: 'try' });
            const hostnameProxy = hostnameClient.proxy('org.freedesktop.hostname1', '/org/freedesktop/hostname1');

            // Wait for proxy to be ready
            await new Promise<void>((resolve, reject) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (hostnameProxy as any).wait(() => {
                    if (hostnameProxy.valid) {
                        resolve();
                    } else {
                        reject(new Error('Failed to connect to hostname1 service'));
                    }
                });
            });

            // Set the static hostname with interactive authentication
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (hostnameProxy as any).call('SetStaticHostname', [hostname.trim(), true]);

            hostnameClient.close();
        } catch (error) {
            throw new Error(`Failed to set hostname: ${String(error)}`);
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async applyNetworkConfiguration(networkManager: any, model: Model): Promise<string[]> {
        const results: string[] = [];

        if (!model.networkInterface.selectedInterface) {
            results.push('No network interface selected');
            return results;
        }

        try {
            const interfaces = networkManager.list_interfaces();
            const selectedIface = interfaces.find((iface: Interface) =>
                iface.Name === model.networkInterface.selectedInterface
            );

            if (!selectedIface) {
                throw new Error(`Interface ${model.networkInterface.selectedInterface} not found`);
            }

            if (!selectedIface.MainConnection) {
                throw new Error(`Interface ${model.networkInterface.selectedInterface} has no active connection`);
            }

            const connection = selectedIface.MainConnection;
            // Create a deep copy of the existing settings to modify
            const settings = connection.copy_settings();

            // Configure IPv4
            if (!settings.ipv4) {
                settings.ipv4 = {
                    method: 'auto',
                    addresses: [],
                    dns: [],
                    dns_search: [],
                    routes: [],
                    ignore_auto_dns: false,
                    ignore_auto_routes: false
                };
            }

            if (model.networkAddress.ipv4.method === 'static') {
                settings.ipv4.method = 'manual';

                // Convert subnet mask to prefix length
                const prefixLength = model.networkAddress.ipv4.subnetMask
                    ? this.subnetMaskToPrefixLength(model.networkAddress.ipv4.subnetMask)
: 24;

                settings.ipv4.addresses = [[
                    model.networkAddress.ipv4.address,
                    prefixLength,
                    model.networkAddress.ipv4.gateway || ''
                ]];

                // Configure DNS
                settings.ipv4.ignore_auto_dns = !model.networkAddress.ipv4.autoDns;
                if (!model.networkAddress.ipv4.autoDns) {
                    settings.ipv4.dns = [
                        model.networkAddress.ipv4.primaryDns,
                        model.networkAddress.ipv4.secondaryDns
                    ].filter(dns => dns && dns.trim());
                } else {
                    settings.ipv4.dns = [];
                }

                results.push(`IPv4 configured: ${model.networkAddress.ipv4.address}/${prefixLength}`);
            } else {
                settings.ipv4.method = 'auto';
                settings.ipv4.addresses = [];
                settings.ipv4.dns = [];
                settings.ipv4.ignore_auto_dns = false;
                results.push('IPv4 configured for DHCP');
            }

            // Configure IPv6
            if (!settings.ipv6) {
                settings.ipv6 = {
                    method: 'auto',
                    addresses: [],
                    dns: [],
                    dns_search: [],
                    routes: [],
                    ignore_auto_dns: false,
                    ignore_auto_routes: false
                };
            }

            if (model.networkAddress.ipv6.method === 'static') {
                settings.ipv6.method = 'manual';

                if (model.networkAddress.ipv6.address) {
                    const { address, prefix } = this.parseIpv6Address(model.networkAddress.ipv6.address);
                    settings.ipv6.addresses = [[
                        address,
                        prefix,
                        model.networkAddress.ipv6.gateway || ''
                    ]];
                    results.push(`IPv6 configured: ${address}/${prefix}`);
                } else {
                    settings.ipv6.addresses = [];
                }

                // Configure IPv6 DNS
                settings.ipv6.ignore_auto_dns = !model.networkAddress.ipv6.autoDns;
                if (!model.networkAddress.ipv6.autoDns) {
                    settings.ipv6.dns = [
                        model.networkAddress.ipv6.primaryDns,
                        model.networkAddress.ipv6.secondaryDns
                    ].filter(dns => dns && dns.trim());
                } else {
                    settings.ipv6.dns = [];
                }
            } else if (model.networkAddress.ipv6.method === 'disabled') {
                settings.ipv6.method = 'ignore';
                settings.ipv6.addresses = [];
                settings.ipv6.dns = [];
                results.push('IPv6 disabled');
            } else {
                settings.ipv6.method = 'auto';
                settings.ipv6.addresses = [];
                settings.ipv6.dns = [];
                settings.ipv6.ignore_auto_dns = false;
                results.push('IPv6 configured for auto');
            }

            // Actually apply the network configuration using NetworkManager D-Bus
            try {
                console.log('Applying network settings to connection:', connection.Settings.connection.id);
                console.log('New settings:', settings);

                // Apply the settings to the connection using NetworkManager D-Bus
                await connection.apply_settings(settings);
                results.push(`✓ Network configuration applied to ${connection.Settings.connection.id}`);

                // Reactivate the connection to apply the new settings
                // This is necessary because apply_settings only updates the stored configuration,
                // but doesn't automatically apply it to the active connection
                if (selectedIface.Device) {
                    console.log('Reactivating connection to apply new settings:', connection.Settings.connection.id);

                    // First deactivate if there's an active connection
                    if (selectedIface.Device.ActiveConnection) {
                        await selectedIface.Device.ActiveConnection.deactivate();
                        results.push(`✓ Deactivated existing connection`);
                    }

                    // Then activate with the new settings
                    await connection.activate(selectedIface.Device, null);
                    results.push(`✓ Connection ${connection.Settings.connection.id} reactivated with new settings`);
                } else {
                    results.push(`⚠ Warning: No device found for interface, settings updated but not applied`);
                }
            } catch (networkError) {
                const errorMsg = String(networkError);
                console.error('NetworkManager configuration error:', networkError);

                // Check for common authentication errors
                if (errorMsg.includes('Interactive authentication required') ||
                    errorMsg.includes('org.freedesktop.PolicyKit1.Error.Failed')) {
                    throw new Error('Network configuration requires administrator privileges. Please ensure you have sufficient permissions.');
                }

                throw new Error(`Failed to apply network configuration: ${errorMsg}`);
            }
        } catch (error) {
            throw new Error(`Network configuration failed: ${String(error)}`);
        }

        return results;
    }

    async configureNtpServers(servers: string[], autoConfig: boolean): Promise<string[]> {
        const results: string[] = [];

        try {
            // Create timedate1 proxy for NTP configuration with superuser access
            const timedateClient = cockpit.dbus('org.freedesktop.timedate1', { superuser: 'try' });
            const timedateProxy = timedateClient.proxy('org.freedesktop.timedate1', '/org/freedesktop/timedate1');

            // Wait for proxy to be ready
            await new Promise<void>((resolve, reject) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (timedateProxy as any).wait(() => {
                    if (timedateProxy.valid) {
                        resolve();
                    } else {
                        reject(new Error('Failed to connect to timedate1 service'));
                    }
                });
            });

            // Enable NTP with proper authentication
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (timedateProxy as any).call('SetNTP', [true, true]);

            if (autoConfig) {
                results.push('NTP enabled with automatic server selection');
            } else if (servers.length > 0) {
                // Initialize ServerTime if not already done
                if (!this.serverTime) {
                    this.serverTime = new ServerTime();
                }

                // Set custom NTP servers using the correct sequence from serverTime.js
                try {
                    // Step 1: Get current NTP configuration to determine backend
                    const currentNtpConfig = await this.serverTime.get_custom_ntp();
                    console.log('Current NTP config:', currentNtpConfig);

                    // Step 2: Turn off NTP
                    await this.serverTime.set_ntp(false);

                    // Step 3: Set custom NTP configuration with proper backend
                    const customNtpConfig = {
                        backend: currentNtpConfig.backend, // Use existing backend (timesyncd or chronyd)
                        enabled: true,
                        servers: servers.filter(s => !!s) // Filter out empty servers
                    };
                    console.log('Setting NTP config:', customNtpConfig);
                    await this.serverTime.set_custom_ntp(customNtpConfig);

                    // Step 4: Turn NTP back on
                    await this.serverTime.set_ntp(true);

                    results.push(`NTP configured with custom servers (${currentNtpConfig.backend}): ${servers.join(', ')}`);
                } catch (serverTimeError) {
                    console.warn('Failed to set custom NTP servers via ServerTime:', serverTimeError);
                    results.push(`NTP enabled (custom servers: ${servers.join(', ')} - configuration may have failed: ${String(serverTimeError)})`);
                }
            } else {
                results.push('NTP enabled with default configuration');
            }

            timedateClient.close();
        } catch (error) {
            throw new Error(`NTP configuration failed: ${String(error)}`);
        }

        return results;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async applySystemConfiguration(networkManager: any, model: Model): Promise<{ success: boolean; results: string[] }> {
        const allResults: string[] = [];
        let hasErrors = false;

        // 1. Apply hostname
        if (model.hostname.value && model.hostname.value.trim()) {
            try {
                await this.setHostname(model.hostname.value);
                allResults.push(`✓ Hostname set to: ${model.hostname.value}`);
            } catch (error) {
                allResults.push(`✗ ${String(error)}`);
                hasErrors = true;
            }
        } else {
            allResults.push('- Hostname: No changes required');
        }

        // 2. Apply network configuration
        if (model.networkInterface.selectedInterface && networkManager) {
            try {
                const networkResults = await this.applyNetworkConfiguration(networkManager, model);
                networkResults.forEach(result => allResults.push(`✓ ${result}`));
            } catch (error) {
                allResults.push(`✗ ${String(error)}`);
                hasErrors = true;
            }
        } else {
            allResults.push('- Network: No interface selected or NetworkManager unavailable');
        }

        // 3. Apply NTP configuration
        try {
            const ntpResults = await this.configureNtpServers(
                model.networkServices.ntp.servers,
                model.networkServices.ntp.autoConfig
            );
            ntpResults.forEach(result => allResults.push(`✓ ${result}`));
        } catch (error) {
            allResults.push(`✗ ${String(error)}`);
            hasErrors = true;
        }

        return {
            success: !hasErrors,
            results: allResults
        };
    }

    // Helper functions
    private subnetMaskToPrefixLength(subnetMask: string): number {
        const parts = subnetMask.split('.').map(Number);
        if (parts.length !== 4) return 24; // Default fallback

        let prefixLength = 0;
        for (const part of parts) {
            prefixLength += part.toString(2).split('1').length - 1;
        }
        return prefixLength;
    }

    private parseIpv6Address(addressWithPrefix: string): { address: string; prefix: number } {
        if (!addressWithPrefix) {
            return { address: '', prefix: 64 };
        }

        const parts = addressWithPrefix.split('/');
        const address = parts[0] || '';
        const prefix = parts[1] ? parseInt(parts[1], 10) : 64;

        return { address, prefix };
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

export const systemConfigurationService = new SystemConfigurationService();
