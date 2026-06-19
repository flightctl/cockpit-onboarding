import * as React from "react";

import {
    TextInputGroup,
    type TextInputGroupProps,
} from "@patternfly/react-core/dist/esm/components/TextInputGroup/index.js";
import { ValidatedOptions } from "@patternfly/react-core/dist/esm/helpers/constants.js";

export type ValidatedTextInputGroupProps = Omit<TextInputGroupProps, "validated" | "value"> & {
    value: string | null | undefined;
    error?: string | null | undefined;
    /** When true, empty values show a warning state (for required fields). Default false. */
    warnWhenEmpty?: boolean;
};

const getValidatedState = (
    value: string | null | undefined,
    error: string | null | undefined,
    warnWhenEmpty: boolean
): TextInputGroupProps["validated"] | undefined => {
    if (error) {
        return ValidatedOptions.error;
    }
    if (value?.trim()) {
        return ValidatedOptions.success;
    }
    if (warnWhenEmpty) {
        return ValidatedOptions.warning;
    }
    return undefined;
};

export const getValidatedProps = (
    value: string | null | undefined,
    error: string | null | undefined,
    warnWhenEmpty = false
): { validated: NonNullable<TextInputGroupProps["validated"]> } | Record<string, never> => {
    const validated = getValidatedState(value, error, warnWhenEmpty);
    return validated ? { validated } : {};
};

/** TextInputGroup wrapper that derives validated status from value and error state. */
const ValidatedTextInputGroup = ({
    value,
    error,
    warnWhenEmpty = false,
    children,
    ...groupProps
}: ValidatedTextInputGroupProps) => {
    const validated = getValidatedState(value, error, warnWhenEmpty);

    return (
        <TextInputGroup {...groupProps} {...(validated !== undefined ? { validated } : {})}>
            {children}
        </TextInputGroup>
    );
};

export default ValidatedTextInputGroup;
