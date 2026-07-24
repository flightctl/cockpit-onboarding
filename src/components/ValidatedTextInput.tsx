/* SPDX-License-Identifier: LGPL-2.1-or-later */
import * as React from "react";

import { TextInput, TextInputProps } from "@patternfly/react-core/dist/esm/components/TextInput";
import { ValidatedOptions } from "@patternfly/react-core/dist/esm/helpers/constants.js";

import FormHelperText from "./HelperTexts";

type ValidationError = string | null | undefined;

const getValidatedState = (hasValue: boolean, error: ValidationError): "success" | "error" | "default" => {
    if (error) {
        return ValidatedOptions.error;
    }
    if (hasValue) {
        return ValidatedOptions.success;
    }
    return ValidatedOptions.default;
};

type ValidatedTextInputProps = TextInputProps & {
    helperText?: string;
    error: ValidationError;
};

const ValidatedTextInput = ({ value, helperText, error, ...props }: ValidatedTextInputProps) => {
    const validated = getValidatedState(Boolean(value), error);
    const errorId = props.id ? `${props.id}-helper-error` : undefined;

    return (
        <>
            <TextInput value={value ?? ""} validated={validated} {...props} />
            {helperText && <FormHelperText content={helperText} />}
            {error && <FormHelperText {...(errorId && { id: errorId })} content={error} variant="error" />}
        </>
    );
};

export default ValidatedTextInput;
