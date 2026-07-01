import React, { useState } from "react";
import cockpit from "cockpit";

import { Button } from "@patternfly/react-core/dist/esm/components/Button/index.js";
import { FormGroup } from "@patternfly/react-core/dist/esm/components/Form/index.js";
import { Stack, StackItem } from "@patternfly/react-core/dist/esm/layouts/Stack/index.js";
import { Flex, FlexItem } from "@patternfly/react-core/dist/esm/layouts/Flex/index.js";
import { MinusCircleIcon, PlusCircleIcon } from "@patternfly/react-icons";

import ValidatedTextInput from "../components/ValidatedTextInput";
import FeatureSwitch from "../components/FeatureSwitch";
import { useModelContext } from "../model-context";
import { validateHostnameOrIP } from "../validation";
import NetworkProxySection from "./NetworkProxySection";

const _ = cockpit.gettext;

const getNtpServerValidationError = (value: string): string | undefined => {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
        return validateHostnameOrIP(value, true) ?? undefined;
    }
    return validateHostnameOrIP(value, false) ?? undefined;
};

// The empty string is to be able to fill in the first server.
// It will be invalid unless it's set to a valid hostname or IP address.
const emptyNtpServers = [""];

const NetworkServicesSection = () => {
    const { model, updateNestedModel } = useModelContext();
    const [ntpValidationErrors, setNtpValidationErrors] = useState<Record<number, string | undefined>>({});

    const storedNtpServers = model.networkServices.ntp.servers || [];
    const ntpServers = storedNtpServers.length > 0 ? storedNtpServers : emptyNtpServers;

    const setAutoNtp = (autoConfig: boolean) => {
        updateNestedModel("networkServices", "ntp", { autoConfig, servers: emptyNtpServers });
        if (autoConfig) {
            setNtpValidationErrors({});
        }
    };

    const handleNtpServerChange = (index: number, value: string) => {
        const newServers = [...ntpServers];
        newServers[index] = value;
        updateNestedModel("networkServices", "ntp", { servers: newServers });
        setNtpValidationErrors((prev) => ({
            ...prev,
            [index]: getNtpServerValidationError(value),
        }));
    };

    const addNtpServerRow = () => {
        const newIndex = ntpServers.length;
        updateNestedModel("networkServices", "ntp", { servers: [...ntpServers, ""] });
        setNtpValidationErrors((prev) => ({
            ...prev,
            [newIndex]: getNtpServerValidationError(""),
        }));
    };

    const removeNtpServer = (index: number) => {
        if (ntpServers.length === 1) {
            // When clicking on "remove" for the last server, we keep the row, and clear the field content
            updateNestedModel("networkServices", "ntp", { servers: emptyNtpServers });
            setNtpValidationErrors({ 0: getNtpServerValidationError("") });
            return;
        }

        const newServers = ntpServers.filter((_, i) => i !== index);
        updateNestedModel("networkServices", "ntp", { servers: newServers });
        setNtpValidationErrors((prev) => {
            const next: Record<number, string | undefined> = {};
            newServers.forEach((server, i) => {
                const sourceIndex = i < index ? i : i + 1;
                next[i] = prev[sourceIndex] ?? getNtpServerValidationError(server);
            });
            return next;
        });
    };

    return (
        <Stack hasGutter>
            <StackItem>
                <FeatureSwitch
                    fieldId="ntp-servers"
                    label={_("NTP Servers")}
                    isChecked={!model.networkServices.ntp.autoConfig}
                    onToggle={(checked) => setAutoNtp(!checked)}
                >
                    <Stack hasGutter>
                        {ntpServers.map((server, index) => {
                            let minusAlign: "alignSelfCenter" | "alignSelfFlexStart" | "alignSelfFlexEnd";
                            if (index === 0) {
                                minusAlign = ntpValidationErrors[index] ? "alignSelfCenter" : "alignSelfFlexEnd";
                            } else {
                                minusAlign = "alignSelfFlexStart";
                            }
                            return (
                                <StackItem key={index}>
                                    <Flex>
                                        <FlexItem flex={{ default: "flex_1" }}>
                                            <FormGroup
                                                label={index === 0 ? _("NTP Server Hostname") : undefined}
                                                isRequired
                                            >
                                                <ValidatedTextInput
                                                    id={index === 0 ? "ntp-server-input" : `ntp-server-input-${index}`}
                                                    value={server}
                                                    error={ntpValidationErrors[index]}
                                                    onChange={(_, value) => handleNtpServerChange(index, value)}
                                                    placeholder={_("e.g. pool.ntp.org")}
                                                />
                                            </FormGroup>
                                        </FlexItem>
                                        <FlexItem
                                            alignSelf={{
                                                default: minusAlign,
                                            }}
                                        >
                                            <Button
                                                variant="plain"
                                                aria-label={_("Remove NTP server")}
                                                onClick={() => removeNtpServer(index)}
                                            >
                                                <MinusCircleIcon />
                                            </Button>
                                        </FlexItem>
                                    </Flex>
                                </StackItem>
                            );
                        })}
                        <StackItem>
                            <Button variant="link" isInline icon={<PlusCircleIcon />} onClick={addNtpServerRow}>
                                {_("Add another NTP server")}
                            </Button>
                        </StackItem>
                    </Stack>
                </FeatureSwitch>
            </StackItem>
            <StackItem>
                <NetworkProxySection />
            </StackItem>
        </Stack>
    );
};

export default NetworkServicesSection;
