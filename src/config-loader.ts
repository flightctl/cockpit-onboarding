/**
 * Configuration loader for Cockpit System Onboarding Plugin
 *
 * Implements fallback hierarchy:
 * 1. User override: /etc/cockpit/system-onboarding/config.json (highest priority)
 * 2. Default: /usr/share/cockpit/system-onboarding/config.json (fallback)
 */

import cockpit from "cockpit";
import { SystemOnboardingConfig } from "./types";

// Configuration file paths
const DEFAULT_CONFIG_PATH = "/usr/share/cockpit/system-onboarding/config.json";
const USER_CONFIG_PATH = "/etc/cockpit/system-onboarding/config.json";

// Default configuration if no files are found
const BUILT_IN_DEFAULTS: SystemOnboardingConfig = {
    version: "1.0",
    runOnce: true,
    keepCockpit: false,
    hideModules: true,
    autoReboot: false,
    flightctl: {
        defaultEndpoint: "",
    },
    network: {
        ethernet: {
            enabled: true,
            staticIp: "192.168.100.1",
        },
        wifiAp: {
            enabled: false,
            ssidPrefix: "setup-",
            interface: "",
            password: "onboarding",
        },
    },
    led: {
        enabled: false,
    },
    connectivityTest: {
        host: "www.google.com",
    },
};

/**
 * Load configuration from JSON files with fallback hierarchy
 *
 * @returns Promise<SystemOnboardingConfig> - Loaded and merged configuration
 * @throws Error if configuration is invalid
 */
export async function loadConfig(): Promise<SystemOnboardingConfig> {
    let defaultConfig: Partial<SystemOnboardingConfig> = {};
    let userConfig: Partial<SystemOnboardingConfig> = {};

    // Try to load default configuration
    try {
        const defaultFile = cockpit.file(DEFAULT_CONFIG_PATH, { syntax: JSON });
        const content = await defaultFile.read();
        if (content !== null) {
            defaultConfig = content as Partial<SystemOnboardingConfig>;
        }
    } catch (error) {
        console.warn("Default config not found or could not be read, using built-in defaults:", error);
    }

    // Try to load user override configuration
    try {
        const userFile = cockpit.file(USER_CONFIG_PATH, { syntax: JSON });
        const content = await userFile.read();
        if (content !== null) {
            userConfig = content as Partial<SystemOnboardingConfig>;
        }
    } catch (error) {
        console.info("User config not found, using defaults:", error);
    }

    // Merge configurations: built-in defaults < default file < user override
    const mergedConfig: SystemOnboardingConfig = {
        ...BUILT_IN_DEFAULTS,
        ...defaultConfig,
        ...userConfig,
        // Deep merge for nested objects
        network: {
            ...BUILT_IN_DEFAULTS.network,
            ...defaultConfig.network,
            ...userConfig.network,
            ethernet: {
                ...BUILT_IN_DEFAULTS.network?.ethernet,
                ...defaultConfig.network?.ethernet,
                ...userConfig.network?.ethernet,
            },
            wifiAp: {
                ...BUILT_IN_DEFAULTS.network?.wifiAp,
                ...defaultConfig.network?.wifiAp,
                ...userConfig.network?.wifiAp,
            },
        },
        led: {
            ...BUILT_IN_DEFAULTS.led,
            ...defaultConfig.led,
            ...userConfig.led,
        },
        flightctl: {
            ...BUILT_IN_DEFAULTS.flightctl,
            ...defaultConfig.flightctl,
            ...userConfig.flightctl,
        },
        defaults: {
            ...defaultConfig.defaults,
            ...userConfig.defaults,
            proxy: {
                ...defaultConfig.defaults?.proxy,
                ...userConfig.defaults?.proxy,
            },
            labels: {
                ...defaultConfig.defaults?.labels,
                ...userConfig.defaults?.labels,
            },
        },
        connectivityTest: {
            ...BUILT_IN_DEFAULTS.connectivityTest,
            ...defaultConfig.connectivityTest,
            ...userConfig.connectivityTest,
        },
    };

    // Validate the merged configuration
    validateConfig(mergedConfig);

    return mergedConfig;
}

/**
 * Validate configuration against schema requirements
 *
 * @param config - Configuration object to validate
 * @throws Error if validation fails
 */
export function validateConfig(config: SystemOnboardingConfig): void {
    // Check required fields
    if (!config.version) {
        throw new Error("Configuration validation failed: version is required");
    }

    if (config.version !== "1.0") {
        throw new Error(`Configuration validation failed: version must be '1.0', got '${config.version}'`);
    }

    // Validate flightctl configuration if present
    if (config.flightctl?.defaultEndpoint !== undefined) {
        const endpoint = config.flightctl.defaultEndpoint;
        if (typeof endpoint !== "string") {
            throw new Error("flightctl.defaultEndpoint must be a string");
        }
        if (endpoint && !/^https?:\/\//.test(endpoint)) {
            throw new Error("flightctl.defaultEndpoint must start with http:// or https://");
        }
    }

    // Validate network configuration
    if (config.network) {
        if (config.network.wifiAp) {
            const wifiAp = config.network.wifiAp;

            if (wifiAp.ssidPrefix !== undefined) {
                if (
                    typeof wifiAp.ssidPrefix !== "string" ||
                    wifiAp.ssidPrefix.length < 1 ||
                    wifiAp.ssidPrefix.length > 20
                ) {
                    throw new Error("WiFi AP ssidPrefix must be a string between 1 and 20 characters");
                }

                if (!/^[a-zA-Z0-9_-]+$/.test(wifiAp.ssidPrefix)) {
                    throw new Error(
                        "WiFi AP ssidPrefix must contain only alphanumeric characters, underscores, and hyphens"
                    );
                }
            }

            if (wifiAp.interface !== undefined && wifiAp.interface !== "") {
                if (typeof wifiAp.interface !== "string" || wifiAp.interface.length > 15) {
                    throw new Error("WiFi AP interface must be a string of at most 15 characters");
                }
                if (!/^[a-zA-Z0-9._-]+$/.test(wifiAp.interface)) {
                    throw new Error(
                        "WiFi AP interface must contain only alphanumeric characters, dots, underscores, and hyphens"
                    );
                }
            }

            if (wifiAp.password !== undefined) {
                if (typeof wifiAp.password !== "string") {
                    throw new Error("WiFi AP password must be a string");
                }
                // Empty string means open network (no password); non-empty must be 8-63 chars (WPA2 requirement)
                if (wifiAp.password.length > 0 && (wifiAp.password.length < 8 || wifiAp.password.length > 63)) {
                    throw new Error("WiFi AP password must be empty (open network) or between 8 and 63 characters");
                }
            }
        }

        if (config.network.ethernet?.staticIp !== undefined) {
            const staticIp = config.network.ethernet.staticIp;
            if (typeof staticIp !== "string" || !isValidIPv4(staticIp)) {
                throw new Error(`Ethernet staticIp must be a valid IPv4 address, got '${staticIp}'`);
            }
        }
    }

    // Validate LED configuration
    if (config.led?.enabled === true) {
        if (!config.led.tool || typeof config.led.tool !== "string") {
            throw new Error("LED configuration: tool path is required when LED is enabled");
        }
    }
}

/**
 * Validate IPv4 address format
 *
 * @param ip - IP address string to validate
 * @returns boolean - true if valid IPv4 address
 */
function isValidIPv4(ip: string): boolean {
    const parts = ip.split(".");
    if (parts.length !== 4) {
        return false;
    }

    return parts.every((part) => {
        const num = parseInt(part, 10);
        return !isNaN(num) && num >= 0 && num <= 255 && part === String(num);
    });
}

// Re-export the interface for convenience
export type { SystemOnboardingConfig };
