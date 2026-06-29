import cockpit from "cockpit";
import { waitForProxy } from "./dbus-helpers";
import { WifiSecurity } from "../types";

export interface WifiConnection {
    ssid: string;
    bssid: string;
    password: string;
    security: WifiSecurity;
}

export interface WifiNetwork {
    ssid: string;
    strength: number;
    security: string;
    frequency: number;
    channel: number;
    band: "2.4 GHz" | "5 GHz" | "unknown";
    rate: number;
    bssid: string;
}

interface DbusVariant<T = unknown> {
    v?: T;
}

interface NetworkManagerData {
    Devices?: string[];
}

interface NetworkManagerDeviceData {
    Interface?: string;
    DeviceType?: number;
    ActiveConnection?: string;
}

interface ActiveConnectionData {
    Connection?: string;
}

interface WirelessDeviceData {
    AccessPoints?: string[];
}

interface AccessPointData {
    Ssid?: unknown;
    Strength?: number;
    Frequency?: number;
    HwAddress?: string;
    MaxBitrate?: number;
    Flags?: number;
    WpaFlags?: number;
    RsnFlags?: number;
}

const WIFI_CONNECTION_SETTINGS_KEY = "802-11-wireless";
const WIFI_CONNECTION_SECRETS_KEY = "802-11-wireless-security";

interface WifiConnectionSettings {
    [WIFI_CONNECTION_SETTINGS_KEY]?: {
        ssid?: DbusVariant<string | number[]>;
        bssid?: DbusVariant<string>;
    };
    [WIFI_CONNECTION_SECRETS_KEY]?: {
        "key-mgmt"?: DbusVariant<string>;
    };
}

interface WifiConnectionSecrets {
    [WIFI_CONNECTION_SECRETS_KEY]?: {
        psk?: DbusVariant<string>;
        "wep-key0"?: DbusVariant<string>;
        "leap-password"?: DbusVariant<string>;
    };
}

async function findWifiDevice(
    nmClient: cockpit.DBusClient,
    interfaceName: string
): Promise<{ devicePath: string; activeConnectionPath?: string } | null> {
    const nmManager = await waitForProxy<NetworkManagerData>(
        nmClient.proxy("org.freedesktop.NetworkManager", "/org/freedesktop/NetworkManager")
    );

    const devicePaths = nmManager.data.Devices || [];

    for (const path of devicePaths) {
        const devProxy = await waitForProxy<NetworkManagerDeviceData>(
            nmClient.proxy("org.freedesktop.NetworkManager.Device", path)
        );

        const devData = devProxy.data;
        if (devData.Interface === interfaceName && devData.DeviceType === 2) {
            // 2 = WiFi
            return {
                devicePath: path,
                ...(devData.ActiveConnection !== undefined && {
                    activeConnectionPath: devData.ActiveConnection,
                }),
            };
        }
    }

    return null;
}

export async function getCurrentWifiConnection(interfaceName: string): Promise<WifiConnection | null> {
    try {
        // polkit rule authorizes the onboarding user
        const nmClient = cockpit.dbus("org.freedesktop.NetworkManager");
        const device = await findWifiDevice(nmClient, interfaceName);

        if (!device || !device.activeConnectionPath || device.activeConnectionPath === "/") {
            nmClient.close();
            return null;
        }

        // Get active connection details
        const activeConnProxy = await waitForProxy<ActiveConnectionData>(
            nmClient.proxy("org.freedesktop.NetworkManager.Connection.Active", device.activeConnectionPath)
        );

        const connectionPath = activeConnProxy.data.Connection;
        if (!connectionPath || connectionPath === "/") {
            nmClient.close();
            return null;
        }

        const connectionProxy = await waitForProxy(
            nmClient.proxy("org.freedesktop.NetworkManager.Settings.Connection", connectionPath)
        );

        const settingsResult = await connectionProxy.call("GetSettings", []);
        const settings = settingsResult[0] as WifiConnectionSettings;

        let secrets: WifiConnectionSecrets = {};
        try {
            const secretsResult = await connectionProxy.call("GetSecrets", [WIFI_CONNECTION_SECRETS_KEY]);
            secrets = secretsResult[0] as WifiConnectionSecrets;
        } catch (secretsError) {
            console.warn("Failed to get WiFi secrets, password will not be available:", secretsError);
        }

        // Extract SSID
        const ssidRaw = settings[WIFI_CONNECTION_SETTINGS_KEY]?.ssid;
        let ssid = "";
        if (ssidRaw?.v) {
            const ssidBytes = ssidRaw.v;
            if (Array.isArray(ssidBytes)) {
                ssid = new TextDecoder().decode(new Uint8Array(ssidBytes));
            } else if (typeof ssidBytes === "string") {
                try {
                    ssid = atob(ssidBytes);
                } catch (e) {
                    console.error("Failed to decode base64 SSID:", e);
                    ssid = ssidBytes;
                }
            }
        }

        // Extract BSSID
        const bssidRaw = settings[WIFI_CONNECTION_SETTINGS_KEY]?.bssid?.v;
        const bssid = bssidRaw || "";

        // Extract password from secrets
        let password = "";
        const securitySettings = secrets[WIFI_CONNECTION_SECRETS_KEY];
        if (securitySettings) {
            password =
                securitySettings.psk?.v ||
                securitySettings["wep-key0"]?.v ||
                securitySettings["leap-password"]?.v ||
                "";
        }

        // Determine security type
        let security: WifiSecurity = "none";
        const keyMgmt = settings[WIFI_CONNECTION_SECRETS_KEY]?.["key-mgmt"]?.v;
        if (keyMgmt) {
            if (keyMgmt === "none") {
                security = "wep";
            } else if (keyMgmt.includes("wpa") || keyMgmt.includes("sae")) {
                security = "wpa";
            }
        }

        nmClient.close();

        return { ssid, bssid, password, security };
    } catch (error) {
        console.error("Failed to get current WiFi connection:", error);
        return null;
    }
}

function parseWifiSecurity(flags: number, wpaFlags: number, rsnFlags: number): string {
    const securityMethods: string[] = [];

    // WPA3 (SAE)
    const NM_802_11_AP_SEC_KEY_MGMT_SAE = 0x400;
    if (rsnFlags & NM_802_11_AP_SEC_KEY_MGMT_SAE) {
        securityMethods.push("WPA3");
    }

    // WPA2 (RSN with PSK or 802.1X)
    const NM_802_11_AP_SEC_KEY_MGMT_PSK = 0x100;
    const NM_802_11_AP_SEC_KEY_MGMT_802_1X = 0x200;
    if (rsnFlags !== 0 && rsnFlags & (NM_802_11_AP_SEC_KEY_MGMT_PSK | NM_802_11_AP_SEC_KEY_MGMT_802_1X)) {
        if (!securityMethods.includes("WPA3") || rsnFlags & ~NM_802_11_AP_SEC_KEY_MGMT_SAE) {
            securityMethods.push("WPA2");
        }
    }

    // WPA (older)
    if (wpaFlags !== 0) {
        securityMethods.push("WPA");
    }

    // WEP (privacy flag set but no WPA/RSN)
    const NM_802_11_AP_FLAGS_PRIVACY = 0x1;
    if (securityMethods.length === 0 && flags & NM_802_11_AP_FLAGS_PRIVACY) {
        securityMethods.push("WEP");
    }

    if (securityMethods.length === 0) {
        return "None";
    } else if (securityMethods.length > 1) {
        return securityMethods.join("/");
    }
    return securityMethods[0];
}

function frequencyToChannel(frequency: number): number {
    if (frequency >= 2412 && frequency <= 2484) {
        if (frequency === 2484) {
            return 14;
        }
        return Math.floor((frequency - 2407) / 5);
    } else if (frequency >= 5000) {
        return Math.floor((frequency - 5000) / 5);
    }
    return 0;
}

function channelToBand(channel: number): "2.4 GHz" | "5 GHz" | "unknown" {
    if (channel >= 1 && channel <= 14) {
        return "2.4 GHz";
    }
    if (channel >= 32 && channel <= 177) {
        return "5 GHz";
    }
    return "unknown";
}

function decodeSsid(ssidData: unknown): string {
    if (typeof ssidData === "string") {
        try {
            return atob(ssidData);
        } catch (e) {
            console.error("Failed to decode Base64 SSID:", e);
            return "";
        }
    } else if (Array.isArray(ssidData)) {
        return new TextDecoder().decode(new Uint8Array(ssidData));
    }
    return "";
}

export async function scanWifiNetworks(interfaceName: string): Promise<WifiNetwork[]> {
    try {
        // polkit rule authorizes the onboarding user
        const nmClient = cockpit.dbus("org.freedesktop.NetworkManager");
        const device = await findWifiDevice(nmClient, interfaceName);

        if (!device) {
            throw new Error(`WiFi device ${interfaceName} not found`);
        }

        const deviceProxy = await waitForProxy<WirelessDeviceData>(
            nmClient.proxy("org.freedesktop.NetworkManager.Device.Wireless", device.devicePath)
        );

        await deviceProxy.call("RequestScan", [{}]);

        // Wait for scan to complete (typical scan takes 2-3 seconds)
        await new Promise((resolve) => setTimeout(resolve, 3000));

        const apPaths = deviceProxy.data.AccessPoints || [];
        const aps: WifiNetwork[] = [];

        for (const apPath of apPaths) {
            try {
                const apProxy = await waitForProxy<AccessPointData>(
                    nmClient.proxy("org.freedesktop.NetworkManager.AccessPoint", apPath)
                );

                const apData = apProxy.data;

                const ssid = decodeSsid(apData.Ssid || "");
                if (!ssid || ssid.trim().length === 0) {
                    continue;
                }

                const strength = apData.Strength || 0;
                const frequency = apData.Frequency || 0;
                const bssid = apData.HwAddress || "";
                const rate = Math.floor((apData.MaxBitrate || 0) / 1000);
                const channel = frequencyToChannel(frequency);
                const band = channelToBand(channel);
                const security = parseWifiSecurity(apData.Flags || 0, apData.WpaFlags || 0, apData.RsnFlags || 0);

                aps.push({ ssid, strength, security, frequency, channel, band, rate, bssid });
            } catch (error) {
                console.warn(`Failed to read access point ${apPath}:`, error);
                continue;
            }
        }

        nmClient.close();

        // Sort by signal strength (strongest first)
        aps.sort((a, b) => b.strength - a.strength);

        return aps;
    } catch (error) {
        console.error("WiFi scan failed:", error);
        throw new Error(`WiFi network scan failed: ${String(error)}`);
    }
}
