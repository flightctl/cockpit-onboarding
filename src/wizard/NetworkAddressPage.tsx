import React from 'react';

import { Radio } from "@patternfly/react-core/dist/esm/components/Radio/index.js";
import { FormGroup } from "@patternfly/react-core/dist/esm/components/Form/index.js";
import { Checkbox } from "@patternfly/react-core/dist/esm/components/Checkbox/index.js";
import { TextInputGroup, TextInputGroupMain } from "@patternfly/react-core/dist/esm/components/TextInputGroup/index.js";
import { Stack, StackItem, Flex, FlexItem, ValidatedOptions } from '@patternfly/react-core';
import { useModelContext } from '../model-context';

// Validation functions
const validateIPv4 = (ip: string): string | null => {
    if (!ip.trim()) return 'IPv4 address is required';

    const ipRegex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const match = ip.match(ipRegex);

    if (!match) return 'Invalid IPv4 address format';

    const octets = match.slice(1).map(Number);
    for (const octet of octets) {
        if (octet < 0 || octet > 255) {
            return 'IPv4 octets must be between 0 and 255';
        }
    }

    return null;
};

const validateSubnetMask = (mask: string): string | null => {
    if (!mask.trim()) return 'Subnet mask is required';

    // Support CIDR notation (/24)
    if (mask.startsWith('/')) {
        const prefix = parseInt(mask.slice(1), 10);
        if (isNaN(prefix) || prefix < 0 || prefix > 32) {
            return 'CIDR prefix must be between 0 and 32';
        }
        return null;
    }

    // Support dotted decimal notation (255.255.255.0)
    const ipv4Error = validateIPv4(mask);
    if (ipv4Error) return 'Invalid subnet mask format';

    // Validate that it's a valid subnet mask
    const octets = mask.split('.').map(Number);
    let binaryMask = '';
    for (const octet of octets) {
        binaryMask += octet.toString(2).padStart(8, '0');
    }

    // Valid subnet mask should have consecutive 1s followed by consecutive 0s
    if (!/^1*0*$/.test(binaryMask)) {
        return 'Invalid subnet mask - must have consecutive 1s followed by 0s';
    }

    return null;
};

const validateIPv6 = (ip: string, requirePrefix = false): string | null => {
    if (!ip.trim()) return requirePrefix ? 'IPv6 address is required' : null;

    let address = ip;
    let prefix = null;

    // Extract prefix if present
    if (ip.includes('/')) {
        const parts = ip.split('/');
        if (parts.length !== 2) return 'Invalid IPv6 address format';
        address = parts[0];
        prefix = parseInt(parts[1], 10);

        if (isNaN(prefix) || prefix < 0 || prefix > 128) {
            return 'IPv6 prefix must be between 0 and 128';
        }
    } else if (requirePrefix) {
        return 'IPv6 address must include prefix (e.g., /64)';
    }

    // Validate IPv6 address format
    const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$|^::$|^::1$|^([0-9a-fA-F]{0,4}:){1,6}:$|^:([0-9a-fA-F]{0,4}:){1,6}$/;
    const expandedRegex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;

    // Handle compressed format
    if (address.includes('::')) {
        const parts = address.split('::');
        if (parts.length > 2) return 'Invalid IPv6 address format';

        const beforeParts = parts[0] ? parts[0].split(':').filter(p => p !== '') : [];
        const afterParts = parts[1] ? parts[1].split(':').filter(p => p !== '') : [];

        if (beforeParts.length + afterParts.length >= 8) return 'Invalid IPv6 address format';

        // Validate each part
        for (const part of [...beforeParts, ...afterParts]) {
            if (!/^[0-9a-fA-F]{1,4}$/.test(part)) return 'Invalid IPv6 address format';
        }
    } else if (!expandedRegex.test(address) && !ipv6Regex.test(address)) {
        return 'Invalid IPv6 address format';
    }

    return null;
};

const validateIPv6Gateway = (gateway: string): string | null => {
    if (!gateway.trim()) return null; // Optional field

    const error = validateIPv6(gateway);
    if (error) return error;

    // Check if it's a link-local address (not allowed for gateway)
    if (gateway.toLowerCase().startsWith('fe80:')) {
        return 'Gateway cannot be a link-local address (fe80::)';
    }

    return null;
};

const validateDNSServer = (dns: string, isRequired = false): string | null => {
    if (!dns.trim()) {
        return isRequired ? 'DNS server is required' : null;
    }

    // Try IPv4 first
    const ipv4Error = validateIPv4(dns);
    if (!ipv4Error) return null;

    // Try IPv6
    const ipv6Error = validateIPv6(dns);
    if (!ipv6Error) return null;

    return 'Invalid DNS server address';
};

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
        updateNestedModel('networkAddress', 'ipv4', { method });
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
        const error = validateDNSServer(primaryDns, !model.networkAddress.ipv4.autoDns);
        setValidationErrors(prev => ({ ...prev, primaryDns: error }));
        updateNestedModel('networkAddress', 'ipv4', { primaryDns });
    };

    const setSecondaryDns = (secondaryDns: string) => {
        const error = validateDNSServer(secondaryDns, false);
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
                            isChecked={model.networkAddress.ipv4.method === 'dhcp'}
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
                                        value={model.networkAddress.ipv4.address}
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
                                        value={model.networkAddress.ipv4.subnetMask}
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
                                        value={model.networkAddress.ipv4.gateway}
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
                                        value={model.networkAddress.ipv4.primaryDns}
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
                                <TextInputGroup validated={validationErrors.secondaryDns ? ValidatedOptions.error : (model.networkAddress.ipv4.secondaryDns && !validationErrors.secondaryDns ? ValidatedOptions.success : ValidatedOptions.warning)}>
                                    <TextInputGroupMain
                                        id="secondary-dns-ipv4"
                                        value={model.networkAddress.ipv4.secondaryDns}
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
        updateNestedModel('networkAddress', 'ipv6', { method });
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
        const error = validateDNSServer(primaryDns, !model.networkAddress.ipv6.autoDns);
        setValidationErrors(prev => ({ ...prev, primaryDns: error }));
        updateNestedModel('networkAddress', 'ipv6', { primaryDns });
    };

    const setSecondaryDnsIpv6 = (secondaryDns: string) => {
        const error = validateDNSServer(secondaryDns, false);
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
                            isChecked={model.networkAddress.ipv6.method === 'dhcp'}
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
                                        value={model.networkAddress.ipv6.address}
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
                                <TextInputGroup validated={validationErrors.gateway ? ValidatedOptions.error : (model.networkAddress.ipv6.gateway && !validationErrors.gateway ? ValidatedOptions.success : ValidatedOptions.warning)}>
                                    <TextInputGroupMain
                                        id="gateway-ipv6"
                                        value={model.networkAddress.ipv6.gateway}
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
                                        value={model.networkAddress.ipv6.primaryDns}
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
                                    <TextInputGroup validated={validationErrors.secondaryDns ? ValidatedOptions.error : (model.networkAddress.ipv6.secondaryDns && !validationErrors.secondaryDns ? ValidatedOptions.success : ValidatedOptions.warning)}>
                                        <TextInputGroupMain
                                        id="secondary-dns-ipv6"
                                        value={model.networkAddress.ipv6.secondaryDns}
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
