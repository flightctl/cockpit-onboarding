import React from 'react';

import { TextInput } from "@patternfly/react-core/dist/esm/components/TextInput/index.js";
import { FormGroup } from "@patternfly/react-core/dist/esm/components/Form/index.js";
import { Stack, StackItem } from '@patternfly/react-core';
import { useModelContext } from '../model-context';

export const HostnamePage: React.FunctionComponent = () => {
    const { model: model, updateModel: updateModel } = useModelContext();
    
    const setHostname = (value: string) => {
        updateModel('hostname', { value });
    };

    return (
        <Stack hasGutter>
            <StackItem>
                <p>Configure the hostname for this system:</p>
                <FormGroup label="Hostname" isRequired>
                    <TextInput
                        id="hostname-input"
                        value={model.hostname.value}
                        onChange={(_, value) => setHostname(value)}
                        placeholder="my-system.example.com"
                    />
                </FormGroup>
            </StackItem>
        </Stack>
    );
};