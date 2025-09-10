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

import React from 'react';
import { useRef } from 'react';
import { useEvent, useObject } from "hooks";

import * as service from 'service.js';
import { NetworkManagerModel, Interface } from './interfaces.js';

import { EmptyStatePanel } from "cockpit-components-empty-state.jsx";
import { ModelProvider } from './model-context';

import { Button } from "@patternfly/react-core/dist/esm/components/Button/index.js";
import { Page, PageSection, PageSectionTypes } from "@patternfly/react-core/dist/esm/components/Page/index.js";
import { ExclamationCircleIcon } from "@patternfly/react-icons";
import { Flex } from "@patternfly/react-core/dist/esm/layouts/Flex/index.js";
import { Wizard, WizardStep } from '@patternfly/react-core';

import { HostnamePage } from './wizard/HostnamePage.tsx';
import { NetworkInterfacePage } from './wizard/NetworkInterfacePage.tsx';
import { NetworkAddressPage } from './wizard/NetworkAddressPage.tsx';
import { NetworkServicesPage } from './wizard/NetworkServicesPage.tsx';
import { EnrollmentPage } from './wizard/EnrollmentPage.tsx';
import { ReviewPage } from './wizard/ReviewPage.tsx';

import { WithDialogs } from "dialogs.jsx";

const _ = cockpit.gettext;

export const Application = () => {
    const nmService = useObject(() => service.proxy("NetworkManager"),
                                null,
                                []);
    useEvent(nmService, "changed");

    const networkManager = useObject(() => new NetworkManagerModel(), null, []);
    useEvent(networkManager, "changed");

    const nmRunning_ref = useRef(undefined);
    useEvent(networkManager.client, "owner", (event, owner) => { nmRunning_ref.current = owner !== null });

    if (networkManager.ready === undefined)
        return <EmptyStatePanel loading />;

    if (!nmRunning_ref.current) {
        if (nmService.enabled) {
            return (
                <div id="networking-nm-crashed">
                    <EmptyStatePanel icon={ ExclamationCircleIcon }
                                     title={ _("NetworkManager is not running") }
                                     action={nmService.exists ? _("Start service") : null}
                                     onAction={ nmService.start }
                                     secondary={
                                         <Button component="a"
                                                 variant="secondary"
                                                 onClick={() => cockpit.jump("/system/services#/NetworkManager.service", cockpit.transport.host)}>
                                             {_("Troubleshoot…")}
                                         </Button>
                                     } />
                </div>
            );
        } else if (!nmService.exists) {
            return (
                <div id="networking-nm-not-found">
                    <EmptyStatePanel icon={ ExclamationCircleIcon }
                                     title={ _("NetworkManager is not installed") } />

                </div>
            );
        } else {
            return (
                <div id="networking-nm-disabled">
                    <EmptyStatePanel icon={ ExclamationCircleIcon }
                                     title={ _("Network devices and graphs require NetworkManager") }
                                     action={nmService.exists ? _("Enable service") : null}
                                     onAction={() => {
                                         nmService.enable();
                                         nmService.start();
                                     }} />

                </div>
            );
        }
    }

    const interfaces = networkManager.list_interfaces();

    /* At this point NM is running and the model is ready */
    return (
        <ModelProvider networkManager={networkManager}>
            <WithDialogs key="1">
                <SystemOnboardingWizard operationInProgress={networkManager.operationInProgress} interfaces={interfaces} />
            </WithDialogs>
        </ModelProvider>
    );
};

interface SystemOnboardingWizardProps {
    operationInProgress?: boolean;
    interfaces: Interface[];
}

export const SystemOnboardingWizard: React.FunctionComponent<SystemOnboardingWizardProps> = ({ operationInProgress, interfaces }) => {
    return (
        <Page className='no-masthead-sidebar'>
            <PageSection hasBodyWrapper={false} padding={{ default: "padding" }}>
                <Flex alignItems={{ default: 'alignItemsCenter' }}>
                    <h2>System onboarding wizard</h2>
                </Flex>
            </PageSection>        
            <PageSection hasBodyWrapper={false} type={PageSectionTypes.wizard} aria-label="Wizard container">
                <Wizard>
                    <WizardStep name="Hostname" id="wizard-step-1">
                        <HostnamePage />
                    </WizardStep>
                    <WizardStep name="Network interface" id="wizard-step-2">
                        <NetworkInterfacePage operationInProgress={operationInProgress} interfaces={interfaces} />
                    </WizardStep>
                    <WizardStep name="Network address" id="wizard-step-3">
                        <NetworkAddressPage />
                    </WizardStep>
                    <WizardStep name="Network services" id="wizard-step-4">
                        <NetworkServicesPage />
                    </WizardStep>
                    <WizardStep name="Enrollment server" id="wizard-step-5">
                        <EnrollmentPage />
                    </WizardStep>
                    <WizardStep name="Review and enroll" id="wizard-step-6" footer={{ nextButtonText: 'Enroll' }}>
                        <ReviewPage />
                    </WizardStep>
                </Wizard>
            </PageSection>
        </Page>
    );
};
