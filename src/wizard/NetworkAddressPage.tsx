import React from 'react';

import { Radio } from "@patternfly/react-core/dist/esm/components/Radio/index.js";
import { TextInput } from "@patternfly/react-core/dist/esm/components/TextInput/index.js";
import { FormGroup } from "@patternfly/react-core/dist/esm/components/Form/index.js";
import { Checkbox } from "@patternfly/react-core/dist/esm/components/Checkbox/index.js";
import { Stack, StackItem } from '@patternfly/react-core';
import { Flex, FlexItem } from '@patternfly/react-core';
import { useModelContext } from '../model-context';

export const NetworkAddressPage: React.FunctionComponent = () => {
    return (
      <Stack hasGutter>
        <StackItem>
            <p>Configure the IPv4 connection for this interface:</p>
            <NetworkConfigIPv4/>
        </StackItem>
        <StackItem>
            <p>Optionally, configure the IPv6 connection for this interface:</p>
            <NetworkConfigIPv6/>
        </StackItem>
      </Stack>
    );
};

export const NetworkConfigIPv4: React.FunctionComponent = () => {
    const { model, updateNestedModel } = useModelContext();
    
    const setIpv4Method = (method: 'dhcp' | 'static') => {
        updateNestedModel('networkAddress', 'ipv4', { method });
    };
    
    const setIpv4Address = (address: string) => {
        updateNestedModel('networkAddress', 'ipv4', { address });
    };
    
    const setSubnetMask = (subnetMask: string) => {
        updateNestedModel('networkAddress', 'ipv4', { subnetMask });
    };
    
    const setGatewayIp = (gateway: string) => {
        updateNestedModel('networkAddress', 'ipv4', { gateway });
    };
    
    const setAutoDns = (autoDns: boolean) => {
        updateNestedModel('networkAddress', 'ipv4', { autoDns });
    };
    
    const setPrimaryDns = (primaryDns: string) => {
        updateNestedModel('networkAddress', 'ipv4', { primaryDns });
    };
    
    const setSecondaryDns = (secondaryDns: string) => {
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
                            <FormGroup label="IPv4 Address" isRequired>
                                <TextInput
                                    id="ipv4-address"
                                    value={model.networkAddress.ipv4.address}
                                    onChange={(_, value) => setIpv4Address(value)}
                                    placeholder="192.168.1.100"
                                />
                            </FormGroup>
                        </StackItem>
                        <StackItem>
                            <FormGroup label="Subnet Mask" isRequired>
                                <TextInput
                                    id="subnet-mask"
                                    value={model.networkAddress.ipv4.subnetMask}
                                    onChange={(_, value) => setSubnetMask(value)}
                                    placeholder="255.255.255.0"
                                />
                            </FormGroup>
                        </StackItem>
                        <StackItem>
                            <FormGroup label="Gateway IP" isRequired>
                                <TextInput
                                    id="gateway-ip"
                                    value={model.networkAddress.ipv4.gateway}
                                    onChange={(_, value) => setGatewayIp(value)}
                                    placeholder="192.168.1.1"
                                />
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
                            <FormGroup label="Primary Server">
                                <TextInput
                                    id="primary-dns-ipv4"
                                    value={model.networkAddress.ipv4.primaryDns}
                                    onChange={(_, value) => setPrimaryDns(value)}
                                    placeholder="8.8.8.8"
                                />
                            </FormGroup>
                        </StackItem>
                        <StackItem>
                            <FormGroup label="Secondary Server">
                                <TextInput
                                    id="secondary-dns-ipv4"
                                    value={model.networkAddress.ipv4.secondaryDns}
                                    onChange={(_, value) => setSecondaryDns(value)}
                                    placeholder="8.8.4.4"
                                />
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
    
    const setIpv6Method = (method: 'dhcp' | 'static' | 'disabled') => {
        updateNestedModel('networkAddress', 'ipv6', { method });
    };
    
    const setIpv6Address = (address: string) => {
        updateNestedModel('networkAddress', 'ipv6', { address });
    };
    
    const setGatewayIpv6 = (gateway: string) => {
        updateNestedModel('networkAddress', 'ipv6', { gateway });
    };
    
    const setAutoDnsIpv6 = (autoDns: boolean) => {
        updateNestedModel('networkAddress', 'ipv6', { autoDns });
    };
    
    const setPrimaryDnsIpv6 = (primaryDns: string) => {
        updateNestedModel('networkAddress', 'ipv6', { primaryDns });
    };
    
    const setSecondaryDnsIpv6 = (secondaryDns: string) => {
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
                            <FormGroup label="IPv6 Address" isRequired>
                                <TextInput
                                    id="ipv6-address"
                                    value={model.networkAddress.ipv6.address}
                                    onChange={(_, value) => setIpv6Address(value)}
                                    placeholder="2001:db8::1/64"
                                />
                            </FormGroup>
                        </StackItem>
                        <StackItem>
                            <FormGroup label="Gateway IP" isRequired>
                                <TextInput
                                    id="gateway-ipv6"
                                    value={model.networkAddress.ipv6.gateway}
                                    onChange={(_, value) => setGatewayIpv6(value)}
                                    placeholder="2001:db8::1"
                                />
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
                            <FormGroup label="Primary Server">
                                <TextInput
                                    id="primary-dns-ipv6"
                                    value={model.networkAddress.ipv6.primaryDns}
                                    onChange={(_, value) => setPrimaryDnsIpv6(value)}
                                    placeholder="2001:4860:4860::8888"
                                />
                            </FormGroup>
                        </StackItem>
                        <StackItem>
                            <FormGroup label="Secondary Server">
                                <TextInput
                                    id="secondary-dns-ipv6"
                                    value={model.networkAddress.ipv6.secondaryDns}
                                    onChange={(_, value) => setSecondaryDnsIpv6(value)}
                                    placeholder="2001:4860:4860::8844"
                                />
                            </FormGroup>
                        </StackItem>
                    </Stack>
                    )}
                </StackItem>
            )}
        </Stack>
    );
};
