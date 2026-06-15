import { Interface } from '../pkg/networkmanager/interfaces.js';
import { Model } from './model-context';
import { getHostnameInfo, getFormattedHostname, setHostname } from './services/hostname';
import { getDefaultInterface, getDhcpHostname, applyNetworkConfiguration } from './services/network';
import { getNtpServers, configureNtpServers, closeServerTime } from './services/ntp';
import { applyProxyConfiguration } from './services/proxy';
import { applyLabelsConfiguration } from './services/labels';

export interface SystemInfo {
    hostname: string;
    prettyHostname?: string | undefined;
    staticHostname?: string | undefined;
    dhcpHostname: string;
    defaultInterface: string | null;
    ntpServers: string[];
}

export class SystemConfigurationService {
    async getSystemInfo(interfaces: Interface[]): Promise<SystemInfo> {
        const hostnameInfo = await getHostnameInfo().catch((err): { hostname: string; prettyHostname?: string; staticHostname?: string } => {
            console.error('Failed to get hostname info:', err);
            return { hostname: '' };
        });

        const defaultInterface = await getDefaultInterface(interfaces).catch((err): string | null => {
            console.error('Failed to get default interface:', err);
            return null;
        });

        const ntpServers = await getNtpServers().catch((err) => {
            console.error('Failed to get NTP servers:', err);
            return [] as string[];
        });

        const dhcpHostname = await getDhcpHostname(interfaces).catch((err) => {
            console.warn('Failed to get DHCP hostname:', err);
            return '';
        });

        return {
            hostname: getFormattedHostname(hostnameInfo),
            prettyHostname: hostnameInfo.prettyHostname,
            staticHostname: hostnameInfo.staticHostname,
            dhcpHostname,
            defaultInterface,
            ntpServers
        };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async applySystemConfiguration(networkManager: any, model: Model, options?: { skipNetwork?: boolean; skipActivation?: boolean }): Promise<{ success: boolean; results: string[]; singleNic: boolean }> {
        const allResults: string[] = [];
        let hasErrors = false;
        let singleNic = false;

        // 1. Apply hostname
        if (model.hostname.value && model.hostname.value.trim()) {
            try {
                await setHostname(model.hostname.value);
                allResults.push(`✓ Hostname set to: ${model.hostname.value}`);
            } catch (error) {
                allResults.push(`✗ ${String(error)}`);
                hasErrors = true;
            }
        } else {
            allResults.push('- Hostname: No changes required');
        }

        // 2. Apply network configuration
        if (options?.skipNetwork) {
            allResults.push('- Network: deferred to systemd-run transient unit');
        } else if (model.networkInterface.selectedInterface && networkManager) {
            try {
                const networkApplyResult = await applyNetworkConfiguration(networkManager, model, options?.skipActivation);
                networkApplyResult.results.forEach(result => allResults.push(`✓ ${result}`));
                singleNic = networkApplyResult.singleNic;
            } catch (error) {
                allResults.push(`✗ ${String(error)}`);
                hasErrors = true;
            }
        } else {
            allResults.push('- Network: No interface selected or NetworkManager unavailable');
        }

        // 3. Apply NTP configuration
        try {
            const ntpResults = await configureNtpServers(
                model.networkServices.ntp.servers,
                model.networkServices.ntp.autoConfig
            );
            ntpResults.forEach(result => allResults.push(`✓ ${result}`));
        } catch (error) {
            allResults.push(`✗ ${String(error)}`);
            hasErrors = true;
        }

        // 4. Apply proxy configuration
        try {
            const proxyResults = await applyProxyConfiguration(model.networkServices.proxy);
            proxyResults.forEach(result => allResults.push(`✓ ${result}`));
        } catch (error) {
            allResults.push(`✗ ${String(error)}`);
            hasErrors = true;
        }

        // 5. Apply labels configuration
        try {
            const labelResults = await applyLabelsConfiguration(model.labels);
            labelResults.forEach(result => allResults.push(`✓ ${result}`));
        } catch (error) {
            allResults.push(`✗ ${String(error)}`);
            hasErrors = true;
        }

        return {
            success: !hasErrors,
            results: allResults,
            singleNic,
        };
    }

    close() {
        closeServerTime();
    }
}

export const systemConfigurationService = new SystemConfigurationService();
