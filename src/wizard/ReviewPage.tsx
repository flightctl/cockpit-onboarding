import React from 'react';
import cockpit from 'cockpit';

import {
    Stack,
    StackItem,
    DescriptionList,
    DescriptionListGroup,
    DescriptionListTerm,
    DescriptionListDescription,
    Button,
    Flex,
    FlexItem
} from '@patternfly/react-core';
import { PencilAltIcon } from '@patternfly/react-icons';
import { useWizardContext } from '@patternfly/react-core';
import { useModelContext } from '../model-context';
import { useConfig } from '../app';

const _ = cockpit.gettext;

interface ReviewPageProps {
    hasEnrollmentScripts: boolean;
}

export const ReviewPage: React.FunctionComponent<ReviewPageProps> = ({ hasEnrollmentScripts }) => {
    const { model } = useModelContext();
    const { config } = useConfig();
    const { goToStepById } = useWizardContext();

    return (
        <Stack hasGutter>
            <StackItem>
                <p>
                    {hasEnrollmentScripts
                        ? _('Please review your configuration below. Click "Enroll" to apply these settings and complete the system onboarding.')
                        : _('Please review your configuration below. Click "Apply" to apply these settings to the system.')}
                </p>
            </StackItem>

            <StackItem>
                <DescriptionList isHorizontal>
                    {/* Hostname Section */}
                    <DescriptionListGroup>
                        <DescriptionListTerm>
                            <Flex alignItems={{ default: 'alignItemsCenter' }}>
                                <FlexItem><strong>{_('Hostname')}</strong></FlexItem>
                                <FlexItem>
                                    <Button
                                        variant="link"
                                        icon={<PencilAltIcon />}
                                        onClick={() => goToStepById('wizard-step-1')}
                                        aria-label={_('Edit hostname')}
                                    >
                                        {_('Edit')}
                                    </Button>
                                </FlexItem>
                            </Flex>
                        </DescriptionListTerm>
                        <DescriptionListDescription><span /></DescriptionListDescription>
                    </DescriptionListGroup>
                    <DescriptionListGroup>
                        <DescriptionListTerm>{_('Hostname')}</DescriptionListTerm>
                        <DescriptionListDescription>
                            {model.hostname.value || _('(empty)')}
                        </DescriptionListDescription>
                    </DescriptionListGroup>

                    {/* Network Interface Section */}
                    <DescriptionListGroup>
                        <DescriptionListTerm>
                            <Flex alignItems={{ default: 'alignItemsCenter' }}>
                                <FlexItem><strong>{_('Network Interface')}</strong></FlexItem>
                                <FlexItem>
                                    <Button
                                        variant="link"
                                        icon={<PencilAltIcon />}
                                        onClick={() => goToStepById('wizard-step-2')}
                                        aria-label={_('Edit network interface')}
                                    >
                                        {_('Edit')}
                                    </Button>
                                </FlexItem>
                            </Flex>
                        </DescriptionListTerm>
                        <DescriptionListDescription><span /></DescriptionListDescription>
                    </DescriptionListGroup>
                    <DescriptionListGroup>
                        <DescriptionListTerm>{_('Interface')}</DescriptionListTerm>
                        <DescriptionListDescription>
                            {model.networkInterface.selectedInterface || _('(not selected)')}
                        </DescriptionListDescription>
                    </DescriptionListGroup>
                    {model.networkInterface.interfaceType === 'wifi' && (
                        <>
                            <DescriptionListGroup>
                                <DescriptionListTerm>{_('WiFi SSID')}</DescriptionListTerm>
                                <DescriptionListDescription>
                                    {model.networkInterface.wifiSsid || _('(empty)')}
                                </DescriptionListDescription>
                            </DescriptionListGroup>
                            <DescriptionListGroup>
                                <DescriptionListTerm>{_('WiFi Security')}</DescriptionListTerm>
                                <DescriptionListDescription>
                                    {model.networkInterface.wifiSecurity === 'none' && _('None')}
                                    {model.networkInterface.wifiSecurity === 'wep' && _('WEP')}
                                    {model.networkInterface.wifiSecurity === 'wpa' && _('WPA/WPA2')}
                                    {!model.networkInterface.wifiSecurity && _('(not set)')}
                                </DescriptionListDescription>
                            </DescriptionListGroup>
                        </>
                    )}
                    {model.networkInterface.vlanId !== null && (
                        <DescriptionListGroup>
                            <DescriptionListTerm>{_('VLAN ID')}</DescriptionListTerm>
                            <DescriptionListDescription>
                                {model.networkInterface.vlanId}
                            </DescriptionListDescription>
                        </DescriptionListGroup>
                    )}

                    {/* Network Address Section */}
                    <DescriptionListGroup>
                        <DescriptionListTerm>
                            <Flex alignItems={{ default: 'alignItemsCenter' }}>
                                <FlexItem><strong>{_('Network Address')}</strong></FlexItem>
                                <FlexItem>
                                    <Button
                                        variant="link"
                                        icon={<PencilAltIcon />}
                                        onClick={() => goToStepById('wizard-step-3')}
                                        aria-label={_('Edit network address')}
                                    >
                                        {_('Edit')}
                                    </Button>
                                </FlexItem>
                            </Flex>
                        </DescriptionListTerm>
                        <DescriptionListDescription><span /></DescriptionListDescription>
                    </DescriptionListGroup>
                    <DescriptionListGroup>
                        <DescriptionListTerm>{_('IPv4 Configuration')}</DescriptionListTerm>
                        <DescriptionListDescription>
                            {model.networkAddress.ipv4.method === 'auto' && _('Automatic (DHCP)')}
                            {model.networkAddress.ipv4.method === 'static' && _('Static')}
                            {model.networkAddress.ipv4.method === 'disabled' && _('Disabled')}
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
                            {model.networkAddress.ipv4.autoDns
? (
                                'auto'
                            )
: (
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

                    <DescriptionListGroup>
                        <DescriptionListTerm>{_('IPv6 Configuration')}</DescriptionListTerm>
                        <DescriptionListDescription>
                            {model.networkAddress.ipv6.method === 'auto' && _('Automatic (DHCP)')}
                            {model.networkAddress.ipv6.method === 'static' && _('Static')}
                            {model.networkAddress.ipv6.method === 'disabled' && _('Disabled')}
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
                                {model.networkAddress.ipv6.autoDns
? (
                                    'auto'
                                )
: (
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

                    {/* Network Services Section */}
                    <DescriptionListGroup>
                        <DescriptionListTerm>
                            <Flex alignItems={{ default: 'alignItemsCenter' }}>
                                <FlexItem><strong>{_('Network Services')}</strong></FlexItem>
                                <FlexItem>
                                    <Button
                                        variant="link"
                                        icon={<PencilAltIcon />}
                                        onClick={() => goToStepById('wizard-step-4')}
                                        aria-label={_('Edit network services')}
                                    >
                                        {_('Edit')}
                                    </Button>
                                </FlexItem>
                            </Flex>
                        </DescriptionListTerm>
                        <DescriptionListDescription><span /></DescriptionListDescription>
                    </DescriptionListGroup>
                    <DescriptionListGroup>
                        <DescriptionListTerm>{_('NTP Servers')}</DescriptionListTerm>
                        <DescriptionListDescription>
                            {model.networkServices.ntp.autoConfig
                                ? _('Automatic')
                                : (model.networkServices.ntp.servers.length > 0
                                    ? (
                                    model.networkServices.ntp.servers.map((server, index) => (
                                        <div key={index}>{server}</div>
                                    ))
                                )
: (
    <span>{_('(empty)')}</span>
                                )
                            )}
                        </DescriptionListDescription>
                    </DescriptionListGroup>
                    <DescriptionListGroup>
                        <DescriptionListTerm>{_('HTTP Proxy')}</DescriptionListTerm>
                        <DescriptionListDescription>
                            {model.networkServices.proxy.enabled
                                ? (
                                <>
                                    {model.networkServices.proxy.hostname && model.networkServices.proxy.port
                                        ? `${model.networkServices.proxy.hostname}:${model.networkServices.proxy.port}`
                                        : _('(incomplete configuration)')}
                                    {model.networkServices.proxy.username && (
                                        <div>{_('Username: ')} {model.networkServices.proxy.username}</div>
                                    )}
                                </>
                            )
: _('Not configured')}
                        </DescriptionListDescription>
                    </DescriptionListGroup>

                    {hasEnrollmentScripts && (
                        <>
                            {/* Enrollment Section */}
                            <DescriptionListGroup>
                                <DescriptionListTerm>
                                    <Flex alignItems={{ default: 'alignItemsCenter' }}>
                                        <FlexItem><strong>{_('Enrollment Services')}</strong></FlexItem>
                                        <FlexItem>
                                            <Button
                                                variant="link"
                                                icon={<PencilAltIcon />}
                                                onClick={() => goToStepById('wizard-step-5')}
                                                aria-label={_('Edit enrollment services')}
                                            >
                                                {_('Edit')}
                                            </Button>
                                        </FlexItem>
                                    </Flex>
                                </DescriptionListTerm>
                                <DescriptionListDescription><span /></DescriptionListDescription>
                            </DescriptionListGroup>
                            {model.enrollment.selectedServices.length === 0 ? (
                                <DescriptionListGroup>
                                    <DescriptionListTerm>{_('Selected Services')}</DescriptionListTerm>
                                    <DescriptionListDescription>
                                        {_('No services selected')}
                                    </DescriptionListDescription>
                                </DescriptionListGroup>
                            ) : (
                                model.enrollment.selectedServices.map(serviceId => {
                                    const service = config?.enrollmentServices?.find(s => s.id === serviceId);
                                    if (!service) return null;

                                    const endpoint = model.enrollment.endpoints[serviceId] || service.endpoint.url;
                                    const credentials = model.enrollment.credentials[serviceId] || {};

                                    return (
                                        <React.Fragment key={serviceId}>
                                            <DescriptionListGroup>
                                                <DescriptionListTerm>{service.name}</DescriptionListTerm>
                                                <DescriptionListDescription>
                                                    {_('Endpoint: ')} {endpoint}
                                                </DescriptionListDescription>
                                            </DescriptionListGroup>
                                            {Object.keys(credentials).length > 0 && (
                                                <DescriptionListGroup>
                                                    <DescriptionListTerm>{_('Credentials')}</DescriptionListTerm>
                                                    <DescriptionListDescription>
                                                        {Object.entries(credentials).map(([key, value]) => {
                                                            // Hide password/token fields
                                                            const isSecret = key.toLowerCase().includes('password') ||
                                                                           key.toLowerCase().includes('token') ||
                                                                           key.toLowerCase().includes('key');
                                                            const displayValue = isSecret && value
                                                                ? '•'.repeat(8)
                                                                : String(value || _('(empty)'));

                                                            return (
                                                                <div key={key}>
                                                                    <strong>{key}:</strong> {displayValue}
                                                                </div>
                                                            );
                                                        })}
                                                    </DescriptionListDescription>
                                                </DescriptionListGroup>
                                            )}
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </>
                    )}
                </DescriptionList>
            </StackItem>
        </Stack>
    );
};
