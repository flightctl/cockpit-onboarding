import cockpit from "cockpit";
import { waitForProxy } from "./dbus-helpers";

export interface WifiConnection {
    ssid: string;
    bssid: string;
    password: string;
    security: "none" | "wep" | "wpa";
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function findWifiDevice(
    nmClient: any,
    interfaceName: string
): Promise<{ devicePath: string; activeConnectionPath?: string } | null> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nmManager = nmClient.proxy("org.freedesktop.NetworkManager", "/org/freedesktop/NetworkManager");
    await waitForProxy(nmManager);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const devicePaths = (nmManager.data as any).Devices || [];

    for (const path of devicePaths) {
        const devProxy = nmClient.proxy("org.freedesktop.NetworkManager.Device", path);
        await waitForProxy(devProxy);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const devData = devProxy.data as any;
        if (devData.Interface === interfaceName && devData.DeviceType === 2) {
            // 2 = WiFi
            return {
                devicePath: path,
                activeConnectionPath: devData.ActiveConnection,
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
        const activeConnProxy = nmClient.proxy(
            "org.freedesktop.NetworkManager.Connection.Active",
            device.activeConnectionPath
        );
        await waitForProxy(activeConnProxy);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const activeConnData = activeConnProxy.data as any;
        const connectionPath = activeConnData.Connection;

        if (!connectionPath || connectionPath === "/") {
            nmClient.close();
            return null;
        }

        const connectionProxy = nmClient.proxy("org.freedesktop.NetworkManager.Settings.Connection", connectionPath);
        await waitForProxy(connectionProxy);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const settingsResult = await (connectionProxy as any).call("GetSettings", []);
        const settings = settingsResult[0];

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let secrets: any = {};
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const secretsResult = await (connectionProxy as any).call("GetSecrets", ["802-11-wireless-security"]);
            secrets = secretsResult[0];
        } catch (secretsError) {
            console.warn("Failed to get WiFi secrets, password will not be available:", secretsError);
        }

        // Extract SSID
        const ssidRaw = settings["802-11-wireless"]?.ssid;
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
        const bssidRaw = settings["802-11-wireless"]?.bssid?.v;
        const bssid = bssidRaw || "";

        // Extract password from secrets
        let password = "";
        const securitySettings = secrets["802-11-wireless-security"];
        if (securitySettings) {
            password =
                securitySettings.psk?.v ||
                securitySettings["wep-key0"]?.v ||
                securitySettings["leap-password"]?.v ||
                "";
        }

        // Determine security type
        let security: "none" | "wep" | "wpa" = "none";
        const keyMgmt = settings["802-11-wireless-security"]?.["key-mgmt"]?.v;
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
        if (frequency === 2484) {return 14}
        return Math.floor((frequency - 2407) / 5);
    } else if (frequency >= 5000) {
        return Math.floor((frequency - 5000) / 5);
    }
    return 0;
}

function channelToBand(channel: number): "2.4 GHz" | "5 GHz" | "unknown" {
    if (channel >= 1 && channel <= 14) {return "2.4 GHz"}
    if (channel >= 32 && channel <= 177) {return "5 GHz"}
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

        const deviceProxy = nmClient.proxy("org.freedesktop.NetworkManager.Device.Wireless", device.devicePath);
        await waitForProxy(deviceProxy);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (deviceProxy as any).call("RequestScan", [{}]);

        // Wait for scan to complete (typical scan takes 2-3 seconds)
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const deviceData = deviceProxy.data as any;
        const apPaths = deviceData.AccessPoints || [];
        const aps: WifiNetwork[] = [];

        for (const apPath of apPaths) {
            try {
                const apProxy = nmClient.proxy("org.freedesktop.NetworkManager.AccessPoint", apPath);
                await waitForProxy(apProxy);

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const apData = apProxy.data as any;

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
