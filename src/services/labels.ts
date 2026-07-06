import cockpit from "cockpit";

import { SCRIPT_LABELS } from "../paths";
import type { GenericLabel, LabelsState } from "../types";
import type { AliasState } from "../model-context";
import { resolveAliasValue, ALIAS_LABEL_KEY } from "./alias";
import { spawnWithParamsFile } from "./spawn-helpers";
import {
    CONFIG_ACTION_IDS,
    indexedActionId,
    makeStepAction,
    type StepAction,
} from "../wizard/enrollment-progress-types";

const _ = cockpit.gettext;

const buildLabelMap = (labels: GenericLabel[], isValueRequired: boolean): Record<string, string> => {
    const genericLabels: Record<string, string> = {};
    for (const { key, value } of labels) {
        if (key && (!isValueRequired || value)) {
            genericLabels[key] = value || "";
        }
    }
    return genericLabels;
};

export async function applyLabelsConfiguration(
    labels: LabelsState,
    alias: AliasState,
    hostname: string
): Promise<StepAction[]> {
    const actions: StepAction[] = [];

    const defaultLabels = buildLabelMap(labels.deviceLabels, false);
    const deviceAlias = resolveAliasValue(alias, hostname);
    if (deviceAlias) {
        defaultLabels[ALIAS_LABEL_KEY] = deviceAlias;
    }

    const systemInfoLabels = buildLabelMap(labels.systemInfoMappings, true);

    const defaultCount = Object.keys(defaultLabels).length;
    const systemInfoCount = Object.keys(systemInfoLabels).length;

    if (defaultCount === 0 && systemInfoCount === 0) {
        actions.push(
            makeStepAction(indexedActionId(CONFIG_ACTION_IDS.LABELS, 0), _("Labels: No changes required"), "success")
        );
        return actions;
    }

    const params = {
        DEFAULT_LABELS: defaultLabels,
        SYSTEMINFO_LABELS: systemInfoLabels,
    };

    try {
        await spawnWithParamsFile(SCRIPT_LABELS, params, ".labels-params-");

        let actionIndex = 0;
        if (defaultCount > 0) {
            actions.push(
                makeStepAction(
                    indexedActionId(CONFIG_ACTION_IDS.LABELS, actionIndex++),
                    cockpit.format(
                        cockpit.ngettext("Applied $0 default label", "Applied $0 default labels", defaultCount),
                        defaultCount
                    ),
                    "success"
                )
            );
        }
        if (systemInfoCount > 0) {
            actions.push(
                makeStepAction(
                    indexedActionId(CONFIG_ACTION_IDS.LABELS, actionIndex),
                    cockpit.format(
                        cockpit.ngettext(
                            "Applied $0 system-info mapping",
                            "Applied $0 system-info mappings",
                            systemInfoCount
                        ),
                        systemInfoCount
                    ),
                    "success"
                )
            );
        }
    } catch (error) {
        throw new Error(cockpit.format(_("Labels configuration failed: $0"), String(error)));
    }

    return actions;
}
