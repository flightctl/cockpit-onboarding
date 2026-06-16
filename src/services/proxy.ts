import { SCRIPT_PROXY } from "../paths";
import type { ProxyConfig } from "../types";
import { spawnWithParamsFile } from "./spawn-helpers";

export async function applyProxyConfiguration(proxy: ProxyConfig): Promise<string[]> {
    const results: string[] = [];

    if (!proxy.enabled || !proxy.hostname || !proxy.port) {
        results.push("Proxy: No changes required");
        return results;
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
        results.push(`Proxy configured: ${proxy.protocol}://${proxy.hostname}:${proxy.port}`);
    } catch (error) {
        throw new Error(`Proxy configuration failed: ${String(error)}`);
    }

    return results;
}
