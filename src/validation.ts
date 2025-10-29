/**
 * Validation utilities for system onboarding
 *
 * These functions implement validation logic per data-model.md specifications
 */

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
