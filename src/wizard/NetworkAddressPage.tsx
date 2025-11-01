import React from 'react';

import { Radio } from "@patternfly/react-core/dist/esm/components/Radio/index.js";
import { FormGroup } from "@patternfly/react-core/dist/esm/components/Form/index.js";
import { Checkbox } from "@patternfly/react-core/dist/esm/components/Checkbox/index.js";
import { TextInputGroup, TextInputGroupMain } from "@patternfly/react-core/dist/esm/components/TextInputGroup/index.js";
import { Stack, StackItem, Flex, FlexItem, ValidatedOptions } from '@patternfly/react-core';
import { useModelContext } from '../model-context';
import {
    validateIPv4,
    validateSubnetMask,
    validateIPv6,
    validateIPv6Gateway,
    validateIP
} from '../validation';

export const NetworkAddressPage: React.FunctionComponent = () => {
    return (
        <Stack hasGutter>
            <StackItem>
                <p>Configure the IPv4 connection for this interface:</p>
                <NetworkConfigIPv4 />
            </StackItem>
            <StackItem>
                <p>Optionally, configure the IPv6 connection for this interface:</p>
                <NetworkConfigIPv6 />
            </StackItem>
        </Stack>
    );
};

export const NetworkConfigIPv4: React.FunctionComponent = () => {
    const { model, updateNestedModel } = useModelContext();

    // Validation state
    const [validationErrors, setValidationErrors] = React.useState({
        address: null as string | null,
        subnetMask: null as string | null,
        gateway: null as string | null,
        primaryDns: null as string | null,
        secondaryDns: null as string | null,
    });

    const setIpv4Method = (method: 'dhcp' | 'static') => {
        // Map 'dhcp' to 'auto' for the model
        const modelMethod = method === 'dhcp' ? 'auto' : method;
        updateNestedModel('networkAddress', 'ipv4', { method: modelMethod as 'auto' | 'static' | 'disabled' });
    };

    const setIpv4Address = (address: string) => {
        const error = validateIPv4(address);
        setValidationErrors(prev => ({ ...prev, address: error }));
        updateNestedModel('networkAddress', 'ipv4', { address });
    };

    const setSubnetMask = (subnetMask: string) => {
        const error = validateSubnetMask(subnetMask);
        setValidationErrors(prev => ({ ...prev, subnetMask: error }));
        updateNestedModel('networkAddress', 'ipv4', { subnetMask });
    };

    const setGatewayIp = (gateway: string) => {
        const error = validateIPv4(gateway);
        setValidationErrors(prev => ({ ...prev, gateway: error }));
        updateNestedModel('networkAddress', 'ipv4', { gateway });
    };

    const setAutoDns = (autoDns: boolean) => {
        updateNestedModel('networkAddress', 'ipv4', { autoDns });
        // Clear DNS validation errors when switching to auto-DNS
        if (autoDns) {
            setValidationErrors(prev => ({ ...prev, primaryDns: null, secondaryDns: null }));
        }
    };

    const setPrimaryDns = (primaryDns: string) => {
        const error = validateIP(primaryDns, !model.networkAddress.ipv4.autoDns);
        setValidationErrors(prev => ({ ...prev, primaryDns: error }));
        updateNestedModel('networkAddress', 'ipv4', { primaryDns });
    };

    const setSecondaryDns = (secondaryDns: string) => {
        const error = validateIP(secondaryDns, false);
        setValidationErrors(prev => ({ ...prev, secondaryDns: error }));
        updateNestedModel('networkAddress', 'ipv4', { secondaryDns });
    };

    return (
        <Stack hasGutter>
            <StackItem>
                <Flex>
                    <FlexItem>
                        <Radio
                            id="dhcpv4-radio"
                            name="ipv4-method"
                            label="DHCPv4"
                            isChecked={model.networkAddress.ipv4.method === 'auto'}
                            onChange={() => setIpv4Method('dhcp')}
                        />
                    </FlexItem>
                    <FlexItem>
                        <Radio
                            id="static-ip-radio"
                            name="ipv4-method"
                            label="Static IP"
                            isChecked={model.networkAddress.ipv4.method === 'static'}
                            onChange={() => setIpv4Method('static')}
                        />
                    </FlexItem>
                </Flex>
            </StackItem>
            {model.networkAddress.ipv4.method === 'static' && (
                <StackItem>
                    <Stack hasGutter>
                        <StackItem>
                            <FormGroup
                                label="IPv4 Address"
                                isRequired
                            >
                                <TextInputGroup validated={validationErrors.address ? ValidatedOptions.error : (model.networkAddress.ipv4.address && !validationErrors.address ? ValidatedOptions.success : ValidatedOptions.warning)}>
                                    <TextInputGroupMain
                                        id="ipv4-address"
                                        value={model.networkAddress.ipv4.address || ''}
                                        onChange={(_, value) => setIpv4Address(value)}
                                        placeholder="192.168.1.100"
                                    />
                                </TextInputGroup>
                            </FormGroup>
                        </StackItem>
                        <StackItem>
                            <FormGroup
                                label="Subnet Mask"
                                isRequired
                            >
                                <TextInputGroup validated={validationErrors.subnetMask ? ValidatedOptions.error : (model.networkAddress.ipv4.subnetMask && !validationErrors.subnetMask ? ValidatedOptions.success : ValidatedOptions.warning)}>
                                    <TextInputGroupMain
                                        id="subnet-mask"
                                        value={model.networkAddress.ipv4.subnetMask || ''}
                                        onChange={(_, value) => setSubnetMask(value)}
                                        placeholder="255.255.255.0 or /24"
                                    />
                                </TextInputGroup>
                            </FormGroup>
                        </StackItem>
                        <StackItem>
                            <FormGroup
                                label="Gateway IP"
                                isRequired
                            >
                                <TextInputGroup validated={validationErrors.gateway ? ValidatedOptions.error : (model.networkAddress.ipv4.gateway && !validationErrors.gateway ? ValidatedOptions.success : ValidatedOptions.warning)}>
                                    <TextInputGroupMain
                                        id="gateway-ip"
                                        value={model.networkAddress.ipv4.gateway || ''}
                                        onChange={(_, value) => setGatewayIp(value)}
                                        placeholder="192.168.1.1"
                                    />
                                </TextInputGroup>
                            </FormGroup>
                        </StackItem>
                    </Stack>
                </StackItem>
            )}
            <StackItem>
                <Checkbox
                    id="auto-dns-ipv4"
                    label="Automatically configure DNS"
                    isChecked={model.networkAddress.ipv4.autoDns}
                    onChange={(_, checked) => setAutoDns(checked)}
                />
                {!model.networkAddress.ipv4.autoDns && (
                    <Stack hasGutter style={{ marginTop: '1rem', marginLeft: '1.5rem' }}>
                        <StackItem>
                            <FormGroup
                                label="Primary Server"
                                isRequired
                            >
                                <TextInputGroup validated={validationErrors.primaryDns ? ValidatedOptions.error : (model.networkAddress.ipv4.primaryDns && !validationErrors.primaryDns ? ValidatedOptions.success : ValidatedOptions.warning)}>
                                    <TextInputGroupMain
                                        id="primary-dns-ipv4"
                                        value={model.networkAddress.ipv4.primaryDns || ''}
                                        onChange={(_, value) => setPrimaryDns(value)}
                                        placeholder="8.8.8.8"
                                    />
                                </TextInputGroup>
                            </FormGroup>
                        </StackItem>
                        <StackItem>
                            <FormGroup
                                label="Secondary Server"
                            >
                                <TextInputGroup
                                    {...(validationErrors.secondaryDns
                                        ? { validated: ValidatedOptions.error }
                                        : model.networkAddress.ipv4.secondaryDns?.trim()
                                            ? { validated: ValidatedOptions.success }
                                            : {})}
                                >
                                    <TextInputGroupMain
                                        id="secondary-dns-ipv4"
                                        value={model.networkAddress.ipv4.secondaryDns || ''}
                                        onChange={(_, value) => setSecondaryDns(value)}
                                        placeholder="8.8.4.4"
                                    />
                                </TextInputGroup>
                            </FormGroup>
                        </StackItem>
                    </Stack>
                )}
            </StackItem>
        </Stack>
    );
};

export const NetworkConfigIPv6: React.FunctionComponent = () => {
    const { model, updateNestedModel } = useModelContext();

    // Validation state
    const [validationErrors, setValidationErrors] = React.useState({
        address: null as string | null,
        gateway: null as string | null,
        primaryDns: null as string | null,
        secondaryDns: null as string | null,
    });

    const setIpv6Method = (method: 'dhcp' | 'static' | 'disabled') => {
        // Map 'dhcp' to 'auto' for the model
        const modelMethod = method === 'dhcp' ? 'auto' : method;
        updateNestedModel('networkAddress', 'ipv6', { method: modelMethod as 'auto' | 'static' | 'disabled' });
    };

    const setIpv6Address = (address: string) => {
        // Validate the address as-is first
        const error = validateIPv6(address, model.networkAddress.ipv6.method === 'static');
        setValidationErrors(prev => ({ ...prev, address: error }));
        updateNestedModel('networkAddress', 'ipv6', { address });
    };

    const handleIpv6AddressBlur = (address: string) => {
        // Add default /64 prefix if not provided when field loses focus
        if (address.trim() && !address.includes('/')) {
            const normalizedAddress = `${address}/64`;
            updateNestedModel('networkAddress', 'ipv6', { address: normalizedAddress });
        }
    };

    const setGatewayIpv6 = (gateway: string) => {
        const error = validateIPv6Gateway(gateway);
        setValidationErrors(prev => ({ ...prev, gateway: error }));
        updateNestedModel('networkAddress', 'ipv6', { gateway });
    };

    const setAutoDnsIpv6 = (autoDns: boolean) => {
        updateNestedModel('networkAddress', 'ipv6', { autoDns });
        // Clear DNS validation errors when switching to auto-DNS
        if (autoDns) {
            setValidationErrors(prev => ({ ...prev, primaryDns: null, secondaryDns: null }));
        }
    };

    const setPrimaryDnsIpv6 = (primaryDns: string) => {
        const error = validateIP(primaryDns, !model.networkAddress.ipv6.autoDns);
        setValidationErrors(prev => ({ ...prev, primaryDns: error }));
        updateNestedModel('networkAddress', 'ipv6', { primaryDns });
    };

    const setSecondaryDnsIpv6 = (secondaryDns: string) => {
        const error = validateIP(secondaryDns, false);
        setValidationErrors(prev => ({ ...prev, secondaryDns: error }));
        updateNestedModel('networkAddress', 'ipv6', { secondaryDns });
    };

    return (
        <Stack hasGutter>
            <StackItem>
                <Flex>
                    <FlexItem>
                        <Radio
                            id="dhcpv6-radio"
                            name="ipv6-method"
                            label="DHCPv6"
                            isChecked={model.networkAddress.ipv6.method === 'auto'}
                            onChange={() => setIpv6Method('dhcp')}
                        />
                    </FlexItem>
                    <FlexItem>
                        <Radio
                            id="static-ipv6-radio"
                            name="ipv6-method"
                            label="Static IP"
                            isChecked={model.networkAddress.ipv6.method === 'static'}
                            onChange={() => setIpv6Method('static')}
                        />
                    </FlexItem>
                    <FlexItem>
                        <Radio
                            id="disabled-ipv6-radio"
                            name="ipv6-method"
                            label="Disabled"
                            isChecked={model.networkAddress.ipv6.method === 'disabled'}
                            onChange={() => setIpv6Method('disabled')}
                        />
                    </FlexItem>
                </Flex>
            </StackItem>
            {model.networkAddress.ipv6.method === 'static' && (
                <StackItem>
                    <Stack hasGutter>
                        <StackItem>
                            <FormGroup
                                label="IPv6 Address"
                                isRequired
                            >
                                <TextInputGroup validated={validationErrors.address ? ValidatedOptions.error : (model.networkAddress.ipv6.address && !validationErrors.address ? ValidatedOptions.success : ValidatedOptions.warning)}>
                                    <TextInputGroupMain
                                        id="ipv6-address"
                                        value={model.networkAddress.ipv6.address || ''}
                                        onChange={(_, value) => setIpv6Address(value)}
                                        onBlur={(e) => handleIpv6AddressBlur(e.currentTarget.value)}
                                        placeholder="2001:db8::1/64"
                                    />
                                </TextInputGroup>
                            </FormGroup>
                        </StackItem>
                        <StackItem>
                            <FormGroup
                                label="Gateway IP"
                            >
                                <TextInputGroup
                                    {...(validationErrors.gateway
                                        ? { validated: ValidatedOptions.error }
                                        : model.networkAddress.ipv6.gateway?.trim()
                                            ? { validated: ValidatedOptions.success }
                                            : {})}
                                >
                                    <TextInputGroupMain
                                        id="gateway-ipv6"
                                        value={model.networkAddress.ipv6.gateway || ''}
                                        onChange={(_, value) => setGatewayIpv6(value)}
                                        placeholder="2001:db8::1"
                                    />
                                </TextInputGroup>
                            </FormGroup>
                        </StackItem>
                    </Stack>
                </StackItem>
            )}
            {model.networkAddress.ipv6.method !== 'disabled' && (
                <StackItem>
                    <Checkbox
                        id="auto-dns-ipv6"
                        label="Automatically configure DNS"
                        isChecked={model.networkAddress.ipv6.autoDns}
                        onChange={(_, checked) => setAutoDnsIpv6(checked)}
                    />
                    {!model.networkAddress.ipv6.autoDns && (
                        <Stack hasGutter style={{ marginTop: '1rem', marginLeft: '1.5rem' }}>
                            <StackItem>
                                <FormGroup
                                label="Primary Server"
                                isRequired
                                >
                                    <TextInputGroup validated={validationErrors.primaryDns ? ValidatedOptions.error : (model.networkAddress.ipv6.primaryDns && !validationErrors.primaryDns ? ValidatedOptions.success : ValidatedOptions.warning)}>
                                        <TextInputGroupMain
                                        id="primary-dns-ipv6"
                                        value={model.networkAddress.ipv6.primaryDns || ''}
                                        onChange={(_, value) => setPrimaryDnsIpv6(value)}
                                        placeholder="2001:4860:4860::8888"
                                        />
                                    </TextInputGroup>
                                </FormGroup>
                            </StackItem>
                            <StackItem>
                                <FormGroup
                                label="Secondary Server"
                                >
                                    <TextInputGroup
                                        {...(validationErrors.secondaryDns
                                            ? { validated: ValidatedOptions.error }
                                            : model.networkAddress.ipv6.secondaryDns?.trim()
                                                ? { validated: ValidatedOptions.success }
                                                : {})}
                                    >
                                        <TextInputGroupMain
                                        id="secondary-dns-ipv6"
                                        value={model.networkAddress.ipv6.secondaryDns || ''}
                                        onChange={(_, value) => setSecondaryDnsIpv6(value)}
                                        placeholder="2001:4860:4860::8844"
                                        />
                                    </TextInputGroup>
                                </FormGroup>
                            </StackItem>
                        </Stack>
                    )}
                </StackItem>
            )}
        </Stack>
    );
};
