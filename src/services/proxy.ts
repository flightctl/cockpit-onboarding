/* SPDX-License-Identifier: LGPL-2.1-or-later */
import { SCRIPT_PROXY } from "../paths";
import type { ProxyConfig } from "../types";
import { spawnWithParamsFile } from "./spawn-helpers";
import {
    CONFIG_ACTION_IDS,
    indexedActionId,
    makeStepAction,
    type StepAction,
} from "../wizard/enrollment-progress-types";

export async function applyProxyConfiguration(proxy: ProxyConfig): Promise<StepAction[]> {
    const actions: StepAction[] = [];

    if (!proxy.enabled || !proxy.hostname || !proxy.port) {
        actions.push(
            makeStepAction(indexedActionId(CONFIG_ACTION_IDS.PROXY, 0), "Proxy: No changes required", "success")
        );
        return actions;
    }

    const params: Record<string, string | number> = {
        protocol: proxy.protocol,
        hostname: proxy.hostname,
        port: proxy.port,
    };

    if (proxy.username) {
        params.username = proxy.username;
    }
    if (proxy.password) {
        params.password = proxy.password;
    }

    // Strip the default localhost entries from noProxy before passing to the script,
    // since the script always includes them. Pass only user-specified extras.
    const defaultEntries = new Set(["localhost", "127.0.0.1", "::1"]);
    const userNoProxy = proxy.noProxy
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s && !defaultEntries.has(s))
        .join(",");
    if (userNoProxy) {
        params.noProxy = userNoProxy;
    }

    try {
        await spawnWithParamsFile(SCRIPT_PROXY, params, ".proxy-params-");
        actions.push(
            makeStepAction(
                indexedActionId(CONFIG_ACTION_IDS.PROXY, 0),
                `Proxy configured: ${proxy.protocol}://${proxy.hostname}:${proxy.port}`,
                "success"
            )
        );
    } catch (error) {
        throw new Error(`Proxy configuration failed: ${String(error)}`);
    }

    return actions;
}
