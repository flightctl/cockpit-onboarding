import cockpit from "cockpit";
import type { EnrollmentService } from "../types";
import type { SkipResult } from "./skip-conditions";

export interface CancellationSignal {
    cancelled: boolean;
    process?: cockpit.Spawn<string> | undefined;
}

export interface ConnectivityResult {
    success: boolean;
    output: string;
}

export async function testNetworkConnectivity(
    testHost: string,
    iface: string | undefined,
    signal?: CancellationSignal,
    onOutput?: (output: string) => void
): Promise<ConnectivityResult> {
    try {
        // DNS resolution
        try {
            const dnsLabel = iface ? `${testHost} via ${iface}` : testHost;
            onOutput?.(`• Resolving ${dnsLabel} via DNS...`);
            const dnsArgs = iface
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
            onOutput?.(" Success.");
        } catch (dnsError) {
            if (signal) {
                signal.process = undefined;
            }

            let errorDetail = "";
            if (dnsError instanceof cockpit.ProcessError && dnsError.exit_status !== null) {
                errorDetail = ` (exit status ${dnsError.exit_status})`;
            }

            const errorMsg = ` Failed${errorDetail}.\n  Please check network configuration.`;
            onOutput?.(errorMsg);
            return { success: false, output: errorMsg };
        }

        // Ping bound to the configured interface
        try {
            const pingLabel = iface ? `${testHost} via ${iface}` : testHost;
            onOutput?.(`• Pinging ${pingLabel}...`);
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
            onOutput?.(" Success.");
            return { success: true, output: "success" };
        } catch (pingError) {
            if (signal) {
                signal.process = undefined;
            }
            console.warn(`Ping failed for ${testHost}:`, pingError);
            const warningMsg = " Failed.\n  However, pings may be simply blocked by firewall.";
            onOutput?.(warningMsg);
            return { success: true, output: warningMsg };
        }
    } catch (error) {
        if (signal) {
            signal.process = undefined;
        }
        console.error("Connectivity test error:", error);
        const errorMsg = error instanceof Error ? error.message : String(error);
        const fullErrorMsg = `Network connectivity test failed: ${errorMsg}`;
        onOutput?.(fullErrorMsg);
        return { success: false, output: fullErrorMsg };
    }
}

export async function verifyServiceConnectivity(
    service: EnrollmentService,
    endpoint: string,
    skipInfo: SkipResult | undefined,
    signal?: CancellationSignal,
    onOutput?: (output: string) => void
): Promise<ConnectivityResult> {
    if (skipInfo?.action === "connectivityOnly") {
        onOutput?.(`${skipInfo.reason}\n`);
    }

    if (!endpoint) {
        const msg = "No endpoint configured — cannot verify connectivity.";
        onOutput?.(msg);
        return { success: false, output: msg };
    }

    let hostname: string;
    try {
        hostname = new URL(endpoint).hostname;
    } catch {
        const msg = `Invalid endpoint URL: ${endpoint}`;
        onOutput?.(msg);
        return { success: false, output: msg };
    }

    // DNS resolution
    try {
        onOutput?.(`• Resolving ${hostname}...`);
        const dnsProc = cockpit.spawn(["getent", "hosts", hostname], { err: "ignore" });
        if (signal) {
            signal.process = dnsProc;
        }
        await dnsProc;
        if (signal) {
            signal.process = undefined;
        }
        onOutput?.(" Success.");
    } catch {
        if (signal) {
            signal.process = undefined;
        }
        const msg = ` Failed.\n  Cannot resolve ${hostname}. Check DNS configuration.`;
        onOutput?.(msg);
        return { success: false, output: msg };
    }

    // HTTPS connection test
    try {
        onOutput?.(`• Connecting to ${endpoint}...`);
        const curlProc = cockpit.spawn(
            [
                "curl",
                "-sf",
                "--max-time",
                "10",
                "-k",
                "-o",
                "/dev/null",
                "-w",
                "%{http_code}",
                `${endpoint}/api/v1/version`,
            ],
            { err: "ignore" }
        );
        if (signal) {
            signal.process = curlProc;
        }
        await curlProc;
        if (signal) {
            signal.process = undefined;
        }
        onOutput?.(" Success.");
        return { success: true, output: "Connectivity verified" };
    } catch {
        if (signal) {
            signal.process = undefined;
        }
        const msg = ` Failed.\n  Cannot connect to ${endpoint}. The server may be unreachable.`;
        onOutput?.(msg);
        return { success: false, output: msg };
    }
}
