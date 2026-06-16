import React from "react";
import cockpit from "cockpit";

import { Stack, StackItem } from "@patternfly/react-core/dist/esm/layouts/Stack/index.js";
import {
    DescriptionList,
    DescriptionListGroup,
    DescriptionListTerm,
    DescriptionListDescription,
} from "@patternfly/react-core/dist/esm/components/DescriptionList/index.js";
import { Alert } from "@patternfly/react-core/dist/esm/components/Alert/index.js";
import { Button } from "@patternfly/react-core/dist/esm/components/Button/index.js";
import { useWizardContext } from "@patternfly/react-core/dist/esm/components/Wizard/index.js";
import { PencilAltIcon } from "@patternfly/react-icons";
import { useModelContext } from "../model-context";
import { useConfig } from "../app";
import { getSetupInterface } from "../services/network";

const _ = cockpit.gettext;

interface ReviewPageProps {
    hasEnrollmentScripts: boolean;
}

export const ReviewPage: React.FunctionComponent<ReviewPageProps> = ({ hasEnrollmentScripts }) => {
    const { model, networkManager } = useModelContext();
    const { config } = useConfig();
    const { goToStepById } = useWizardContext();

    const interfaces = networkManager?.list_interfaces() || [];
    const setupIface = getSetupInterface(interfaces);
    const isSingleNic = setupIface !== null && setupIface === model.networkInterface.selectedInterface;

    return (
        <Stack hasGutter>
            <StackItem>
                <p>
                    {hasEnrollmentScripts
                        ? _(
                              'Please review your configuration below. Click "Enroll" to apply these settings and complete the system onboarding.'
                          )
                        : _(
                              'Please review your configuration below. Click "Apply" to apply these settings to the system.'
                          )}
                </p>
            </StackItem>

            {isSingleNic && (
                <StackItem>
                    <Alert variant="warning" isInline title={_("Connection will be interrupted")}>
                        {_(
                            "You are applying changes to the interface serving this browser session. Your connection will drop when the new network profile is activated. The remaining steps (connectivity test, enrollment, and cleanup) will continue in the background automatically."
                        )}
                    </Alert>
                </StackItem>
            )}

            <StackItem>
                <DescriptionList isHorizontal>
                    {/* Hostname Section */}
                    <DescriptionListGroup>
                        <DescriptionListTerm>{_("Hostname")}</DescriptionListTerm>
                        <DescriptionListDescription>
                            {model.hostname.value || _("(empty)")}
                            <Button
                                variant="link"
                                icon={<PencilAltIcon />}
                                onClick={() => goToStepById("wizard-step-1")}
                                aria-label={_("Edit hostname")}
                            />
                        </DescriptionListDescription>
                    </DescriptionListGroup>

                    {/* Network Interface Section */}
                    <DescriptionListGroup>
                        <DescriptionListTerm>{_("Interface")}</DescriptionListTerm>
                        <DescriptionListDescription>
                            {model.networkInterface.selectedInterface || _("(not selected)")}
                            <Button
                                variant="link"
                                icon={<PencilAltIcon />}
                                onClick={() => goToStepById("wizard-step-2")}
                                aria-label={_("Edit network interface")}
                            />
                        </DescriptionListDescription>
                    </DescriptionListGroup>
                    {model.networkInterface.interfaceType === "wifi" && (
                        <>
                            <DescriptionListGroup>
                                <DescriptionListTerm>{_("WiFi SSID")}</DescriptionListTerm>
                                <DescriptionListDescription>
                                    {model.networkInterface.wifiSsid || _("(empty)")}
                                    <Button
                                        variant="link"
                                        icon={<PencilAltIcon />}
                                        onClick={() => goToStepById("wizard-step-2")}
                                        aria-label={_("Edit network interface")}
                                    />
                                </DescriptionListDescription>
                            </DescriptionListGroup>
                            <DescriptionListGroup>
                                <DescriptionListTerm>{_("WiFi Security")}</DescriptionListTerm>
                                <DescriptionListDescription>
                                    {model.networkInterface.wifiSecurity === "none" && _("None")}
                                    {model.networkInterface.wifiSecurity === "wep" && _("WEP")}
                                    {model.networkInterface.wifiSecurity === "wpa" && _("WPA/WPA2")}
                                    {!model.networkInterface.wifiSecurity && _("(not set)")}
                                </DescriptionListDescription>
                            </DescriptionListGroup>
                        </>
                    )}
                    {model.networkInterface.vlanId !== null && (
                        <DescriptionListGroup>
                            <DescriptionListTerm>{_("VLAN ID")}</DescriptionListTerm>
                            <DescriptionListDescription>
                                {model.networkInterface.vlanId}
                                <Button
                                    variant="link"
                                    icon={<PencilAltIcon />}
                                    onClick={() => goToStepById("wizard-step-2")}
                                    aria-label={_("Edit network interface")}
                                />
                            </DescriptionListDescription>
                        </DescriptionListGroup>
                    )}

                    {/* Network Address Section */}
                    <DescriptionListGroup>
                        <DescriptionListTerm>{_("IPv4 Configuration")}</DescriptionListTerm>
                        <DescriptionListDescription>
                            {model.networkAddress.ipv4.method === "auto" && _("Automatic (DHCP)")}
                            {model.networkAddress.ipv4.method === "static" && _("Static")}
                            {model.networkAddress.ipv4.method === "disabled" && _("Disabled")}
                            <Button
                                variant="link"
                                icon={<PencilAltIcon />}
                                onClick={() => goToStepById("wizard-step-3")}
                                aria-label={_("Edit network address")}
                            />
                        </DescriptionListDescription>
                    </DescriptionListGroup>
                    {model.networkAddress.ipv4.method === "static" && (
                        <>
                            <DescriptionListGroup>
                                <DescriptionListTerm>IPv4 Address</DescriptionListTerm>
                                <DescriptionListDescription>
                                    {model.networkAddress.ipv4.address || "(empty)"}
                                </DescriptionListDescription>
                            </DescriptionListGroup>
                            <DescriptionListGroup>
                                <DescriptionListTerm>IPv4 Subnet Mask</DescriptionListTerm>
                                <DescriptionListDescription>
                                    {model.networkAddress.ipv4.subnetMask || "(empty)"}
                                </DescriptionListDescription>
                            </DescriptionListGroup>
                            <DescriptionListGroup>
                                <DescriptionListTerm>Gateway</DescriptionListTerm>
                                <DescriptionListDescription>
                                    {model.networkAddress.ipv4.gateway || "(empty)"}
                                </DescriptionListDescription>
                            </DescriptionListGroup>
                        </>
                    )}
                    <DescriptionListGroup>
                        <DescriptionListTerm>DNS servers</DescriptionListTerm>
                        <DescriptionListDescription>
                            {model.networkAddress.ipv4.autoDns ? (
                                _("Automatic")
                            ) : (
                                <>
                                    {model.networkAddress.ipv4.primaryDns && (
                                        <div>{model.networkAddress.ipv4.primaryDns}</div>
                                    )}
                                    {model.networkAddress.ipv4.secondaryDns && (
                                        <div>{model.networkAddress.ipv4.secondaryDns}</div>
                                    )}
                                    {!model.networkAddress.ipv4.primaryDns &&
                                        !model.networkAddress.ipv4.secondaryDns && <div>(empty)</div>}
                                </>
                            )}
                        </DescriptionListDescription>
                    </DescriptionListGroup>

                    <DescriptionListGroup>
                        <DescriptionListTerm>{_("IPv6 Configuration")}</DescriptionListTerm>
                        <DescriptionListDescription>
                            {model.networkAddress.ipv6.method === "auto" && _("Automatic (DHCP)")}
                            {model.networkAddress.ipv6.method === "static" && _("Static")}
                            {model.networkAddress.ipv6.method === "disabled" && _("Disabled")}
                            <Button
                                variant="link"
                                icon={<PencilAltIcon />}
                                onClick={() => goToStepById("wizard-step-3")}
                                aria-label={_("Edit network address")}
                            />
                        </DescriptionListDescription>
                    </DescriptionListGroup>
                    {model.networkAddress.ipv6.method === "static" && (
                        <>
                            <DescriptionListGroup>
                                <DescriptionListTerm>IPv6 Address</DescriptionListTerm>
                                <DescriptionListDescription>
                                    {model.networkAddress.ipv6.address || "(empty)"}
                                </DescriptionListDescription>
                            </DescriptionListGroup>
                            <DescriptionListGroup>
                                <DescriptionListTerm>Gateway</DescriptionListTerm>
                                <DescriptionListDescription>
                                    {model.networkAddress.ipv6.gateway || "(empty)"}
                                </DescriptionListDescription>
                            </DescriptionListGroup>
                        </>
                    )}
                    {model.networkAddress.ipv6.method !== "disabled" && (
                        <DescriptionListGroup>
                            <DescriptionListTerm>DNS servers</DescriptionListTerm>
                            <DescriptionListDescription>
                                {model.networkAddress.ipv6.autoDns ? (
                                    _("Automatic")
                                ) : (
                                    <>
                                        {model.networkAddress.ipv6.primaryDns && (
                                            <div>{model.networkAddress.ipv6.primaryDns}</div>
                                        )}
                                        {model.networkAddress.ipv6.secondaryDns && (
                                            <div>{model.networkAddress.ipv6.secondaryDns}</div>
                                        )}
                                        {!model.networkAddress.ipv6.primaryDns &&
                                            !model.networkAddress.ipv6.secondaryDns && <div>(empty)</div>}
                                    </>
                                )}
                            </DescriptionListDescription>
                        </DescriptionListGroup>
                    )}

                    {/* Network Services Section */}
                    <DescriptionListGroup>
                        <DescriptionListTerm>{_("NTP Servers")}</DescriptionListTerm>
                        <DescriptionListDescription>
                            {model.networkServices.ntp.autoConfig ? (
                                _("Automatic")
                            ) : model.networkServices.ntp.servers.length > 0 ? (
                                model.networkServices.ntp.servers.map((server, index) => (
                                    <div key={index}>{server}</div>
                                ))
                            ) : (
                                <span>{_("(empty)")}</span>
                            )}
                            <Button
                                variant="link"
                                icon={<PencilAltIcon />}
                                onClick={() => goToStepById("wizard-step-4")}
                                aria-label={_("Edit network services")}
                            />
                        </DescriptionListDescription>
                    </DescriptionListGroup>
                    <DescriptionListGroup>
                        <DescriptionListTerm>{_("Proxy")}</DescriptionListTerm>
                        <DescriptionListDescription>
                            {model.networkServices.proxy.enabled ? (
                                <>
                                    {model.networkServices.proxy.hostname && model.networkServices.proxy.port
                                        ? `${model.networkServices.proxy.protocol}://${model.networkServices.proxy.hostname}:${model.networkServices.proxy.port}`
                                        : _("(incomplete configuration)")}
                                    {model.networkServices.proxy.username && (
                                        <div>
                                            {_("Username: ")} {model.networkServices.proxy.username}
                                        </div>
                                    )}
                                    {model.networkServices.proxy.noProxy && (
                                        <div>
                                            {_("No proxy: ")} {model.networkServices.proxy.noProxy}
                                        </div>
                                    )}
                                </>
                            ) : (
                                _("Not configured")
                            )}
                            <Button
                                variant="link"
                                icon={<PencilAltIcon />}
                                onClick={() => goToStepById("wizard-step-4")}
                                aria-label={_("Edit network services")}
                            />
                        </DescriptionListDescription>
                    </DescriptionListGroup>

                    {/* Connectivity Test Section */}
                    <DescriptionListGroup>
                        <DescriptionListTerm>{_("Connectivity test host")}</DescriptionListTerm>
                        <DescriptionListDescription>
                            {model.connectivityTestHost || _("(not set)")}
                            <Button
                                variant="link"
                                icon={<PencilAltIcon />}
                                onClick={() => goToStepById(hasEnrollmentScripts ? "wizard-step-6" : "wizard-step-5")}
                                aria-label={_("Edit connectivity test host")}
                            />
                        </DescriptionListDescription>
                    </DescriptionListGroup>

                    {hasEnrollmentScripts && (
                        <>
                            {/* Enrollment Section */}
                            {config?.enrollmentServices?.map((service) => {
                                const isSelected = model.enrollment.selectedServices.includes(service.id);

                                if (!isSelected) {
                                    // Service not selected - show "Skip enrollment"
                                    return (
                                        <DescriptionListGroup key={service.id}>
                                            <DescriptionListTerm>{service.name}</DescriptionListTerm>
                                            <DescriptionListDescription>
                                                {_("Skip enrollment")}
                                                <Button
                                                    variant="link"
                                                    icon={<PencilAltIcon />}
                                                    onClick={() => goToStepById("wizard-step-5")}
                                                    aria-label={_("Edit enrollment services")}
                                                />
                                            </DescriptionListDescription>
                                        </DescriptionListGroup>
                                    );
                                }

                                const isUsingExisting = model.enrollment.useExisting?.[service.id] ?? false;

                                if (isUsingExisting) {
                                    return (
                                        <DescriptionListGroup key={service.id}>
                                            <DescriptionListTerm>{service.name}</DescriptionListTerm>
                                            <DescriptionListDescription>
                                                {_("Using existing credentials")}
                                                <Button
                                                    variant="link"
                                                    icon={<PencilAltIcon />}
                                                    onClick={() => goToStepById("wizard-step-5")}
                                                    aria-label={_("Edit enrollment services")}
                                                />
                                            </DescriptionListDescription>
                                        </DescriptionListGroup>
                                    );
                                }

                                // Service selected with new credentials - show endpoint and credentials
                                const endpoint = model.enrollment.endpoints[service.id] || service.endpoint.url;
                                const credentials = model.enrollment.credentials[service.id] || {};

                                return (
                                    <DescriptionListGroup key={service.id}>
                                        <DescriptionListTerm>{service.name}</DescriptionListTerm>
                                        <DescriptionListDescription>
                                            <div>
                                                {_("Enroll in ")} {endpoint}
                                            </div>
                                            {Object.keys(credentials).length > 0 && (
                                                <div>
                                                    {Object.entries(credentials)
                                                        .filter(([key]) => !key.startsWith("_"))
                                                        .map(([key, value]) => {
                                                            // Hide password/token fields
                                                            const isSecret =
                                                                key.toLowerCase().includes("password") ||
                                                                key.toLowerCase().includes("token") ||
                                                                key.toLowerCase().includes("key");
                                                            const displayValue =
                                                                isSecret && value
                                                                    ? "•".repeat(8)
                                                                    : String(value || _("(empty)"));

                                                            return (
                                                                <div key={key}>
                                                                    {key}: {displayValue}
                                                                </div>
                                                            );
                                                        })}
                                                </div>
                                            )}
                                            <Button
                                                variant="link"
                                                icon={<PencilAltIcon />}
                                                onClick={() => goToStepById("wizard-step-5")}
                                                aria-label={_("Edit enrollment services")}
                                            />
                                        </DescriptionListDescription>
                                    </DescriptionListGroup>
                                );
                            })}
                        </>
                    )}

                    {/* Labels Section */}
                    {(model.labels.deviceLabels.length > 0 || model.labels.systemInfoMappings.length > 0) && (
                        <DescriptionListGroup>
                            <DescriptionListTerm>{_("Device labels")}</DescriptionListTerm>
                            <DescriptionListDescription>
                                {model.labels.deviceLabels.map((entry, i) => (
                                    <div key={i}>
                                        {entry.key} = {entry.value}
                                    </div>
                                ))}
                                {model.labels.systemInfoMappings.map((entry, i) => (
                                    <div key={i}>
                                        {entry.labelKey} &larr; {entry.systemInfoField}
                                    </div>
                                ))}
                                <Button
                                    variant="link"
                                    icon={<PencilAltIcon />}
                                    onClick={() =>
                                        goToStepById(hasEnrollmentScripts ? "wizard-step-7" : "wizard-step-6")
                                    }
                                    aria-label={_("Edit device labels")}
                                />
                            </DescriptionListDescription>
                        </DescriptionListGroup>
                    )}
                </DescriptionList>
            </StackItem>
        </Stack>
    );
};
