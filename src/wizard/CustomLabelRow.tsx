/* SPDX-License-Identifier: LGPL-2.1-or-later */
import React from "react";
import cockpit from "cockpit";

import { Button } from "@patternfly/react-core/dist/esm/components/Button/index.js";
import { FormGroup } from "@patternfly/react-core/dist/esm/components/Form/index.js";
import { Stack, StackItem } from "@patternfly/react-core/dist/esm/layouts/Stack/index.js";
import { Flex, FlexItem } from "@patternfly/react-core/dist/esm/layouts/Flex/index.js";
import { TextInput } from "@patternfly/react-core/dist/esm/components/TextInput/index.js";
import { MinusCircleIcon } from "@patternfly/react-icons";

import { ALIAS_LABEL_KEY } from "../services/alias";
import { validateLabelKey, validateLabelValue } from "../validation";
import { GenericLabel } from "../types";
import FormHelperText from "../components/HelperTexts";

const _ = cockpit.gettext;

export type DeviceLabelEntry = GenericLabel & { rowKey: number };

const getDeviceLabelErrors = (label: GenericLabel): GenericLabel => {
    const { key, value } = label;
    const hasKey = key.length > 0;
    const hasValue = value.length > 0;

    if (!hasKey && !hasValue) {
        return { key: "", value: "" };
    }

    if (!hasKey) {
        return { key: _("Label key is required"), value: "" };
    }

    if (key === ALIAS_LABEL_KEY) {
        return { key: _("The 'alias' label key is reserved"), value: "" };
    }

    return {
        key: validateLabelKey(key) ?? "",
        value: validateLabelValue(value) ?? "",
    };
};

type CustomLabelRowProps = {
    entry: DeviceLabelEntry;
    onUpdate: (rowKey: number, newEntry: DeviceLabelEntry) => void;
    onRemove: (rowKey: number) => void;
};

const CustomLabelRowComponent = ({ entry, onUpdate, onRemove }: CustomLabelRowProps) => {
    const [errors, setErrors] = React.useState<GenericLabel>(() => getDeviceLabelErrors(entry));

    const handleChange = (field: "key" | "value", value: string) => {
        const newLabel = { ...entry, [field]: value };
        onUpdate(entry.rowKey, newLabel);
        setErrors(getDeviceLabelErrors(newLabel));
    };

    return (
        <Stack>
            <StackItem>
                <Flex alignItems={{ default: "alignItemsFlexEnd" }}>
                    <FlexItem flex={{ default: "flex_1" }}>
                        <FormGroup label={_("Label key")}>
                            <TextInput
                                id={`device-label-key-${entry.rowKey}`}
                                value={entry.key}
                                onChange={(_, value) => handleChange("key", value)}
                                placeholder={_("Enter label key")}
                            />
                        </FormGroup>
                    </FlexItem>
                    <FlexItem flex={{ default: "flex_1" }}>
                        <FormGroup label={_("Label value")}>
                            <TextInput
                                id={`device-label-value-${entry.rowKey}`}
                                value={entry.value}
                                onChange={(_, value) => handleChange("value", value)}
                                placeholder={_("Enter label value")}
                            />
                        </FormGroup>
                    </FlexItem>
                    <FlexItem>
                        <Button variant="plain" aria-label={_("Remove label")} onClick={() => onRemove(entry.rowKey)}>
                            <MinusCircleIcon />
                        </Button>
                    </FlexItem>
                </Flex>
            </StackItem>
            {errors.key && (
                <StackItem>
                    <FormHelperText content={errors.key} variant="error" />
                </StackItem>
            )}
            {errors.value && (
                <StackItem>
                    <FormHelperText content={errors.value} variant="error" />
                </StackItem>
            )}
        </Stack>
    );
};

export const CustomLabelRow = React.memo(CustomLabelRowComponent);
CustomLabelRow.displayName = "CustomLabelRow";
