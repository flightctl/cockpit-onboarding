import cockpit from "cockpit";
import { WATCHDOG_ACTIVE, SCRIPT_RUN_WATCHDOG } from "../paths";

export async function armWatchdog(testHost: string, timeoutSec: number): Promise<void> {
    try {
        await cockpit.spawn(["sudo", SCRIPT_RUN_WATCHDOG, String(timeoutSec), testHost], { err: "message" });
    } catch (error) {
        console.warn("Failed to arm watchdog timer:", error);
    }
}

export async function disarmWatchdog(): Promise<void> {
    try {
        await cockpit.spawn(["sudo", "systemctl", "stop", "cockpit-system-onboarding-watchdog.timer"], {
            err: "message",
        });
    } catch {
        // Timer may not exist if it already fired
    }
    try {
        await cockpit.spawn(["sudo", "systemctl", "stop", "cockpit-system-onboarding-watchdog.service"], {
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
