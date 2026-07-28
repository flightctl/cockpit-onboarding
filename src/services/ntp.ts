/* SPDX-License-Identifier: LGPL-2.1-or-later */
import cockpit from "cockpit";
import { SCRIPT_NTP } from "../paths";
import { ServerTime } from "../../pkg/lib/serverTime.js";
import { validateHostnameOrIP } from "../validation";
import {
    CONFIG_ACTION_IDS,
    indexedActionId,
    makeStepAction,
    sleep,
    type StepAction,
} from "../wizard/enrollment-progress-types";

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

const NTP_SYNC_TIMEOUT_SECONDS = 30;
const NTP_SYNC_POLL_INTERVAL_MS = 1000;

async function isNtpActive(): Promise<boolean> {
    try {
        const output = await cockpit.spawn(
            ["timedatectl", "show", "--property=NTP", "--value"],
            { err: "ignore" }
        );
        return output.trim() === "yes";
    } catch {
        return false;
    }
}

async function isNtpSynchronized(): Promise<boolean> {
    try {
        const output = await cockpit.spawn(
            ["timedatectl", "show", "--property=NTPSynchronized", "--value"],
            { err: "ignore" }
        );
        return output.trim() === "yes";
    } catch {
        return false;
    }
}

export async function waitForNtpSync(): Promise<boolean> {
    if (!(await isNtpActive())) {
        return false;
    }

    for (let i = 0; i < NTP_SYNC_TIMEOUT_SECONDS; i++) {
        if (await isNtpSynchronized()) {
            return true;
        }
        await sleep(NTP_SYNC_POLL_INTERVAL_MS);
    }

    return false;
}

export async function configureNtpServers(servers: string[], autoConfig: boolean): Promise<StepAction[]> {
    const actions: StepAction[] = [];
    let ntpConfigured = false;

    try {
        if (autoConfig) {
            await cockpit.spawn(["sudo", SCRIPT_NTP, "auto"], { err: "message" });
            actions.push(
                makeStepAction(
                    indexedActionId(CONFIG_ACTION_IDS.NTP, 0),
                    "NTP enabled with automatic server selection",
                    "success"
                )
            );
            ntpConfigured = true;
        } else if (servers.length > 0) {
            const filteredServers = servers.filter((s) => !!s);
            for (const server of filteredServers) {
                const error = validateHostnameOrIP(server, true);
                if (error) {
                    throw new Error(`Invalid NTP server "${server}": ${error}`);
                }
            }
            await cockpit.spawn(["sudo", SCRIPT_NTP, "set", ...filteredServers], { err: "message" });
            actions.push(
                makeStepAction(
                    indexedActionId(CONFIG_ACTION_IDS.NTP, 0),
                    `NTP configured with custom servers: ${filteredServers.join(", ")}`,
                    "success"
                )
            );
            ntpConfigured = true;
        } else {
            actions.push(
                makeStepAction(
                    indexedActionId(CONFIG_ACTION_IDS.NTP, 0),
                    "NTP enabled with default configuration",
                    "success"
                )
            );
        }
    } catch (error) {
        throw new Error(`NTP configuration failed: ${String(error)}`);
    }

    if (ntpConfigured) {
        actions.push(
            makeStepAction(CONFIG_ACTION_IDS.NTP_SYNC, "Waiting for NTP time synchronization...", "pending")
        );
        const synced = await waitForNtpSync();
        if (synced) {
            actions.push(
                makeStepAction(CONFIG_ACTION_IDS.NTP_SYNC, "NTP time synchronized", "success")
            );
        } else {
            actions.push(
                makeStepAction(
                    CONFIG_ACTION_IDS.NTP_SYNC,
                    "NTP time synchronization timed out, proceeding with enrollment",
                    "warning"
                )
            );
        }
    }

    return actions;
}
