import * as React from "react";

import { TextInput, TextInputProps } from "@patternfly/react-core/dist/esm/components/TextInput";
import { ValidatedOptions } from "@patternfly/react-core/dist/esm/helpers/constants.js";

import DefaultHelperText, { ErrorHelperText } from "./HelperTexts";

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

    return (
        <>
            <TextInput value={value ?? ""} validated={validated} {...props} />
            {helperText && <DefaultHelperText text={helperText} />}
            {error && <ErrorHelperText error={error} />}
        </>
    );
};

export default ValidatedTextInput;
