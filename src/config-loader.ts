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

const ALLOWED_SCRIPT_DIRS = [
    "/usr/share/cockpit/system-onboarding/system-onboarding.d/",
    "/etc/cockpit/system-onboarding.d/",
];

// Default configuration if no files are found
const BUILT_IN_DEFAULTS: SystemOnboardingConfig = {
    version: "1.0",
    runOnce: true,
    keepCockpit: false,
    hideModules: true,
    autoReboot: false,
    enrollmentServices: [],
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
        enrollmentServices: userConfig.enrollmentServices || defaultConfig.enrollmentServices || [],
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

    // Validate enrollment services if present
    if (config.enrollmentServices && Array.isArray(config.enrollmentServices)) {
        config.enrollmentServices.forEach((service, index) => {
            // Required fields
            if (!service.id || typeof service.id !== "string") {
                throw new Error(`Enrollment service at index ${index}: 'id' is required and must be a string`);
            }

            if (!/^[a-z0-9-]+$/.test(service.id)) {
                throw new Error(
                    `Enrollment service '${service.id}': id must contain only lowercase letters, numbers, and hyphens`
                );
            }

            if (!service.name || typeof service.name !== "string") {
                throw new Error(`Enrollment service '${service.id}': 'name' is required and must be a string`);
            }

            if (service.name.length < 1 || service.name.length > 100) {
                throw new Error(`Enrollment service '${service.id}': name length must be between 1 and 100 characters`);
            }

            if (!service.endpoint || typeof service.endpoint !== "object") {
                throw new Error(`Enrollment service '${service.id}': 'endpoint' is required and must be an object`);
            }

            if (typeof service.endpoint.url !== "string") {
                throw new Error(`Enrollment service '${service.id}': endpoint.url must be a string`);
            }

            // Empty URL is allowed when allowUserOverride is true (user provides it)
            if (service.endpoint.url && !/^https?:\/\//.test(service.endpoint.url)) {
                throw new Error(`Enrollment service '${service.id}': endpoint.url must start with http:// or https://`);
            }

            if (!service.credentialsSchema || typeof service.credentialsSchema !== "object") {
                throw new Error(
                    `Enrollment service '${service.id}': 'credentialsSchema' is required and must be an object`
                );
            }

            if (service.credentialsSchema.type !== "object") {
                throw new Error(`Enrollment service '${service.id}': credentialsSchema.type must be 'object'`);
            }

            // credentialsSchema must have either top-level properties or oneOf variants
            const hasProperties =
                service.credentialsSchema.properties && typeof service.credentialsSchema.properties === "object";
            const hasOneOf =
                Array.isArray(service.credentialsSchema.oneOf) && service.credentialsSchema.oneOf.length > 0;
            if (!hasProperties && !hasOneOf) {
                throw new Error(
                    `Enrollment service '${service.id}': credentialsSchema must have 'properties' or 'oneOf'`
                );
            }

            if (!service.scriptPath || typeof service.scriptPath !== "string") {
                throw new Error(`Enrollment service '${service.id}': 'scriptPath' is required and must be a string`);
            }

            if (!ALLOWED_SCRIPT_DIRS.some((dir) => service.scriptPath.startsWith(dir))) {
                throw new Error(
                    `Enrollment service '${service.id}': scriptPath must be within an allowed directory ` +
                        `(${ALLOWED_SCRIPT_DIRS.join(" or ")}), got '${service.scriptPath}'`
                );
            }

            if (service.scriptPath.includes("..")) {
                throw new Error(`Enrollment service '${service.id}': scriptPath must not contain '..'`);
            }

            if (service.skipWhen !== undefined) {
                if (!Array.isArray(service.skipWhen)) {
                    throw new Error(`Enrollment service '${service.id}': 'skipWhen' must be an array`);
                }
                service.skipWhen.forEach((condition, condIndex) => {
                    if (!condition.action || (condition.action !== "skip" && condition.action !== "connectivityOnly")) {
                        throw new Error(
                            `Enrollment service '${service.id}': skipWhen[${condIndex}].action must be 'skip' or 'connectivityOnly'`
                        );
                    }
                    if (!condition.reason || typeof condition.reason !== "string") {
                        throw new Error(
                            `Enrollment service '${service.id}': skipWhen[${condIndex}].reason is required`
                        );
                    }
                    if (condition.allPathsExist !== undefined && !Array.isArray(condition.allPathsExist)) {
                        throw new Error(
                            `Enrollment service '${service.id}': skipWhen[${condIndex}].allPathsExist must be an array`
                        );
                    }
                    if (condition.anyPathExists !== undefined && !Array.isArray(condition.anyPathExists)) {
                        throw new Error(
                            `Enrollment service '${service.id}': skipWhen[${condIndex}].anyPathExists must be an array`
                        );
                    }
                });
            }
        });
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
    if (parts.length !== 4) {return false}

    return parts.every((part) => {
        const num = parseInt(part, 10);
        return !isNaN(num) && num >= 0 && num <= 255 && part === String(num);
    });
}

// Re-export the interface for convenience
export type { SystemOnboardingConfig };
