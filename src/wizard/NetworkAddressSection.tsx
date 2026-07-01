import React from "react";
import cockpit from "cockpit";

import { Alert } from "@patternfly/react-core/dist/esm/components/Alert/index.js";
import { Radio } from "@patternfly/react-core/dist/esm/components/Radio/index.js";
import { Stack, StackItem } from "@patternfly/react-core/dist/esm/layouts/Stack/index.js";
import { Title } from "@patternfly/react-core/dist/esm/components/Title/index.js";

import { useModelContext } from "../model-context";
import { getSetupInterface } from "../services/network";
import { validateIpv4StaticConfig, validateIpv6StaticConfig } from "../validation";

import FeatureSwitch from "../components/FeatureSwitch";
import { LabelHeading } from "../components/Headings.tsx";
import ValidatedRadioLabel from "../components/ValidatedRadioLabel.tsx";
import { NetworkAddressDns } from "./NetworkAddressDns";
import { StaticIpv4Configuration } from "./StaticIpv4Configuration.tsx";
import { StaticIpv6Configuration } from "./StaticIpv6Configuration.tsx";

const _ = cockpit.gettext;

const NetworkAddressSection = () => {
    const { model, networkManager } = useModelContext();

    const interfaces = networkManager?.list_interfaces?.() || [];
    const setupInterface = getSetupInterface(interfaces);
    const isSetupInterface = setupInterface !== null && model.networkInterface.selectedInterface === setupInterface;

    const isMissingNetworkConfig =
        model.networkAddress.ipv4.method === "disabled" && model.networkAddress.ipv6.method === "disabled";

    return (
        <Stack hasGutter>
            <StackItem>
                <Title headingLevel="h2" size="md">
                    {_("IP Settings")}
                </Title>
            </StackItem>
            <StackItem>
                <NetworkConfigIPv4 isSetupInterface={isSetupInterface} />
            </StackItem>
            <StackItem>
                <NetworkConfigIPv6 isSetupInterface={isSetupInterface} />
            </StackItem>
            {isMissingNetworkConfig && (
                <StackItem className="pf-v6-u-my-md">
                    <Alert variant="warning" isInline title={_("Configure IPv4, IPv6, or both to continue.")} />
                </StackItem>
            )}
        </Stack>
    );
};

const NetworkConfigIPv4 = ({ isSetupInterface = false }: { isSetupInterface?: boolean }) => {
    const { model, updateNestedModel } = useModelContext();

    const setIpv4Method = (method: "dhcp" | "static" | "disabled") => {
        const modelMethod = method === "dhcp" ? "auto" : method;
        updateNestedModel("networkAddress", "ipv4", { method: modelMethod as "auto" | "static" | "disabled" });
    };

    const selectedIpv4Method = model.networkAddress.ipv4.method;
    const isValidStaticIp = selectedIpv4Method !== "static" || validateIpv4StaticConfig(model.networkAddress.ipv4);

    return (
        <Stack hasGutter>
            <StackItem>
                <FeatureSwitch
                    fieldId="ipv4-method"
                    label={_("IPv4")}
                    isChecked={selectedIpv4Method !== "disabled"}
                    onToggle={() => setIpv4Method(selectedIpv4Method === "disabled" ? "dhcp" : "disabled")}
                >
                    <Stack hasGutter>
                        <StackItem>
                            <Stack hasGutter>
                                <StackItem>
                                    <LabelHeading text={_("IPv4 Connection")} />
                                </StackItem>
                                <StackItem>
                                    <Radio
                                        id="dhcpv4-radio"
                                        name="ipv4-method"
                                        label={_("Automatic (DHCPv4)")}
                                        isChecked={selectedIpv4Method === "auto"}
                                        onChange={() => setIpv4Method("dhcp")}
                                    />
                                </StackItem>
                                <StackItem>
                                    <Radio
                                        id="static-ip-radio"
                                        name="ipv4-method"
                                        label={
                                            <ValidatedRadioLabel
                                                label={_("Manual (Static IP)")}
                                                isValid={isValidStaticIp}
                                            />
                                        }
                                        isChecked={selectedIpv4Method === "static"}
                                        onChange={() => setIpv4Method("static")}
                                        body={
                                            selectedIpv4Method === "static" && (
                                                <StaticIpv4Configuration isSetupInterface={isSetupInterface} />
                                            )
                                        }
                                    />
                                </StackItem>
                            </Stack>
                        </StackItem>
                        <StackItem>
                            <NetworkAddressDns version="ipv4" />
                        </StackItem>
                    </Stack>
                </FeatureSwitch>
            </StackItem>
        </Stack>
    );
};

const NetworkConfigIPv6 = ({ isSetupInterface = false }: { isSetupInterface?: boolean }) => {
    const { model, updateNestedModel } = useModelContext();

    const setIpv6Method = (method: "auto" | "dhcp" | "static" | "disabled") => {
        updateNestedModel("networkAddress", "ipv6", { method });
    };

    const selectedIpv6Method = model.networkAddress.ipv6.method;
    const isValidStaticIp = selectedIpv6Method !== "static" || validateIpv6StaticConfig(model.networkAddress.ipv6);

    return (
        <Stack hasGutter>
            <StackItem>
                <FeatureSwitch
                    fieldId="ipv6-method"
                    label={_("IPv6")}
                    isChecked={selectedIpv6Method !== "disabled"}
                    onToggle={() => setIpv6Method(selectedIpv6Method === "disabled" ? "auto" : "disabled")}
                >
                    <Stack hasGutter>
                        <StackItem>
                            <Stack hasGutter>
                                <StackItem>
                                    <LabelHeading text={_("IPv6 Connection")} />
                                </StackItem>
                                <StackItem>
                                    <Radio
                                        id="slaac-radio"
                                        name="ipv6-method"
                                        label={_("Automatic (SLAAC)")}
                                        isChecked={selectedIpv6Method === "auto"}
                                        onChange={() => setIpv6Method("auto")}
                                    />
                                </StackItem>
                                <StackItem>
                                    <Radio
                                        id="dhcpv6-radio"
                                        name="ipv6-method"
                                        label={_("Stateful DHCPv6")}
                                        isChecked={selectedIpv6Method === "dhcp"}
                                        onChange={() => setIpv6Method("dhcp")}
                                    />
                                </StackItem>
                                <StackItem>
                                    <Radio
                                        id="static-ipv6-radio"
                                        name="ipv6-method"
                                        label={
                                            <ValidatedRadioLabel
                                                label={_("Manual (Static IP)")}
                                                isValid={isValidStaticIp}
                                            />
                                        }
                                        isChecked={selectedIpv6Method === "static"}
                                        onChange={() => setIpv6Method("static")}
                                        body={
                                            selectedIpv6Method === "static" && (
                                                <StaticIpv6Configuration isSetupInterface={isSetupInterface} />
                                            )
                                        }
                                    />
                                </StackItem>
                            </Stack>
                        </StackItem>
                        <StackItem>
                            <NetworkAddressDns version="ipv6" />
                        </StackItem>
                    </Stack>
                </FeatureSwitch>
            </StackItem>
        </Stack>
    );
};

export default NetworkAddressSection;
