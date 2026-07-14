import cockpit from "cockpit";
import type { WatchdogStatusData } from "../wizard/RestoredConfigurationSection";
import { WATCHDOG_ACTIVE, WATCHDOG_STATUS, SCRIPT_RUN_WATCHDOG } from "../paths";

export async function armWatchdog(testHost: string, timeoutSec: number): Promise<void> {
    try {
        await cockpit.spawn(["sudo", SCRIPT_RUN_WATCHDOG, String(timeoutSec), testHost], { err: "message" });
    } catch (error) {
        console.warn("Failed to arm watchdog timer:", error);
    }
}

export async function disarmWatchdog(): Promise<void> {
    try {
        await cockpit.spawn(["sudo", "systemctl", "stop", "flightctl-onboarding-watchdog.timer"], {
            err: "message",
        });
    } catch {
        // Timer may not exist if it already fired
    }
    try {
        await cockpit.spawn(["sudo", "systemctl", "stop", "flightctl-onboarding-watchdog.service"], {
            err: "message",
        });
    } catch {
        // Service may not exist
    }
    try {
        await cockpit.spawn(["sudo", "rm", "-f", WATCHDOG_ACTIVE], { err: "message" });
    } catch (error) {
        console.warn("Failed to remove watchdog state file:", error);
    }
}

export async function readWatchdogStatus(): Promise<WatchdogStatusData | null> {
    try {
        const statusFile = cockpit.file(WATCHDOG_STATUS, { superuser: "try" });
        const content = await statusFile.read();
        statusFile.close();
        if (!content) {
            return null;
        }
        const parsed = JSON.parse(content) as WatchdogStatusData;
        if (parsed.status === "network_failure" || parsed.status === "app_failure") {
            return parsed;
        }
        return null;
    } catch {
        return null;
    }
}
