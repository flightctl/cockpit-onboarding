import React from "react";
import cockpit from "cockpit";

import { Button } from "@patternfly/react-core/dist/esm/components/Button/index.js";
import { Divider } from "@patternfly/react-core/dist/esm/components/Divider/Divider";
import { Flex, FlexItem } from "@patternfly/react-core/dist/esm/layouts/Flex/index.js";
import { FormGroup, FormSection } from "@patternfly/react-core/dist/esm/components/Form/index.js";
import { MenuToggle, MenuToggleElement } from "@patternfly/react-core/dist/esm/components/MenuToggle/index.js";
import { MenuFooter } from "@patternfly/react-core/dist/esm/components/Menu/MenuFooter";
import { MinusCircleIcon, PlusCircleIcon } from "@patternfly/react-icons";
import { Radio } from "@patternfly/react-core/dist/esm/components/Radio/index.js";
import { Select, SelectList, SelectOption } from "@patternfly/react-core/dist/esm/components/Select/index.js";
import { Stack, StackItem } from "@patternfly/react-core/dist/esm/layouts/Stack/index.js";
import { TextInput } from "@patternfly/react-core/dist/esm/components/TextInput/index.js";
import { Title } from "@patternfly/react-core/dist/esm/components/Title/index.js";

import { SubtleHeading } from "../components/Headings";
import FeatureSwitch from "../components/FeatureSwitch";
import FormHelperText from "../components/HelperTexts";
import ValidatedTextInput from "../components/ValidatedTextInput";
import { AliasMode, useModelContext } from "../model-context";
import { ALIAS_LABEL_KEY } from "../services/alias";
import {
    getDuplicateLabelKeys,
    getOverlappingLabelKeys,
    validateSystemHostname,
    validateLabelKey,
    validateLabelValue,
} from "../validation";
import { CustomLabelRow, type DeviceLabelEntry } from "./CustomLabelRow";

const _ = cockpit.gettext;

// SYSTEM_INFO_FIELDS includes all built-in system info fields that the flighctl-agent will collect and report.
// To include additional fields, users need to configure them manually as "custom-info.d" scripts, and then they need to
// select them manually in the system information mapping section.
const SYSTEM_INFO_FIELDS = [
    "architecture",
    "hostname",
    "kernel",
    "distroName",
    "distroVersion",
    "productName",
    "productSerial",
    "productUuid",
    "netInterfaceDefault",
    "netIpDefault",
    "netMacDefault",
    "managementCertNotAfter",
    "managementCertSerial",
    "tpmVendorInfo",
];

const CUSTOM_INFO_SENTINEL = "__customInfo__";
const CUSTOM_INFO_PREFIX = "customInfo.";

const isCustomInfoField = (field: string): boolean => field.startsWith(CUSTOM_INFO_PREFIX);

const getCustomInfoKey = (field: string): string =>
    isCustomInfoField(field) ? field.slice(CUSTOM_INFO_PREFIX.length) : "";

const getSystemInfoFieldLabel = (value: string): string => {
    if (!value) {
        return _("Select system info field");
    }
    if (isCustomInfoField(value)) {
        return _("Use custom system info field");
    }
    return value;
};

type SystemInfoFieldSelectProps = {
    id: string;
    value: string;
    onChange: (value: string) => void;
};

const SystemInfoFieldSelect = ({ id, value, onChange }: SystemInfoFieldSelectProps) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const selectedValue = isCustomInfoField(value) ? CUSTOM_INFO_SENTINEL : value;
    const selectedLabel = getSystemInfoFieldLabel(value);

    const onSelect = (
        _event: React.MouseEvent<Element, MouseEvent> | undefined,
        selection: string | number | undefined
    ) => {
        if (selection) {
            onChange(selection as string);
        }
        setIsOpen(false);
    };

    const toggle = (toggleRef: React.Ref<MenuToggleElement>) => (
        <MenuToggle
            ref={toggleRef}
            id={id}
            onClick={() => setIsOpen(!isOpen)}
            isExpanded={isOpen}
            isFullWidth
            isPlaceholder={!selectedValue}
        >
            {selectedLabel}
        </MenuToggle>
    );

    return (
        <Select
            id={`${id}-menu`}
            isOpen={isOpen}
            selected={selectedValue || undefined}
            onSelect={onSelect}
            onOpenChange={setIsOpen}
            toggle={toggle}
            shouldFocusToggleOnSelect
            popperProps={{ preventOverflow: true, width: "trigger" }}
        >
            <SelectList style={{ maxHeight: "20rem", overflow: "auto" }}>
                {SYSTEM_INFO_FIELDS.map((field) => (
                    <SelectOption key={field} value={field}>
                        {field}
                    </SelectOption>
                ))}
            </SelectList>
            <Divider />
            <MenuFooter>
                <Button
                    variant="link"
                    isInline
                    onClick={() => {
                        onChange(CUSTOM_INFO_SENTINEL);
                        setIsOpen(false);
                    }}
                >
                    {_("Use custom system info field")}
                </Button>
            </MenuFooter>
        </Select>
    );
};

let nextDeviceLabelRowKey = 0;
const createDeviceLabelRowKey = () => nextDeviceLabelRowKey++;

let nextSystemInfoMappingRowKey = 0;
const createSystemInfoMappingRowKey = () => nextSystemInfoMappingRowKey++;

type SystemInfoMappingEntry = { rowKey: number; key: string; value: string };

const toDisplayDeviceLabels = (labels: { key: string; value: string }[]): DeviceLabelEntry[] => {
    const source = labels.length > 0 ? labels : [{ key: "", value: "" }];
    return source.map((label) => ({ rowKey: createDeviceLabelRowKey(), ...label }));
};

const toModelDeviceLabels = (entries: DeviceLabelEntry[]): { key: string; value: string }[] =>
    entries.map(({ key, value }) => ({ key, value }));

const createEmptyDeviceLabelEntry = (): DeviceLabelEntry => ({
    rowKey: createDeviceLabelRowKey(),
    key: "",
    value: "",
});

const toDisplaySystemInfoMappings = (mappings: { key: string; value: string }[]): SystemInfoMappingEntry[] => {
    const source = mappings.length > 0 ? mappings : [{ key: "", value: "" }];
    return source.map((mapping) => ({ rowKey: createSystemInfoMappingRowKey(), ...mapping }));
};

const toModelSystemInfoMappings = (entries: SystemInfoMappingEntry[]): { key: string; value: string }[] =>
    entries.map(({ key, value }) => ({ key, value }));

const createEmptySystemInfoMappingEntry = (): SystemInfoMappingEntry => ({
    rowKey: createSystemInfoMappingRowKey(),
    key: "",
    value: "",
});

const getSystemInfoMappingErrors = (key: string, value: string): { key: string; value: string } => {
    const isCustomInfo = value.startsWith(CUSTOM_INFO_PREFIX);
    const hasField = isCustomInfo ? getCustomInfoKey(value).length > 0 : value.length > 0;
    const hasKey = key.length > 0;

    if (!hasKey && !hasField) {
        return { key: "", value: "" };
    }
    if (!hasKey) {
        return { key: _("Label key is required"), value: "" };
    }
    if (!hasField) {
        return {
            key: "",
            value: _("The system info field for this mapping is required"),
        };
    }

    if (key === ALIAS_LABEL_KEY) {
        return { key: _("The 'alias' label key is reserved"), value: "" };
    }

    return {
        key: validateLabelKey(key) ?? "",
        value: "",
    };
};

const formatQuotedLabelKey = (key: string): string => `'${key}'`;

const formatQuotedLabelKeys = (keys: string[]): string => keys.map(formatQuotedLabelKey).join(", ");

const formatDuplicateLabelKeysError = (duplicateKeys: string[]): string =>
    cockpit.format(_("Label keys must be unique. Duplicate keys found: $0"), formatQuotedLabelKeys(duplicateKeys));

const formatOverlappingLabelKeysWarning = (overlappingKeys: string[]): string =>
    cockpit.format(
        _(
            "The following system information mapping keys have been also defined as custom labels, and will be ignored: $0."
        ),
        formatQuotedLabelKeys(overlappingKeys)
    );

export const LabelsPage = () => {
    const { model, isInitialized, updateModel } = useModelContext();
    const { mode: aliasMode, customValue: customAliasValue } = model.alias;
    const { deviceLabels, systemInfoMappings } = model.labels;
    const [displayDeviceLabels, setDisplayDeviceLabels] = React.useState<DeviceLabelEntry[]>(() =>
        toDisplayDeviceLabels(deviceLabels)
    );
    const [displaySystemInfoMappings, setDisplaySystemInfoMappings] = React.useState<SystemInfoMappingEntry[]>(() =>
        toDisplaySystemInfoMappings(systemInfoMappings)
    );
    const hasSyncedModelLabels = React.useRef(deviceLabels.length > 0);
    const hasSyncedModelSystemInfoMappings = React.useRef(systemInfoMappings.length > 0);
    const [hostnameValidationError, setHostnameValidationError] = React.useState<string | null>(() =>
        validateSystemHostname(model.hostname.value)
    );
    const [aliasValidationError, setAliasValidationError] = React.useState<string | null>(null);
    const hostnameAsAliasError = aliasMode === AliasMode.HOSTNAME
        ? validateLabelValue(model.hostname.value)
        : null;

    React.useEffect(() => {
        if (!isInitialized || hasSyncedModelLabels.current) {
            return;
        }
        hasSyncedModelLabels.current = true;
        if (deviceLabels.length > 0) {
            setDisplayDeviceLabels(toDisplayDeviceLabels(deviceLabels));
        }
    }, [isInitialized, deviceLabels]);

    React.useEffect(() => {
        if (!isInitialized || hasSyncedModelSystemInfoMappings.current) {
            return;
        }
        hasSyncedModelSystemInfoMappings.current = true;
        if (systemInfoMappings.length > 0) {
            setDisplaySystemInfoMappings(toDisplaySystemInfoMappings(systemInfoMappings));
        }
    }, [isInitialized, systemInfoMappings]);

    React.useEffect(() => {
        setHostnameValidationError(validateSystemHostname(model.hostname.value));
    }, [model.hostname.value]);

    const setHostname = (value: string) => {
        const error = validateSystemHostname(value);
        setHostnameValidationError(error);
        updateModel("hostname", { value });
    };

    const setAliasEnabled = (enabled: boolean) => {
        setAliasMode(enabled ? AliasMode.HOSTNAME : AliasMode.NONE);
    };

    const setAliasMode = (mode: AliasMode) => {
        updateModel("alias", { mode });
        if (mode !== AliasMode.CUSTOM) {
            setAliasValidationError(null);
        }
    };

    const setCustomAlias = (value: string) => {
        const error = validateLabelValue(value);
        setAliasValidationError(value.length > 0 ? error : _("Alias value is required"));
        updateModel("alias", { mode: AliasMode.CUSTOM, customValue: value });
    };

    const applyDeviceLabelsUpdate = React.useCallback(
        (updater: (prev: DeviceLabelEntry[]) => DeviceLabelEntry[]) => {
            hasSyncedModelLabels.current = true;
            let modelLabels: { key: string; value: string }[] = [];
            setDisplayDeviceLabels((prev) => {
                const updated = updater(prev);
                modelLabels = toModelDeviceLabels(updated);
                return updated;
            });
            updateModel("labels", { deviceLabels: modelLabels });
        },
        [updateModel]
    );

    const addDeviceLabelRow = React.useCallback(() => {
        applyDeviceLabelsUpdate((prev) => [...prev, createEmptyDeviceLabelEntry()]);
    }, [applyDeviceLabelsUpdate]);

    const updateDeviceLabel = React.useCallback(
        (rowKey: number, newEntry: DeviceLabelEntry) => {
            applyDeviceLabelsUpdate((prev) => prev.map((entry) => (entry.rowKey === rowKey ? newEntry : entry)));
        },
        [applyDeviceLabelsUpdate]
    );

    const removeDeviceLabel = React.useCallback(
        (rowKey: number) => {
            applyDeviceLabelsUpdate((prev) =>
                prev.length === 1 ? [createEmptyDeviceLabelEntry()] : prev.filter((entry) => entry.rowKey !== rowKey)
            );
        },
        [applyDeviceLabelsUpdate]
    );

    const applySystemInfoMappingsUpdate = React.useCallback(
        (updater: (prev: SystemInfoMappingEntry[]) => SystemInfoMappingEntry[]) => {
            hasSyncedModelSystemInfoMappings.current = true;
            let modelMappings: { key: string; value: string }[] = [];
            setDisplaySystemInfoMappings((prev) => {
                const updated = updater(prev);
                modelMappings = toModelSystemInfoMappings(updated);
                return updated;
            });
            updateModel("labels", { systemInfoMappings: modelMappings });
        },
        [updateModel]
    );

    const addSystemInfoMappingRow = React.useCallback(() => {
        applySystemInfoMappingsUpdate((prev) => [...prev, createEmptySystemInfoMappingEntry()]);
    }, [applySystemInfoMappingsUpdate]);

    const updateSystemInfoMapping = React.useCallback(
        (rowKey: number, newEntry: SystemInfoMappingEntry) => {
            applySystemInfoMappingsUpdate((prev) => prev.map((entry) => (entry.rowKey === rowKey ? newEntry : entry)));
        },
        [applySystemInfoMappingsUpdate]
    );

    const removeSystemInfoMapping = React.useCallback(
        (rowKey: number) => {
            applySystemInfoMappingsUpdate((prev) =>
                prev.length === 1
                    ? [createEmptySystemInfoMappingEntry()]
                    : prev.filter((entry) => entry.rowKey !== rowKey)
            );
        },
        [applySystemInfoMappingsUpdate]
    );

    const duplicateDeviceLabelKeys = getDuplicateLabelKeys(displayDeviceLabels);
    const duplicateSystemInfoLabelKeys = getDuplicateLabelKeys(displaySystemInfoMappings);
    const overlappingLabelKeys = getOverlappingLabelKeys(displayDeviceLabels, displaySystemInfoMappings);

    return (
        <Stack hasGutter>
            <StackItem>
                <Title headingLevel="h1" size="2xl">
                    {_("Device labels")}
                </Title>
            </StackItem>
            <StackItem>
                <FormSection title={_("Hostname and Alias")}>
                    <Stack hasGutter>
                        <StackItem>
                            <FormGroup label={_("Hostname")} isRequired>
                                <ValidatedTextInput
                                    id="hostname-input"
                                    value={model.hostname.value}
                                    error={hostnameValidationError}
                                    onChange={(_, value) => setHostname(value)}
                                    placeholder={_("e.g. my-system.example.com")}
                                    isDisabled={!isInitialized}
                                />
                            </FormGroup>
                        </StackItem>
                        <StackItem>
                            <FeatureSwitch
                                fieldId="alias-enabled"
                                label={_("Alias")}
                                isChecked={aliasMode !== AliasMode.NONE}
                                onToggle={setAliasEnabled}
                            >
                                <Stack hasGutter>
                                    <StackItem>
                                        <Radio
                                            id="alias-mode-hostname"
                                            name="alias-mode"
                                            label={_("Use hostname as alias")}
                                            isChecked={aliasMode === AliasMode.HOSTNAME}
                                            onChange={() => setAliasMode(AliasMode.HOSTNAME)}
                                        />
                                        {hostnameAsAliasError && (
                                            <FormHelperText content={hostnameAsAliasError} variant="error" />
                                        )}
                                    </StackItem>
                                    <StackItem>
                                        <Radio
                                            id="alias-mode-custom"
                                            name="alias-mode"
                                            label={_("Set a custom alias")}
                                            isChecked={aliasMode === AliasMode.CUSTOM}
                                            onChange={() => setAliasMode(AliasMode.CUSTOM)}
                                            body={
                                                aliasMode === AliasMode.CUSTOM && (
                                                    <FormGroup label={_("Custom alias")} isRequired>
                                                        <ValidatedTextInput
                                                            id="alias-custom-input"
                                                            value={customAliasValue}
                                                            error={aliasValidationError}
                                                            onChange={(_, value) => setCustomAlias(value)}
                                                            placeholder={_("e.g. edge-gateway-01")}
                                                        />
                                                    </FormGroup>
                                                )
                                            }
                                        />
                                    </StackItem>
                                </Stack>
                            </FeatureSwitch>
                        </StackItem>
                    </Stack>
                </FormSection>
            </StackItem>

            <StackItem>
                <Divider />
            </StackItem>

            <StackItem>
                <FormSection title={_("Custom labels")}>
                    <Stack hasGutter>
                        {displayDeviceLabels.map((entry) => (
                            <StackItem key={entry.rowKey}>
                                <CustomLabelRow
                                    entry={entry}
                                    onUpdate={updateDeviceLabel}
                                    onRemove={removeDeviceLabel}
                                />
                            </StackItem>
                        ))}
                        {duplicateDeviceLabelKeys.length > 0 && (
                            <StackItem>
                                <FormHelperText
                                    content={formatDuplicateLabelKeysError(duplicateDeviceLabelKeys)}
                                    variant="error"
                                />
                            </StackItem>
                        )}
                        <StackItem>
                            <Button variant="secondary" size="sm" icon={<PlusCircleIcon />} onClick={addDeviceLabelRow}>
                                {_("Add another label")}
                            </Button>
                        </StackItem>
                    </Stack>
                </FormSection>
            </StackItem>

            <StackItem>
                <Divider />
            </StackItem>

            <StackItem>
                <FormSection title={_("System information mapping")}>
                    <SubtleHeading text={_("Automatically derive labels from device hardware and OS information")} />
                    <Stack hasGutter>
                        {displaySystemInfoMappings.map((entry) => {
                            const mappingErrors = getSystemInfoMappingErrors(entry.key, entry.value);

                            const handleKeyChange = (value: string) => {
                                updateSystemInfoMapping(entry.rowKey, { ...entry, key: value });
                            };

                            const handleFieldChange = (value: string) => {
                                const fieldValue = value === CUSTOM_INFO_SENTINEL ? CUSTOM_INFO_PREFIX : value;
                                updateSystemInfoMapping(entry.rowKey, { ...entry, value: fieldValue });
                            };

                            const handleCustomInfoKeyChange = (key: string) => {
                                updateSystemInfoMapping(entry.rowKey, {
                                    ...entry,
                                    value: CUSTOM_INFO_PREFIX + key,
                                });
                            };

                            return (
                                <StackItem key={entry.rowKey}>
                                    <Flex alignItems={{ default: "alignItemsFlexEnd" }}>
                                        <FlexItem flex={{ default: "flex_1" }}>
                                            <FormGroup label={_("Label key")}>
                                                <TextInput
                                                    id={`sysinfo-label-key-${entry.rowKey}`}
                                                    value={entry.key}
                                                    onChange={(_, value) => handleKeyChange(value)}
                                                    placeholder={_("Enter label key")}
                                                />
                                            </FormGroup>
                                        </FlexItem>
                                        <FlexItem flex={{ default: "flex_1" }}>
                                            <FormGroup label={_("System info field")}>
                                                <SystemInfoFieldSelect
                                                    id={`sysinfo-field-${entry.rowKey}`}
                                                    value={entry.value}
                                                    onChange={handleFieldChange}
                                                />
                                            </FormGroup>
                                        </FlexItem>
                                        {isCustomInfoField(entry.value) && (
                                            <FlexItem flex={{ default: "flex_1" }}>
                                                <FormGroup label={_("Custom info key")}>
                                                    <TextInput
                                                        id={`custom-info-key-${entry.rowKey}`}
                                                        value={getCustomInfoKey(entry.value)}
                                                        onChange={(_, value) => handleCustomInfoKeyChange(value)}
                                                        placeholder={_("e.g. siteId")}
                                                    />
                                                </FormGroup>
                                            </FlexItem>
                                        )}
                                        <FlexItem>
                                            <Button
                                                variant="plain"
                                                aria-label={_("Remove mapping")}
                                                onClick={() => removeSystemInfoMapping(entry.rowKey)}
                                            >
                                                <MinusCircleIcon />
                                            </Button>
                                        </FlexItem>
                                    </Flex>
                                    {mappingErrors.key && (
                                        <FormHelperText content={mappingErrors.key} variant="error" />
                                    )}
                                    {mappingErrors.value && (
                                        <FormHelperText content={mappingErrors.value} variant="error" />
                                    )}
                                </StackItem>
                            );
                        })}
                        {duplicateSystemInfoLabelKeys.length > 0 && (
                            <StackItem>
                                <FormHelperText
                                    content={formatDuplicateLabelKeysError(duplicateSystemInfoLabelKeys)}
                                    variant="error"
                                />
                            </StackItem>
                        )}
                        <StackItem>
                            <Button
                                variant="secondary"
                                size="sm"
                                icon={<PlusCircleIcon />}
                                onClick={addSystemInfoMappingRow}
                            >
                                {_("Add another mapping")}
                            </Button>
                        </StackItem>
                    </Stack>
                </FormSection>
            </StackItem>
            {overlappingLabelKeys.length > 0 && (
                <StackItem>
                    <FormHelperText
                        content={formatOverlappingLabelKeysWarning(overlappingLabelKeys)}
                        variant="warning"
                    />
                </StackItem>
            )}
        </Stack>
    );
};
