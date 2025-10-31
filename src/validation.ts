/**
 * Validation utilities for system onboarding
 *
 * These functions implement validation logic per data-model.md specifications
 */

import * as ipaddr from 'ipaddr.js';

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
 * @returns Error message or null if valid
 */
export const validateHostname = (hostname: string): string | null => {
    if (!hostname.trim()) return 'Hostname is required';

    // RFC 1123 hostname validation
    if (hostname.length > 253) return 'Hostname must be 253 characters or less';

    // Split into labels (parts separated by dots)
    const labels = hostname.split('.');

    for (const label of labels) {
        // Each label must be 1-63 characters
        if (label.length === 0) return 'Hostname cannot have empty labels';
        if (label.length > 63) return 'Each hostname label must be 63 characters or less';

        // Can only contain alphanumeric characters and hyphens (check this first)
        if (!/^[a-zA-Z0-9-]+$/.test(label)) return 'Hostname can only contain letters, numbers, and hyphens';

        // Must start and end with alphanumeric character
        if (!/^[a-zA-Z0-9]/.test(label)) return 'Each hostname label must start with an alphanumeric character';
        if (!/[a-zA-Z0-9]$/.test(label)) return 'Each hostname label must end with an alphanumeric character';

        // Cannot be all numeric (for FQDN compliance)
        if (/^\d+$/.test(label) && labels.length > 1) return 'Hostname labels cannot be all numeric in a FQDN';
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
    if (!ip.trim()) return 'IPv4 address is required';

    // Use ipaddr.js validation (same as NetworkManager utils)
    // IPv4.isValidFourPartDecimal explicitly requires all 4 octets
    if (!ipaddr.IPv4.isValidFourPartDecimal(ip)) {
        // Provide more specific error for user feedback
        const ipRegex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
        const match = ip.match(ipRegex);

        if (!match) return 'Invalid IPv4 address format';

        const octets = match.slice(1).map(Number);
        for (const octet of octets) {
            if (octet < 0 || octet > 255) {
                return 'IPv4 octets must be between 0 and 255';
            }
        }

        return 'Invalid IPv4 address format';
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
    if (!mask.trim()) return 'Subnet mask is required';

    // Support CIDR notation (/24)
    if (mask.startsWith('/')) {
        const prefix = parseInt(mask.slice(1), 10);
        if (isNaN(prefix) || prefix < 0 || prefix > 32) {
            return 'CIDR prefix must be between 0 and 32';
        }
        return null;
    }

    // Support dotted decimal notation (255.255.255.0)
    const ipv4Error = validateIPv4(mask);
    if (ipv4Error) return 'Invalid subnet mask format';

    // Validate that it's a valid subnet mask
    const octets = mask.split('.').map(Number);
    let binaryMask = '';
    for (const octet of octets) {
        binaryMask += octet.toString(2).padStart(8, '0');
    }

    // Valid subnet mask should have consecutive 1s followed by consecutive 0s
    if (!/^1*0*$/.test(binaryMask)) {
        return 'Invalid subnet mask - must have consecutive 1s followed by 0s';
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
    if (!ip.trim()) return requirePrefix ? 'IPv6 address is required' : null;

    let address = ip;
    let prefix: number | null = null;

    // Extract prefix if present
    if (ip.includes('/')) {
        const parts = ip.split('/');
        if (parts.length !== 2) return 'Invalid IPv6 address format';
        address = parts[0];
        prefix = parseInt(parts[1], 10);

        if (isNaN(prefix) || prefix < 0 || prefix > 128) {
            return 'IPv6 prefix must be between 0 and 128';
        }
    } else if (requirePrefix) {
        return 'IPv6 address must include prefix (e.g., /64)';
    }

    // Use ipaddr.js validation (same as NetworkManager utils)
    if (!ipaddr.IPv6.isValid(address)) {
        return 'Invalid IPv6 address format';
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
    if (!gateway.trim()) return null; // Optional field

    const error = validateIPv6(gateway);
    if (error) return error;

    // Check if it's a link-local address (not allowed for gateway)
    if (gateway.toLowerCase().startsWith('fe80:')) {
        return 'Gateway cannot be a link-local address (fe80::)';
    }

    return null;
};

/**
 * Validate DNS server address (IPv4 or IPv6)
 *
 * @param dns - The DNS server address to validate
 * @param isRequired - Whether the field is required
 * @returns Error message or null if valid
 */
export const validateDNSServer = (dns: string, isRequired = false): string | null => {
    if (!dns.trim()) {
        return isRequired ? 'DNS server is required' : null;
    }

    // Try IPv4 first (using ipaddr.js)
    if (ipaddr.IPv4.isValidFourPartDecimal(dns)) return null;

    // Try IPv6 (using ipaddr.js)
    if (ipaddr.IPv6.isValid(dns)) return null;

    return 'Invalid DNS server address';
};
