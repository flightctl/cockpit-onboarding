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
import { NetworkManagerModel, Interface } from '../pkg/networkmanager/interfaces.js';

import { EmptyStatePanel } from "cockpit-components-empty-state.jsx";
import { ModelProvider, useModelContext } from './model-context';
import { loadConfig } from './config-loader';
import { readAttemptedMarker, AttemptedMarkerData } from './attempted-marker';
import { SystemOnboardingConfig } from './types';

import { Alert, AlertActionCloseButton } from "@patternfly/react-core/dist/esm/components/Alert/index.js";
import { Button } from "@patternfly/react-core/dist/esm/components/Button/index.js";
import { Page, PageSection, PageSectionTypes } from "@patternfly/react-core/dist/esm/components/Page/index.js";
import { ExclamationCircleIcon } from "@patternfly/react-icons";
import { Wizard, WizardStep } from "@patternfly/react-core/dist/esm/components/Wizard/index.js";

import { HostnamePage } from './wizard/HostnamePage.tsx';
import { NetworkInterfacePage } from './wizard/NetworkInterfacePage.tsx';
import { NetworkAddressPage } from './wizard/NetworkAddressPage.tsx';
import { NetworkServicesPage } from './wizard/NetworkServicesPage.tsx';
import { EnrollmentPage } from './wizard/EnrollmentPage.tsx';
import { ConnectivityTestPage } from './wizard/ConnectivityTestPage.tsx';
import { LabelsPage } from './wizard/LabelsPage.tsx';
import { ReviewPage } from './wizard/ReviewPage.tsx';
import { EnrollmentProgressPage } from './wizard/EnrollmentProgressPage.tsx';
import { MARKER_COMPLETE, SCRIPT_CLEANUP, WATCHDOG_STATUS } from './paths';
import {
    validateHostnameStep,
    validateNetworkInterfaceStep,
    validateNetworkAddressStep,
    validateNetworkServicesStep,
    validateEnrollmentStep,
    validateConnectivityTestStep,
    validateLabelsStep,
} from './wizard/step-validation';

import { WithDialogs } from "dialogs.jsx";

const _ = cockpit.gettext;

interface WatchdogStatusData {
    status: 'success' | 'app_failure' | 'network_failure';
    message: string;
    details?: {
        carrierDetected: boolean;
        dnsResolved: boolean;
        pingSucceeded: boolean;
        testedHost: string;
        activeConnections: string;
    };
}

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
    const [onboardingComplete, setOnboardingComplete] = useState(false);
    const [checkingMarker, setCheckingMarker] = useState(true);
    const [previousAttempt, setPreviousAttempt] = useState<AttemptedMarkerData | null>(null);
    const [watchdogStatus, setWatchdogStatus] = useState<WatchdogStatusData | null>(null);

    const nmService = useObject(() => service.proxy("NetworkManager"),
                                null,
                                []);
    useEvent(nmService, "changed");

    const networkManager = useObject(() => new NetworkManagerModel(), null, []);
    useEvent(networkManager, "changed");

    const nmRunning_ref = useRef<boolean | undefined>(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useEvent(networkManager.client as any, "owner", (_event, owner) => { nmRunning_ref.current = owner !== null });

    // Check for onboarding completion marker file
    useEffect(() => {
        const markerFile = cockpit.file(MARKER_COMPLETE);

        markerFile.read()
                .then(async (content) => {
                    if (content !== null) {
                        setOnboardingComplete(true);
                        console.log('Onboarding already complete (marker file exists)');
                    } else {
                        setOnboardingComplete(false);
                        console.log('Marker file does not exist - onboarding not complete');
                        const attempt = await readAttemptedMarker();
                        if (attempt) {
                            console.log('Previous attempt data found, will pre-populate wizard');
                            setPreviousAttempt(attempt);

                            try {
                                const statusContent = await cockpit.file(WATCHDOG_STATUS).read();
                                if (statusContent) {
                                    const parsed = JSON.parse(statusContent) as WatchdogStatusData;
                                    if (parsed.status === 'network_failure' || parsed.status === 'app_failure') {
                                        setWatchdogStatus(parsed);
                                    }
                                }
                            } catch {
                                // No watchdog status file or parse error — not a rollback scenario
                            }
                        }
                    }
                })
                .catch((error) => {
                    console.log('Error checking marker file:', error);
                    setOnboardingComplete(false);
                })
                .finally(() => {
                    setCheckingMarker(false);
                    markerFile.close();
                });
    }, []);

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

    // Show loading while checking marker file or loading configuration
    if (checkingMarker || !isConfigLoaded || networkManager.ready === undefined)
        return <EmptyStatePanel loading />;

    // Show message if onboarding is already complete
    if (onboardingComplete) {
        return (
            <div id="system-onboarding-already-complete">
                <EmptyStatePanel
                    title={_("Onboarding complete")}
                    paragraph={_("System onboarding has already been completed on this device.")}
                />
            </div>
        );
    }

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
            <ModelProvider networkManager={networkManager} config={config} previousAttempt={previousAttempt}>
                <WithDialogs key="1">
                    <SystemOnboardingWizardWrapper interfaces={interfaces} previousAttempt={previousAttempt} watchdogStatus={watchdogStatus} />
                </WithDialogs>
            </ModelProvider>
        </ConfigContext.Provider>
    );
};

// Wrapper to wait for model initialization before showing wizard
const SystemOnboardingWizardWrapper: React.FunctionComponent<{ interfaces: Interface[]; previousAttempt?: AttemptedMarkerData | null; watchdogStatus?: WatchdogStatusData | null }> = ({ interfaces, previousAttempt, watchdogStatus }) => {
    const { isInitialized } = useModelContext();

    if (!isInitialized) {
        return <EmptyStatePanel loading />;
    }

    return <SystemOnboardingWizard interfaces={interfaces} previousAttempt={previousAttempt} watchdogStatus={watchdogStatus} />;
};

interface SystemOnboardingWizardProps {
    interfaces: Interface[];
    previousAttempt?: AttemptedMarkerData | null | undefined;
    watchdogStatus?: WatchdogStatusData | null | undefined;
}

export const SystemOnboardingWizard: React.FunctionComponent<SystemOnboardingWizardProps> = ({ interfaces, previousAttempt, watchdogStatus }) => {
    const { config } = useConfig();
    const { model, cancelEnrollmentRef } = useModelContext();
    const [currentStepIndex, setCurrentStepIndex] = useState(1);
    const [maxReachedStep, setMaxReachedStep] = useState(1);
    const [showRestoredAlert, setShowRestoredAlert] = useState(Boolean(previousAttempt));

    // Check if enrollment services are configured (controls whether step 5 is shown)
    const hasEnrollmentServices = Boolean(config && config.enrollmentServices && config.enrollmentServices.length > 0);
    // Check if the user actually selected any enrollment services
    const hasSelectedEnrollments = hasEnrollmentServices && model.enrollment.selectedServices.length > 0;
    const reviewButtonText = hasSelectedEnrollments ? _("Enroll") : _("Apply");
    const finalStepName = hasSelectedEnrollments ? _("Apply and enroll") : _("Apply configuration");

    // Compute validation state for each step
    const isHostnameValid = validateHostnameStep(model);
    const isNetworkInterfaceValid = validateNetworkInterfaceStep(model);
    const isNetworkAddressValid = validateNetworkAddressStep(model);
    const isNetworkServicesValid = validateNetworkServicesStep(model);
    const isEnrollmentValid = validateEnrollmentStep(model, config?.enrollmentServices);
    const isConnectivityTestValid = validateConnectivityTestStep(model);
    const isLabelsValid = validateLabelsStep(model);

    // Map step index to validation state
    const stepValidations = [
        isHostnameValid, // step 1
        isNetworkInterfaceValid, // step 2
        isNetworkAddressValid, // step 3
        isNetworkServicesValid, // step 4
        isEnrollmentValid, // step 5 (if enrollment enabled)
        isConnectivityTestValid, // step 6 (connectivity test)
        isLabelsValid, // step 7 (labels)
        true, // review step - always valid
        true, // progress step - always valid
    ];

    // Handle step navigation - using PatternFly Wizard's correct signature
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
    const handleStepChange = (_event: any, currentStep: any, _prevStep: any) => {
        const stepId = typeof currentStep.id === 'string' ? currentStep.id : '';
        const stepNumber = parseInt(stepId.split('-').pop() || '1', 10);

        setCurrentStepIndex(stepNumber);

        // Update max reached step if user progresses forward with valid data
        if (stepNumber > maxReachedStep && stepValidations[currentStepIndex - 1]) {
            setMaxReachedStep(stepNumber);
        }
    };

    // Determine which steps should be disabled
    // Users can only navigate to steps they've reached or the next step if current is valid
    const canNavigateToStep = (stepNumber: number): boolean => {
        // Can always go to steps we've already reached
        if (stepNumber <= maxReachedStep) {
            return false; // not disabled
        }

        // Can go to the next step only if current step is valid
        if (stepNumber === maxReachedStep + 1 && stepValidations[maxReachedStep - 1]) {
            return false; // not disabled
        }

        // Cannot skip ahead
        return true; // disabled
    };

    // Dynamic footer configuration for EnrollmentProgressPage
    const enrollmentExecutionState = model.enrollmentProgress.executionState;
    const getProgressPageFooter = () => {
        if (enrollmentExecutionState === 'running') {
            // While running: disable Back, enable Next as "Cancel"
            return {
                isBackDisabled: true,
                isNextDisabled: false,
                nextButtonText: _("Cancel"),
                onNext: () => {
                    if (cancelEnrollmentRef.current) {
                        cancelEnrollmentRef.current();
                    }
                },
                isCancelHidden: true
            };
        } else if (enrollmentExecutionState === 'success') {
            // On success: navigate to completion page immediately, then run cleanup
            // after a short delay. Cleanup tears down the WiFi AP, so we must show
            // the user feedback first before the connection drops.
            const wantReboot = config?.autoReboot === true;
            const runCleanup = () =>
                cockpit.spawn(['sudo', SCRIPT_CLEANUP], { err: 'message' })
                        .catch(error => console.warn('Cleanup failed:', error));
            const handleFinish = () => {
                // Marker file is already written — reload shows the "Onboarding complete" page
                window.location.reload();
                // Fire cleanup after a delay so the page has time to render
                setTimeout(() => runCleanup(), 2000);
            };
            const handleFinishAndReboot = () => {
                // Reboot triggers systemd ExecStop which runs cleanup automatically
                cockpit.spawn(['sudo', 'shutdown', '-r', 'now'], { err: 'message' })
                        .catch(error => console.error('Failed to trigger reboot:', error));
            };
            return {
                isBackDisabled: true,
                isNextDisabled: false,
                nextButtonText: wantReboot ? _("Finish & Reboot") : _("Finish"),
                onNext: wantReboot ? handleFinishAndReboot : handleFinish,
                isCancelHidden: true
            };
        } else if (enrollmentExecutionState === 'failed') {
            // On failure: enable Back, disable Next
            return {
                isBackDisabled: false,
                isNextDisabled: true,
                nextButtonText: _("Finish"),
                isCancelHidden: true
            };
        } else {
            // Default/idle state
            return {
                isBackDisabled: true,
                nextButtonText: _("Finish"),
                isCancelHidden: true
            };
        }
    };

    return (
        <Page className='no-masthead-sidebar' isContentFilled id="system-onboarding-wizard">
            {showRestoredAlert && (
                <PageSection>
                    <Alert
                        variant={watchdogStatus?.status === 'network_failure' ? "warning" : "info"}
                        title={watchdogStatus?.status === 'network_failure'
                            ? _("Network configuration rolled back")
                            : watchdogStatus?.status === 'app_failure'
                                ? _("Enrollment did not complete")
                                : _("Previous configuration restored")}
                        isInline
                        actionClose={<AlertActionCloseButton onClose={() => setShowRestoredAlert(false)} />}
                    >
                        {watchdogStatus?.status === 'network_failure'
                            ? _("The watchdog timer rolled back your configuration because network connectivity could not be established.") +
                              (watchdogStatus.details
                                  ? ` ${!watchdogStatus.details.carrierDetected
                                      ? _("No network carrier was detected on any interface.")
                                      : !watchdogStatus.details.dnsResolved
                                          ? cockpit.format(_("DNS resolution failed for $0."), watchdogStatus.details.testedHost)
                                          : _("Network connectivity check failed.")}`
                                  : '') +
                              ' ' + _("Review and modify the settings as needed before re-applying.")
                            : watchdogStatus?.status === 'app_failure'
                                ? _("Network connectivity is working, but enrollment did not complete. You can retry without changing network settings.")
                                : _("Your previous onboarding configuration has been restored. Review and modify the settings as needed before re-applying.")}
                    </Alert>
                </PageSection>
            )}
            <PageSection hasBodyWrapper={false} type={PageSectionTypes.wizard} padding={{ default: 'noPadding' }} aria-label="Wizard container">
                <Wizard onStepChange={handleStepChange}>
                    <WizardStep
                        name={_("Hostname")}
                        id="wizard-step-1"
                        footer={{ isNextDisabled: !isHostnameValid, isCancelHidden: true }}
                        isDisabled={canNavigateToStep(1)}
                    >
                        <HostnamePage />
                    </WizardStep>
                    <WizardStep
                        name={_("Network interface")}
                        id="wizard-step-2"
                        footer={{ isNextDisabled: !isNetworkInterfaceValid, isCancelHidden: true }}
                        isDisabled={canNavigateToStep(2)}
                    >
                        <NetworkInterfacePage interfaces={interfaces} />
                    </WizardStep>
                    <WizardStep
                        name={_("Network address")}
                        id="wizard-step-3"
                        footer={{ isNextDisabled: !isNetworkAddressValid, isCancelHidden: true }}
                        isDisabled={canNavigateToStep(3)}
                    >
                        <NetworkAddressPage />
                    </WizardStep>
                    <WizardStep
                        name={_("Network services")}
                        id="wizard-step-4"
                        footer={{ isNextDisabled: !isNetworkServicesValid, isCancelHidden: true }}
                        isDisabled={canNavigateToStep(4)}
                    >
                        <NetworkServicesPage />
                    </WizardStep>
                    {hasEnrollmentServices && (
                        <WizardStep
                            name={_("Enrollment server")}
                            id="wizard-step-5"
                            footer={{ isNextDisabled: !isEnrollmentValid, isCancelHidden: true }}
                            isDisabled={canNavigateToStep(5)}
                        >
                            <EnrollmentPage />
                        </WizardStep>
                    )}
                    <WizardStep
                        name={_("Connectivity test")}
                        id={hasEnrollmentServices ? "wizard-step-6" : "wizard-step-5"}
                        footer={{ isNextDisabled: !isConnectivityTestValid, isCancelHidden: true }}
                        isDisabled={canNavigateToStep(hasEnrollmentServices ? 6 : 5)}
                    >
                        <ConnectivityTestPage />
                    </WizardStep>
                    <WizardStep
                        name={_("Device labels")}
                        id={hasEnrollmentServices ? "wizard-step-7" : "wizard-step-6"}
                        footer={{ isNextDisabled: !isLabelsValid, isCancelHidden: true }}
                        isDisabled={canNavigateToStep(hasEnrollmentServices ? 7 : 6)}
                    >
                        <LabelsPage />
                    </WizardStep>
                    <WizardStep
                        name={_("Review")}
                        id={(() => {
                            let n = 7;
                            if (hasEnrollmentServices) n++;
                            return `wizard-step-${n}`;
                        })()}
                        footer={{ nextButtonText: reviewButtonText, isCancelHidden: true }}
                        isDisabled={canNavigateToStep((() => {
                            let n = 7;
                            if (hasEnrollmentServices) n++;
                            return n;
                        })())}
                    >
                        <ReviewPage hasEnrollmentScripts={hasEnrollmentServices} />
                    </WizardStep>
                    <WizardStep
                        name={finalStepName}
                        id={(() => {
                            let n = 8;
                            if (hasEnrollmentServices) n++;
                            return `wizard-step-${n}`;
                        })()}
                        footer={getProgressPageFooter()}
                        isDisabled={canNavigateToStep((() => {
                            let n = 8;
                            if (hasEnrollmentServices) n++;
                            return n;
                        })())}
                    >
                        <EnrollmentProgressPage />
                    </WizardStep>
                </Wizard>
            </PageSection>
        </Page>
    );
};
