import React, { useState } from "react";
import cockpit from "cockpit";

import { TextInput } from "@patternfly/react-core/dist/esm/components/TextInput/index.js";
import { FormGroup } from "@patternfly/react-core/dist/esm/components/Form/index.js";
import { MenuToggle, MenuToggleElement } from "@patternfly/react-core/dist/esm/components/MenuToggle/index.js";
import { Select, SelectList, SelectOption } from "@patternfly/react-core/dist/esm/components/Select/index.js";
import { Stack, StackItem } from "@patternfly/react-core/dist/esm/layouts/Stack/index.js";

import FeatureSwitch from "../components/FeatureSwitch";
import ValidatedTextInput from "../components/ValidatedTextInput";
import DefaultHelperText from "../components/HelperTexts";
import { useModelContext } from "../model-context";
import { validateHostnameOrIP, validatePort } from "../validation";
import type { ProxyProtocol } from "../types";

const _ = cockpit.gettext;

const PROXY_PROTOCOLS: { value: ProxyProtocol; label: string }[] = [
    { value: "http", label: _("HTTP") },
    { value: "https", label: _("HTTPS") },
    { value: "socks5", label: _("SOCKS5") },
];

const NetworkProxySection = () => {
    const { model, updateNestedModel } = useModelContext();
    const [proxyHostnameError, setProxyHostnameError] = useState<string>();
    const [proxyPortError, setProxyPortError] = useState<string>();
    const [isProtocolOpen, setIsProtocolOpen] = useState(false);

    const setProxyEnabled = (enabled: boolean) => {
        updateNestedModel("networkServices", "proxy", { enabled });
        if (!enabled) {
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

    const handleProxyProtocolChange = (value: ProxyProtocol) => {
        updateNestedModel("networkServices", "proxy", { protocol: value });
    };

    const selectedProtocol = model.networkServices.proxy.protocol;
    const selectedProtocolLabel =
        PROXY_PROTOCOLS.find((protocol) => protocol.value === selectedProtocol)?.label ?? _("HTTP");

    const onProtocolSelect = (
        _event: React.MouseEvent<Element, MouseEvent> | undefined,
        value: string | number | undefined
    ) => {
        if (value) {
            handleProxyProtocolChange(value as ProxyProtocol);
        }
        setIsProtocolOpen(false);
    };

    const protocolToggle = (toggleRef: React.Ref<MenuToggleElement>) => (
        <MenuToggle
            ref={toggleRef}
            id="proxy-protocol-select"
            onClick={() => setIsProtocolOpen(!isProtocolOpen)}
            isExpanded={isProtocolOpen}
        >
            {selectedProtocolLabel}
        </MenuToggle>
    );

    const handleProxyNoProxyChange = (value: string) => {
        updateNestedModel("networkServices", "proxy", { noProxy: value });
    };

    return (
        <FeatureSwitch
            fieldId="proxy-enabled"
            label={_("HTTP Proxy")}
            isChecked={model.networkServices.proxy.enabled}
            onToggle={setProxyEnabled}
        >
            <Stack hasGutter>
                <StackItem>
                    <FormGroup label={_("Protocol")}>
                        <Select
                            id="proxy-protocol-select-menu"
                            isOpen={isProtocolOpen}
                            selected={selectedProtocol}
                            onSelect={onProtocolSelect}
                            onOpenChange={setIsProtocolOpen}
                            toggle={protocolToggle}
                            shouldFocusToggleOnSelect
                        >
                            <SelectList>
                                {PROXY_PROTOCOLS.map(({ value, label }) => (
                                    <SelectOption key={value} value={value}>
                                        {label}
                                    </SelectOption>
                                ))}
                            </SelectList>
                        </Select>
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
                    <FormGroup label={_("Proxy Username")}>
                        <TextInput
                            id="proxy-username-input"
                            value={model.networkServices.proxy.username || ""}
                            onChange={(_, value) => handleProxyUsernameChange(value)}
                            placeholder={_("Enter the proxy username")}
                        />
                    </FormGroup>
                </StackItem>

                <StackItem>
                    <FormGroup label={_("Proxy Password")}>
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
                    <FormGroup label={_("Bypass")} fieldId="proxy-no-proxy-input">
                        <TextInput
                            id="proxy-no-proxy-input"
                            value={model.networkServices.proxy.noProxy}
                            onChange={(_, value) => handleProxyNoProxyChange(value)}
                            placeholder={_("e.g. localhost,127.0.0.1,::1,*.internal.corp,10.0.0.0/8")}
                        />
                        <DefaultHelperText
                            text={_("Comma-separated list of hosts, domains, or CIDRs that should bypass the proxy")}
                        />
                    </FormGroup>
                </StackItem>
            </Stack>
        </FeatureSwitch>
    );
};

export default NetworkProxySection;
