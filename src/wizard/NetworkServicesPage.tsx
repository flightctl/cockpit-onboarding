import React, { useState } from 'react';

import { Checkbox } from "@patternfly/react-core/dist/esm/components/Checkbox/index.js";
import { TextInput } from "@patternfly/react-core/dist/esm/components/TextInput/index.js";
import { Button } from "@patternfly/react-core/dist/esm/components/Button/index.js";
import { FormGroup } from "@patternfly/react-core/dist/esm/components/Form/index.js";
import { Stack, StackItem } from '@patternfly/react-core';
import { Flex, FlexItem } from '@patternfly/react-core';
import { Table, Thead, Tr, Th, Tbody, Td } from '@patternfly/react-table';

export const NetworkServicesPage: React.FunctionComponent = () => {
    const [autoNtp, setAutoNtp] = useState<boolean>(true);
    const [ntpServerInput, setNtpServerInput] = useState<string>('');
    const [ntpServers, setNtpServers] = useState<string[]>([]);

    const addNtpServer = () => {
        if (ntpServerInput.trim() && !ntpServers.includes(ntpServerInput.trim())) {
            const newServers = [...ntpServers, ntpServerInput.trim()];
            setNtpServers(newServers.sort());
            setNtpServerInput('');
        }
    };

    const removeNtpServer = (serverToRemove: string) => {
        setNtpServers(ntpServers.filter(server => server !== serverToRemove));
    };

    return (
        <Stack hasGutter>
            <StackItem>
                <p>Configure the Network Time Protocol (NTP):</p>
                <Checkbox
                    id="auto-ntp"
                    label="Automatically configure time servers"
                    isChecked={autoNtp}
                    onChange={(_, checked) => setAutoNtp(checked)}
                />
            </StackItem>
            {!autoNtp && (
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
                                    {ntpServers.length > 0 ? (
                                        ntpServers.map((server, index) => (
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