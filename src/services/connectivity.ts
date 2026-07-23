/* SPDX-License-Identifier: LGPL-2.1-or-later */
import cockpit from "cockpit";

import {
    createActionEmitter,
    ENROLLMENT_ACTION_IDS,
    type OnStepAction,
    type StepExecutionResult,
} from "../wizard/enrollment-progress-types";

const IPV4_RE = /^\d{1,3}(\.\d{1,3}){3}$/;
const IPV6_RE = /^[0-9a-fA-F:]+$/;

function isIPAddress(host: string): boolean {
    return IPV4_RE.test(host) || IPV6_RE.test(host);
}

export interface CancellationSignal {
    cancelled: boolean;
    process?: cockpit.Spawn<string> | undefined;
}

export async function testNetworkConnectivity(
    testHost: string,
    iface: string | undefined,
    signal?: CancellationSignal,
    onAction?: OnStepAction
): Promise<StepExecutionResult> {
    const { emit, getActions } = createActionEmitter(onAction);

    try {
        if (isIPAddress(testHost)) {
            emit({
                id: "dns-skip-ip",
                actionTitle: "Host is an IP address, skipping DNS resolution.",
                result: "success",
            });
        } else {
            try {
                const dnsLabel = iface ? `${testHost} via ${iface}` : testHost;
                const resolveTitle = `Resolving ${dnsLabel} via DNS`;
                emit({ id: ENROLLMENT_ACTION_IDS.DNS_RESOLVE, actionTitle: resolveTitle, result: "pending" });
                let useResolvectl = false;
                if (iface) {
                    try {
                        await cockpit.spawn(["systemctl", "is-active", "--quiet", "systemd-resolved"], { err: "ignore" });
                        useResolvectl = true;
                    } catch {
                        // systemd-resolved not running (e.g. CentOS/RHEL)
                    }
                }
                const dnsArgs = useResolvectl
                    ? ["resolvectl", "query", `--interface=${iface}`, testHost]
                    : ["getent", "hosts", testHost];
                const dnsProc = cockpit.spawn(dnsArgs, { err: "ignore" });
                if (signal) {
                    signal.process = dnsProc;
                }
                await dnsProc;
                if (signal) {
                    signal.process = undefined;
                }
                emit({ id: ENROLLMENT_ACTION_IDS.DNS_RESOLVE, actionTitle: resolveTitle, result: "success" });
            } catch (dnsError) {
                if (signal) {
                    signal.process = undefined;
                }

                let errorDetail = "";
                if (dnsError instanceof cockpit.ProcessError && dnsError.exit_status !== null) {
                    errorDetail = ` (exit status ${dnsError.exit_status})`;
                }

                const errorTitle = `DNS resolution failed${errorDetail}. Please check network configuration.`;
                emit({ id: ENROLLMENT_ACTION_IDS.DNS_RESOLVE, actionTitle: errorTitle, result: "error" });
                return { success: false, actions: getActions() };
            }
        }

        try {
            const pingLabel = iface ? `${testHost} via ${iface}` : testHost;
            const pingTitle = `Pinging ${pingLabel}`;
            emit({ id: ENROLLMENT_ACTION_IDS.PING, actionTitle: pingTitle, result: "pending" });
            const pingArgs = ["timeout", "10", "ping", "-c", "1", "-W", "5"];
            if (iface) {
                pingArgs.push("-I", iface);
            }
            pingArgs.push(testHost);
            const pingProc = cockpit.spawn(pingArgs, { err: "ignore" });
            if (signal) {
                signal.process = pingProc;
            }
            await pingProc;
            if (signal) {
                signal.process = undefined;
            }
            emit({ id: ENROLLMENT_ACTION_IDS.PING, actionTitle: pingTitle, result: "success" });
            return { success: true, actions: getActions() };
        } catch (pingError) {
            if (signal) {
                signal.process = undefined;
            }
            console.warn(`Ping failed for ${testHost}:`, pingError);
            const warningTitle = "Ping failed. However, pings may be simply blocked by firewall.";
            emit({ id: ENROLLMENT_ACTION_IDS.PING, actionTitle: warningTitle, result: "warning" });
            return { success: true, actions: getActions() };
        }
    } catch (error) {
        if (signal) {
            signal.process = undefined;
        }
        console.error("Connectivity test error:", error);
        const errorMsg = error instanceof Error ? error.message : String(error);
        const fullErrorMsg = `Network connectivity test failed: ${errorMsg}`;
        emit({ id: "connectivity-error", actionTitle: fullErrorMsg, result: "error" });
        return { success: false, actions: getActions() };
    }
}
