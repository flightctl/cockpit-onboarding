import cockpit from "cockpit";
import { SCRIPT_NTP } from "../paths";
import { waitForProxy } from "./dbus-helpers";
import { ServerTime } from "../../pkg/lib/serverTime.js";
import { validateHostnameOrIP } from "../validation";

interface CustomNtpConfig {
    backend: "timesyncd" | "chronyd" | null;
    enabled: boolean;
    servers: string[];
}

interface ServerTimeInstance {
    get_custom_ntp(): Promise<CustomNtpConfig>;
    close(): void;
}

let serverTimeInstance: ServerTimeInstance | null = null;

function getServerTime(): ServerTimeInstance {
    if (!serverTimeInstance) {
        serverTimeInstance = new ServerTime() as unknown as ServerTimeInstance;
    }
    return serverTimeInstance;
}

export function closeServerTime(): void {
    if (serverTimeInstance) {
        serverTimeInstance.close();
        serverTimeInstance = null;
    }
}

export async function getNtpServers(): Promise<string[]> {
    try {
        const serverTime = getServerTime();
        const customNtp = await serverTime.get_custom_ntp();

        if (customNtp && customNtp.servers && Array.isArray(customNtp.servers)) {
            return customNtp.servers.filter((server: string) => server && server.trim().length > 0);
        }
    } catch (error) {
        console.warn("Failed to get NTP servers via ServerTime:", error);
    }

    return [];
}

export async function configureNtpServers(servers: string[], autoConfig: boolean): Promise<string[]> {
    const results: string[] = [];

    // polkit rule authorizes the onboarding user
    const timedateClient = cockpit.dbus("org.freedesktop.timedate1");
    try {
        const timedateProxy = await waitForProxy(
            timedateClient.proxy("org.freedesktop.timedate1", "/org/freedesktop/timedate1")
        );

        await timedateProxy.call("SetNTP", [true, true]);

        // Disable NTP before changing server config
        await timedateProxy.call("SetNTP", [false, true]);

        // Write NTP config files via a helper script run with sudo.
        // We can't use serverTime.js set_custom_ntp() because it uses
        // { superuser: "require" } which needs Cockpit's superuser bridge.
        if (autoConfig) {
            await cockpit.spawn(["sudo", SCRIPT_NTP, "auto"], { err: "message" });
            results.push("NTP enabled with automatic server selection");
        } else if (servers.length > 0) {
            const filteredServers = servers.filter((s) => !!s);
            for (const server of filteredServers) {
                const error = validateHostnameOrIP(server, true);
                if (error) {
                    throw new Error(`Invalid NTP server "${server}": ${error}`);
                }
            }
            await cockpit.spawn(["sudo", SCRIPT_NTP, "set", ...filteredServers], { err: "message" });
            results.push(`NTP configured with custom servers: ${filteredServers.join(", ")}`);
        } else {
            results.push("NTP enabled with default configuration");
        }

        // Re-enable NTP
        await timedateProxy.call("SetNTP", [true, true]);
    } catch (error) {
        throw new Error(`NTP configuration failed: ${String(error)}`);
    } finally {
        timedateClient.close();
    }

    return results;
}
