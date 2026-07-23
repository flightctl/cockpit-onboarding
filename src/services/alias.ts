/* SPDX-License-Identifier: LGPL-2.1-or-later */
import { AliasMode, type AliasState } from "../model-context";
import { validateLabelValue } from "../validation";

export const ALIAS_LABEL_KEY = "alias";

export function resolveAliasValue(alias: AliasState, hostname: string): string | null {
    switch (alias.mode) {
        case AliasMode.NONE:
            return null;
        case AliasMode.HOSTNAME: {
            const value = hostname.trim();
            return value || null;
        }
        case AliasMode.CUSTOM: {
            const value = alias.customValue.trim();
            return value || null;
        }
    }
}

/**
 * Alias is a label value, therefore we must not use AliasMode.HOSTNAME if the hostname is not a valid label value.
 *
 * @param aliasMode - The alias mode to resolve.
 * @param hostname - The hostname to resolve the alias mode for.
 * @returns The resolved alias mode.
 */
export function resolveDefaultAliasMode(aliasMode: AliasMode | undefined, hostname: string): AliasMode {
    if (!hostname || validateLabelValue(hostname) !== null) {
        return AliasMode.CUSTOM;
    }
    return aliasMode ?? AliasMode.HOSTNAME;
}

export function validateAliasConfig(alias: AliasState, hostname: string): boolean {
    if (alias.mode === AliasMode.NONE) {
        return true;
    }

    const aliasValue = resolveAliasValue(alias, hostname);
    if (!aliasValue) {
        return false;
    }

    return validateLabelValue(aliasValue) === null;
}
