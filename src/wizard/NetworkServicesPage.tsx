import React, { useState } from 'react';

import { Checkbox } from "@patternfly/react-core/dist/esm/components/Checkbox/index.js";
import { TextInput } from "@patternfly/react-core/dist/esm/components/TextInput/index.js";
import { TextInputGroup, TextInputGroupMain } from "@patternfly/react-core/dist/esm/components/TextInputGroup/index.js";
import { Button } from "@patternfly/react-core/dist/esm/components/Button/index.js";
import { FormGroup } from "@patternfly/react-core/dist/esm/components/Form/index.js";
import { Stack, StackItem } from "@patternfly/react-core/dist/esm/layouts/Stack/index.js";
import { Flex, FlexItem } from "@patternfly/react-core/dist/esm/layouts/Flex/index.js";
import { ValidatedOptions } from "@patternfly/react-core/dist/esm/helpers/constants.js";
import { Table, Thead, Tr, Th, Tbody, Td } from '@patternfly/react-table';
import { useModelContext } from '../model-context';
import { validateHostnameOrIP, validatePort } from '../validation';

export const NetworkServicesPage: React.FunctionComponent = () => {
    const { model, updateNestedModel } = useModelContext();
    const [ntpServerInput, setNtpServerInput] = useState<string>('');
    const [ntpValidationError, setNtpValidationError] = useState<string | null>(null);
    const [proxyHostnameError, setProxyHostnameError] = useState<string | null>(null);
    const [proxyPortError, setProxyPortError] = useState<string | null>(null);

    const setAutoNtp = (autoConfig: boolean) => {
        updateNestedModel('networkServices', 'ntp', { autoConfig });
    };

    const handleNtpServerInputChange = (value: string) => {
        setNtpServerInput(value);
        // Only validate if the input is not empty, since this field is optional
        // (user only needs to fill it if they want to add a server)
        const error = value.trim() ? validateHostnameOrIP(value, false) : null;
        setNtpValidationError(error);
    };

    const addNtpServer = () => {
        const trimmedInput = ntpServerInput.trim();

        // Don't add if input is empty
        if (!trimmedInput) {
            return;
        }

        const error = validateHostnameOrIP(trimmedInput, false);

        if (error) {
            setNtpValidationError(error);
            return;
        }

        if (!model.networkServices.ntp.servers.includes(trimmedInput)) {
            const newServers = [...model.networkServices.ntp.servers, trimmedInput];
            updateNestedModel('networkServices', 'ntp', { servers: newServers.sort() });
            setNtpServerInput('');
            setNtpValidationError(null);
        }
    };

    const removeNtpServer = (serverToRemove: string) => {
        const newServers = model.networkServices.ntp.servers.filter(server => server !== serverToRemove);
        updateNestedModel('networkServices', 'ntp', { servers: newServers });
    };

    // Proxy configuration handlers
    const setProxyEnabled = (enabled: boolean) => {
        updateNestedModel('networkServices', 'proxy', { enabled });
        if (!enabled) {
            // Clear validation errors when disabling proxy
            setProxyHostnameError(null);
            setProxyPortError(null);
        }
    };

    const handleProxyHostnameChange = (value: string) => {
        updateNestedModel('networkServices', 'proxy', { hostname: value || null });
        const error = validateHostnameOrIP(value, false);
        setProxyHostnameError(error);
    };

    const handleProxyPortChange = (value: string) => {
        const port = value ? parseInt(value, 10) : null;
        updateNestedModel('networkServices', 'proxy', { port });
        const error = validatePort(port, false);
        setProxyPortError(error);
    };

    const handleProxyUsernameChange = (value: string) => {
        updateNestedModel('networkServices', 'proxy', { username: value || null });
    };

    const handleProxyPasswordChange = (value: string) => {
        updateNestedModel('networkServices', 'proxy', { password: value || null });
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
                                        <TextInputGroup
                                            {...(ntpValidationError
                                                ? { validated: ValidatedOptions.error }
                                                : ntpServerInput.trim()
                                                    ? { validated: ValidatedOptions.success }
                                                    : {})}
                                        >
                                            <TextInputGroupMain
                                                id="ntp-server-input"
                                                value={ntpServerInput}
                                                onChange={(_, value) => handleNtpServerInputChange(value)}
                                                placeholder="pool.ntp.org"
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        addNtpServer();
                                                    }
                                                }}
                                            />
                                        </TextInputGroup>
                                        {ntpValidationError && (
                                            <div style={{ color: 'var(--pf-global--danger-color--100)', fontSize: 'var(--pf-global--FontSize--sm)', marginTop: '0.25rem' }}>
                                                {ntpValidationError}
                                            </div>
                                        )}
                                    </FlexItem>
                                    <FlexItem>
                                        <Button
                                            variant="secondary"
                                            onClick={addNtpServer}
                                            isDisabled={!ntpServerInput.trim() || !!ntpValidationError}
                                        >
                                            Add
                                        </Button>
                                    </FlexItem>
                                </Flex>
                            </FormGroup>
                        </StackItem>
                        <StackItem>
                            <p>Configured NTP Servers:</p>
                            <Table aria-label="NTP servers table" variant="compact">
                                <Thead>
                                    <Tr>
                                        <Th>Server</Th>
                                        <Th>Actions</Th>
                                    </Tr>
                                </Thead>
                                <Tbody>
                                    {model.networkServices.ntp.servers.length > 0
? (
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
                                    )
: (
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

            <StackItem style={{ marginTop: '2rem' }}>
                <p>Configure HTTP proxy (optional):</p>
                <Checkbox
                    id="proxy-enabled"
                    label="Use HTTP proxy"
                    isChecked={model.networkServices.proxy.enabled}
                    onChange={(_, checked) => setProxyEnabled(checked)}
                />
            </StackItem>

            {model.networkServices.proxy.enabled && (
                <StackItem style={{ marginLeft: '1.5rem' }}>
                    <Stack hasGutter>
                        <StackItem>
                            <FormGroup label="Proxy Hostname" isRequired>
                                <TextInput
                                    id="proxy-hostname-input"
                                    value={model.networkServices.proxy.hostname || ''}
                                    onChange={(_, value) => handleProxyHostnameChange(value)}
                                    placeholder="proxy.example.com"
                                    validated={proxyHostnameError ? ValidatedOptions.error : (model.networkServices.proxy.hostname ? ValidatedOptions.success : ValidatedOptions.default)}
                                />
                                {proxyHostnameError && (
                                    <div style={{ color: 'var(--pf-global--danger-color--100)', fontSize: 'var(--pf-global--FontSize--sm)', marginTop: '0.25rem' }}>
                                        {proxyHostnameError}
                                    </div>
                                )}
                            </FormGroup>
                        </StackItem>

                        <StackItem>
                            <FormGroup label="Proxy Port" isRequired>
                                <TextInput
                                    id="proxy-port-input"
                                    type="number"
                                    value={model.networkServices.proxy.port?.toString() || ''}
                                    onChange={(_, value) => handleProxyPortChange(value)}
                                    placeholder="8080"
                                    validated={proxyPortError ? ValidatedOptions.error : (model.networkServices.proxy.port ? ValidatedOptions.success : ValidatedOptions.default)}
                                />
                                {proxyPortError && (
                                    <div style={{ color: 'var(--pf-global--danger-color--100)', fontSize: 'var(--pf-global--FontSize--sm)', marginTop: '0.25rem' }}>
                                        {proxyPortError}
                                    </div>
                                )}
                            </FormGroup>
                        </StackItem>

                        <StackItem>
                            <FormGroup label="Proxy Username (optional)">
                                <TextInput
                                    id="proxy-username-input"
                                    value={model.networkServices.proxy.username || ''}
                                    onChange={(_, value) => handleProxyUsernameChange(value)}
                                    placeholder="username"
                                />
                            </FormGroup>
                        </StackItem>

                        <StackItem>
                            <FormGroup label="Proxy Password (optional)">
                                <TextInput
                                    id="proxy-password-input"
                                    type="password"
                                    value={model.networkServices.proxy.password || ''}
                                    onChange={(_, value) => handleProxyPasswordChange(value)}
                                    placeholder="password"
                                />
                            </FormGroup>
                        </StackItem>
                    </Stack>
                </StackItem>
            )}
        </Stack>
    );
};
