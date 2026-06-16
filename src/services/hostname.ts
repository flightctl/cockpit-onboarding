import cockpit from "cockpit";
import { waitForProxy } from "./dbus-helpers";

export interface HostnameInfo {
    hostname: string;
    prettyHostname?: string;
    staticHostname?: string;
}

export async function getHostnameInfo(): Promise<HostnameInfo> {
    const hostnameClient = cockpit.dbus("org.freedesktop.hostname1");
    try {
        const hostnameProxy = hostnameClient.proxy("org.freedesktop.hostname1", "/org/freedesktop/hostname1");
        await waitForProxy(hostnameProxy);

        const hostnameData = (hostnameProxy as cockpit.DBusProxy & {
            data: { Hostname?: string; PrettyHostname?: string; StaticHostname?: string };
        }).data;
        const info: HostnameInfo = {
            hostname: hostnameData.Hostname || "",
        };
        if (hostnameData.PrettyHostname) {
            info.prettyHostname = hostnameData.PrettyHostname;
        }
        if (hostnameData.StaticHostname) {
            info.staticHostname = hostnameData.StaticHostname;
        }
        return info;
    } catch (error) {
        console.warn("Failed to get hostname via D-Bus:", error);
        return { hostname: "" };
    } finally {
        hostnameClient.close();
    }
}

export function getFormattedHostname(hostnameInfo: HostnameInfo): string {
    const { hostname, prettyHostname, staticHostname } = hostnameInfo;

    if (prettyHostname && staticHostname && staticHostname !== prettyHostname) {
        return `${prettyHostname} (${staticHostname})`;
    } else if (staticHostname) {
        return staticHostname;
    }

    return hostname || "";
}

export async function setHostname(hostname: string): Promise<void> {
    if (!hostname || !hostname.trim()) {
        throw new Error("Hostname cannot be empty");
    }

    // polkit rule authorizes the onboarding user
    const hostnameClient = cockpit.dbus("org.freedesktop.hostname1");
    try {
        const hostnameProxy = hostnameClient.proxy("org.freedesktop.hostname1", "/org/freedesktop/hostname1");
        await waitForProxy(hostnameProxy);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (hostnameProxy as any).call("SetStaticHostname", [hostname.trim(), true]);
    } catch (error) {
        throw new Error(`Failed to set hostname: ${String(error)}`);
    } finally {
        hostnameClient.close();
    }
}
