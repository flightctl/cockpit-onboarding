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
