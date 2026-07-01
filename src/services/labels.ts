import cockpit from "cockpit";

import { SCRIPT_LABELS } from "../paths";
import type { GenericLabel, LabelsState } from "../types";
import type { AliasState } from "../model-context";
import { resolveAliasValue, ALIAS_LABEL_KEY } from "./alias";
import { spawnWithParamsFile } from "./spawn-helpers";

const _ = cockpit.gettext;

const buildLabelMap = (labels: GenericLabel[]): Record<string, string> => {
    const genericLabels: Record<string, string> = {};
    for (const { key, value } of labels) {
        if (key && value) {
            genericLabels[key] = value;
        }
    }
    return genericLabels;
};

export async function applyLabelsConfiguration(
    labels: LabelsState,
    alias: AliasState,
    hostname: string
): Promise<string[]> {
    const results: string[] = [];

    const defaultLabels = buildLabelMap(labels.deviceLabels);
    const deviceAlias = resolveAliasValue(alias, hostname);
    if (deviceAlias) {
        defaultLabels[ALIAS_LABEL_KEY] = deviceAlias;
    }

    const systemInfoLabels = buildLabelMap(labels.systemInfoMappings);

    const defaultCount = Object.keys(defaultLabels).length;
    const systemInfoCount = Object.keys(systemInfoLabels).length;

    if (defaultCount === 0 && systemInfoCount === 0) {
        results.push(_("Labels: No changes required"));
        return results;
    }

    const params = {
        DEFAULT_LABELS: defaultLabels,
        SYSTEMINFO_LABELS: systemInfoLabels,
    };

    try {
        await spawnWithParamsFile(SCRIPT_LABELS, params, ".labels-params-");

        if (defaultCount > 0) {
            results.push(
                cockpit.format(
                    cockpit.ngettext("Applied $0 default label", "Applied $0 default labels", defaultCount),
                    defaultCount
                )
            );
        }
        if (systemInfoCount > 0) {
            results.push(
                cockpit.format(
                    cockpit.ngettext(
                        "Applied $0 system-info mapping",
                        "Applied $0 system-info mappings",
                        systemInfoCount
                    ),
                    systemInfoCount
                )
            );
        }
    } catch (error) {
        throw new Error(cockpit.format(_("Labels configuration failed: $0"), String(error)));
    }

    return results;
}
