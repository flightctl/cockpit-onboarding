/*
 * This file is part of Cockpit.
 *
 * Copyright (C) 2017 Red Hat, Inc.
 *
 * Cockpit is free software; you can redistribute it and/or modify it
 * under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation; either version 2.1 of the License, or
 * (at your option) any later version.
 *
 * Cockpit is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with Cockpit; If not, see <http://www.gnu.org/licenses/>.
 */

import cockpit from 'cockpit';

import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
import { useEvent, useObject } from "hooks";

import * as service from 'service.js';
import { NetworkManagerModel, Interface } from '../pkg/lib/cockpit/networkmanager/interfaces.js';

import { EmptyStatePanel } from "cockpit-components-empty-state.jsx";
import { ModelProvider } from './model-context';
import { loadConfig } from './config-loader';
import { SystemOnboardingConfig } from './types';

import { Button } from "@patternfly/react-core/dist/esm/components/Button/index.js";
import { Page, PageSection, PageSectionTypes } from "@patternfly/react-core/dist/esm/components/Page/index.js";
import { ExclamationCircleIcon } from "@patternfly/react-icons";
import { Wizard, WizardStep } from '@patternfly/react-core';

import { HostnamePage } from './wizard/HostnamePage.tsx';
import { NetworkInterfacePage } from './wizard/NetworkInterfacePage.tsx';
import { NetworkAddressPage } from './wizard/NetworkAddressPage.tsx';
import { NetworkServicesPage } from './wizard/NetworkServicesPage.tsx';
import { EnrollmentPage } from './wizard/EnrollmentPage.tsx';
import { ReviewPage } from './wizard/ReviewPage.tsx';
import { EnrollmentProgressPage } from './wizard/EnrollmentProgressPage.tsx';

import { WithDialogs } from "dialogs.jsx";

const _ = cockpit.gettext;

// Configuration context to provide loaded configuration throughout the app
interface ConfigContextType {
    config: SystemOnboardingConfig | null;
    isConfigLoaded: boolean;
    configError: string | null;
}

const ConfigContext = createContext<ConfigContextType>({
    config: null,
    isConfigLoaded: false,
    configError: null,
});

export const useConfig = () => useContext(ConfigContext);

export const Application = () => {
    const [config, setConfig] = useState<SystemOnboardingConfig | null>(null);
    const [isConfigLoaded, setIsConfigLoaded] = useState(false);
    const [configError, setConfigError] = useState<string | null>(null);

    const nmService = useObject(() => service.proxy("NetworkManager"),
                                null,
                                []);
    useEvent(nmService, "changed");

    const networkManager = useObject(() => NetworkManagerModel(), null, []);
    useEvent(networkManager, "changed");

    const nmRunning_ref = useRef<boolean | undefined>(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useEvent(networkManager.client as any, "owner", (_event, owner) => { nmRunning_ref.current = owner !== null });

    // Load configuration on mount
    useEffect(() => {
        loadConfig()
                .then(loadedConfig => {
                    setConfig(loadedConfig);
                    setIsConfigLoaded(true);
                    console.log('Configuration loaded successfully:', loadedConfig);
                })
                .catch(error => {
                    console.error('Failed to load configuration:', error);
                    setConfigError(error.message || 'Unknown error loading configuration');
                    setIsConfigLoaded(true); // Mark as loaded even on error to show error state
                });
    }, []);

    // Show loading while configuration is being loaded
    if (!isConfigLoaded || networkManager.ready === undefined)
        return <EmptyStatePanel loading />;

    // Show error if configuration failed to load
    if (configError) {
        return (
            <div id="system-onboarding-config-error">
                <EmptyStatePanel
                    icon={ExclamationCircleIcon}
                    title={_("Configuration error")}
                    paragraph={configError}
                />
            </div>
        );
    }

    if (!nmRunning_ref.current) {
        if (nmService.enabled) {
            return (
                <div id="networking-nm-crashed">
                    <EmptyStatePanel
icon={ ExclamationCircleIcon }
                                     title={ _("NetworkManager is not running") }
                                     action={nmService.exists ? _("Start service") : null}
                                     onAction={ () => nmService.start() }
                                     secondary={
                                         <Button
component="a"
                                                 variant="secondary"
                                                 onClick={() => cockpit.jump("/system/services#/NetworkManager.service", cockpit.transport.host)}
                                         >
                                             {_("Troubleshoot…")}
                                         </Button>
                                     }
                    />
                </div>
            );
        } else if (!nmService.exists) {
            return (
                <div id="networking-nm-not-found">
                    <EmptyStatePanel
icon={ ExclamationCircleIcon }
                                     title={ _("NetworkManager is not installed") }
                    />

                </div>
            );
        } else {
            return (
                <div id="networking-nm-disabled">
                    <EmptyStatePanel
icon={ ExclamationCircleIcon }
                                     title={ _("Network devices and graphs require NetworkManager") }
                                     action={nmService.exists ? _("Enable service") : null}
                                     onAction={() => {
                                         nmService.enable();
                                         nmService.start();
                                     }}
                    />

                </div>
            );
        }
    }

    const interfaces = networkManager.list_interfaces();

    /* At this point NM is running, the model is ready, and configuration is loaded */
    return (
        <ConfigContext.Provider value={{ config, isConfigLoaded, configError }}>
            <ModelProvider networkManager={networkManager}>
                <WithDialogs key="1">
                    <SystemOnboardingWizard interfaces={interfaces} />
                </WithDialogs>
            </ModelProvider>
        </ConfigContext.Provider>
    );
};

interface SystemOnboardingWizardProps {
    interfaces: Interface[];
}

export const SystemOnboardingWizard: React.FunctionComponent<SystemOnboardingWizardProps> = ({ interfaces }) => {
    const { config } = useConfig();

    // Check if enrollment services are configured
    const hasEnrollmentServices = Boolean(config && config.enrollmentServices && config.enrollmentServices.length > 0);

    const reviewButtonText = hasEnrollmentServices ? _('Enroll') : _('Apply');
    const finalStepName = hasEnrollmentServices ? _('Apply and enroll') : _('Apply configuration');

    return (
        <Page className='no-masthead-sidebar' isContentFilled id="system-onboarding-wizard">
            <PageSection hasBodyWrapper={false} type={PageSectionTypes.wizard} padding={{ default: 'noPadding' }} aria-label="Wizard container">
                <Wizard>
                    <WizardStep name={_('Hostname')} id="wizard-step-1">
                        <HostnamePage />
                    </WizardStep>
                    <WizardStep name={_('Network interface')} id="wizard-step-2">
                        <NetworkInterfacePage interfaces={interfaces} />
                    </WizardStep>
                    <WizardStep name={_('Network address')} id="wizard-step-3">
                        <NetworkAddressPage />
                    </WizardStep>
                    <WizardStep name={_('Network services')} id="wizard-step-4">
                        <NetworkServicesPage />
                    </WizardStep>
                    {hasEnrollmentServices && (
                        <WizardStep name={_('Enrollment server')} id="wizard-step-5">
                            <EnrollmentPage />
                        </WizardStep>
                    )}
                    <WizardStep name={_('Review')} id={hasEnrollmentServices ? "wizard-step-6" : "wizard-step-5"} footer={{ nextButtonText: reviewButtonText }}>
                        <ReviewPage hasEnrollmentScripts={hasEnrollmentServices} />
                    </WizardStep>
                    <WizardStep name={finalStepName} id={hasEnrollmentServices ? "wizard-step-7" : "wizard-step-6"} footer={{ nextButtonText: _('Finish'), isBackDisabled: true }}>
                        <EnrollmentProgressPage />
                    </WizardStep>
                </Wizard>
            </PageSection>
        </Page>
    );
};
