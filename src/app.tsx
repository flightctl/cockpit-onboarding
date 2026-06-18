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

import React, { useState, useEffect, useRef, createContext, useContext } from "react";
import { ExclamationCircleIcon } from "@patternfly/react-icons";
import { Button, ButtonVariant } from "@patternfly/react-core/dist/esm/components/Button/index.js";
import { ActionList, ActionListGroup, ActionListItem } from "@patternfly/react-core/dist/esm/components/ActionList/index.js";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@patternfly/react-core/dist/esm/components/Modal/index.js";
import { Page, PageSection, PageSectionTypes } from "@patternfly/react-core/dist/esm/components/Page/index.js";
import { Wizard, WizardBasicStep, WizardFooterWrapper, WizardStep } from "@patternfly/react-core/dist/esm/components/Wizard/index.js";

import cockpit from "cockpit";
import * as service from "service.js";
import { EmptyStatePanel } from "cockpit-components-empty-state.jsx";
import { useEvent, useObject } from "hooks";
import { WithDialogs } from "dialogs.jsx";

import { NetworkManagerModel, Interface } from "../pkg/networkmanager/interfaces.js";

import { ModelProvider, useModelContext } from "./model-context";
import { loadConfig } from "./config-loader";
import { readAttemptedMarker, AttemptedMarkerData } from "./attempted-marker";
import { SystemOnboardingConfig } from "./types";

import { HostnamePage } from "./wizard/HostnamePage.tsx";
import { NetworkPage } from "./wizard/NetworkPage.tsx";
import { EnrollmentPage } from "./wizard/EnrollmentPage.tsx";
import { ConnectivityTestPage } from "./wizard/ConnectivityTestPage.tsx";
import { LabelsPage } from "./wizard/LabelsPage.tsx";
import { ReviewPage } from "./wizard/ReviewPage.tsx";
import { EnrollmentProgressPage } from "./wizard/EnrollmentProgressPage.tsx";
import RestoredConfigurationSection, { WatchdogStatusData } from "./wizard/RestoredConfigurationSection.tsx";
import {
    stepIds, WIZARD_STEP_IDS, type WizardStepId,
    validateHostnameStep,
    validateNetworkStep,
    validateEnrollmentStep,
    validateConnectivityTestStep,
    validateLabelsStep,
} from "./wizard/WizardSteps.ts";

import { MARKER_COMPLETE, SCRIPT_CLEANUP, WATCHDOG_STATUS } from "./paths";


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
    const [onboardingComplete, setOnboardingComplete] = useState(false);
    const [checkingMarker, setCheckingMarker] = useState(true);
    const [previousAttempt, setPreviousAttempt] = useState<AttemptedMarkerData | null>(null);
    const [watchdogStatus, setWatchdogStatus] = useState<WatchdogStatusData | null>(null);

    const nmService = useObject(() => service.proxy("NetworkManager"), null, []);
    useEvent(nmService, "changed");

    const networkManager = useObject(() => new NetworkManagerModel(), null, []);
    useEvent(networkManager, "changed");

    const nmRunning_ref = useRef<boolean | undefined>(undefined);
    useEvent(networkManager.client, "owner", (_event, owner) => {
        nmRunning_ref.current = owner !== null;
    });

    // Check for onboarding completion marker file
    useEffect(() => {
        const markerFile = cockpit.file(MARKER_COMPLETE);

        markerFile
            .read()
            .then(async (content) => {
                if (content !== null) {
                    setOnboardingComplete(true);
                    console.log("Onboarding already complete (marker file exists)");
                } else {
                    setOnboardingComplete(false);
                    console.log("Marker file does not exist - onboarding not complete");
                    const attempt = await readAttemptedMarker();
                    if (attempt) {
                        console.log("Previous attempt data found, will pre-populate wizard");
                        setPreviousAttempt(attempt);

                        try {
                            const statusContent = await cockpit.file(WATCHDOG_STATUS).read();
                            if (statusContent) {
                                const parsed = JSON.parse(statusContent) as WatchdogStatusData;
                                if (parsed.status === "network_failure" || parsed.status === "app_failure") {
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
                console.log("Error checking marker file:", error);
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
            .then((loadedConfig) => {
                setConfig(loadedConfig);
                setIsConfigLoaded(true);
                console.log("Configuration loaded successfully:", loadedConfig);
            })
            .catch((error) => {
                console.error("Failed to load configuration:", error);
                setConfigError(error.message || "Unknown error loading configuration");
                setIsConfigLoaded(true); // Mark as loaded even on error to show error state
            });
    }, []);

    // Show loading while checking marker file or loading configuration
    if (checkingMarker || !isConfigLoaded || networkManager.ready === undefined) {
        return <EmptyStatePanel loading />;
    }

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
                        icon={ExclamationCircleIcon}
                        title={_("NetworkManager is not running")}
                        action={nmService.exists ? _("Start service") : null}
                        onAction={() => nmService.start()}
                        secondary={
                            <Button
                                component="a"
                                variant="secondary"
                                onClick={() =>
                                    cockpit.jump("/system/services#/NetworkManager.service", cockpit.transport.host)
                                }
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
                    <EmptyStatePanel icon={ExclamationCircleIcon} title={_("NetworkManager is not installed")} />
                </div>
            );
        } else {
            return (
                <div id="networking-nm-disabled">
                    <EmptyStatePanel
                        icon={ExclamationCircleIcon}
                        title={_("Network devices and graphs require NetworkManager")}
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
                    <SystemOnboardingWizardWrapper
                        interfaces={interfaces}
                        hasPreviousAttempt={Boolean(previousAttempt)}
                        watchdogStatus={watchdogStatus}
                    />
                </WithDialogs>
            </ModelProvider>
        </ConfigContext.Provider>
    );
};

// Wrapper to wait for model initialization before showing wizard
const SystemOnboardingWizardWrapper: React.FunctionComponent<{
    interfaces: Interface[];
    hasPreviousAttempt: boolean;
    watchdogStatus?: WatchdogStatusData | null;
}> = ({ interfaces, hasPreviousAttempt, watchdogStatus }) => {
    const { isInitialized } = useModelContext();

    if (!isInitialized) {
        return <EmptyStatePanel loading />;
    }

    return (
        <SystemOnboardingWizard
            interfaces={interfaces}
            hasPreviousAttempt={hasPreviousAttempt}
            watchdogStatus={watchdogStatus}
        />
    );
};

interface SystemOnboardingWizardProps {
    interfaces: Interface[];
    hasPreviousAttempt?: boolean;
    watchdogStatus?: WatchdogStatusData | null | undefined;
}

export const SystemOnboardingWizard: React.FunctionComponent<SystemOnboardingWizardProps> = ({
    interfaces,
    hasPreviousAttempt,
    watchdogStatus,
}) => {
    const { config } = useConfig();
    const { model, cancelEnrollmentRef } = useModelContext();
    const [maxReachedStep, setMaxReachedStep] = useState<WizardStepId>(WIZARD_STEP_IDS.network);
    const [showRestoredConfigurationSection, setShowRestoredConfigurationSection] = useState(hasPreviousAttempt);
    const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);

    // Check if enrollment services are configured (controls whether enrollment step is shown)
    const hasEnrollmentServices = Boolean(config && config.enrollmentServices && config.enrollmentServices.length > 0);
    // Check if the user actually selected any enrollment services
    const hasSelectedEnrollments = hasEnrollmentServices && model.enrollment.selectedServices.length > 0;
    const reviewButtonText = hasSelectedEnrollments ? _("Enroll") : _("Apply");
    const finalStepName = hasSelectedEnrollments ? _("Apply and enroll") : _("Apply configuration");

    // Compute validation state for each step
    const isHostnameStepValid = validateHostnameStep(model);
    const isNetworkStepValid = validateNetworkStep(model);
    const isEnrollmentStepValid = validateEnrollmentStep(model, config?.enrollmentServices);
    const isConnectivityTestStepValid = validateConnectivityTestStep(model);
    const isLabelsStepValid = validateLabelsStep(model);

    // Map step index to validation state
    const stepValidations = [
        isNetworkStepValid,
        isEnrollmentStepValid,
        isConnectivityTestStepValid,
        isHostnameStepValid,
        isLabelsStepValid,
        true,
        true,
    ];

    const visibleStepIds: readonly WizardStepId[] = hasEnrollmentServices
        ? stepIds
        : stepIds.filter((id) => id !== WIZARD_STEP_IDS.enrollment);

    const getStepValidation = (stepId: WizardStepId): boolean => {
        const index = stepIds.indexOf(stepId);
        return index >= 0 ? stepValidations[index] : false;
    };

    // Handle step navigation - using PatternFly Wizard's correct signature
    const handleStepChange = (_event: React.MouseEvent<HTMLButtonElement>, currentStep: WizardBasicStep) => {
        const stepId = currentStep.id.toString() as WizardStepId;
        const stepIndex = visibleStepIds.indexOf(stepId);
        const maxReachIndex = visibleStepIds.indexOf(maxReachedStep);

        // Update max reached step if user progresses forward with valid data
        if (stepIndex > maxReachIndex && getStepValidation(visibleStepIds[maxReachIndex])) {
            setMaxReachedStep(stepId);
        }
    };

    // Users can only navigate to steps they've reached or the next step if current is valid
    const isStepDisabled = (stepId: WizardStepId): boolean => {
        const stepIndex = visibleStepIds.indexOf(stepId);
        const maxReachIndex = visibleStepIds.indexOf(maxReachedStep);

        if (stepIndex === -1) {
            return true;
        }

        // Users can go back to a step that has already been reached
        if (stepIndex <= maxReachIndex) {
            return false;
        }

        // Users can proceed to the next step only if the furthest reached step is valid
        if (stepIndex === maxReachIndex + 1 && getStepValidation(visibleStepIds[maxReachIndex])) {
            return false;
        }

        // Cannot skip ahead past an invalid step
        return true;
    };

    // Dynamic footer configuration for EnrollmentProgressPage
    const enrollmentExecutionState = model.enrollmentProgress.executionState;

    useEffect(() => {
        if (enrollmentExecutionState !== "running") {
            setIsCancelConfirmOpen(false);
        }
    }, [enrollmentExecutionState]);

    const confirmApplyCancel = () => {
        setIsCancelConfirmOpen(false);
        if (cancelEnrollmentRef.current) {
            cancelEnrollmentRef.current();
        }
    };

    const getProgressPageFooter = () => {
        if (enrollmentExecutionState === "running") {
            // While running: disable Back, show a danger Cancel button that asks for confirmation
            return (
                <WizardFooterWrapper>
                    <ActionList>
                        <ActionListGroup>
                            <ActionListItem>
                                <Button variant={ButtonVariant.secondary} isDisabled>
                                    {_("Back")}
                                </Button>
                            </ActionListItem>
                            <ActionListItem>
                                <Button variant={ButtonVariant.danger} onClick={() => setIsCancelConfirmOpen(true)}>
                                    {_("Cancel")}
                                </Button>
                            </ActionListItem>
                        </ActionListGroup>
                    </ActionList>
                </WizardFooterWrapper>
            );
        } else if (enrollmentExecutionState === "success") {
            // On success: navigate to completion page immediately, then run cleanup
            // after a short delay. Cleanup tears down the WiFi AP, so we must show
            // the user feedback first before the connection drops.
            const wantReboot = config?.autoReboot === true;
            const runCleanup = () =>
                cockpit
                    .spawn(["sudo", SCRIPT_CLEANUP], { err: "message" })
                    .catch((error) => console.warn("Cleanup failed:", error));
            const handleFinish = () => {
                // Marker file is already written — reload shows the "Onboarding complete" page
                window.location.reload();
                // Fire cleanup after a delay so the page has time to render
                setTimeout(() => runCleanup(), 2000);
            };
            const handleFinishAndReboot = () => {
                // Reboot triggers systemd ExecStop which runs cleanup automatically
                cockpit
                    .spawn(["sudo", "shutdown", "-r", "now"], { err: "message" })
                    .catch((error) => console.error("Failed to trigger reboot:", error));
            };
            return {
                isBackDisabled: true,
                isNextDisabled: false,
                nextButtonText: wantReboot ? _("Finish & Reboot") : _("Finish"),
                onNext: wantReboot ? handleFinishAndReboot : handleFinish,
                isCancelHidden: true,
            };
        } else if (enrollmentExecutionState === "failed") {
            // On failure: enable Back, disable Next
            return {
                isBackDisabled: false,
                isNextDisabled: true,
                nextButtonText: _("Finish"),
                isCancelHidden: true,
            };
        } else {
            // Default/idle state
            return {
                isBackDisabled: true,
                nextButtonText: _("Finish"),
                isCancelHidden: true,
            };
        }
    };

    return (
        <Page className="no-masthead-sidebar" isContentFilled id="system-onboarding-wizard">
            {showRestoredConfigurationSection && (
                <RestoredConfigurationSection
                    onDismiss={() => setShowRestoredConfigurationSection(false)}
                    watchdogStatus={watchdogStatus}
                />
            )}
            <PageSection
                hasBodyWrapper={false}
                type={PageSectionTypes.wizard}
                padding={{ default: "noPadding" }}
                aria-label="Wizard container"
            >
                <Wizard onStepChange={handleStepChange}>
                    <WizardStep
                        name={_("Network")}
                        id={WIZARD_STEP_IDS.network}
                        footer={{ isNextDisabled: !isNetworkStepValid, isCancelHidden: true }}
                    >
                        <NetworkPage interfaces={interfaces} />
                    </WizardStep>
                    {hasEnrollmentServices && (
                        <WizardStep
                            name={_("Enrollment server")}
                            id={WIZARD_STEP_IDS.enrollment}
                            footer={{ isNextDisabled: !isEnrollmentStepValid, isCancelHidden: true }}
                            isDisabled={isStepDisabled(WIZARD_STEP_IDS.enrollment)}
                        >
                            <EnrollmentPage />
                        </WizardStep>
                    )}
                    <WizardStep
                        name={_("Connectivity test")}
                        id={WIZARD_STEP_IDS.connectivityTest}
                        footer={{ isNextDisabled: !isConnectivityTestStepValid, isCancelHidden: true }}
                        isDisabled={isStepDisabled(WIZARD_STEP_IDS.connectivityTest)}
                    >
                        <ConnectivityTestPage />
                    </WizardStep>
                    <WizardStep
                        name={_("Hostname")}
                        id={WIZARD_STEP_IDS.hostname}
                        footer={{ isNextDisabled: !isHostnameStepValid, isCancelHidden: true }}
                        isDisabled={isStepDisabled(WIZARD_STEP_IDS.hostname)}
                    >
                        <HostnamePage />
                    </WizardStep>
                    <WizardStep
                        name={_("Device labels")}
                        id={WIZARD_STEP_IDS.labels}
                        footer={{ isNextDisabled: !isLabelsStepValid, isCancelHidden: true }}
                        isDisabled={isStepDisabled(WIZARD_STEP_IDS.labels)}
                    >
                        <LabelsPage />
                    </WizardStep>
                    <WizardStep
                        name={_("Review")}
                        id={WIZARD_STEP_IDS.review}
                        footer={{ nextButtonText: reviewButtonText, isCancelHidden: true }}
                        isDisabled={isStepDisabled(WIZARD_STEP_IDS.review)}
                    >
                        <ReviewPage hasEnrollmentScripts={hasEnrollmentServices} />
                    </WizardStep>
                    <WizardStep
                        name={finalStepName}
                        id={WIZARD_STEP_IDS.progress}
                        footer={getProgressPageFooter()}
                        isDisabled={isStepDisabled(WIZARD_STEP_IDS.progress)}
                    >
                        <EnrollmentProgressPage />
                    </WizardStep>
                </Wizard>
            </PageSection>
            <Modal
                isOpen={isCancelConfirmOpen}
                onClose={() => setIsCancelConfirmOpen(false)}
                variant="small"
                aria-labelledby="cancel-apply-title"
                aria-describedby="cancel-apply-body"
            >
                <ModalHeader
                    title={_("Cancel applying changes?")}
                    titleIconVariant="warning"
                    labelId="cancel-apply-title"
                />
                <ModalBody id="cancel-apply-body">
                    {_(
                        "Applying changes is in progress. Cancelling will stop the process and roll back network changes."
                    )}
                </ModalBody>
                <ModalFooter>
                    <Button key="confirm" variant={ButtonVariant.danger} onClick={confirmApplyCancel}>
                        {_("Cancel applying changes")}
                    </Button>
                    <Button key="back" variant={ButtonVariant.link} onClick={() => setIsCancelConfirmOpen(false)}>
                        {_("Keep applying")}
                    </Button>
                </ModalFooter>
            </Modal>
        </Page>
    );
};
