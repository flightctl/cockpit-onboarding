/* SPDX-License-Identifier: LGPL-2.1-or-later */
import cockpit from "cockpit";

import { SCRIPT_CHECK_CONNECTIVITY } from "../paths";
import { createStreamParser } from "./spawn-helpers";
import {
    createActionEmitter,
    type OnStepAction,
    type StepExecutionResult,
} from "../wizard/enrollment-progress-types";

export interface CancellationSignal {
    cancelled: boolean;
    process?: cockpit.Spawn<string> | undefined;
}

export interface ConnectivityCheckOptions {
    enrollmentHost?: string | undefined;
    port?: number | undefined;
    required?: boolean | undefined;
    pingTimeoutSeconds?: number | undefined;
    pingWaitSeconds?: number | undefined;
}

export async function testNetworkConnectivity(
    testHost: string,
    iface: string | undefined,
    signal?: CancellationSignal,
    onAction?: OnStepAction,
    options?: ConnectivityCheckOptions
): Promise<StepExecutionResult> {
    const { emit, getActions } = createActionEmitter(onAction);
    const parser = createStreamParser("connectivity-stream", emit);

    const hosts = [testHost];
    if (options?.enrollmentHost && options.enrollmentHost !== testHost) {
        hosts.push(options.enrollmentHost);
    }

    const args = [
        "sudo",
        SCRIPT_CHECK_CONNECTIVITY,
        "--hosts",
        hosts.join(","),
        "--interface",
        iface || "",
        "--port",
        String(options?.port ?? 443),
        "--ping-timeout",
        String(options?.pingTimeoutSeconds ?? 10),
        "--ping-wait",
        String(options?.pingWaitSeconds ?? 5),
    ];
    if (options?.required) {
        args.push("--required");
    }

    try {
        const proc = cockpit.spawn(args, { err: "out" });
        if (signal) {
            signal.process = proc;
        }

        parser.attach(proc);
        await proc;
        parser.flush();

        if (signal) {
            signal.process = undefined;
        }
        return { success: true, actions: getActions() };
    } catch {
        parser.flush();
        parser.markCurrentStepError();

        if (signal) {
            signal.process = undefined;
        }

        if (!getActions().some((a) => a.result === "error")) {
            emit({
                id: parser.nextId(),
                actionTitle: "Network connectivity test failed",
                result: "error",
            });
        }
        return { success: false, actions: getActions() };
    }
}
