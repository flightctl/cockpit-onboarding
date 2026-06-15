import { SCRIPT_LABELS } from '../paths';
import type { LabelsState } from '../types';
import { spawnWithParamsFile } from './spawn-helpers';

export async function applyLabelsConfiguration(labels: LabelsState): Promise<string[]> {
    const results: string[] = [];

    const defaultLabels: Record<string, string> = {};
    for (const { key, value } of labels.deviceLabels) {
        if (key && value) {
            defaultLabels[key] = value;
        }
    }

    const systemInfoLabels: Record<string, string> = {};
    for (const { labelKey, systemInfoField } of labels.systemInfoMappings) {
        if (labelKey && systemInfoField) {
            systemInfoLabels[labelKey] = systemInfoField;
        }
    }

    if (Object.keys(defaultLabels).length === 0 && Object.keys(systemInfoLabels).length === 0) {
        results.push('Labels: No changes required');
        return results;
    }

    const params = {
        DEFAULT_LABELS: defaultLabels,
        SYSTEMINFO_LABELS: systemInfoLabels,
    };

    try {
        await spawnWithParamsFile(SCRIPT_LABELS, params, '.labels-params-');

        const defaultCount = Object.keys(defaultLabels).length;
        const systemInfoCount = Object.keys(systemInfoLabels).length;

        if (defaultCount > 0) {
            results.push(`Applied ${defaultCount} default label${defaultCount !== 1 ? 's' : ''}`);
        }
        if (systemInfoCount > 0) {
            results.push(`Applied ${systemInfoCount} system-info mapping${systemInfoCount !== 1 ? 's' : ''}`);
        }
    } catch (error) {
        throw new Error(`Labels configuration failed: ${String(error)}`);
    }

    return results;
}
