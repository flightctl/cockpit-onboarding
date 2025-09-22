import React from 'react';

import { TextInputGroup, TextInputGroupMain } from "@patternfly/react-core/dist/esm/components/TextInputGroup/index.js";
import { FormGroup } from "@patternfly/react-core/dist/esm/components/Form/index.js";
import { Stack, StackItem, ValidatedOptions } from '@patternfly/react-core';
import { useModelContext } from '../model-context';

// Hostname validation function
const validateHostname = (hostname: string): string | null => {
    if (!hostname.trim()) return 'Hostname is required';

    // RFC 1123 hostname validation
    if (hostname.length > 253) return 'Hostname must be 253 characters or less';

    // Split into labels (parts separated by dots)
    const labels = hostname.split('.');

    for (const label of labels) {
        // Each label must be 1-63 characters
        if (label.length === 0) return 'Hostname cannot have empty labels';
        if (label.length > 63) return 'Each hostname label must be 63 characters or less';

        // Must start and end with alphanumeric character
        if (!/^[a-zA-Z0-9]/.test(label)) return 'Each hostname label must start with an alphanumeric character';
        if (!/[a-zA-Z0-9]$/.test(label)) return 'Each hostname label must end with an alphanumeric character';

        // Can only contain alphanumeric characters and hyphens
        if (!/^[a-zA-Z0-9-]+$/.test(label)) return 'Hostname can only contain letters, numbers, and hyphens';

        // Cannot be all numeric (for FQDN compliance)
        if (/^\d+$/.test(label) && labels.length > 1) return 'Hostname labels cannot be all numeric in a FQDN';
    }

    return null;
};

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
