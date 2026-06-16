import cockpit from "cockpit";
import { Interface } from "../../pkg/networkmanager/interfaces.js";
import { Model } from "../model-context";
import { ONBOARDING_PROFILE_PREFIX } from "../paths";
import { waitForProxy, waitForProxyWithTimeout } from "./dbus-helpers";

export interface NetworkApplyResult {
    results: string[];
    singleNic: boolean;
}

function isLocalhost(hostname: string): boolean {
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

export function getSetupInterface(interfaces: Interface[]): string | null {
    const hostname = window.location.hostname;

    if (isLocalhost(hostname)) {
        return null;
    }

    for (const iface of interfaces) {
        if (!iface.Device) {
            continue;
        }

        const ip4Config = iface.Device.Ip4Config;
        if (ip4Config) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const addressData: { address: string; prefix: string }[] = (ip4Config as any).AddressData || [];
            for (const addr of addressData) {
                if (addr.address === hostname) {
                    return iface.Name;
                }
            }
        }

        const ip6Config = iface.Device.Ip6Config;
        if (ip6Config) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const addressData: { address: string; prefix: string }[] = (ip6Config as any).AddressData || [];
            for (const addr of addressData) {
                if (addr.address === hostname) {
                    return iface.Name;
                }
            }
        }
    }

    return null;
}

export async function getDefaultInterface(interfaces: Interface[]): Promise<string | null> {
    try {
        const result = await cockpit.spawn(["ip", "route", "show", "default"], { err: "message" });
        const lines = result.split("\n");

        for (const line of lines) {
            const match = line.match(/default via .+ dev (\S+)/);
            if (match) {
                const interfaceName = match[1];
                const found = interfaces.find((iface) => iface.Name === interfaceName);
                if (found) {
                    return interfaceName;
                }
            }
        }
    } catch (error) {
        console.warn("Failed to get default route:", error);
    }

    // Fallback: find first active interface
    const activeInterface = interfaces.find(
        (iface) => iface.Device && iface.Device.State === 100 // NM_DEVICE_STATE_ACTIVATED
    );

    return activeInterface ? activeInterface.Name : null;
}

export async function getDhcpHostname(interfaces: Interface[]): Promise<string> {
    try {
        const defaultIface = await getDefaultInterface(interfaces);
        if (!defaultIface) {
            return "";
        }

        const iface = interfaces.find((i) => i.Name === defaultIface);
        if (!iface || !iface.Device || !iface.Device.ActiveConnection) {
            return "";
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ipv4Method = (iface.MainConnection?.Settings as any)?.ipv4?.method;
        if (ipv4Method === "manual") {
            return "";
        }

        const activeConnection = iface.Device.ActiveConnection;
        if (!activeConnection.Ip4Config) {
            return "";
        }

        // polkit rule authorizes the onboarding user
        const nmClient = cockpit.dbus("org.freedesktop.NetworkManager");
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const ip4ConfigProxy = nmClient.proxy(
                "org.freedesktop.NetworkManager.IP4Config",
                activeConnection.Ip4Config as any as string
            );
            await waitForProxyWithTimeout(ip4ConfigProxy, 2000);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const dhcpOptions = (ip4ConfigProxy.data as any).DhcpOptions || {};

            // DHCP option 12 is the hostname option
            return dhcpOptions["12"] || "";
        } finally {
            nmClient.close();
        }
    } catch (error) {
        console.warn("Could not retrieve DHCP hostname:", error);
        return "";
    }
}

export function subnetMaskToPrefixLength(subnetMask: string): number {
    const parts = subnetMask.split(".").map(Number);
    if (parts.length !== 4) {return 24}

    let prefixLength = 0;
    for (const part of parts) {
        prefixLength += part.toString(2).split("1").length - 1;
    }
    return prefixLength;
}

export function parseIpv6Address(addressWithPrefix: string): { address: string; prefix: number } {
    if (!addressWithPrefix) {
        return { address: "", prefix: 64 };
    }

    const parts = addressWithPrefix.split("/");
    const address = parts[0] || "";
    const prefix = parts[1] ? parseInt(parts[1], 10) : 64;

    return { address, prefix };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function waitForActivation(nmClient: any, activeConnPath: string): Promise<void> {
    const NM_ACTIVE_CONNECTION_STATE_ACTIVATED = 2;
    const NM_ACTIVE_CONNECTION_STATE_DEACTIVATED = 4;
    const TIMEOUT_MS = 30000;
    const POLL_MS = 500;

    return new Promise((resolve, reject) => {
        const proxy = nmClient.proxy("org.freedesktop.NetworkManager.Connection.Active", activeConnPath);

        let timer: ReturnType<typeof setTimeout> | null = null;
        let pollInterval: ReturnType<typeof setInterval> | null = null;

        const cleanup = () => {
            if (timer) {clearTimeout(timer)}
            if (pollInterval) {clearInterval(pollInterval)}
        };

        timer = setTimeout(() => {
            cleanup();
            resolve();
        }, TIMEOUT_MS);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (proxy as any).wait(() => {
            if (!proxy.valid) {
                cleanup();
                resolve();
                return;
            }

            const checkState = () => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const state = (proxy as any).State;
                if (state === NM_ACTIVE_CONNECTION_STATE_ACTIVATED) {
                    cleanup();
                    resolve();
                } else if (state === NM_ACTIVE_CONNECTION_STATE_DEACTIVATED) {
                    cleanup();
                    reject(new Error("Connection activation failed"));
                }
            };

            checkState();
            pollInterval = setInterval(checkState, POLL_MS);
        });
    });
}

function buildConnectionSettings(
    model: Model,
    ifaceName: string,
    interfaceType: string
): Record<string, Record<string, unknown>> {
    const connectionId = `${ONBOARDING_PROFILE_PREFIX}${ifaceName}`;

    // Determine the NM connection type
    const nmType = interfaceType === "wifi" ? "802-11-wireless" : "802-3-ethernet";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const settings: Record<string, Record<string, any>> = {
        connection: {
            id: { t: "s", v: connectionId },
            type: { t: "s", v: nmType },
            "interface-name": { t: "s", v: ifaceName },
            autoconnect: { t: "b", v: true },
            "autoconnect-priority": { t: "i", v: 999 },
        },
    };

    // Add type-specific section
    if (nmType === "802-3-ethernet") {
        settings["802-3-ethernet"] = {};
    } else if (nmType === "802-11-wireless") {
        const ssid = model.networkInterface.wifiSsid || "";
        // NM expects SSID as 'ay' (array of bytes). Cockpit's D-Bus bridge
        // accepts base64-encoded strings for 'ay' values.
        const ssidBase64 = btoa(ssid);
        settings["802-11-wireless"] = {
            ssid: { t: "ay", v: ssidBase64 },
            mode: { t: "s", v: "infrastructure" },
        };

        if (model.networkInterface.wifiSecurity && model.networkInterface.wifiSecurity !== "none") {
            settings["802-11-wireless"].security = { t: "s", v: "802-11-wireless-security" };
            settings["802-11-wireless-security"] = {
                "key-mgmt": { t: "s", v: "wpa-psk" },
                psk: { t: "s", v: model.networkInterface.wifiPassword || "" },
            };
        }
    }

    // IPv4 settings
    if (model.networkAddress.ipv4.method === "static") {
        const prefixLength = model.networkAddress.ipv4.subnetMask
            ? subnetMaskToPrefixLength(model.networkAddress.ipv4.subnetMask)
            : 24;

        const addressData = [
            {
                address: { t: "s", v: model.networkAddress.ipv4.address || "" },
                prefix: { t: "u", v: prefixLength },
            },
        ];

        const dnsServers = [model.networkAddress.ipv4.primaryDns, model.networkAddress.ipv4.secondaryDns].filter(
            (dns) => dns && dns.trim()
        ) as string[];

        // Convert DNS to uint32 (NM D-Bus format for ipv4.dns)
        const dnsUint32 = dnsServers.map((ip) => {
            const parts = ip.split(".").map(Number);
            // NM uses little-endian uint32 for IPv4 DNS
            return parts[0] | (parts[1] << 8) | (parts[2] << 16) | (parts[3] << 24);
        });

        settings.ipv4 = {
            method: { t: "s", v: "manual" },
            "address-data": { t: "aa{sv}", v: addressData },
            gateway: { t: "s", v: model.networkAddress.ipv4.gateway || "" },
            dns: { t: "au", v: dnsUint32 },
            "ignore-auto-dns": { t: "b", v: !model.networkAddress.ipv4.autoDns },
        };
    } else if (model.networkAddress.ipv4.method === "disabled") {
        settings.ipv4 = {
            method: { t: "s", v: "disabled" },
        };
    } else {
        settings.ipv4 = {
            method: { t: "s", v: "auto" },
        };
    }

    // IPv6 settings
    if (model.networkAddress.ipv6.method === "static") {
        let ipv6AddressData: Record<string, unknown>[] = [];
        if (model.networkAddress.ipv6.address) {
            const { address, prefix } = parseIpv6Address(model.networkAddress.ipv6.address);
            ipv6AddressData = [
                {
                    address: { t: "s", v: address },
                    prefix: { t: "u", v: prefix },
                },
            ];
        }

        const dnsServers = [model.networkAddress.ipv6.primaryDns, model.networkAddress.ipv6.secondaryDns].filter(
            (dns) => dns && dns.trim()
        ) as string[];

        // NM expects IPv6 DNS as array of byte arrays (aay). Cockpit's D-Bus
        // bridge accepts base64-encoded strings for byte array values.
        const dnsBytes = dnsServers.map((ip) => {
            const bytes = ipv6ToBytes(ip);
            return btoa(String.fromCharCode(...bytes));
        });

        settings.ipv6 = {
            method: { t: "s", v: "manual" },
            "address-data": { t: "aa{sv}", v: ipv6AddressData },
            gateway: { t: "s", v: model.networkAddress.ipv6.gateway || "" },
            dns: { t: "aay", v: dnsBytes },
            "ignore-auto-dns": { t: "b", v: !model.networkAddress.ipv6.autoDns },
        };
    } else if (model.networkAddress.ipv6.method === "disabled") {
        settings.ipv6 = {
            method: { t: "s", v: "disabled" },
        };
    } else if (model.networkAddress.ipv6.method === "dhcp") {
        settings.ipv6 = {
            method: { t: "s", v: "dhcp" },
        };
    } else {
        settings.ipv6 = {
            method: { t: "s", v: "auto" },
        };
    }

    return settings;
}

function ipv6ToBytes(ip: string): number[] {
    // Expand :: notation and convert to 16 bytes
    const parts = ip.split(":");
    const result: number[] = new Array(16).fill(0);

    // Handle :: expansion
    const doubleColonIndex = parts.indexOf("");
    if (doubleColonIndex !== -1) {
        const before = parts.slice(0, doubleColonIndex).filter((p) => p !== "");
        const after = parts.slice(doubleColonIndex + 1).filter((p) => p !== "");
        const missing = 8 - before.length - after.length;

        const expanded = [...before, ...new Array(missing).fill("0"), ...after];

        for (let i = 0; i < 8; i++) {
            const val = parseInt(expanded[i] || "0", 16);
            result[i * 2] = (val >> 8) & 0xff;
            result[i * 2 + 1] = val & 0xff;
        }
    } else {
        for (let i = 0; i < 8; i++) {
            const val = parseInt(parts[i] || "0", 16);
            result[i * 2] = (val >> 8) & 0xff;
            result[i * 2 + 1] = val & 0xff;
        }
    }

    return result;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function applyNetworkConfiguration(
    networkManager: any,
    model: Model,
    skipActivation = false
): Promise<NetworkApplyResult> {
    const results: string[] = [];

    if (!model.networkInterface.selectedInterface) {
        results.push("No network interface selected");
        return { results, singleNic: false };
    }

    const ifaceName = model.networkInterface.selectedInterface;
    const interfaces: Interface[] = networkManager.list_interfaces();
    const setupIface = getSetupInterface(interfaces);
    const isSingleNic = setupIface !== null && setupIface === ifaceName;

    try {
        const selectedIface = interfaces.find((iface: Interface) => iface.Name === ifaceName);

        if (!selectedIface) {
            throw new Error(`Interface ${ifaceName} not found`);
        }

        const interfaceType = model.networkInterface.interfaceType || "ethernet";
        const connectionId = `${ONBOARDING_PROFILE_PREFIX}${ifaceName}`;

        // Delete any previously created onboarding profile for this interface
        try {
            await deleteOnboardingProfiles(ifaceName);
        } catch (cleanupError) {
            console.warn("Failed to clean up previous onboarding profile:", cleanupError);
        }

        // Build NM connection settings for the new profile
        const settings = buildConnectionSettings(model, ifaceName, interfaceType);

        // Create the new connection profile via NM D-Bus
        const nmClient = cockpit.dbus("org.freedesktop.NetworkManager", { superuser: "try" });
        try {
            console.log("Creating new NM connection profile:", connectionId);

            const settingsProxy = nmClient.proxy(
                "org.freedesktop.NetworkManager.Settings",
                "/org/freedesktop/NetworkManager/Settings"
            );
            await waitForProxy(settingsProxy);

            // Call AddConnection to create the new profile
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const newConnectionPath = await (nmClient as any).call(
                "/org/freedesktop/NetworkManager/Settings",
                "org.freedesktop.NetworkManager.Settings",
                "AddConnection",
                [settings]
            );

            results.push(`Created new connection profile: ${connectionId}`);
            console.log("New connection path:", newConnectionPath);

            if (skipActivation) {
                results.push(`Created profile ${connectionId} (activation deferred to systemd-run)`);
            } else {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const devicePathResult = await (nmClient as any).call(
                    "/org/freedesktop/NetworkManager",
                    "org.freedesktop.NetworkManager",
                    "GetDeviceByIpIface",
                    [ifaceName]
                );
                const devicePath = Array.isArray(devicePathResult) ? devicePathResult[0] : devicePathResult;

                console.log("Activating connection on device:", devicePath);

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const activeConnResult = await (nmClient as any).call(
                    "/org/freedesktop/NetworkManager",
                    "org.freedesktop.NetworkManager",
                    "ActivateConnection",
                    [newConnectionPath[0] || newConnectionPath, devicePath, "/"]
                );

                const activeConnPath = Array.isArray(activeConnResult) ? activeConnResult[0] : activeConnResult;
                if (!isSingleNic) {
                    await waitForActivation(nmClient, activeConnPath);
                }

                results.push(`Activated connection ${connectionId} on ${ifaceName}`);
            }
        } catch (networkError) {
            const errorMsg = String(networkError);
            console.error("NetworkManager configuration error:", networkError);

            if (
                errorMsg.includes("Interactive authentication required") ||
                errorMsg.includes("org.freedesktop.PolicyKit1.Error.Failed")
            ) {
                throw new Error(
                    "Network configuration requires administrator privileges. Please ensure you have sufficient permissions."
                );
            }

            throw new Error(`Failed to create/activate network profile: ${errorMsg}`);
        } finally {
            nmClient.close();
        }

        if (model.networkAddress.ipv4.method === "static") {
            const prefixLength = model.networkAddress.ipv4.subnetMask
                ? subnetMaskToPrefixLength(model.networkAddress.ipv4.subnetMask)
                : 24;
            results.push(`IPv4 configured: ${model.networkAddress.ipv4.address}/${prefixLength}`);
        } else if (model.networkAddress.ipv4.method === "disabled") {
            results.push("IPv4 disabled");
        } else {
            results.push("IPv4 configured for automatic (DHCP)");
        }

        if (model.networkAddress.ipv6.method === "static") {
            results.push(`IPv6 configured: ${model.networkAddress.ipv6.address}`);
        } else if (model.networkAddress.ipv6.method === "disabled") {
            results.push("IPv6 disabled");
        } else if (model.networkAddress.ipv6.method === "dhcp") {
            results.push("IPv6 configured for stateful DHCPv6");
        } else {
            results.push("IPv6 configured for automatic (SLAAC)");
        }
    } catch (error) {
        throw new Error(`Network configuration failed: ${String(error)}`);
    }

    return { results, singleNic: isSingleNic };
}

async function deleteOnboardingProfiles(ifaceName?: string): Promise<void> {
    const nmClient = cockpit.dbus("org.freedesktop.NetworkManager", { superuser: "try" });

    try {
        const settingsProxy = nmClient.proxy(
            "org.freedesktop.NetworkManager.Settings",
            "/org/freedesktop/NetworkManager/Settings"
        );
        await waitForProxy(settingsProxy);

        // List all connections
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const connectionsResult = await (nmClient as any).call(
            "/org/freedesktop/NetworkManager/Settings",
            "org.freedesktop.NetworkManager.Settings",
            "ListConnections",
            []
        );

        const connectionPaths: string[] = connectionsResult[0] || connectionsResult;

        for (const connPath of connectionPaths) {
            try {
                // Get the connection settings to check its ID
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const connSettings = await (nmClient as any).call(
                    connPath,
                    "org.freedesktop.NetworkManager.Settings.Connection",
                    "GetSettings",
                    []
                );

                const connData = connSettings[0] || connSettings;
                const connId = connData?.connection?.id?.v || connData?.connection?.id || "";

                const prefix = ifaceName ? `${ONBOARDING_PROFILE_PREFIX}${ifaceName}` : ONBOARDING_PROFILE_PREFIX;

                if (typeof connId === "string" && connId.startsWith(prefix)) {
                    console.log(`Deleting onboarding profile: ${connId} at ${connPath}`);
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    await (nmClient as any).call(
                        connPath,
                        "org.freedesktop.NetworkManager.Settings.Connection",
                        "Delete",
                        []
                    );
                }
            } catch (connError) {
                console.warn(`Failed to inspect/delete connection ${connPath}:`, connError);
            }
        }
    } finally {
        nmClient.close();
    }
}

export async function rollbackNetworkConfiguration(): Promise<string[]> {
    const results: string[] = [];

    try {
        await deleteOnboardingProfiles();
        results.push("Rolled back network configuration: deleted onboarding profiles");
        results.push("NetworkManager will fall back to previous connection automatically");
    } catch (error) {
        results.push(`Failed to roll back network configuration: ${String(error)}`);
        console.error("Network rollback error:", error);
    }

    return results;
}
