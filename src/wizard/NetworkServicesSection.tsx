import React, { useState } from "react";
import { Table, Thead, Tr, Th, Tbody, Td } from "@patternfly/react-table";
import cockpit from "cockpit";

import { Checkbox } from "@patternfly/react-core/dist/esm/components/Checkbox/index.js";
import { TextInput } from "@patternfly/react-core/dist/esm/components/TextInput/index.js";
import { TextInputGroupMain } from "@patternfly/react-core/dist/esm/components/TextInputGroup/index.js";
import { Button } from "@patternfly/react-core/dist/esm/components/Button/index.js";
import { FormGroup } from "@patternfly/react-core/dist/esm/components/Form/index.js";
import { FormSelect, FormSelectOption } from "@patternfly/react-core/dist/esm/components/FormSelect/index.js";
import { Title } from "@patternfly/react-core/dist/esm/components/Title/index.js";
import { Stack, StackItem } from "@patternfly/react-core/dist/esm/layouts/Stack/index.js";
import { Flex, FlexItem } from "@patternfly/react-core/dist/esm/layouts/Flex/index.js";

import ValidatedTextInputGroup, { getValidatedProps } from "../components/ValidatedTextInputGroup";
import DefaultHelperText, { ErrorHelperText } from "../components/HelperTexts";
import { SubtleHeading } from "../components/Headings";
import { useModelContext } from "../model-context";
import { validateHostnameOrIP, validatePort } from "../validation";
import type { ProxyProtocol } from "../types";

const _ = cockpit.gettext;

const NetworkServicesSection = () => {
    const { model, updateNestedModel } = useModelContext();
    const [ntpServerInput, setNtpServerInput] = useState<string>("");
    const [ntpValidationError, setNtpValidationError] = useState<string>();
    const [proxyHostnameError, setProxyHostnameError] = useState<string>();
    const [proxyPortError, setProxyPortError] = useState<string>();

    const setAutoNtp = (autoConfig: boolean) => {
        updateNestedModel("networkServices", "ntp", { autoConfig });
    };

    const handleNtpServerInputChange = (value: string) => {
        const trimmedValue = value.trim();
        setNtpServerInput(trimmedValue);
        // Only validate if the input is not empty, since this field is optional
        // (user only needs to fill it if they want to add a server)
        const error = validateHostnameOrIP(trimmedValue, false);
        setNtpValidationError(error ?? undefined);
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
            updateNestedModel("networkServices", "ntp", { servers: newServers.sort() });
            setNtpServerInput("");
            setNtpValidationError(undefined);
        }
    };

    const removeNtpServer = (serverToRemove: string) => {
        const newServers = model.networkServices.ntp.servers.filter((server) => server !== serverToRemove);
        updateNestedModel("networkServices", "ntp", { servers: newServers });
    };

    // Proxy configuration handlers
    const setProxyEnabled = (enabled: boolean) => {
        updateNestedModel("networkServices", "proxy", { enabled });
        if (!enabled) {
            // Clear validation errors when disabling proxy
            setProxyHostnameError(undefined);
            setProxyPortError(undefined);
        }
    };

    const handleProxyHostnameChange = (value: string) => {
        updateNestedModel("networkServices", "proxy", { hostname: value || null });
        const error = validateHostnameOrIP(value, false);
        setProxyHostnameError(error || undefined);
    };

    const handleProxyPortChange = (value: string) => {
        const port = value ? parseInt(value, 10) : null;
        const error = validatePort(port, false);
        updateNestedModel("networkServices", "proxy", { port });
        setProxyPortError(error || undefined);
    };

    const handleProxyUsernameChange = (value: string) => {
        updateNestedModel("networkServices", "proxy", { username: value || null });
    };

    const handleProxyPasswordChange = (value: string) => {
        updateNestedModel("networkServices", "proxy", { password: value || null });
    };

    const handleProxyProtocolChange = (value: string) => {
        updateNestedModel("networkServices", "proxy", { protocol: value as ProxyProtocol });
    };

    const handleProxyNoProxyChange = (value: string) => {
        updateNestedModel("networkServices", "proxy", { noProxy: value });
    };

    return (
        <Stack hasGutter>
            <Title headingLevel="h2" size="md">
                {_("Network Services")}
            </Title>
            <StackItem>
                <SubtleHeading text={_("Configure additional network services such as NTP servers and HTTP proxies")} />
            </StackItem>
            <StackItem>
                <FormGroup label={_("Configure NTP Servers:")}>
                    <Checkbox
                        id="auto-ntp"
                        label={_("Automatically configure time servers")}
                        isChecked={model.networkServices.ntp.autoConfig}
                        onChange={(_, checked) => setAutoNtp(checked)}
                    />
                </FormGroup>
            </StackItem>
            {!model.networkServices.ntp.autoConfig && (
                <StackItem>
                    <Stack hasGutter>
                        <StackItem>
                            <FormGroup label={_("NTP Server Hostname")} isRequired>
                                <Flex>
                                    <FlexItem flex={{ default: "flex_1" }}>
                                        <ValidatedTextInputGroup value={ntpServerInput} error={ntpValidationError}>
                                            <TextInputGroupMain
                                                id="ntp-server-input"
                                                value={ntpServerInput}
                                                onChange={(_, value) => handleNtpServerInputChange(value)}
                                                placeholder={_("e.g. pool.ntp.org")}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") {
                                                        addNtpServer();
                                                    }
                                                }}
                                            />
                                        </ValidatedTextInputGroup>
                                        <ErrorHelperText error={ntpValidationError} />
                                    </FlexItem>
                                    <FlexItem>
                                        <Button
                                            variant="secondary"
                                            onClick={addNtpServer}
                                            isDisabled={!ntpServerInput.trim() || !!ntpValidationError}
                                        >
                                            {_("Add")}
                                        </Button>
                                    </FlexItem>
                                </Flex>
                            </FormGroup>
                        </StackItem>
                        <StackItem>
                            <p>{_("Configured NTP Servers:")}</p>
                            <Table aria-label={_("NTP servers table")} variant="compact">
                                <Thead>
                                    <Tr>
                                        <Th>{_("Server")}</Th>
                                        <Th>{_("Actions")}</Th>
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
                                                        {_("Remove")}
                                                    </Button>
                                                </Td>
                                            </Tr>
                                        ))
                                    ) : (
                                        <Tr>
                                            <Td colSpan={2}>{_("No NTP servers configured")}</Td>
                                        </Tr>
                                    )}
                                </Tbody>
                            </Table>
                        </StackItem>
                    </Stack>
                </StackItem>
            )}

            <StackItem>
                <FormGroup label={_("Configure HTTP proxy (optional):")}>
                    <Checkbox
                        id="proxy-enabled"
                        label={_("Use HTTP proxy")}
                        isChecked={model.networkServices.proxy.enabled}
                        onChange={(_, checked) => setProxyEnabled(checked)}
                    />
                </FormGroup>
            </StackItem>

            {model.networkServices.proxy.enabled && (
                <StackItem>
                    <Stack hasGutter>
                        <StackItem>
                            <FormGroup label={_("Protocol")}>
                                <FormSelect
                                    id="proxy-protocol-select"
                                    value={model.networkServices.proxy.protocol}
                                    onChange={(_event, value) => handleProxyProtocolChange(value)}
                                >
                                    <FormSelectOption value="http" label={_("HTTP")} />
                                    <FormSelectOption value="https" label={_("HTTPS")} />
                                    <FormSelectOption value="socks5" label={_("SOCKS5")} />
                                </FormSelect>
                            </FormGroup>
                        </StackItem>

                        <StackItem>
                            <FormGroup label={_("Proxy Hostname")} isRequired>
                                <TextInput
                                    id="proxy-hostname-input"
                                    value={model.networkServices.proxy.hostname || ""}
                                    onChange={(_, value) => handleProxyHostnameChange(value)}
                                    placeholder={_("e.g. proxy.example.com")}
                                    {...getValidatedProps(model.networkServices.proxy.hostname, proxyHostnameError)}
                                />
                                <ErrorHelperText error={proxyHostnameError} />
                            </FormGroup>
                        </StackItem>

                        <StackItem>
                            <FormGroup label={_("Proxy Port")} isRequired>
                                <TextInput
                                    id="proxy-port-input"
                                    type="number"
                                    value={model.networkServices.proxy.port?.toString() || ""}
                                    onChange={(_, value) => handleProxyPortChange(value)}
                                    placeholder={_("e.g. 8080")}
                                    {...getValidatedProps(model.networkServices.proxy.port?.toString(), proxyPortError)}
                                />
                                <ErrorHelperText error={proxyPortError} />
                            </FormGroup>
                        </StackItem>

                        <StackItem>
                            <FormGroup label={_("Proxy Username (optional)")}>
                                <TextInput
                                    id="proxy-username-input"
                                    value={model.networkServices.proxy.username || ""}
                                    onChange={(_, value) => handleProxyUsernameChange(value)}
                                    placeholder={_("Enter the proxy username")}
                                />
                            </FormGroup>
                        </StackItem>

                        <StackItem>
                            <FormGroup label={_("Proxy Password (optional)")}>
                                <TextInput
                                    id="proxy-password-input"
                                    type="password"
                                    value={model.networkServices.proxy.password || ""}
                                    onChange={(_, value) => handleProxyPasswordChange(value)}
                                    placeholder={_("Enter the proxy password")}
                                />
                            </FormGroup>
                        </StackItem>

                        <StackItem>
                            <FormGroup label={_("No Proxy")} fieldId="proxy-no-proxy-input">
                                <TextInput
                                    id="proxy-no-proxy-input"
                                    value={model.networkServices.proxy.noProxy}
                                    onChange={(_, value) => handleProxyNoProxyChange(value)}
                                    placeholder={_("e.g. localhost,127.0.0.1,::1,*.internal.corp,10.0.0.0/8")}
                                />
                                <DefaultHelperText
                                    text={_(
                                        "Comma-separated list of hosts, domains, or CIDRs that should bypass the proxy"
                                    )}
                                />
                            </FormGroup>
                        </StackItem>
                    </Stack>
                </StackItem>
            )}
        </Stack>
    );
};

export default NetworkServicesSection;
