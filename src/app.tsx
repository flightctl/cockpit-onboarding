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

import React, { useState, useEffect, useRef } from 'react';
import { useEvent, useObject } from "hooks";

import * as service from 'service.js';
import { NetworkManagerModel, Interface } from '../pkg/lib/cockpit/networkmanager/interfaces.js';

import { EmptyStatePanel } from "cockpit-components-empty-state.jsx";
import { ModelProvider } from './model-context';

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

export const Application = () => {
    const nmService = useObject(() => service.proxy("NetworkManager"),
                                null,
                                []);
    useEvent(nmService, "changed");

    const networkManager = useObject(() => NetworkManagerModel(), null, []);
    useEvent(networkManager, "changed");

    const nmRunning_ref = useRef<boolean | undefined>(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useEvent(networkManager.client as any, "owner", (_event, owner) => { nmRunning_ref.current = owner !== null });

    if (networkManager.ready === undefined)
        return <EmptyStatePanel loading />;

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

    /* At this point NM is running and the model is ready */
    return (
        <ModelProvider networkManager={networkManager}>
            <WithDialogs key="1">
                <SystemOnboardingWizard interfaces={interfaces} />
            </WithDialogs>
        </ModelProvider>
    );
};

interface SystemOnboardingWizardProps {
    interfaces: Interface[];
}

const checkEnrollmentScripts = async (): Promise<boolean> => {
    try {
        // Use shell to expand $HOME environment variable
        const proc = cockpit.spawn(['sh', '-c', 'find "$HOME/.config/cockpit/system-onboarding.d/" -name "*.sh" -type f -executable 2>/dev/null || true']);
        const output = await proc;
        const scripts = output.trim().split('\n')
.filter(line => line.length > 0);
        return scripts.length > 0;
    } catch {
        console.log('No enrollment scripts found or directory does not exist');
        return false;
    }
};

export const SystemOnboardingWizard: React.FunctionComponent<SystemOnboardingWizardProps> = ({ interfaces }) => {
    const [hasEnrollmentScripts, setHasEnrollmentScripts] = useState<boolean | null>(null);

    useEffect(() => {
        checkEnrollmentScripts().then(setHasEnrollmentScripts);
    }, []);

    // Show loading while checking for scripts
    if (hasEnrollmentScripts === null) {
        return <EmptyStatePanel loading />;
    }

    const reviewButtonText = hasEnrollmentScripts ? _('Enroll') : _('Apply');
    const finalStepName = hasEnrollmentScripts ? _('Apply and enroll') : _('Apply configuration');

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
                    {hasEnrollmentScripts && (
                        <WizardStep name={_('Enrollment server')} id="wizard-step-5">
                            <EnrollmentPage />
                        </WizardStep>
                    )}
                    <WizardStep name={_('Review')} id={hasEnrollmentScripts ? "wizard-step-6" : "wizard-step-5"} footer={{ nextButtonText: reviewButtonText }}>
                        <ReviewPage hasEnrollmentScripts={hasEnrollmentScripts} />
                    </WizardStep>
                    <WizardStep name={finalStepName} id={hasEnrollmentScripts ? "wizard-step-7" : "wizard-step-6"} footer={{ nextButtonText: _('Finish'), isBackDisabled: true }}>
                        <EnrollmentProgressPage />
                    </WizardStep>
                </Wizard>
            </PageSection>
        </Page>
    );
};
