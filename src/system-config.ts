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

            // Check if the interface is using DHCP (auto) before querying DHCP options
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const ipv4Method = (iface.MainConnection?.Settings as any)?.ipv4?.method;
            if (ipv4Method === 'manual') {
                // Static IP configuration - no DHCP hostname available
                return '';
            }

            // Get IP4Config from the active connection
            const activeConnection = iface.Device.ActiveConnection;
            if (!activeConnection.Ip4Config) {
                return '';
            }

            // Create NetworkManager D-Bus client with superuser access
            const nmClient = cockpit.dbus('org.freedesktop.NetworkManager', { superuser: 'try' });
            // Ip4Config is actually a D-Bus path string, not the config object
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const ip4ConfigProxy = nmClient.proxy('org.freedesktop.NetworkManager.IP4Config', activeConnection.Ip4Config as any as string);

            // Wait for proxy to be ready with a 2 second timeout
            await Promise.race([
                new Promise<void>((resolve, reject) => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (ip4ConfigProxy as any).wait(() => {
                        if (ip4ConfigProxy.valid) {
                            resolve();
                        } else {
                            reject(new Error('Failed to connect to IP4Config'));
                        }
                    });
                }),
                new Promise<void>((_resolve, reject) => {
                    setTimeout(() => reject(new Error('Timeout waiting for IP4Config proxy')), 2000);
                })
            ]);

            // Get DHCP options
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const dhcpOptions = (ip4ConfigProxy.data as any).DhcpOptions || {};

            // DHCP option 12 is the hostname option
            const dhcpHostname = dhcpOptions['12'] || '';

            nmClient.close();
            return dhcpHostname;
        } catch (error) {
            // DHCP hostname is optional, so just warn if unavailable
            console.warn('Could not retrieve DHCP hostname:', error);
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
        // Fetch system information with error handling for each component
        const hostnameInfo = await this.getHostnameInfo().catch((err): { hostname: string; prettyHostname?: string; staticHostname?: string } => {
            console.error('Failed to get hostname info:', err);
            return { hostname: '' };
        });

        const defaultInterface = await this.getDefaultInterface(interfaces).catch((err): string | null => {
            console.error('Failed to get default interface:', err);
            return null;
        });

        const ntpServers = await this.getNtpServers().catch((err): string[] => {
            console.error('Failed to get NTP servers:', err);
            return [];
        });

        const dhcpHostname = await this.getDhcpHostname(interfaces).catch((err): string => {
            console.warn('Failed to get DHCP hostname:', err);
            return '';
        });

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

                // Cockpit NM model uses address_data (array of {address, prefix} objects)
                // and gateway as a separate field — not the raw NM 'addresses' array
                settings.ipv4.address_data = [{
                    address: model.networkAddress.ipv4.address,
                    prefix: String(prefixLength),
                }];
                settings.ipv4.gateway = model.networkAddress.ipv4.gateway || '';

                // Configure DNS (Cockpit NM model uses dns_data, not dns)
                settings.ipv4.ignore_auto_dns = !model.networkAddress.ipv4.autoDns;
                if (!model.networkAddress.ipv4.autoDns) {
                    settings.ipv4.dns_data = [
                        model.networkAddress.ipv4.primaryDns,
                        model.networkAddress.ipv4.secondaryDns
                    ].filter(dns => dns && dns.trim());
                } else {
                    settings.ipv4.dns_data = [];
                }

                results.push(`IPv4 configured: ${model.networkAddress.ipv4.address}/${prefixLength}`);
            } else {
                settings.ipv4.method = 'auto';
                settings.ipv4.address_data = [];
                settings.ipv4.gateway = '';
                settings.ipv4.dns_data = [];
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
                    settings.ipv6.address_data = [{
                        address,
                        prefix: String(prefix),
                    }];
                    settings.ipv6.gateway = model.networkAddress.ipv6.gateway || '';
                    results.push(`IPv6 configured: ${address}/${prefix}`);
                } else {
                    settings.ipv6.address_data = [];
                    settings.ipv6.gateway = '';
                }

                // Configure IPv6 DNS (Cockpit NM model uses dns_data)
                settings.ipv6.ignore_auto_dns = !model.networkAddress.ipv6.autoDns;
                if (!model.networkAddress.ipv6.autoDns) {
                    settings.ipv6.dns_data = [
                        model.networkAddress.ipv6.primaryDns,
                        model.networkAddress.ipv6.secondaryDns
                    ].filter(dns => dns && dns.trim());
                } else {
                    settings.ipv6.dns_data = [];
                }
            } else if (model.networkAddress.ipv6.method === 'disabled') {
                settings.ipv6.method = 'ignore';
                settings.ipv6.address_data = [];
                settings.ipv6.gateway = '';
                settings.ipv6.dns_data = [];
                results.push('IPv6 disabled');
            } else {
                settings.ipv6.method = 'auto';
                settings.ipv6.address_data = [];
                settings.ipv6.gateway = '';
                settings.ipv6.dns_data = [];
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

    async getCurrentWifiConnection(interfaceName: string): Promise<{
        ssid: string;
        bssid: string;
        password: string;
        security: 'none' | 'wep' | 'wpa';
    } | null> {
        try {
            // Use superuser access to read connection secrets
            const nmClient = cockpit.dbus('org.freedesktop.NetworkManager', { superuser: 'try' });
            const nmManager = nmClient.proxy('org.freedesktop.NetworkManager', '/org/freedesktop/NetworkManager');

            // Wait for manager proxy to be ready
            await new Promise<void>((resolve, reject) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (nmManager as any).wait(() => {
                    if (nmManager.valid) {
                        resolve();
                    } else {
                        reject(new Error('Failed to connect to NetworkManager'));
                    }
                });
            });

            // Get all devices and find the WiFi device for this interface
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const devicePaths = (nmManager.data as any).Devices || [];
            let devicePath = null;
            let activeConnectionPath = null;

            for (const path of devicePaths) {
                const devProxy = nmClient.proxy('org.freedesktop.NetworkManager.Device', path);
                await new Promise<void>((resolve, reject) => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (devProxy as any).wait(() => {
                        if (devProxy.valid) {
                            resolve();
                        } else {
                            reject(new Error('Failed to connect to device'));
                        }
                    });
                });

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const devData = devProxy.data as any;
                if (devData.Interface === interfaceName && devData.DeviceType === 2) { // 2 = WiFi
                    devicePath = path;
                    activeConnectionPath = devData.ActiveConnection;
                    break;
                }
            }

            if (!devicePath || !activeConnectionPath || activeConnectionPath === '/') {
                // No active WiFi connection
                nmClient.close();
                return null;
            }

            // Get active connection details
            const activeConnProxy = nmClient.proxy('org.freedesktop.NetworkManager.Connection.Active', activeConnectionPath);
            await new Promise<void>((resolve, reject) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (activeConnProxy as any).wait(() => {
                    if (activeConnProxy.valid) {
                        resolve();
                    } else {
                        reject(new Error('Failed to connect to active connection'));
                    }
                });
            });

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const activeConnData = activeConnProxy.data as any;
            const connectionPath = activeConnData.Connection;

            if (!connectionPath || connectionPath === '/') {
                nmClient.close();
                return null;
            }

            // Get the connection settings
            const connectionProxy = nmClient.proxy('org.freedesktop.NetworkManager.Settings.Connection', connectionPath);
            await new Promise<void>((resolve, reject) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (connectionProxy as any).wait(() => {
                    if (connectionProxy.valid) {
                        resolve();
                    } else {
                        reject(new Error('Failed to connect to connection'));
                    }
                });
            });

            // Get connection settings including secrets
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const settingsResult = await (connectionProxy as any).call('GetSettings', []);
            const settings = settingsResult[0];

            // Get connection secrets (includes WiFi password)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let secrets: any = {};
            try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const secretsResult = await (connectionProxy as any).call('GetSecrets', ['802-11-wireless-security']);
                secrets = secretsResult[0];
            } catch (secretsError) {
                console.warn('Failed to get WiFi secrets, password will not be available:', secretsError);
                // Continue without secrets - we can still pre-select the network
            }

            // Extract SSID
            const ssidRaw = settings['802-11-wireless']?.ssid;

            let ssid = '';
            if (ssidRaw?.v) {
                const ssidBytes = ssidRaw.v;

                if (Array.isArray(ssidBytes)) {
                    // Array of bytes
                    ssid = new TextDecoder().decode(new Uint8Array(ssidBytes));
                } else if (typeof ssidBytes === 'string') {
                    // Base64 encoded string (Cockpit D-Bus returns byte arrays as base64)
                    try {
                        const decoded = atob(ssidBytes);
                        ssid = decoded;
                    } catch (e) {
                        console.error('Failed to decode base64 SSID:', e);
                        ssid = ssidBytes;
                    }
                }
            }

            // Extract BSSID (if available, otherwise use empty string)
            const bssidRaw = settings['802-11-wireless']?.bssid?.v;
            let bssid = '';
            if (bssidRaw) {
                bssid = bssidRaw;
            }

            // Extract password from secrets
            let password = '';
            const securitySettings = secrets['802-11-wireless-security'];
            if (securitySettings) {
                // Try different possible password fields
                password = securitySettings.psk?.v ||
                          securitySettings['wep-key0']?.v ||
                          securitySettings['leap-password']?.v ||
                          '';
            }

            // Determine security type
            let security: 'none' | 'wep' | 'wpa' = 'none';
            const keyMgmt = settings['802-11-wireless-security']?.['key-mgmt']?.v;
            if (keyMgmt) {
                if (keyMgmt === 'none') {
                    security = 'wep';
                } else if (keyMgmt.includes('wpa') || keyMgmt.includes('sae')) {
                    security = 'wpa';
                }
            }

            nmClient.close();

            return {
                ssid,
                bssid,
                password,
                security
            };
        } catch (error) {
            console.error('Failed to get current WiFi connection:', error);
            return null;
        }
    }

    async scanWifiNetworks(interfaceName: string): Promise<Array<{
        ssid: string;
        strength: number;
        security: string; // e.g., "None", "WEP", "WPA", "WPA2", "WPA3", "WPA2/WPA3"
        frequency: number;
        channel: number;
        band: '2.4 GHz' | '5 GHz' | 'unknown';
        rate: number;
        bssid: string;
    }>> {
        try {
            // Get device path from NetworkManager
            // We need to find the device path by querying NetworkManager for all devices
            // and finding the one with matching Interface property
            // Use superuser access for WiFi scanning (requires elevated privileges)
            const nmClient = cockpit.dbus('org.freedesktop.NetworkManager', { superuser: 'try' });
            const nmManager = nmClient.proxy('org.freedesktop.NetworkManager', '/org/freedesktop/NetworkManager');

            // Wait for manager proxy to be ready
            await new Promise<void>((resolve, reject) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (nmManager as any).wait(() => {
                    if (nmManager.valid) {
                        resolve();
                    } else {
                        reject(new Error('Failed to connect to NetworkManager'));
                    }
                });
            });

            // Get all devices and find the one matching our interface name
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const devicePaths = (nmManager.data as any).Devices || [];
            let devicePath = null;

            for (const path of devicePaths) {
                const devProxy = nmClient.proxy('org.freedesktop.NetworkManager.Device', path);
                await new Promise<void>((resolve, reject) => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (devProxy as any).wait(() => {
                        if (devProxy.valid) {
                            resolve();
                        } else {
                            reject(new Error('Failed to connect to device'));
                        }
                    });
                });

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const devData = devProxy.data as any;
                if (devData.Interface === interfaceName && devData.DeviceType === 2) { // 2 = WiFi
                    devicePath = path;
                    break;
                }
            }

            if (!devicePath) {
                throw new Error(`WiFi device ${interfaceName} not found`);
            }

            const deviceProxy = nmClient.proxy('org.freedesktop.NetworkManager.Device.Wireless', devicePath);

            // Wait for proxy to be ready
            await new Promise<void>((resolve, reject) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (deviceProxy as any).wait(() => {
                    if (deviceProxy.valid) {
                        resolve();
                    } else {
                        reject(new Error('Failed to connect to WiFi device'));
                    }
                });
            });

            // Request WiFi scan
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (deviceProxy as any).call('RequestScan', [{}]);

            // Wait for scan to complete (typical scan takes 2-3 seconds)
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Get access points
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const deviceData = deviceProxy.data as any;
            const apPaths = deviceData.AccessPoints || [];
            const aps = [];

            for (const apPath of apPaths) {
                try {
                    const apProxy = nmClient.proxy('org.freedesktop.NetworkManager.AccessPoint', apPath);

                    // Wait for access point proxy to be ready
                    await new Promise<void>((resolve, reject) => {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (apProxy as any).wait(() => {
                            if (apProxy.valid) {
                                resolve();
                            } else {
                                reject(new Error('Failed to connect to access point'));
                            }
                        });
                    });

                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const apData = apProxy.data as any;

                // Decode SSID - Cockpit's DBUS proxy returns byte arrays as Base64 strings
                const ssidData = apData.Ssid || '';

                let ssid = '';
                if (typeof ssidData === 'string') {
                    // SSID is Base64 encoded, decode it
                    try {
                        const base64Decoded = atob(ssidData);
                        ssid = base64Decoded;
                    } catch (e) {
                        console.error('Failed to decode Base64 SSID:', e);
                    }
                } else if (Array.isArray(ssidData)) {
                    // Fallback: if it's a byte array
                    ssid = new TextDecoder().decode(new Uint8Array(ssidData));
                }

                // Skip hidden SSIDs (empty strings)
                if (!ssid || ssid.trim().length === 0) {
                    continue;
                }

                const strength = apData.Strength || 0;
                const frequency = apData.Frequency || 0;
                const bssid = apData.HwAddress || '';
                const rate = Math.floor((apData.MaxBitrate || 0) / 1000); // Convert from Kbps to Mbps

                // Get channel from NetworkManager (not computed from frequency)
                // NetworkManager may provide this via the wireless device, but typically
                // we compute it from frequency for display purposes
                // Channel calculation based on standard WiFi channels
                let channel = 0;
                if (frequency >= 2412 && frequency <= 2484) {
                    // 2.4 GHz band
                    if (frequency === 2484) {
                        channel = 14;
                    } else {
                        channel = Math.floor((frequency - 2407) / 5);
                    }
                } else if (frequency >= 5000) {
                    // 5 GHz band
                    channel = Math.floor((frequency - 5000) / 5);
                }

                // Determine band based on channel number
                let band: '2.4 GHz' | '5 GHz' | 'unknown' = 'unknown';
                if (channel >= 1 && channel <= 14) {
                    band = '2.4 GHz';
                } else if (channel >= 32 && channel <= 177) {
                    band = '5 GHz';
                }

                // Determine security type from flags
                // NetworkManager AP security flags:
                // - Flags: 0x1 = privacy required (WEP or authentication needed)
                // - WpaFlags: WPA (older) security flags
                // - RsnFlags: WPA2/WPA3 (RSN = Robust Security Network) flags
                //   - 0x100 = WPA-PSK (WPA2-Personal)
                //   - 0x400 = SAE (WPA3-Personal)
                const flags = apData.Flags || 0;
                const wpaFlags = apData.WpaFlags || 0;
                const rsnFlags = apData.RsnFlags || 0;

                const securityMethods: string[] = [];

                // Check for WPA3 (SAE - Simultaneous Authentication of Equals)
                const NM_802_11_AP_SEC_KEY_MGMT_SAE = 0x400;
                if (rsnFlags & NM_802_11_AP_SEC_KEY_MGMT_SAE) {
                    securityMethods.push('WPA3');
                }

                // Check for WPA2 (RSN with PSK or 802.1X but not SAE-only)
                const NM_802_11_AP_SEC_KEY_MGMT_PSK = 0x100;
                const NM_802_11_AP_SEC_KEY_MGMT_802_1X = 0x200;
                if (rsnFlags !== 0 && (rsnFlags & (NM_802_11_AP_SEC_KEY_MGMT_PSK | NM_802_11_AP_SEC_KEY_MGMT_802_1X))) {
                    if (!securityMethods.includes('WPA3') || (rsnFlags & ~NM_802_11_AP_SEC_KEY_MGMT_SAE)) {
                        securityMethods.push('WPA2');
                    }
                }

                // Check for WPA (older)
                if (wpaFlags !== 0) {
                    securityMethods.push('WPA');
                }

                // Check for WEP (privacy flag set but no WPA/RSN)
                const NM_802_11_AP_FLAGS_PRIVACY = 0x1;
                if (securityMethods.length === 0 && (flags & NM_802_11_AP_FLAGS_PRIVACY)) {
                    securityMethods.push('WEP');
                }

                // Determine final security string
                let security: string;
                if (securityMethods.length === 0) {
                    security = 'None';
                } else if (securityMethods.length > 1) {
                    // Multiple methods supported (e.g., "WPA2/WPA3")
                    security = securityMethods.join('/');
                } else {
                    security = securityMethods[0];
                }

                    aps.push({ ssid, strength, security, frequency, channel, band, rate, bssid });
                } catch (error) {
                    // Skip this access point if there's an error reading it
                    console.warn(`Failed to read access point ${apPath}:`, error);
                    continue;
                }
            }

            nmClient.close();

            // Sort by signal strength (strongest first)
            aps.sort((a, b) => b.strength - a.strength);

            return aps;
        } catch (error) {
            console.error('WiFi scan failed:', error);
            throw new Error(`WiFi network scan failed: ${String(error)}`);
        }
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
