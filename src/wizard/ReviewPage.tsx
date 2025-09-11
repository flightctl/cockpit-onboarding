import React from 'react';

import { Stack, StackItem } from '@patternfly/react-core';
import { Card, CardBody, CardTitle } from '@patternfly/react-core';
import { DescriptionList, DescriptionListGroup, DescriptionListTerm, DescriptionListDescription } from '@patternfly/react-core';
import { List, ListItem } from '@patternfly/react-core';
import { Title } from '@patternfly/react-core';
import { useModelContext } from '../model-context';

export const ReviewPage: React.FunctionComponent = () => {
    const { model } = useModelContext();

    return (
        <Stack hasGutter>
            <StackItem>
                <p>Please review your configuration below. Click "Enroll" to apply these settings and complete the system onboarding.</p>
            </StackItem>

            <StackItem>
                <DescriptionList isHorizontal>
                    {/* System */}
                    <DescriptionListGroup>
                        <DescriptionListTerm><p>System</p></DescriptionListTerm>
                        <DescriptionListDescription><p></p></DescriptionListDescription>
                    </DescriptionListGroup>
                    <DescriptionListGroup>
                        <DescriptionListTerm>Hostname</DescriptionListTerm>
                        <DescriptionListDescription>
                            {model.hostname.value || '(empty)'}
                        </DescriptionListDescription>
                    </DescriptionListGroup>

                    {/* Network Interface */}
                    <DescriptionListGroup>
                        <DescriptionListTerm><p>Network Interface</p></DescriptionListTerm>
                        <DescriptionListDescription><p></p></DescriptionListDescription>
                    </DescriptionListGroup>
                    <DescriptionListGroup>
                        <DescriptionListTerm>Interface</DescriptionListTerm>
                        <DescriptionListDescription>
                            {model.networkInterface.selectedInterface || '(not selected)'}
                        </DescriptionListDescription>
                    </DescriptionListGroup>
                    {model.networkInterface.useVlan && (
                        <DescriptionListGroup>
                            <DescriptionListTerm>VLAN ID</DescriptionListTerm>
                            <DescriptionListDescription>
                                {model.networkInterface.vlanId}
                            </DescriptionListDescription>
                        </DescriptionListGroup>
                    )}

                    {/* IPv4 Configuration */}
                    <DescriptionListGroup>
                        <DescriptionListTerm><p>IPv4 Configuration</p></DescriptionListTerm>
                        <DescriptionListDescription>
                            {model.networkAddress.ipv4.method === 'dhcp' ? 'DHCPv4' : 'static'}
                        </DescriptionListDescription>
                    </DescriptionListGroup>
                    {model.networkAddress.ipv4.method === 'static' && (
                        <>
                            <DescriptionListGroup>
                                <DescriptionListTerm>IPv4 Address</DescriptionListTerm>
                                <DescriptionListDescription>
                                    {model.networkAddress.ipv4.address || '(empty)'}
                                </DescriptionListDescription>
                            </DescriptionListGroup>
                            <DescriptionListGroup>
                                <DescriptionListTerm>IPv4 Subnet Mask</DescriptionListTerm>
                                <DescriptionListDescription>
                                    {model.networkAddress.ipv4.subnetMask || '(empty)'}
                                </DescriptionListDescription>
                            </DescriptionListGroup>
                            <DescriptionListGroup>
                                <DescriptionListTerm>Gateway</DescriptionListTerm>
                                <DescriptionListDescription>
                                    {model.networkAddress.ipv4.gateway || '(empty)'}
                                </DescriptionListDescription>
                            </DescriptionListGroup>
                        </>
                    )}
                    <DescriptionListGroup>
                        <DescriptionListTerm>DNS servers</DescriptionListTerm>
                        <DescriptionListDescription>
                            {model.networkAddress.ipv4.autoDns ? (
                                'auto'
                            ) : (
                                <>
                                    {model.networkAddress.ipv4.primaryDns && (
                                        <div>{model.networkAddress.ipv4.primaryDns}</div>
                                    )}
                                    {model.networkAddress.ipv4.secondaryDns && (
                                        <div>{model.networkAddress.ipv4.secondaryDns}</div>
                                    )}
                                    {!model.networkAddress.ipv4.primaryDns && !model.networkAddress.ipv4.secondaryDns && (
                                        <div>(empty)</div>
                                    )}
                                </>
                            )}
                        </DescriptionListDescription>
                    </DescriptionListGroup>

                    {/* IPv4 Configuration */}
                    <DescriptionListGroup>
                        <DescriptionListTerm><p>IPv6 Configuration</p></DescriptionListTerm>
                        <DescriptionListDescription>
                            {model.networkAddress.ipv6.method === 'dhcp' && 'DHCPv6'}
                            {model.networkAddress.ipv6.method === 'static' && 'static'}
                            {model.networkAddress.ipv6.method === 'disabled' && 'disabled'}
                        </DescriptionListDescription>
                    </DescriptionListGroup>
                    {model.networkAddress.ipv6.method === 'static' && (
                        <>
                            <DescriptionListGroup>
                                <DescriptionListTerm>IPv6 Address</DescriptionListTerm>
                                <DescriptionListDescription>
                                    {model.networkAddress.ipv6.address || '(empty)'}
                                </DescriptionListDescription>
                            </DescriptionListGroup>
                            <DescriptionListGroup>
                                <DescriptionListTerm>Gateway</DescriptionListTerm>
                                <DescriptionListDescription>
                                    {model.networkAddress.ipv6.gateway || '(empty)'}
                                </DescriptionListDescription>
                            </DescriptionListGroup>
                        </>
                    )}
                    {model.networkAddress.ipv6.method !== 'disabled' && (
                        <DescriptionListGroup>
                            <DescriptionListTerm>DNS servers</DescriptionListTerm>
                            <DescriptionListDescription>
                                {model.networkAddress.ipv6.autoDns ? (
                                    'auto'
                                ) : (
                                    <>
                                        {model.networkAddress.ipv6.primaryDns && (
                                            <div>{model.networkAddress.ipv6.primaryDns}</div>
                                        )}
                                        {model.networkAddress.ipv6.secondaryDns && (
                                            <div>{model.networkAddress.ipv6.secondaryDns}</div>
                                        )}
                                        {!model.networkAddress.ipv6.primaryDns && !model.networkAddress.ipv6.secondaryDns && (
                                            <div>(empty)</div>
                                        )}
                                    </>
                                )}
                            </DescriptionListDescription>
                        </DescriptionListGroup>
                    )}

                    {/* Network Services */}
                    <DescriptionListGroup>
                        <DescriptionListTerm><p>Network Services</p></DescriptionListTerm>
                        <DescriptionListDescription><p></p></DescriptionListDescription>
                    </DescriptionListGroup>
                    <DescriptionListGroup>
                        <DescriptionListTerm>NTP servers</DescriptionListTerm>
                        <DescriptionListDescription>
                            {model.networkServices.ntp.autoConfig ? (
                                'auto'
                            ) : (
                                model.networkServices.ntp.servers.length > 0 ? (
                                    model.networkServices.ntp.servers.map((server, index) => (
                                        <div key={index}>{server}</div>
                                    ))
                                ) : (
                                    <span>(empty)</span>
                                )
                            )}
                        </DescriptionListDescription>
                    </DescriptionListGroup>

                    {/* Network Services */}
                    <DescriptionListGroup>
                        <DescriptionListTerm><p>Enrollment</p></DescriptionListTerm>
                        <DescriptionListDescription><p></p></DescriptionListDescription>
                    </DescriptionListGroup>
                    <DescriptionListGroup>
                        <DescriptionListTerm>Server</DescriptionListTerm>
                        <DescriptionListDescription>
                            {model.enrollment.url || '(empty)'}
                        </DescriptionListDescription>
                    </DescriptionListGroup>
                    {model.enrollment.url && model.enrollment.url.startsWith('https://') && (
                        <DescriptionListGroup>
                            <DescriptionListTerm>TLS Verification</DescriptionListTerm>
                            <DescriptionListDescription>
                                {model.enrollment.skipTlsVerification ? 'disabled (insecure)' : 'enabled'}
                            </DescriptionListDescription>
                        </DescriptionListGroup>
                    )}
                    {model.enrollment.authMethod === 'username-password' && (
                        <>
                            <DescriptionListGroup>
                                <DescriptionListTerm>Username</DescriptionListTerm>
                                <DescriptionListDescription>
                                    {model.enrollment.username || '(empty)'}
                                </DescriptionListDescription>
                            </DescriptionListGroup>
                            <DescriptionListGroup>
                                <DescriptionListTerm>Password</DescriptionListTerm>
                                <DescriptionListDescription>
                                    {model.enrollment.password ? '*'.repeat(model.enrollment.password.length) : '(empty)'}
                                </DescriptionListDescription>
                            </DescriptionListGroup>
                        </>
                    )}
                    {model.enrollment.authMethod === 'token' && (
                        <>
                            <DescriptionListGroup>
                                <DescriptionListTerm>Token</DescriptionListTerm>
                                <DescriptionListDescription>
                                    {model.enrollment.token || '(empty)'}
                                </DescriptionListDescription>
                            </DescriptionListGroup>
                        </>
                    )}
                </DescriptionList>
            </StackItem>
        </Stack>
    );
};