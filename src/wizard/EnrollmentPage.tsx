/**
 * Enrollment Page
 *
 * Allows users to enroll the device into Flight Control.
 */

import React, { useState, useEffect } from "react";
import cockpit from "cockpit";
import ExternalLinkAltIcon from "@patternfly/react-icons/dist/esm/icons/external-link-alt-icon";
import { Button } from "@patternfly/react-core/dist/esm/components/Button/index.js";
import { Divider } from "@patternfly/react-core/dist/esm/components/Divider/index.js";
import { FormGroup } from "@patternfly/react-core/dist/esm/components/Form/index.js";
import { Radio } from "@patternfly/react-core/dist/esm/components/Radio/index.js";
import { Stack, StackItem } from "@patternfly/react-core/dist/esm/layouts/Stack/index.js";
import { TextInput } from "@patternfly/react-core/dist/esm/components/TextInput/index.js";
import { Title } from "@patternfly/react-core/dist/esm/components/Title/index.js";

import { useModelContext } from "../model-context";
import { useConfig } from "../app";
import { getBrandName } from "../flightctl-enrollment";
import { validateURL } from "../validation";
import ValidatedTextInput from "../components/ValidatedTextInput";
import FeatureSwitch from "../components/FeatureSwitch";
import { LabelHeading } from "../components/Headings";
import WithTooltip from "../components/WithTooltip";
import type {
    FlightctlAuthMethod,
    FlightctlPasswordCredentials,
    FlightctlTokenCredentials,
    ServiceEnrollmentConfig,
} from "../types";
import { detectFlightctlConfig } from "../services/flightctl-config";

const _ = cockpit.gettext;

export const EnrollmentPage = () => {
    const { config } = useConfig();
    const brandName = getBrandName(config);
    const { model, updateModel } = useModelContext();
    const enrollment = model.enrollment;
    const defaultEndpoint = config?.flightctl?.defaultEndpoint ?? "";
    const serviceEndpoint = enrollment.endpoint ?? defaultEndpoint;

    const [hasExistingCredentials, setHasExistingCredentials] = useState(false);
    const [existingServerUrl, setExistingServerUrl] = useState("");
    const [endpointTouched, setEndpointTouched] = useState(false);
    const [endpointError, setEndpointError] = useState<string | undefined>();

    const credentials = enrollment.credentials;
    const authMethod = credentials?.authMethod ?? "token";
    const isUsingExisting = hasExistingCredentials && (enrollment.useExisting ?? false);
    const isEndpointFromExistingConfig = Boolean(existingServerUrl) && serviceEndpoint === existingServerUrl;

    const newToken = credentials?.authMethod === "token" ? credentials.token : "";
    const newUsername = credentials?.authMethod === "password" ? credentials.username : "";
    const newPassword = credentials?.authMethod === "password" ? credentials.password : "";

    const updateEnrollment = (patch: Partial<ServiceEnrollmentConfig>) => {
        updateModel("enrollment", patch);
    };

    const updateServiceCredentials = (patch: FlightctlTokenCredentials | FlightctlPasswordCredentials) => {
        updateModel("enrollment", {
            credentials: patch,
        });
    };

    useEffect(() => {
        let cancelled = false;

        detectFlightctlConfig().then((flightctlConfig) => {
            if (cancelled) {
                return;
            }
            setHasExistingCredentials(flightctlConfig.hasCredentials);
            setExistingServerUrl(flightctlConfig.serverUrl ?? defaultEndpoint);
            if (flightctlConfig.hasCredentials && enrollment.useExisting === undefined) {
                updateEnrollment({ useExisting: true });
            } else if (!flightctlConfig.hasCredentials) {
                updateEnrollment({ useExisting: false });
            }
        });

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!enrollment.selected || isUsingExisting) {
            return;
        }
        setEndpointError(validateURL(serviceEndpoint, true) || undefined);
    }, [enrollment.selected, isUsingExisting, serviceEndpoint]);

    const handleEnrollmentToggle = (checked: boolean) => {
        if (!checked) {
            setEndpointTouched(false);
            setEndpointError(undefined);
        }
        updateEnrollment({ selected: checked });
    };

    const handleEndpointChange = (value: string) => {
        setEndpointTouched(true);
        setEndpointError(validateURL(value, true) || undefined);
        updateEnrollment({ endpoint: value });
    };

    const handleAuthMethodChange = (method: FlightctlAuthMethod) => {
        if (method === "token") {
            updateServiceCredentials({
                authMethod: "token",
                token: newToken,
            });
            return;
        }
        updateServiceCredentials({
            authMethod: "password",
            username: newUsername,
            password: newPassword,
        });
    };

    return (
        <Stack hasGutter>
            <StackItem>
                <Title headingLevel="h2" size="md">
                    {cockpit.format(_("$0 enrollment"), brandName)}
                </Title>
            </StackItem>

            <StackItem>
                <FeatureSwitch
                    fieldId="flightctl-enrollment"
                    label={cockpit.format(_("Enroll this device into $0"), brandName)}
                    isChecked={enrollment.selected}
                    onToggle={handleEnrollmentToggle}
                >
                    <Stack hasGutter>
                        <StackItem>
                            <LabelHeading text={_("Credentials")} />
                        </StackItem>
                        <StackItem>
                            <Stack hasGutter>
                                <StackItem>
                                    <WithTooltip
                                        showTooltip={!hasExistingCredentials}
                                        content={_("No existing credentials found")}
                                    >
                                        <Radio
                                            id="use-existing-flightctl"
                                            name="credential-mode-flightctl"
                                            label={_("Use existing")}
                                            isChecked={isUsingExisting}
                                            isDisabled={!hasExistingCredentials}
                                            onChange={() => updateEnrollment({ useExisting: true })}
                                            body={
                                                isUsingExisting && (
                                                    <FormGroup label={_("Server address:")}>
                                                        <TextInput
                                                            value={existingServerUrl || serviceEndpoint}
                                                            isDisabled
                                                        />
                                                    </FormGroup>
                                                )
                                            }
                                        />
                                    </WithTooltip>
                                </StackItem>
                                <StackItem>
                                    <Radio
                                        id="configure-new-flightctl"
                                        name="credential-mode-flightctl"
                                        label={_("Add a new credential")}
                                        isChecked={!isUsingExisting}
                                        onChange={() => updateEnrollment({ useExisting: false })}
                                        body={
                                            !isUsingExisting && (
                                                <Stack hasGutter>
                                                    <StackItem>
                                                        <FormGroup label={_("Authentication method")}>
                                                            <Stack hasGutter>
                                                                <StackItem>
                                                                    <Radio
                                                                        id="auth-token"
                                                                        name="auth-method"
                                                                        label={_("Token")}
                                                                        isChecked={authMethod === "token"}
                                                                        onChange={() => handleAuthMethodChange("token")}
                                                                        body={
                                                                            authMethod === "token" && (
                                                                                <FormGroup
                                                                                    label={_("Token")}
                                                                                    isRequired
                                                                                >
                                                                                    <TextInput
                                                                                        id="credential-token"
                                                                                        type="password"
                                                                                        value={newToken}
                                                                                        onChange={(_event, value) =>
                                                                                            updateServiceCredentials({
                                                                                                authMethod: "token",
                                                                                                token: value,
                                                                                            })
                                                                                        }
                                                                                        isRequired
                                                                                    />
                                                                                    <Button
                                                                                        variant="link"
                                                                                        isInline
                                                                                        className="pf-v6-u-mt-sm"
                                                                                        iconPosition="end"
                                                                                        icon={<ExternalLinkAltIcon />}
                                                                                    >
                                                                                        {_("Where can I get my token?")}
                                                                                    </Button>
                                                                                </FormGroup>
                                                                            )
                                                                        }
                                                                    />
                                                                </StackItem>
                                                                <StackItem>
                                                                    <Radio
                                                                        id="auth-password"
                                                                        name="auth-method"
                                                                        label={_("Username and password")}
                                                                        isChecked={authMethod === "password"}
                                                                        onChange={() =>
                                                                            handleAuthMethodChange("password")
                                                                        }
                                                                        body={
                                                                            authMethod === "password" && (
                                                                                <>
                                                                                    <FormGroup
                                                                                        label={_("Username")}
                                                                                        isRequired
                                                                                    >
                                                                                        <TextInput
                                                                                            id="credential-username"
                                                                                            value={newUsername}
                                                                                            onChange={(_event, value) =>
                                                                                                updateServiceCredentials(
                                                                                                    {
                                                                                                        authMethod:
                                                                                                            "password",
                                                                                                        username: value,
                                                                                                        password:
                                                                                                            newPassword,
                                                                                                    }
                                                                                                )
                                                                                            }
                                                                                            isRequired
                                                                                        />
                                                                                    </FormGroup>
                                                                                    <FormGroup
                                                                                        label={_("Password")}
                                                                                        isRequired
                                                                                    >
                                                                                        <TextInput
                                                                                            id="credential-password"
                                                                                            type="password"
                                                                                            value={newPassword}
                                                                                            onChange={(_event, value) =>
                                                                                                updateServiceCredentials(
                                                                                                    {
                                                                                                        authMethod:
                                                                                                            "password",
                                                                                                        username:
                                                                                                            newUsername,
                                                                                                        password: value,
                                                                                                    }
                                                                                                )
                                                                                            }
                                                                                            isRequired
                                                                                        />
                                                                                    </FormGroup>
                                                                                </>
                                                                            )
                                                                        }
                                                                    />
                                                                </StackItem>
                                                            </Stack>
                                                        </FormGroup>
                                                    </StackItem>

                                                    <StackItem>
                                                        <Divider />
                                                    </StackItem>

                                                    <StackItem>
                                                        <FormGroup
                                                            label={cockpit.format(_("$0 server"), brandName)}
                                                            isRequired
                                                        >
                                                            <ValidatedTextInput
                                                                id="endpoint-flightctl"
                                                                value={serviceEndpoint}
                                                                onChange={(_event, value) =>
                                                                    handleEndpointChange(value)
                                                                }
                                                                {...(isEndpointFromExistingConfig && {
                                                                    helperText: _(
                                                                        "Auto-detected from the selected credential."
                                                                    ),
                                                                })}
                                                                error={endpointTouched ? endpointError : undefined}
                                                            />
                                                        </FormGroup>
                                                    </StackItem>
                                                </Stack>
                                            )
                                        }
                                    />
                                </StackItem>
                            </Stack>
                        </StackItem>
                    </Stack>
                </FeatureSwitch>
            </StackItem>
        </Stack>
    );
};
