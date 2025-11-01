/**
 * Step validation logic for the wizard
 *
 * These functions determine whether each step's required fields are filled and valid,
 * controlling whether users can proceed to the next step.
 */

import { Model } from '../model-context';
import { validateHostname, validateIPv4, validateSubnetMask, validateIPv6, validateIP, validateHostnameOrIP, validatePort } from '../validation';

/**
 * Validate the hostname step
 * Required: A valid hostname must be entered
 */
export const validateHostnameStep = (model: Model): boolean => {
    // Hostname is required and must be valid
    if (!model.hostname.value || !model.hostname.value.trim()) {
        return false;
    }

    const hostnameError = validateHostname(model.hostname.value);
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
    if (model.networkInterface.interfaceType === 'wifi') {
        // WiFi SSID must be selected
        if (!model.networkInterface.wifiSsid) {
            return false;
        }

        // If WiFi requires authentication (not 'none'), password must be provided
        if (model.networkInterface.wifiSecurity && model.networkInterface.wifiSecurity !== 'none') {
            if (!model.networkInterface.wifiPassword || !model.networkInterface.wifiPassword.trim()) {
                return false;
            }
        }
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

    // IPv4 validation
    if (ipv4.method === 'static') {
        // Static IPv4 requires address, subnet mask, and gateway
        if (!ipv4.address || validateIPv4(ipv4.address) !== null) {
            return false;
        }
        if (!ipv4.subnetMask || validateSubnetMask(ipv4.subnetMask) !== null) {
            return false;
        }
        if (!ipv4.gateway || validateIPv4(ipv4.gateway) !== null) {
            return false;
        }

        // If manual DNS is selected, primary DNS is required
        if (!ipv4.autoDns) {
            if (!ipv4.primaryDns || validateIP(ipv4.primaryDns) !== null) {
                return false;
            }
            // Secondary DNS is optional, but if provided must be valid
            if (ipv4.secondaryDns && validateIP(ipv4.secondaryDns, false) !== null) {
                return false;
            }
        }
    }
    // DHCP/auto and disabled don't require additional validation

    // IPv6 validation (optional, but if static must be complete)
    if (ipv6.method === 'static') {
        // Static IPv6 requires address with prefix and gateway
        if (!ipv6.address || validateIPv6(ipv6.address, true) !== null) {
            return false;
        }
        if (!ipv6.gateway || validateIPv6(ipv6.gateway) !== null) {
            return false;
        }

        // If manual DNS is selected, primary DNS is required
        if (!ipv6.autoDns) {
            if (!ipv6.primaryDns || validateIP(ipv6.primaryDns) !== null) {
                return false;
            }
            // Secondary DNS is optional, but if provided must be valid
            if (ipv6.secondaryDns && validateIP(ipv6.secondaryDns, false) !== null) {
                return false;
            }
        }
    }

    return true;
};

/**
 * Validate the network services step
 * NTP: If custom NTP servers are configured, at least one must be provided
 * Proxy: If proxy is enabled, hostname and port are required
 */
export const validateNetworkServicesStep = (model: Model): boolean => {
    const { ntp, proxy } = model.networkServices;

    // NTP validation
    if (!ntp.autoConfig) {
        // Manual NTP configuration requires at least one server
        if (ntp.servers.length === 0) {
            return false;
        }

        // All servers must be valid (servers in the list should never be empty)
        for (const server of ntp.servers) {
            if (validateHostnameOrIP(server, false) !== null) {
                return false;
            }
        }
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
 * Validate the enrollment step
 * If enrollment services are selected, credentials and endpoint must be valid
 *
 * Note: This function needs access to the config to validate properly.
 * For now, we do basic validation. Full validation is done in the UI component.
 */
export const validateEnrollmentStep = (model: Model, enrollmentServices?: any[]): boolean => {
    const { selectedServices, credentials, endpoints } = model.enrollment;

    // If no services are selected, step is valid (enrollment is optional)
    if (selectedServices.length === 0) {
        return true;
    }

    // If we don't have the enrollment services config, we can't fully validate
    // Just check that credentials exist for selected services
    if (!enrollmentServices || enrollmentServices.length === 0) {
        for (const serviceId of selectedServices) {
            if (!credentials[serviceId]) {
                return false;
            }
        }
        return true;
    }

    // Full validation with config
    for (const serviceId of selectedServices) {
        const service = enrollmentServices.find((s: any) => s.id === serviceId);
        if (!service) continue;

        // Validate endpoint exists
        const endpoint = endpoints?.[serviceId] || service.endpoint.url;
        if (!endpoint || !endpoint.trim()) {
            return false;
        }

        // Validate credentials object exists
        const serviceCreds = credentials[serviceId];
        if (!serviceCreds) {
            return false;
        }

        // Check all required fields are filled
        const required = service.credentialsSchema?.required || [];
        for (const fieldName of required) {
            const value = serviceCreds[fieldName];
            if (value === undefined || value === null || value === '') {
                return false;
            }
        }
    }

    return true;
};

/**
 * Validate the review step
 * No validation needed - this is a summary/review page
 */
export const validateReviewStep = (_model: Model): boolean => {
    // Review step has no validation requirements
    // It's just a summary of all previous steps
    return true;
};
