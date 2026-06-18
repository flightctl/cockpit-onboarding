/**
 * Validation utilities for system onboarding
 *
 * These functions implement validation logic per data-model.md specifications
 */

import * as ipaddr from "ipaddr.js";

/**
 * Validate hostname according to RFC 1123
 *
 * Rules:
 * - Total length: 1-253 characters
 * - Label length: 1-63 characters per dot-separated label
 * - Characters: alphanumeric and hyphens only
 * - Start/end: must be alphanumeric
 * - Labels cannot be all numeric in FQDN
 *
 * @param hostname - The hostname to validate
 * @param required - Whether the hostname is required (default: true)
 * @returns Error message or null if valid
 */
export const validateHostname = (hostname: string, required = true): string | null => {
    const trimmedHostname = hostname.trim();

    if (!trimmedHostname) {
        return required ? "Hostname is required" : null;
    }

    // RFC 1123 hostname validation
    if (trimmedHostname.length > 253) {
        return "Hostname must be 253 characters or less";
    }

    // Split into labels (parts separated by dots)
    const labels = trimmedHostname.split(".");

    for (const label of labels) {
        // Each label must be 1-63 characters
        if (label.length === 0) {
            return "Hostname cannot have empty labels";
        }
        if (label.length > 63) {
            return "Each hostname label must be 63 characters or less";
        }

        // Can only contain alphanumeric characters and hyphens (check this first)
        if (!/^[a-zA-Z0-9-]+$/.test(label)) {
            return "Hostname can only contain letters, numbers, and hyphens";
        }

        // Must start and end with alphanumeric character
        if (!/^[a-zA-Z0-9]/.test(label)) {
            return "Each hostname label must start with an alphanumeric character";
        }
        if (!/[a-zA-Z0-9]$/.test(label)) {
            return "Each hostname label must end with an alphanumeric character";
        }
    }

    // Reject if ALL labels are numeric (looks like an IPv4 address)
    // But allow FQDNs with some all-numeric labels like "1.ntp.org"
    const allLabelsNumeric = labels.every((label) => /^\d+$/.test(label));
    if (allLabelsNumeric && labels.length > 1) {
        return "Hostname labels cannot be all numeric in a FQDN";
    }

    return null;
};

/**
 * Validate IPv4 address
 *
 * Uses ipaddr.js for validation (consistent with NetworkManager expectations)
 *
 * @param ip - The IPv4 address to validate
 * @returns Error message or null if valid
 */
export const validateIPv4 = (ip: string): string | null => {
    const trimmedIp = ip.trim();
    if (!trimmedIp) {
        return "IPv4 address is required";
    }

    // Use ipaddr.js validation (same as NetworkManager utils)
    // IPv4.isValidFourPartDecimal explicitly requires all 4 octets
    if (!ipaddr.IPv4.isValidFourPartDecimal(trimmedIp)) {
        // Provide more specific error for user feedback
        const ipRegex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
        const match = trimmedIp.match(ipRegex);

        if (!match) {
            return "Invalid IPv4 address format";
        }

        const octets = match.slice(1).map(Number);
        for (const octet of octets) {
            if (octet < 0 || octet > 255) {
                return "IPv4 octets must be between 0 and 255";
            }
        }

        return "Invalid IPv4 address format";
    }

    return null;
};

/**
 * Validate subnet mask in dotted decimal or CIDR notation
 *
 * @param mask - The subnet mask to validate
 * @returns Error message or null if valid
 */
export const validateSubnetMask = (mask: string): string | null => {
    const trimmedMask = mask.trim();
    if (!trimmedMask) {
        return "Subnet mask is required";
    }

    // Support CIDR notation (/24)
    if (trimmedMask.startsWith("/")) {
        const prefix = parseInt(trimmedMask.slice(1), 10);
        if (isNaN(prefix) || prefix < 0 || prefix > 32) {
            return "CIDR prefix must be between 0 and 32";
        }
        return null;
    }

    // Support dotted decimal notation (255.255.255.0)
    const ipv4Error = validateIPv4(trimmedMask);
    if (ipv4Error) {
        return "Invalid subnet mask format";
    }

    // Validate that it's a valid subnet mask
    const octets = trimmedMask.split(".").map(Number);
    let binaryMask = "";
    for (const octet of octets) {
        binaryMask += octet.toString(2).padStart(8, "0");
    }

    // Valid subnet mask should have consecutive 1s followed by consecutive 0s
    if (!/^1*0*$/.test(binaryMask)) {
        return "Invalid subnet mask - must have consecutive 1s followed by 0s";
    }

    return null;
};

/**
 * Validate IPv6 address with optional prefix
 *
 * Uses ipaddr.js for validation (consistent with NetworkManager expectations)
 *
 * @param ip - The IPv6 address to validate
 * @param requirePrefix - Whether the prefix is required (e.g., /64)
 * @returns Error message or null if valid
 */
export const validateIPv6 = (ip: string, requirePrefix = false): string | null => {
    const trimmedIp = ip.trim();
    if (!trimmedIp) {
        return requirePrefix ? "IPv6 address is required" : null;
    }

    let address = trimmedIp;
    let prefix: number | null = null;

    // Extract prefix if present
    if (trimmedIp.includes("/")) {
        const parts = trimmedIp.split("/");
        if (parts.length !== 2) {
            return "Invalid IPv6 address format";
        }
        address = parts[0];
        prefix = parseInt(parts[1], 10);

        if (isNaN(prefix) || prefix < 0 || prefix > 128) {
            return "IPv6 prefix must be between 0 and 128";
        }
    } else if (requirePrefix) {
        return "IPv6 address must include prefix (e.g., /64)";
    }

    // Use ipaddr.js validation (same as NetworkManager utils)
    if (!ipaddr.IPv6.isValid(address)) {
        return "Invalid IPv6 address format";
    }

    return null;
};

/**
 * Validate IPv6 gateway address
 *
 * @param gateway - The IPv6 gateway address to validate
 * @returns Error message or null if valid
 */
export const validateIPv6Gateway = (gateway: string): string | null => {
    const trimmedGateway = gateway.trim();
    if (!trimmedGateway) {
        return null;
    } // Optional field

    const error = validateIPv6(trimmedGateway);
    if (error) {
        return error;
    }

    // Check if it's a link-local address (not allowed for gateway)
    if (trimmedGateway.toLowerCase().startsWith("fe80:")) {
        return "Gateway cannot be a link-local address (fe80::)";
    }

    return null;
};

/**
 * Validate IP address (IPv4 or IPv6)
 *
 * Useful for DNS servers, gateways, and any field that accepts IP addresses
 *
 * @param ip - The IP address to validate
 * @param required - Whether the field is required
 * @returns Error message or null if valid
 */
export const validateIP = (ip: string, required = true): string | null => {
    const trimmedIp = ip.trim();

    if (!trimmedIp) {
        return required ? "IP address is required" : null;
    }

    // Try IPv4 first (using ipaddr.js)
    if (ipaddr.IPv4.isValidFourPartDecimal(trimmedIp)) {
        return null;
    }

    // Try IPv6 (using ipaddr.js)
    if (ipaddr.IPv6.isValid(trimmedIp)) {
        return null;
    }

    return "Invalid IP address";
};

/**
 * Validate that an IPv4 gateway is within the same subnet as the static IP.
 *
 * @param address - The IPv4 address
 * @param gateway - The IPv4 gateway
 * @param mask - Subnet mask (dotted decimal or CIDR)
 * @returns Error message or null if valid
 */
export const validateIPv4GatewaySubnet = (address: string, gateway: string, mask: string): string | null => {
    const addr = address.trim();
    const gw = gateway.trim();
    const m = mask.trim();
    if (!addr || !gw || !m) {
        return null;
    }
    if (validateIPv4(addr) || validateIPv4(gw) || validateSubnetMask(m)) {
        return null;
    }

    let prefixLen: number;
    if (m.startsWith("/")) {
        prefixLen = parseInt(m.slice(1), 10);
    } else {
        const octets = m.split(".").map(Number);
        let bits = "";
        for (const o of octets) {
            bits += o.toString(2).padStart(8, "0");
        }
        prefixLen = bits.indexOf("0") === -1 ? 32 : bits.indexOf("0");
    }

    const addrParts = addr.split(".").map(Number);
    const gwParts = gw.split(".").map(Number);
    const maskBits = 0xffffffff << (32 - prefixLen);
    const addrInt = ((addrParts[0] << 24) | (addrParts[1] << 16) | (addrParts[2] << 8) | addrParts[3]) >>> 0;
    const gwInt = ((gwParts[0] << 24) | (gwParts[1] << 16) | (gwParts[2] << 8) | gwParts[3]) >>> 0;

    if ((addrInt & maskBits) !== (gwInt & maskBits)) {
        return "Gateway is not in the same subnet as the IP address";
    }

    return null;
};

/**
 * Validate that an IPv6 gateway is within the same subnet as the static IP.
 *
 * @param address - The IPv6 address with prefix (e.g. "2001:db8::1/64")
 * @param gateway - The IPv6 gateway address
 * @returns Error message or null if valid
 */
export const validateIPv6GatewaySubnet = (address: string, gateway: string): string | null => {
    const addr = address.trim();
    const gw = gateway.trim();
    if (!addr || !gw || !addr.includes("/")) {
        return null;
    }
    if (validateIPv6(addr, true) || validateIPv6(gw)) {
        return null;
    }

    try {
        const [addrPart, prefixStr] = addr.split("/");
        const prefixLen = parseInt(prefixStr, 10);
        const addrParsed = ipaddr.IPv6.parse(addrPart);
        const gwParsed = ipaddr.IPv6.parse(gw);
        const addrBytes = addrParsed.toByteArray();
        const gwBytes = gwParsed.toByteArray();

        const fullBytes = Math.floor(prefixLen / 8);
        const remainingBits = prefixLen % 8;

        for (let i = 0; i < fullBytes; i++) {
            if (addrBytes[i] !== gwBytes[i]) {
                return "Gateway is not in the same subnet as the IPv6 address";
            }
        }
        if (remainingBits > 0 && fullBytes < 16) {
            const mask = 0xff << (8 - remainingBits);
            if ((addrBytes[fullBytes] & mask) !== (gwBytes[fullBytes] & mask)) {
                return "Gateway is not in the same subnet as the IPv6 address";
            }
        }
    } catch {
        return null;
    }

    return null;
};

/**
 * Validate hostname or IP address (IPv4 or IPv6)
 *
 * Useful for fields that accept any of these formats (e.g., proxy hostname, NTP server)
 *
 * @param value - The value to validate
 * @param required - Whether the field is required
 * @returns Error message or null if valid
 */
export const validateHostnameOrIP = (value: string, required = true): string | null => {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
        return required ? "Hostname or IP address is required" : null;
    }

    // Try IPv4 first (quick check)
    if (ipaddr.IPv4.isValidFourPartDecimal(trimmedValue)) {
        return null;
    }

    // Try IPv6 (quick check)
    if (ipaddr.IPv6.isValid(trimmedValue)) {
        return null;
    }

    // Finally try hostname validation
    const hostnameError = validateHostname(trimmedValue, true);
    if (!hostnameError) {
        return null;
    }

    // Return a user-friendly combined error
    return "Invalid hostname or IP address";
};

/**
 * Validate port number
 *
 * @param port - The port number to validate
 * @param required - Whether the field is required
 * @returns Error message or null if valid
 */
export const validatePort = (port: number | null, required = true): string | null => {
    if (port === null) {
        return required ? "Port is required" : null;
    }

    if (port < 1 || port > 65535) {
        return "Port must be between 1 and 65535";
    }

    return null;
};

/**
 * Validate URL
 *
 * @param url - The URL to validate
 * @param required - Whether the field is required
 * @returns Error message or null if valid
 */
/**
 * Validate a Kubernetes label key
 *
 * Format: [prefix/]name
 * - prefix: optional DNS subdomain, max 253 chars
 * - name: max 63 chars, alphanumeric start/end, [-_.a-zA-Z0-9] in between
 */
export const validateLabelKey = (key: string, required = true): string | null => {
    const trimmed = key.trim();

    if (!trimmed) {
        return required ? "Label key is required" : null;
    }

    let name = trimmed;
    if (trimmed.includes("/")) {
        const parts = trimmed.split("/");
        if (parts.length !== 2) {
            return 'Label key can contain at most one "/"';
        }
        const prefix = parts[0];
        name = parts[1];

        if (!prefix) {
            return "Label key prefix cannot be empty";
        }
        if (prefix.length > 253) {
            return "Label key prefix must be 253 characters or less";
        }
        if (!/^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?$/.test(prefix)) {
            return "Label key prefix must be a valid DNS subdomain";
        }
    }

    if (!name) {
        return "Label key name cannot be empty";
    }
    if (name.length > 63) {
        return "Label key name must be 63 characters or less";
    }
    if (!/^[a-zA-Z0-9]([a-zA-Z0-9._-]*[a-zA-Z0-9])?$/.test(name)) {
        return "Label key name must start and end with alphanumeric characters, and contain only alphanumerics, hyphens, underscores, or dots";
    }

    return null;
};

/**
 * Validate a Kubernetes label value
 *
 * Max 63 chars, alphanumeric start/end if non-empty, [-_.a-zA-Z0-9] in between.
 * Empty string is valid.
 */
export const validateLabelValue = (value: string): string | null => {
    const trimmed = value.trim();

    if (!trimmed) {
        return null;
    }
    if (trimmed.length > 63) {
        return "Label value must be 63 characters or less";
    }
    if (!/^[a-zA-Z0-9]([a-zA-Z0-9._-]*[a-zA-Z0-9])?$/.test(trimmed)) {
        return "Label value must start and end with alphanumeric characters, and contain only alphanumerics, hyphens, underscores, or dots";
    }

    return null;
};

export const validateURL = (url: string, required = true): string | null => {
    const trimmedUrl = url.trim();

    if (!trimmedUrl) {
        return required ? "URL is required" : null;
    }

    try {
        const urlObj = new URL(trimmedUrl);

        // Check for valid protocol (http or https)
        if (!["http:", "https:"].includes(urlObj.protocol)) {
            return "URL must use http:// or https:// protocol";
        }

        // Check that hostname is valid and not empty
        if (!urlObj.hostname || urlObj.hostname.length === 0) {
            return "URL must have a valid hostname";
        }

        // Use the existing hostname validation function for consistency
        const hostnameError = validateHostname(urlObj.hostname, true);
        if (hostnameError) {
            return `URL hostname is invalid: ${hostnameError}`;
        }

        return null;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_e) {
        return "Invalid URL format";
    }
};
