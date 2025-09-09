import React, { useState } from 'react';

import { Radio } from "@patternfly/react-core/dist/esm/components/Radio/index.js";
import { TextInput } from "@patternfly/react-core/dist/esm/components/TextInput/index.js";
import { FormGroup } from "@patternfly/react-core/dist/esm/components/Form/index.js";
import { Checkbox } from "@patternfly/react-core/dist/esm/components/Checkbox/index.js";
import { Stack, StackItem } from '@patternfly/react-core';
import { Flex, FlexItem } from '@patternfly/react-core';

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
    const [ipv4Method, setIpv4Method] = useState<'dhcp' | 'static'>('dhcp');
    const [ipv4Address, setIpv4Address] = useState<string>('');
    const [subnetMask, setSubnetMask] = useState<string>('');
    const [gatewayIp, setGatewayIp] = useState<string>('');
    const [autoDns, setAutoDns] = useState<boolean>(true);
    const [primaryDns, setPrimaryDns] = useState<string>('');
    const [secondaryDns, setSecondaryDns] = useState<string>('');

    return (
        <Stack hasGutter>
            <StackItem>
                <Flex>
                    <FlexItem>
                        <Radio
                            id="dhcpv4-radio"
                            name="ipv4-method"
                            label="DHCPv4"
                            isChecked={ipv4Method === 'dhcp'}
                            onChange={() => setIpv4Method('dhcp')}
                        />
                    </FlexItem>
                    <FlexItem>
                        <Radio
                            id="static-ip-radio"
                            name="ipv4-method"
                            label="Static IP"
                            isChecked={ipv4Method === 'static'}
                            onChange={() => setIpv4Method('static')}
                        />
                    </FlexItem>
                </Flex>
            </StackItem>
            {ipv4Method === 'static' && (
                <StackItem>
                    <Stack hasGutter>
                        <StackItem>
                            <FormGroup label="IPv4 Address" isRequired>
                                <TextInput
                                    id="ipv4-address"
                                    value={ipv4Address}
                                    onChange={(_, value) => setIpv4Address(value)}
                                    placeholder="192.168.1.100"
                                />
                            </FormGroup>
                        </StackItem>
                        <StackItem>
                            <FormGroup label="Subnet Mask" isRequired>
                                <TextInput
                                    id="subnet-mask"
                                    value={subnetMask}
                                    onChange={(_, value) => setSubnetMask(value)}
                                    placeholder="255.255.255.0"
                                />
                            </FormGroup>
                        </StackItem>
                        <StackItem>
                            <FormGroup label="Gateway IP" isRequired>
                                <TextInput
                                    id="gateway-ip"
                                    value={gatewayIp}
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
                    isChecked={autoDns}
                    onChange={(_, checked) => setAutoDns(checked)}
                />
                {!autoDns && (
                    <Stack hasGutter style={{ marginTop: '1rem', marginLeft: '1.5rem' }}>
                        <StackItem>
                            <FormGroup label="Primary Server">
                                <TextInput
                                    id="primary-dns-ipv4"
                                    value={primaryDns}
                                    onChange={(_, value) => setPrimaryDns(value)}
                                    placeholder="8.8.8.8"
                                />
                            </FormGroup>
                        </StackItem>
                        <StackItem>
                            <FormGroup label="Secondary Server">
                                <TextInput
                                    id="secondary-dns-ipv4"
                                    value={secondaryDns}
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
    const [ipv6Method, setIpv6Method] = useState<'dhcp' | 'static' | 'disabled'>('dhcp');
    const [ipv6Address, setIpv6Address] = useState<string>('');
    const [gatewayIpv6, setGatewayIpv6] = useState<string>('');
    const [autoDnsIpv6, setAutoDnsIpv6] = useState<boolean>(true);
    const [primaryDnsIpv6, setPrimaryDnsIpv6] = useState<string>('');
    const [secondaryDnsIpv6, setSecondaryDnsIpv6] = useState<string>('');

    return (
        <Stack hasGutter>
            <StackItem>
                <Flex>
                    <FlexItem>
                        <Radio
                            id="dhcpv6-radio"
                            name="ipv6-method"
                            label="DHCPv6"
                            isChecked={ipv6Method === 'dhcp'}
                            onChange={() => setIpv6Method('dhcp')}
                        />
                    </FlexItem>
                    <FlexItem>
                        <Radio
                            id="static-ipv6-radio"
                            name="ipv6-method"
                            label="Static IP"
                            isChecked={ipv6Method === 'static'}
                            onChange={() => setIpv6Method('static')}
                        />
                    </FlexItem>
                    <FlexItem>
                        <Radio
                            id="disabled-ipv6-radio"
                            name="ipv6-method"
                            label="Disabled"
                            isChecked={ipv6Method === 'disabled'}
                            onChange={() => setIpv6Method('disabled')}
                        />
                    </FlexItem>
                </Flex>
            </StackItem>
            {ipv6Method === 'static' && (
                <StackItem>
                    <Stack hasGutter>
                        <StackItem>
                            <FormGroup label="IPv6 Address" isRequired>
                                <TextInput
                                    id="ipv6-address"
                                    value={ipv6Address}
                                    onChange={(_, value) => setIpv6Address(value)}
                                    placeholder="2001:db8::1/64"
                                />
                            </FormGroup>
                        </StackItem>
                        <StackItem>
                            <FormGroup label="Gateway IP" isRequired>
                                <TextInput
                                    id="gateway-ipv6"
                                    value={gatewayIpv6}
                                    onChange={(_, value) => setGatewayIpv6(value)}
                                    placeholder="2001:db8::1"
                                />
                            </FormGroup>
                        </StackItem>
                    </Stack>
                </StackItem>
            )}
            {ipv6Method !== 'disabled' && (
                <StackItem>
                    <Checkbox
                        id="auto-dns-ipv6"
                        label="Automatically configure DNS"
                        isChecked={autoDnsIpv6}
                        onChange={(_, checked) => setAutoDnsIpv6(checked)}
                    />
                    {!autoDnsIpv6 && (
                    <Stack hasGutter style={{ marginTop: '1rem', marginLeft: '1.5rem' }}>
                        <StackItem>
                            <FormGroup label="Primary Server">
                                <TextInput
                                    id="primary-dns-ipv6"
                                    value={primaryDnsIpv6}
                                    onChange={(_, value) => setPrimaryDnsIpv6(value)}
                                    placeholder="2001:4860:4860::8888"
                                />
                            </FormGroup>
                        </StackItem>
                        <StackItem>
                            <FormGroup label="Secondary Server">
                                <TextInput
                                    id="secondary-dns-ipv6"
                                    value={secondaryDnsIpv6}
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
