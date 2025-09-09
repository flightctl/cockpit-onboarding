import React, { useState } from 'react';

import { Checkbox } from "@patternfly/react-core/dist/esm/components/Checkbox/index.js";
import { TextInput } from "@patternfly/react-core/dist/esm/components/TextInput/index.js";
import { Button } from "@patternfly/react-core/dist/esm/components/Button/index.js";
import { FormGroup } from "@patternfly/react-core/dist/esm/components/Form/index.js";
import { Stack, StackItem } from '@patternfly/react-core';
import { Flex, FlexItem } from '@patternfly/react-core';
import { Table, Thead, Tr, Th, Tbody, Td } from '@patternfly/react-table';
import { useModelContext } from '../model-context';

export const NetworkServicesPage: React.FunctionComponent = () => {
    const { model, updateNestedModel } = useModelContext();
    const [ntpServerInput, setNtpServerInput] = useState<string>('');

    const setAutoNtp = (autoConfig: boolean) => {
        updateNestedModel('networkServices', 'ntp', { autoConfig });
    };

    const addNtpServer = () => {
        if (ntpServerInput.trim() && !model.networkServices.ntp.servers.includes(ntpServerInput.trim())) {
            const newServers = [...model.networkServices.ntp.servers, ntpServerInput.trim()];
            updateNestedModel('networkServices', 'ntp', { servers: newServers.sort() });
            setNtpServerInput('');
        }
    };

    const removeNtpServer = (serverToRemove: string) => {
        const newServers = model.networkServices.ntp.servers.filter(server => server !== serverToRemove);
        updateNestedModel('networkServices', 'ntp', { servers: newServers });
    };

    return (
        <Stack hasGutter>
            <StackItem>
                <p>Configure the Network Time Protocol (NTP):</p>
                <Checkbox
                    id="auto-ntp"
                    label="Automatically configure time servers"
                    isChecked={model.networkServices.ntp.autoConfig}
                    onChange={(_, checked) => setAutoNtp(checked)}
                />
            </StackItem>
            {!model.networkServices.ntp.autoConfig && (
                <StackItem style={{ marginLeft: '1.5rem' }}>
                    <Stack hasGutter>
                        <StackItem>
                            <FormGroup label="NTP Server Hostname">
                                <Flex>
                                    <FlexItem flex={{ default: 'flex_1' }}>
                                        <TextInput
                                            id="ntp-server-input"
                                            value={ntpServerInput}
                                            onChange={(_, value) => setNtpServerInput(value)}
                                            placeholder="pool.ntp.org"
                                            onKeyPress={(e) => {
                                                if (e.key === 'Enter') {
                                                    addNtpServer();
                                                }
                                            }}
                                        />
                                    </FlexItem>
                                    <FlexItem>
                                        <Button
                                            variant="secondary"
                                            onClick={addNtpServer}
                                            isDisabled={!ntpServerInput.trim()}
                                        >
                                            Add
                                        </Button>
                                    </FlexItem>
                                </Flex>
                            </FormGroup>
                        </StackItem>
                        <StackItem>
                            <p>Configured NTP Servers:</p>
                            <Table aria-label="NTP servers table">
                                <Thead>
                                    <Tr>
                                        <Th>Server</Th>
                                        <Th>Actions</Th>
                                    </Tr>
                                </Thead>
                                <Tbody>
                                    {model.networkServices.ntp.servers.length > 0 ? (
                                        model.networkServices.ntp.servers.map((server, index) => (
                                            <Tr key={index}>
                                                <Td>{server}</Td>
                                                <Td>
                                                    <Button
                                                        variant="danger"
                                                        size="sm"
                                                        onClick={() => removeNtpServer(server)}
                                                    >
                                                        Remove
                                                    </Button>
                                                </Td>
                                            </Tr>
                                        ))
                                    ) : (
                                        <Tr>
                                            <Td colSpan={2}>No NTP servers configured</Td>
                                        </Tr>
                                    )}
                                </Tbody>
                            </Table>
                        </StackItem>
                    </Stack>
                </StackItem>
            )}
        </Stack>
    );
};