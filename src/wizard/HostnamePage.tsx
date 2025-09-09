import React, { useState } from 'react';

import { TextInput } from "@patternfly/react-core/dist/esm/components/TextInput/index.js";
import { FormGroup } from "@patternfly/react-core/dist/esm/components/Form/index.js";
import { Stack, StackItem } from '@patternfly/react-core';

export const HostnamePage: React.FunctionComponent = () => {
    const [hostname, setHostname] = useState<string>('');

    return (
        <Stack hasGutter>
            <StackItem>
                <p>Configure the hostname for this system:</p>
                <FormGroup label="Hostname" isRequired>
                    <TextInput
                        id="hostname-input"
                        value={hostname}
                        onChange={(_, value) => setHostname(value)}
                        placeholder="my-system.example.com"
                    />
                </FormGroup>
            </StackItem>
        </Stack>
    );
};