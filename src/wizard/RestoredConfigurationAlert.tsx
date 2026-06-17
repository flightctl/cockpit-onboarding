import React, { useState } from "react";
import { Alert, AlertActionCloseButton, AlertVariant, PageSection } from "@patternfly/react-core";

import cockpit from "cockpit";

const _ = cockpit.gettext;

export interface WatchdogStatusData {
    status: "success" | "app_failure" | "network_failure";
    message: string;
    details?: {
        carrierDetected: boolean;
        dnsResolved: boolean;
        pingSucceeded: boolean;
        testedHost: string;
        activeConnections: string;
    };
}

interface RestoredConfigurationAlertProps {
    hasPreviousAttempt: boolean;
    watchdogStatus?: WatchdogStatusData | null | undefined;
}

function getNetworkFailureDetail(details: WatchdogStatusData["details"]): string {
    if (!details) {
        return "";
    }
    if (!details.carrierDetected) {
        return _("No network carrier was detected on any interface.");
    }
    if (!details.dnsResolved) {
        return cockpit.format(_("DNS resolution failed for $0."), details.testedHost);
    }
    return _("Network connectivity check failed.");
}

function getAlertContent(watchdogStatus?: WatchdogStatusData | null) {
    switch (watchdogStatus?.status) {
        case "network_failure": {
            const detail = getNetworkFailureDetail(watchdogStatus.details);
            return {
                variant: "warning",
                title: _("Network configuration rolled back"),
                body: [
                    _(
                        "The watchdog timer rolled back your configuration because network connectivity could not be established."
                    ),
                    detail,
                    _("Review and modify the settings as needed before re-applying."),
                ]
                    .filter(Boolean)
                    .join(" "),
            };
        }
        case "app_failure":
            return {
                variant: "info",
                title: _("Enrollment did not complete"),
                body: _(
                    "Network connectivity is working, but enrollment did not complete. You can retry without changing network settings."
                ),
            };
        default:
            return {
                variant: "info",
                title: _("Previous configuration restored"),
                body: _(
                    "Your previous onboarding configuration has been restored. Review and modify the settings as needed before re-applying."
                ),
            };
    }
}

export const RestoredConfigurationAlert: React.FunctionComponent<RestoredConfigurationAlertProps> = ({
    hasPreviousAttempt,
    watchdogStatus,
}) => {
    const [isVisible, setIsVisible] = useState(hasPreviousAttempt);

    if (!isVisible) {
        return null;
    }

    const { variant, title, body } = getAlertContent(watchdogStatus);
    return (
        <PageSection>
            <Alert
                variant={variant as AlertVariant}
                title={title}
                isInline
                actionClose={<AlertActionCloseButton onClose={() => setIsVisible(false)} />}
            >
                {body}
            </Alert>
        </PageSection>
    );
};
