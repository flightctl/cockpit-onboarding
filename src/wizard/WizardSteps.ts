/* SPDX-License-Identifier: LGPL-2.1-or-later */
import { ALIAS_LABEL_KEY, validateAliasConfig } from "../services/alias";
import { Model } from "../model-context";
import { validateFlightctlCredentials } from "../flightctl-enrollment";
import {
    validateSystemHostname,
    validateIpv4StaticConfig,
    validateIpv4DnsConfig,
    validateIpv6StaticConfig,
    validateIpv6DnsConfig,
    validateHostnameOrIP,
    validateManualNtpServers,
    validatePort,
    validateURL,
    validateVlanConfig,
    hasUniqueLabelKeys,
    validateLabelKey,
    validateLabelValue,
} from "../validation";

export const WIZARD_STEP_IDS = {
    network: "networkStep",
    networkServices: "networkServicesStep",
    enrollment: "enrollmentStep",
    labels: "labelsStep",
    review: "reviewStep",
    progress: "progressStep",
} as const;

export const stepIds = [
    WIZARD_STEP_IDS.network,
    WIZARD_STEP_IDS.networkServices,
    WIZARD_STEP_IDS.enrollment,
    WIZARD_STEP_IDS.labels,
    WIZARD_STEP_IDS.review,
    WIZARD_STEP_IDS.progress,
] as const;

export type WizardStepId = (typeof stepIds)[number];

/**
 * Validate the hostname step
 * Required: A valid hostname must be entered
 */
export const validateHostnameStep = (model: Model): boolean => {
    // Hostname is required and must be valid
    if (!model.hostname.value || !model.hostname.value.trim()) {
        return false;
    }

    const hostnameError = validateSystemHostname(model.hostname.value);
    return hostnameError === null;
};

/**
 * Validate the network interface step
 * Required: An interface must be selected
 * If WiFi is selected and requires authentication, password is required
 */
export const validateNetworkInterfaceStep = (model: Model): boolean => {
    // An interface must be selected
    if (!model.networkInterface.selectedInterface) {
        return false;
    }

    // If WiFi is selected and security is not 'none', password is required
    if (model.networkInterface.interfaceType === "wifi") {
        // WiFi SSID must be selected
        if (!model.networkInterface.wifiSsid) {
            return false;
        }

        // If WiFi requires authentication (not 'none'), password must be provided
        if (model.networkInterface.wifiSecurity && model.networkInterface.wifiSecurity !== "none") {
            if (!model.networkInterface.wifiPassword || !model.networkInterface.wifiPassword.trim()) {
                return false;
            }
        }
    }

    if (
        model.networkInterface.interfaceType !== "wifi" &&
        validateVlanConfig(model.networkInterface.vlanEnabled, model.networkInterface.vlanId) !== null
    ) {
        return false;
    }

    return true;
};

/**
 * Validate the network address step
 * Required: IPv4 configuration must be valid (either DHCP or complete static config)
 * IPv6 is optional
 */
export const validateNetworkAddressStep = (model: Model): boolean => {
    const { ipv4, ipv6 } = model.networkAddress;

    // At least one protocol must be enabled
    if (ipv4.method === "disabled" && ipv6.method === "disabled") {
        return false;
    }

    // IPv4 validation
    if (ipv4.method === "static" && !validateIpv4StaticConfig(ipv4)) {
        return false;
    }
    if (ipv4.method !== "disabled" && !validateIpv4DnsConfig(ipv4)) {
        return false;
    }
    // DHCP/auto and disabled don't require additional validation

    // IPv6 validation (optional, but if static must be complete)
    if (ipv6.method === "static" && !validateIpv6StaticConfig(ipv6)) {
        return false;
    }
    if (ipv6.method !== "disabled" && !validateIpv6DnsConfig(ipv6)) {
        return false;
    }

    return true;
};

/**
 * Validate the network services step
 * NTP: If custom NTP servers are configured, at least one must be provided
 * Proxy: If proxy is enabled, hostname and port are required
 */
export const validateNetworkServicesConfig = (model: Model): boolean => {
    const { ntp, proxy } = model.networkServices;

    // NTP validation
    if (!ntp.autoConfig && !validateManualNtpServers(ntp.servers)) {
        return false;
    }

    // Proxy validation
    if (proxy.enabled) {
        // Proxy hostname is required
        if (!proxy.hostname || validateHostnameOrIP(proxy.hostname, false) !== null) {
            return false;
        }

        // Proxy port is required
        if (proxy.port === null || validatePort(proxy.port, false) !== null) {
            return false;
        }

        // Username and password are optional, no validation needed
    }

    return true;
};

/**
 * Validate the enrollment step for Flight Control.
 * Enrollment is optional; when selected, credentials and endpoint must be valid.
 */
export const validateEnrollmentStep = (model: Model): boolean => {
    const enrollment = model.enrollment;

    if (!enrollment.selected) {
        return true;
    }

    if (enrollment.useExisting) {
        return true;
    }

    const endpoint = enrollment.endpoint;
    if (!endpoint || !endpoint.trim()) {
        return false;
    }

    if (validateURL(endpoint, true) !== null) {
        return false;
    }

    return validateFlightctlCredentials(enrollment.credentials);
};

/**
 * Validate the labels step
 * Required: A valid hostname must be entered.
 * Labels are optional; validates key/value consistency when either is present.
 */
export const validateLabelsStep = (model: Model): boolean => {
    if (!validateHostnameStep(model)) {
        return false;
    }

    if (!validateAliasConfig(model.alias, model.hostname.value)) {
        return false;
    }

    const activeDeviceLabels = model.labels.deviceLabels.filter(({ key, value }) => key.length > 0 || value.length > 0);
    if (!hasUniqueLabelKeys(activeDeviceLabels)) {
        return false;
    }

    for (const { key, value } of activeDeviceLabels) {
        // Reserved for the separate Alias field on the labels step.
        if (key === ALIAS_LABEL_KEY) {
            return false;
        }

        if (!key) {
            return false;
        }
        if (validateLabelKey(key) !== null) {
            return false;
        }
        if (validateLabelValue(value) !== null) {
            return false;
        }
    }

    const activeSystemInfoMappings = model.labels.systemInfoMappings.filter(({ key, value }) => {
        const isCustomInfo = value.startsWith("customInfo.");
        const hasField = isCustomInfo ? value.slice("customInfo.".length).length > 0 : value.length > 0;
        return key.length > 0 || hasField;
    });
    if (!hasUniqueLabelKeys(activeSystemInfoMappings)) {
        return false;
    }

    for (const { key, value } of activeSystemInfoMappings) {
        const isCustomInfo = value.startsWith("customInfo.");
        const hasField = isCustomInfo ? value.slice("customInfo.".length).length > 0 : value.length > 0;

        // Reserved for the separate Alias field on the labels step.
        if (key === ALIAS_LABEL_KEY) {
            return false;
        }

        if (!key || !hasField) {
            return false;
        }
        if (validateLabelKey(key) !== null) {
            return false;
        }
    }

    return true;
};

/**
 * Validate the combined network step (interface and address)
 */
export const validateNetworkStep = (model: Model): boolean => {
    return validateNetworkInterfaceStep(model) && validateNetworkAddressStep(model);
};

/**
 * Validate the network services step
 */
export const validateNetworkServicesStep = (model: Model): boolean => {
    return validateNetworkServicesConfig(model);
};

/**
 * Validate the review step
 * Required: A connectivity test host must be configured
 */
export const validateReviewStep = (model: Model): boolean => {
    return validateHostnameOrIP(model.connectivityTestHost) === null;
};
