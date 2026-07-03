import React from "react";
import { Alert, AlertActionCloseButton, AlertVariant } from "@patternfly/react-core/dist/esm/components/Alert/index.js";
import { Content, ContentVariants } from "@patternfly/react-core/dist/esm/components/Content/index.js";
import { List, ListItem } from "@patternfly/react-core/dist/esm/components/List/index.js";
import { PageSection } from "@patternfly/react-core/dist/esm/components/Page/index.js";
import { Stack, StackItem } from "@patternfly/react-core/dist/esm/layouts/Stack/index.js";

import cockpit from "cockpit";

const _ = cockpit.gettext;

export interface WatchdogStatusData {
    status: "success" | "app_failure" | "network_failure";
    message: string;
    timestamp?: string;
    details?: {
        carrierDetected: boolean;
        carrierInterfaces?: string;
        dnsResolved: boolean;
        pingSucceeded: boolean;
        testedHost: string;
        activeConnections: string;
    };
}

interface RestoredConfigurationAlertProps {
    onDismiss: VoidFunction;
    watchdogStatus?: WatchdogStatusData | null | undefined;
}

const getNetworkFailureDetail = (details: WatchdogStatusData["details"]): string => {
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
};

const getExtraDetails = (watchdogStatus: WatchdogStatusData): string[] => {
    const lines: string[] = [];

    const { status, timestamp, details } = watchdogStatus;
    if (timestamp) {
        const checkedAt = new Date(timestamp);
        if (!Number.isNaN(checkedAt.getTime())) {
            lines.push(cockpit.format(_("Checked at $0."), checkedAt.toLocaleString()));
        }
    }

    if (!details) {
        return lines;
    }

    const testedHost = details.testedHost?.trim();
    if (testedHost && status === "network_failure" && !details.carrierDetected) {
        lines.push(cockpit.format(_("Connectivity test host: $0."), testedHost));
    }

    const carrierInterfaces = details.carrierInterfaces?.trim();
    if (carrierInterfaces) {
        lines.push(cockpit.format(_("Interfaces with carrier: $0."), carrierInterfaces));
    }

    const activeConnections = details.activeConnections?.trim();
    if (activeConnections) {
        lines.push(cockpit.format(_("Active connections: $0."), activeConnections));
    }

    if (status === "app_failure" && testedHost && !details.pingSucceeded) {
        lines.push(cockpit.format(_("Ping to $0 failed."), testedHost));
    }

    return lines;
};

const getAlertContent = (watchdogStatus?: WatchdogStatusData | null) => {
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
                extraDetails: getExtraDetails(watchdogStatus),
            };
        }
        case "app_failure": {
            const detail = watchdogStatus.message?.trim();
            return {
                variant: "warning",
                title: _("Enrollment did not complete"),
                body: _(
                    "Network connectivity is working, but enrollment did not complete. You can retry without changing network settings."
                ),
                extraDetails: detail ? [detail, ...getExtraDetails(watchdogStatus)] : getExtraDetails(watchdogStatus),
            };
        }
        default:
            return {
                variant: "info",
                title: _("Previous configuration restored"),
                body: _(
                    "Your previous onboarding configuration has been restored. Review and modify the settings as needed before re-applying."
                ),
                extraDetails: [],
            };
    }
};

const RestoredConfigurationSection = ({ watchdogStatus, onDismiss }: RestoredConfigurationAlertProps) => {
    const { variant, title, body, extraDetails } = getAlertContent(watchdogStatus);
    return (
        <PageSection>
            <Alert
                variant={variant as AlertVariant}
                title={title}
                isInline
                actionClose={<AlertActionCloseButton onClose={onDismiss} />}
            >
                <Stack hasGutter>
                    <StackItem>{body}</StackItem>
                    {extraDetails.length > 0 && (
                        <StackItem>
                            <details>
                                <summary>{_("Additional details")}:</summary>
                                <List>
                                    {extraDetails.map((detail) => (
                                        <ListItem key={detail}>
                                            <Content component={ContentVariants.small}>{detail}</Content>
                                        </ListItem>
                                    ))}
                                </List>
                            </details>
                        </StackItem>
                    )}
                </Stack>
            </Alert>
        </PageSection>
    );
};

export default RestoredConfigurationSection;
