import React from "react";
import cockpit from "cockpit";

import { Button } from "@patternfly/react-core/dist/esm/components/Button/index.js";
import { FormGroup } from "@patternfly/react-core/dist/esm/components/Form/index.js";
import { FormSelect, FormSelectOption } from "@patternfly/react-core/dist/esm/components/FormSelect/index.js";
import { TextInput } from "@patternfly/react-core/dist/esm/components/TextInput/index.js";
import { Stack, StackItem } from "@patternfly/react-core/dist/esm/layouts/Stack/index.js";
import { Flex, FlexItem } from "@patternfly/react-core/dist/esm/layouts/Flex/index.js";
import { MinusCircleIcon } from "@patternfly/react-icons";
import { useModelContext } from "../model-context";

const _ = cockpit.gettext;

const SYSTEM_INFO_FIELDS = [
    "hostname",
    "architecture",
    "kernel",
    "distroName",
    "distroVersion",
    "productName",
    "productSerial",
    "productUuid",
    "netInterfaceDefault",
    "netIpDefault",
    "netMacDefault",
    "cpuCores",
    "cpuModel",
    "memoryTotalKb",
    "gpu",
    "biosVendor",
    "biosVersion",
];

const CUSTOM_INFO_SENTINEL = "__customInfo__";
const CUSTOM_INFO_PREFIX = "customInfo.";

const isCustomInfoField = (field: string): boolean => field.startsWith(CUSTOM_INFO_PREFIX);

const getCustomInfoKey = (field: string): string =>
    isCustomInfoField(field) ? field.slice(CUSTOM_INFO_PREFIX.length) : "";

export const LabelsPage: React.FunctionComponent = () => {
    const { model, updateModel } = useModelContext();
    const { deviceLabels, systemInfoMappings } = model.labels;

    const setDeviceLabels = (labels: typeof deviceLabels) => {
        updateModel("labels", { deviceLabels: labels });
    };

    const setSystemInfoMappings = (mappings: typeof systemInfoMappings) => {
        updateModel("labels", { systemInfoMappings: mappings });
    };

    const addDeviceLabel = () => {
        setDeviceLabels([...deviceLabels, { key: "", value: "" }]);
    };

    const updateDeviceLabel = (index: number, field: "key" | "value", value: string) => {
        const updated = deviceLabels.map((entry, i) => (i === index ? { ...entry, [field]: value } : entry));
        setDeviceLabels(updated);
    };

    const removeDeviceLabel = (index: number) => {
        setDeviceLabels(deviceLabels.filter((_, i) => i !== index));
    };

    const addSystemInfoMapping = () => {
        setSystemInfoMappings([...systemInfoMappings, { labelKey: "", systemInfoField: SYSTEM_INFO_FIELDS[0] }]);
    };

    const updateSystemInfoMapping = (index: number, field: "labelKey" | "systemInfoField", value: string) => {
        const updated = systemInfoMappings.map((entry, i) => (i === index ? { ...entry, [field]: value } : entry));
        setSystemInfoMappings(updated);
    };

    const handleSystemInfoFieldChange = (index: number, value: string) => {
        if (value === CUSTOM_INFO_SENTINEL) {
            updateSystemInfoMapping(index, "systemInfoField", CUSTOM_INFO_PREFIX);
        } else {
            updateSystemInfoMapping(index, "systemInfoField", value);
        }
    };

    const handleCustomInfoKeyChange = (index: number, key: string) => {
        updateSystemInfoMapping(index, "systemInfoField", CUSTOM_INFO_PREFIX + key);
    };

    const removeSystemInfoMapping = (index: number) => {
        setSystemInfoMappings(systemInfoMappings.filter((_, i) => i !== index));
    };

    return (
        <Stack hasGutter>
            <StackItem>
                <p>{_("Custom labels for fleet assignment (e.g., region, site, role)")}</p>
                <Stack hasGutter>
                    {deviceLabels.map((entry, index) => (
                        <StackItem key={index}>
                            <Flex alignItems={{ default: "alignItemsCenter" }}>
                                <FlexItem flex={{ default: "flex_1" }}>
                                    <FormGroup label={_("Key")}>
                                        <TextInput
                                            id={`device-label-key-${index}`}
                                            value={entry.key}
                                            onChange={(_, value) => updateDeviceLabel(index, "key", value)}
                                            placeholder={_("key")}
                                        />
                                    </FormGroup>
                                </FlexItem>
                                <FlexItem flex={{ default: "flex_1" }}>
                                    <FormGroup label={_("Value")}>
                                        <TextInput
                                            id={`device-label-value-${index}`}
                                            value={entry.value}
                                            onChange={(_, value) => updateDeviceLabel(index, "value", value)}
                                            placeholder={_("value")}
                                        />
                                    </FormGroup>
                                </FlexItem>
                                <FlexItem>
                                    <Button
                                        variant="plain"
                                        aria-label={_("Remove label")}
                                        onClick={() => removeDeviceLabel(index)}
                                        style={{ marginTop: "1.5rem" }}
                                    >
                                        <MinusCircleIcon />
                                    </Button>
                                </FlexItem>
                            </Flex>
                        </StackItem>
                    ))}
                    <StackItem>
                        <Button variant="secondary" onClick={addDeviceLabel}>
                            {_("Add label")}
                        </Button>
                    </StackItem>
                </Stack>
            </StackItem>

            <StackItem style={{ marginTop: "1rem" }}>
                <p>{_("Automatically derive labels from device hardware and OS information")}</p>
                <Stack hasGutter>
                    {systemInfoMappings.map((entry, index) => (
                        <StackItem key={index}>
                            <Flex alignItems={{ default: "alignItemsCenter" }}>
                                <FlexItem flex={{ default: "flex_1" }}>
                                    <FormGroup label={_("Label key")}>
                                        <TextInput
                                            id={`sysinfo-label-key-${index}`}
                                            value={entry.labelKey}
                                            onChange={(_, value) => updateSystemInfoMapping(index, "labelKey", value)}
                                            placeholder={_("label key")}
                                        />
                                    </FormGroup>
                                </FlexItem>
                                <FlexItem flex={{ default: "flex_1" }}>
                                    <FormGroup label={_("System info field")}>
                                        <FormSelect
                                            id={`sysinfo-field-${index}`}
                                            value={
                                                isCustomInfoField(entry.systemInfoField)
                                                    ? CUSTOM_INFO_SENTINEL
                                                    : entry.systemInfoField
                                            }
                                            onChange={(_, value) => handleSystemInfoFieldChange(index, value)}
                                        >
                                            {SYSTEM_INFO_FIELDS.map((field) => (
                                                <FormSelectOption key={field} value={field} label={field} />
                                            ))}
                                            <FormSelectOption
                                                key={CUSTOM_INFO_SENTINEL}
                                                value={CUSTOM_INFO_SENTINEL}
                                                label={_("Custom info...")}
                                            />
                                        </FormSelect>
                                    </FormGroup>
                                </FlexItem>
                                {isCustomInfoField(entry.systemInfoField) && (
                                    <FlexItem flex={{ default: "flex_1" }}>
                                        <FormGroup label={_("Custom info key")}>
                                            <TextInput
                                                id={`custom-info-key-${index}`}
                                                value={getCustomInfoKey(entry.systemInfoField)}
                                                onChange={(_, value) => handleCustomInfoKeyChange(index, value)}
                                                placeholder={_("e.g. siteId")}
                                            />
                                        </FormGroup>
                                    </FlexItem>
                                )}
                                <FlexItem>
                                    <Button
                                        variant="plain"
                                        aria-label={_("Remove mapping")}
                                        onClick={() => removeSystemInfoMapping(index)}
                                        style={{ marginTop: "1.5rem" }}
                                    >
                                        <MinusCircleIcon />
                                    </Button>
                                </FlexItem>
                            </Flex>
                        </StackItem>
                    ))}
                    <StackItem>
                        <Button variant="secondary" onClick={addSystemInfoMapping}>
                            {_("Add mapping")}
                        </Button>
                    </StackItem>
                </Stack>
            </StackItem>
        </Stack>
    );
};
