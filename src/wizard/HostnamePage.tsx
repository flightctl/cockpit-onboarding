import React from 'react';

import { TextInputGroup, TextInputGroupMain } from "@patternfly/react-core/dist/esm/components/TextInputGroup/index.js";
import { FormGroup } from "@patternfly/react-core/dist/esm/components/Form/index.js";
import { Stack, StackItem, ValidatedOptions } from '@patternfly/react-core';
import { useModelContext } from '../model-context';
import { validateHostname } from '../validation';

export const HostnamePage: React.FunctionComponent = () => {
    const { model, isInitialized, updateModel } = useModelContext();
    const [validationError, setValidationError] = React.useState<string | null>(null);

    const setHostname = (value: string) => {
        const error = validateHostname(value);
        setValidationError(error);
        updateModel('hostname', { value });
    };

    return (
        <Stack hasGutter>
            <StackItem>
                <p>Configure the hostname for this system:</p>
                <FormGroup label="Hostname" isRequired>
                    <TextInputGroup validated={validationError ? ValidatedOptions.error : (model.hostname.value && !validationError ? ValidatedOptions.success : ValidatedOptions.warning)}>
                        <TextInputGroupMain
                            id="hostname-input"
                            value={model.hostname.value}
                            onChange={(_, value) => setHostname(value)}
                            placeholder="my-system.example.com"
                            disabled={!isInitialized}
                        />
                    </TextInputGroup>
                    {validationError && (
                        <div style={{ color: 'var(--pf-global--danger-color--100)', fontSize: 'var(--pf-global--FontSize--sm)', marginTop: '0.25rem' }}>
                            {validationError}
                        </div>
                    )}
                </FormGroup>
            </StackItem>
        </Stack>
    );
};
