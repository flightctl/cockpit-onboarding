import React, { useState } from "react";
import cockpit from "cockpit";

import { Checkbox } from "@patternfly/react-core/dist/esm/components/Checkbox/index.js";
import { TextInput } from "@patternfly/react-core/dist/esm/components/TextInput/index.js";
import { Button } from "@patternfly/react-core/dist/esm/components/Button/index.js";
import { FormGroup } from "@patternfly/react-core/dist/esm/components/Form/index.js";
import { FormSelect, FormSelectOption } from "@patternfly/react-core/dist/esm/components/FormSelect/index.js";
import { Stack, StackItem } from "@patternfly/react-core/dist/esm/layouts/Stack/index.js";
import { Flex, FlexItem } from "@patternfly/react-core/dist/esm/layouts/Flex/index.js";
import { MinusCircleIcon, PlusCircleIcon } from "@patternfly/react-icons";

import ValidatedTextInput from "../components/ValidatedTextInput";
import DefaultHelperText from "../components/HelperTexts";
import { LabelHeading } from "../components/Headings";
import { useModelContext } from "../model-context";
import { validateHostnameOrIP, validateManualNtpServers, validatePort } from "../validation";
import type { ProxyProtocol } from "../types";
import { Radio } from "@patternfly/react-core/dist/esm/components/Radio";
import ValidatedRadioLabel from "../components/ValidatedRadioLabel";

const _ = cockpit.gettext;

const getNtpServerValidationError = (value: string): string | undefined => {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
        return validateHostnameOrIP(value, true) ?? undefined;
    }
    return validateHostnameOrIP(value, false) ?? undefined;
};

// The empty string is to be able to fill in the first server.
// It will be invalid unless it's set to a valid hostname or IP address.
const emptyNtpServers = [""];

const NetworkServicesSection = () => {
    const { model, updateNestedModel } = useModelContext();
    const [ntpValidationErrors, setNtpValidationErrors] = useState<Record<number, string | undefined>>({});
    const [proxyHostnameError, setProxyHostnameError] = useState<string>();
    const [proxyPortError, setProxyPortError] = useState<string>();

    const storedNtpServers = model.networkServices.ntp.servers || [];
    const ntpServers = storedNtpServers.length > 0 ? storedNtpServers : emptyNtpServers;
    const isValidManualNtp =
        model.networkServices.ntp.autoConfig ||
        validateManualNtpServers(storedNtpServers.length > 0 ? storedNtpServers : emptyNtpServers);

    const setAutoNtp = (autoConfig: boolean) => {
        updateNestedModel("networkServices", "ntp", { autoConfig, servers: emptyNtpServers });
        if (autoConfig) {
            setNtpValidationErrors({});
        }
    };

    const handleNtpServerChange = (index: number, value: string) => {
        const newServers = [...ntpServers];
        newServers[index] = value;
        updateNestedModel("networkServices", "ntp", { servers: newServers });
        setNtpValidationErrors((prev) => ({
            ...prev,
            [index]: getNtpServerValidationError(value),
        }));
    };

    const addNtpServerRow = () => {
        const newIndex = ntpServers.length;
        updateNestedModel("networkServices", "ntp", { servers: [...ntpServers, ""] });
        setNtpValidationErrors((prev) => ({
            ...prev,
            [newIndex]: getNtpServerValidationError(""),
        }));
    };

    const removeNtpServer = (index: number) => {
        if (ntpServers.length === 1) {
            // When clicking on "remove" for the last server, we keep the row, and clear the field content
            updateNestedModel("networkServices", "ntp", { servers: emptyNtpServers });
            setNtpValidationErrors({ 0: getNtpServerValidationError("") });
            return;
        }

        const newServers = ntpServers.filter((_, i) => i !== index);
        updateNestedModel("networkServices", "ntp", { servers: newServers });
        setNtpValidationErrors((prev) => {
            const next: Record<number, string | undefined> = {};
            newServers.forEach((server, i) => {
                const sourceIndex = i < index ? i : i + 1;
                next[i] = prev[sourceIndex] ?? getNtpServerValidationError(server);
            });
            return next;
        });
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
            <StackItem>
                <LabelHeading text={_("Configure NTP Servers:")} />
            </StackItem>
            <StackItem>
                <FormGroup label={_("Time servers configuration:")}>
                    <Stack hasGutter>
                        <StackItem>
                            <Radio
                                id={`auto-ntp-radio`}
                                name="ntp-method"
                                label={_("Automatic")}
                                isChecked={model.networkServices.ntp.autoConfig}
                                onChange={() => setAutoNtp(true)}
                            />
                        </StackItem>
                        <StackItem>
                            <Radio
                                id={`manual-ntp-radio`}
                                name="ntp-method"
                                label={<ValidatedRadioLabel label={_("Manual")} isValid={isValidManualNtp} />}
                                isChecked={!model.networkServices.ntp.autoConfig}
                                onChange={() => setAutoNtp(false)}
                            />
                        </StackItem>
                    </Stack>
                </FormGroup>
            </StackItem>
            {!model.networkServices.ntp.autoConfig && (
                <StackItem>
                    <Stack hasGutter>
                        {ntpServers.map((server, index) => (
                            <StackItem key={index}>
                                <Flex>
                                    <FlexItem flex={{ default: "flex_1" }}>
                                        <FormGroup
                                            label={index === 0 ? _("NTP Server Hostname") : undefined}
                                            isRequired
                                        >
                                            <ValidatedTextInput
                                                id={index === 0 ? "ntp-server-input" : `ntp-server-input-${index}`}
                                                value={server}
                                                error={ntpValidationErrors[index]}
                                                onChange={(_, value) => handleNtpServerChange(index, value)}
                                                placeholder={_("e.g. pool.ntp.org")}
                                            />
                                        </FormGroup>
                                    </FlexItem>
                                    <FlexItem
                                        alignSelf={{ default: index === 0 ? "alignSelfFlexEnd" : "alignSelfFlexStart" }}
                                    >
                                        <Button
                                            variant="plain"
                                            aria-label={_("Remove NTP server")}
                                            onClick={() => removeNtpServer(index)}
                                        >
                                            <MinusCircleIcon />
                                        </Button>
                                    </FlexItem>
                                </Flex>
                            </StackItem>
                        ))}
                        <StackItem>
                            <Button variant="link" isInline icon={<PlusCircleIcon />} onClick={addNtpServerRow}>
                                {_("Add another NTP server")}
                            </Button>
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
                                <ValidatedTextInput
                                    id="proxy-hostname-input"
                                    value={model.networkServices.proxy.hostname || ""}
                                    error={proxyHostnameError}
                                    onChange={(_, value) => handleProxyHostnameChange(value)}
                                    placeholder={_("e.g. proxy.example.com")}
                                />
                            </FormGroup>
                        </StackItem>

                        <StackItem>
                            <FormGroup label={_("Proxy Port")} isRequired>
                                <ValidatedTextInput
                                    id="proxy-port-input"
                                    type="number"
                                    value={model.networkServices.proxy.port?.toString() || ""}
                                    error={proxyPortError}
                                    onChange={(_, value) => handleProxyPortChange(value)}
                                    placeholder={_("e.g. 8080")}
                                />
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
