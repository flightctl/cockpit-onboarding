import React, { useState } from 'react';

import { Checkbox } from "@patternfly/react-core/dist/esm/components/Checkbox/index.js";
import { TextInputGroup, TextInputGroupMain } from "@patternfly/react-core/dist/esm/components/TextInputGroup/index.js";
import { Button } from "@patternfly/react-core/dist/esm/components/Button/index.js";
import { FormGroup } from "@patternfly/react-core/dist/esm/components/Form/index.js";
import { Stack, StackItem } from '@patternfly/react-core';
import { Flex, FlexItem } from '@patternfly/react-core';
import { ValidatedOptions } from '@patternfly/react-core';
import { Table, Thead, Tr, Th, Tbody, Td } from '@patternfly/react-table';
import { useModelContext } from '../model-context';

// NTP server validation function
const validateNtpServer = (server: string): string | null => {
    if (!server.trim()) return 'NTP server is required';
    
    // Try IPv4 validation first
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const ipv4Match = server.match(ipv4Regex);
    if (ipv4Match) {
        const octets = ipv4Match.slice(1).map(Number);
        for (const octet of octets) {
            if (octet < 0 || octet > 255) {
                return 'Invalid IPv4 address';
            }
        }
        return null; // Valid IPv4
    }
    
    // Try IPv6 validation
    const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$|^::$|^::1$|^([0-9a-fA-F]{0,4}:){1,6}:$|^:([0-9a-fA-F]{0,4}:){1,6}$/;
    if (ipv6Regex.test(server)) {
        return null; // Valid IPv6
    }
    
    // Hostname validation (similar to hostname page but more lenient)
    if (server.length > 253) return 'Hostname must be 253 characters or less';
    
    const labels = server.split('.');
    for (const label of labels) {
        if (label.length === 0) return 'Hostname cannot have empty labels';
        if (label.length > 63) return 'Each hostname label must be 63 characters or less';
        
        // More lenient hostname validation for NTP servers
        if (!/^[a-zA-Z0-9]/.test(label)) return 'Each hostname label must start with an alphanumeric character';
        if (!/[a-zA-Z0-9]$/.test(label)) return 'Each hostname label must end with an alphanumeric character';
        if (!/^[a-zA-Z0-9.-]+$/.test(label)) return 'Hostname can only contain letters, numbers, dots, and hyphens';
    }
    
    return null;
};

export const NetworkServicesPage: React.FunctionComponent = () => {
    const { model, updateNestedModel } = useModelContext();
    const [ntpServerInput, setNtpServerInput] = useState<string>('');
    const [validationError, setValidationError] = useState<string | null>(null);

    const setAutoNtp = (autoConfig: boolean) => {
        updateNestedModel('networkServices', 'ntp', { autoConfig });
    };

    const handleNtpServerInputChange = (value: string) => {
        setNtpServerInput(value);
        const error = validateNtpServer(value);
        setValidationError(error);
    };

    const addNtpServer = () => {
        const trimmedInput = ntpServerInput.trim();
        const error = validateNtpServer(trimmedInput);
        
        if (error) {
            setValidationError(error);
            return;
        }
        
        if (trimmedInput && !model.networkServices.ntp.servers.includes(trimmedInput)) {
            const newServers = [...model.networkServices.ntp.servers, trimmedInput];
            updateNestedModel('networkServices', 'ntp', { servers: newServers.sort() });
            setNtpServerInput('');
            setValidationError(null);
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
                                        <TextInputGroup validated={validationError ? ValidatedOptions.error : (ntpServerInput && !validationError ? ValidatedOptions.success : ValidatedOptions.warning)}>
                                            <TextInputGroupMain
                                                id="ntp-server-input"
                                                value={ntpServerInput}
                                                onChange={(_, value) => handleNtpServerInputChange(value)}
                                                placeholder="pool.ntp.org"
                                                onKeyPress={(e) => {
                                                    if (e.key === 'Enter') {
                                                        addNtpServer();
                                                    }
                                                }}
                                            />
                                        </TextInputGroup>
                                        {validationError && (
                                            <div style={{ color: 'var(--pf-global--danger-color--100)', fontSize: 'var(--pf-global--FontSize--sm)', marginTop: '0.25rem' }}>
                                                {validationError}
                                            </div>
                                        )}
                                    </FlexItem>
                                    <FlexItem>
                                        <Button
                                            variant="secondary"
                                            onClick={addNtpServer}
                                            isDisabled={!ntpServerInput.trim() || !!validationError}
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