import { Interface, NetworkManagerModel } from "../pkg/networkmanager/interfaces.js";
import { Model } from "./model-context";
import { getHostnameInfo, getFormattedHostname, setHostname } from "./services/hostname";
import { getDefaultInterface, getDhcpHostname, applyNetworkConfiguration } from "./services/network";
import { getNtpServers, configureNtpServers, closeServerTime } from "./services/ntp";
import { applyProxyConfiguration } from "./services/proxy";
import { applyLabelsConfiguration } from "./services/labels";
import {
    CONFIG_ACTION_IDS,
    indexedActionId,
    makeStepAction,
    type StepAction,
    type SystemConfigurationApplyResult,
} from "./wizard/enrollment-progress-types";

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
        const hostnameInfo = await getHostnameInfo().catch(
            (err): { hostname: string; prettyHostname?: string; staticHostname?: string } => {
                console.error("Failed to get hostname info:", err);
                return { hostname: "" };
            }
        );

        const defaultInterface = await getDefaultInterface(interfaces).catch((err): string | null => {
            console.error("Failed to get default interface:", err);
            return null;
        });

        const ntpServers = await getNtpServers().catch((err) => {
            console.error("Failed to get NTP servers:", err);
            return [] as string[];
        });

        const dhcpHostname = await getDhcpHostname(interfaces).catch((err) => {
            console.warn("Failed to get DHCP hostname:", err);
            return "";
        });

        return {
            hostname: getFormattedHostname(hostnameInfo),
            prettyHostname: hostnameInfo.prettyHostname,
            staticHostname: hostnameInfo.staticHostname,
            dhcpHostname,
            defaultInterface,
            ntpServers,
        };
    }

    async applySystemConfiguration(
        networkManager: NetworkManagerModel | undefined,
        model: Model,
        options?: { skipNetwork?: boolean; skipActivation?: boolean }
    ): Promise<SystemConfigurationApplyResult> {
        const actions: StepAction[] = [];
        let hasErrors = false;
        let singleNic = false;

        if (model.hostname.value && model.hostname.value.trim()) {
            try {
                await setHostname(model.hostname.value);
                actions.push(
                    makeStepAction(CONFIG_ACTION_IDS.HOSTNAME, `Hostname set to: ${model.hostname.value}`, "success")
                );
            } catch (error) {
                actions.push(makeStepAction(CONFIG_ACTION_IDS.HOSTNAME, String(error), "error"));
                hasErrors = true;
            }
        } else {
            actions.push(
                makeStepAction(CONFIG_ACTION_IDS.HOSTNAME_UNCHANGED, "Hostname: No changes required", "success")
            );
        }

        if (options?.skipNetwork) {
            actions.push(
                makeStepAction(
                    CONFIG_ACTION_IDS.NETWORK_DEFERRED,
                    "Network: deferred to systemd-run transient unit",
                    "success"
                )
            );
        } else if (model.networkInterface.selectedInterface && networkManager) {
            try {
                const networkApplyResult = await applyNetworkConfiguration(
                    networkManager,
                    model,
                    options?.skipActivation
                );
                actions.push(...networkApplyResult.actions);
                singleNic = networkApplyResult.singleNic;
            } catch (error) {
                actions.push(makeStepAction(CONFIG_ACTION_IDS.NETWORK_UNAVAILABLE, String(error), "error"));
                hasErrors = true;
            }
        } else {
            actions.push(
                makeStepAction(
                    CONFIG_ACTION_IDS.NETWORK_NO_INTERFACE,
                    "Network: No interface selected or NetworkManager unavailable",
                    "success"
                )
            );
        }

        try {
            const ntpActions = await configureNtpServers(
                model.networkServices.ntp.servers,
                model.networkServices.ntp.autoConfig
            );
            actions.push(...ntpActions);
        } catch (error) {
            actions.push(makeStepAction(indexedActionId(CONFIG_ACTION_IDS.NTP, 0), String(error), "error"));
            hasErrors = true;
        }

        try {
            const proxyActions = await applyProxyConfiguration(model.networkServices.proxy);
            actions.push(...proxyActions);
        } catch (error) {
            actions.push(makeStepAction(indexedActionId(CONFIG_ACTION_IDS.PROXY, 0), String(error), "error"));
            hasErrors = true;
        }

        try {
            const labelActions = await applyLabelsConfiguration(model.labels, model.alias, model.hostname.value);
            actions.push(...labelActions);
        } catch (error) {
            actions.push(makeStepAction(indexedActionId(CONFIG_ACTION_IDS.LABELS, 0), String(error), "error"));
            hasErrors = true;
        }

        return {
            success: !hasErrors,
            actions,
            singleNic,
        };
    }

    close() {
        closeServerTime();
    }
}

export const systemConfigurationService = new SystemConfigurationService();
