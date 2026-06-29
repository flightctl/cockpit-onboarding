import React from "react";
import cockpit from "cockpit";

import { FormGroup } from "@patternfly/react-core/dist/esm/components/Form/index.js";

import ValidatedTextInput from "../components/ValidatedTextInput";
import { useModelContext } from "../model-context";
import { validateHostname } from "../validation";

const _ = cockpit.gettext;

export const HostnamePage = () => {
    const { model, isInitialized, updateModel } = useModelContext();
    const [validationError, setValidationError] = React.useState<string | null>(null);

    const setHostname = (value: string) => {
        const error = validateHostname(value);
        setValidationError(error);
        updateModel("hostname", { value });
    };

    return (
        <FormGroup label={_("Hostname")} isRequired>
            <ValidatedTextInput
                id="hostname-input"
                value={model.hostname.value}
                error={validationError}
                onChange={(_, value) => setHostname(value)}
                placeholder={_("e.g. my-system.example.com")}
                isDisabled={!isInitialized}
            />
        </FormGroup>
    );
};
