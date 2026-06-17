import React from "react";
import cockpit from "cockpit";

import { Radio } from "@patternfly/react-core/dist/esm/components/Radio/index.js";
import { FormGroup, FormHelperText } from "@patternfly/react-core/dist/esm/components/Form/index.js";
import { Checkbox } from "@patternfly/react-core/dist/esm/components/Checkbox/index.js";
import { TextInputGroup, TextInputGroupMain } from "@patternfly/react-core/dist/esm/components/TextInputGroup/index.js";
import { Button } from "@patternfly/react-core/dist/esm/components/Button/index.js";
import { Spinner } from "@patternfly/react-core/dist/esm/components/Spinner/index.js";
import { HelperText, HelperTextItem } from "@patternfly/react-core/dist/esm/components/HelperText/index.js";
import { Stack, StackItem } from "@patternfly/react-core/dist/esm/layouts/Stack/index.js";
import { Flex, FlexItem } from "@patternfly/react-core/dist/esm/layouts/Flex/index.js";
import { ValidatedOptions } from "@patternfly/react-core/dist/esm/helpers/constants.js";
import { Alert } from "@patternfly/react-core/dist/esm/components/Alert/index.js";
import { useModelContext } from "../model-context";
import { getSetupInterface } from "../services/network";
import { SCRIPT_CHECK_NETWORK } from "../paths";
import {
    validateIPv4,
    validateSubnetMask,
    validateIPv6,
    validateIPv6Gateway,
    validateIP,
    validateIPv4GatewaySubnet,
    validateIPv6GatewaySubnet,
} from "../validation";

const _ = cockpit.gettext;

type ArpingResult = "conflict" | "available" | "error" | null;
type GatewayArpingResult = "reachable" | "unreachable" | "error" | null;

export const NetworkAddressPage: React.FunctionComponent = () => {
    const { model, networkManager } = useModelContext();

    const interfaces = networkManager?.list_interfaces?.() || [];
    const setupInterface = getSetupInterface(interfaces);
    const isSetupInterface = setupInterface !== null && model.networkInterface.selectedInterface === setupInterface;

    return (
        <Stack hasGutter>
            {isSetupInterface && (
                <StackItem>
                    <Alert variant="warning" isInline title={_("Connected through this interface")}>
                        {model.networkInterface.interfaceType === "wifi"
                            ? _(
                                  "Applying these changes will disconnect your browser session. The wizard will continue in the background and roll back if enrollment fails."
                              )
                            : _(
                                  "Applying these changes will disconnect your browser session. After applying, unplug the ethernet cable from this device and connect it to your production network. The wizard will wait up to 5 minutes for the new connection before rolling back."
                              )}
                    </Alert>
                </StackItem>
            )}
            <StackItem>
                <p>Configure the IPv4 connection for this interface:</p>
                <NetworkConfigIPv4 isSetupInterface={isSetupInterface} />
            </StackItem>
            <StackItem>
                <p>Optionally, configure the IPv6 connection for this interface:</p>
                <NetworkConfigIPv6 isSetupInterface={isSetupInterface} />
            </StackItem>
        </Stack>
    );
};

export const NetworkConfigIPv4: React.FunctionComponent<{ isSetupInterface?: boolean }> = ({
    isSetupInterface = false,
}) => {
    const { model, updateNestedModel } = useModelContext();

    // Validation state
    const [validationErrors, setValidationErrors] = React.useState({
        address: null as string | null,
        subnetMask: null as string | null,
        gateway: null as string | null,
        primaryDns: null as string | null,
        secondaryDns: null as string | null,
    });

    const [arpingRunning, setArpingRunning] = React.useState(false);
    const [arpingResult, setArpingResult] = React.useState<ArpingResult>(null);
    const [gatewayArpingRunning, setGatewayArpingRunning] = React.useState(false);
    const [gatewayArpingResult, setGatewayArpingResult] = React.useState<GatewayArpingResult>(null);

    const setIpv4Method = (method: "dhcp" | "static" | "disabled") => {
        const modelMethod = method === "dhcp" ? "auto" : method;
        updateNestedModel("networkAddress", "ipv4", { method: modelMethod as "auto" | "static" | "disabled" });
    };

    const setIpv4Address = (address: string) => {
        const error = validateIPv4(address);
        setValidationErrors((prev) => ({ ...prev, address: error }));
        setArpingResult(null);
        updateNestedModel("networkAddress", "ipv4", { address });
    };

    const checkIpAvailability = async () => {
        const ipAddress = model.networkAddress.ipv4.address;
        const interfaceName = model.networkInterface.selectedInterface;
        if (!ipAddress || !interfaceName) {
            return;
        }

        setArpingRunning(true);
        setArpingResult(null);

        try {
            await cockpit.spawn(["sudo", SCRIPT_CHECK_NETWORK, "check-ip", interfaceName, ipAddress], {
                err: "message",
            });
            // arping -D exits 0 when no reply received (IP is free)
            setArpingResult("available");
        } catch (err: unknown) {
            const cockpitErr = err as { exit_status?: number };
            if (cockpitErr.exit_status === 1) {
                // arping -D exits 1 when a reply is received (IP already in use)
                setArpingResult("conflict");
            } else {
                setArpingResult("error");
            }
        } finally {
            setArpingRunning(false);
        }
    };

    const checkGatewayReachability = async () => {
        const gateway = model.networkAddress.ipv4.gateway;
        const interfaceName = model.networkInterface.selectedInterface;
        if (!gateway || !interfaceName) {
            return;
        }

        setGatewayArpingRunning(true);
        setGatewayArpingResult(null);

        try {
            await cockpit.spawn(["sudo", SCRIPT_CHECK_NETWORK, "check-gateway", interfaceName, gateway], {
                err: "message",
            });
            setGatewayArpingResult("reachable");
        } catch (err: unknown) {
            const cockpitErr = err as { exit_status?: number };
            if (cockpitErr.exit_status === 1) {
                setGatewayArpingResult("unreachable");
            } else {
                setGatewayArpingResult("error");
            }
        } finally {
            setGatewayArpingRunning(false);
        }
    };

    const setSubnetMask = (subnetMask: string) => {
        const error = validateSubnetMask(subnetMask);
        setValidationErrors((prev) => ({ ...prev, subnetMask: error }));
        updateNestedModel("networkAddress", "ipv4", { subnetMask });
        if (!error && model.networkAddress.ipv4.gateway && model.networkAddress.ipv4.address) {
            const gwError =
                validateIPv4(model.networkAddress.ipv4.gateway) ||
                validateIPv4GatewaySubnet(
                    model.networkAddress.ipv4.address,
                    model.networkAddress.ipv4.gateway,
                    subnetMask
                );
            setValidationErrors((prev) => ({ ...prev, gateway: gwError }));
        }
    };

    const setGatewayIp = (gateway: string) => {
        const formatError = validateIPv4(gateway);
        const subnetError =
            !formatError && model.networkAddress.ipv4.address && model.networkAddress.ipv4.subnetMask
                ? validateIPv4GatewaySubnet(
                      model.networkAddress.ipv4.address,
                      gateway,
                      model.networkAddress.ipv4.subnetMask
                  )
                : null;
        setValidationErrors((prev) => ({ ...prev, gateway: formatError || subnetError }));
        setGatewayArpingResult(null);
        updateNestedModel("networkAddress", "ipv4", { gateway });
    };

    const setAutoDns = (autoDns: boolean) => {
        updateNestedModel("networkAddress", "ipv4", { autoDns });
        // Clear DNS validation errors when switching to auto-DNS
        if (autoDns) {
            setValidationErrors((prev) => ({ ...prev, primaryDns: null, secondaryDns: null }));
        }
    };

    const setPrimaryDns = (primaryDns: string) => {
        const error = validateIP(primaryDns, !model.networkAddress.ipv4.autoDns);
        setValidationErrors((prev) => ({ ...prev, primaryDns: error }));
        updateNestedModel("networkAddress", "ipv4", { primaryDns });
    };

    const setSecondaryDns = (secondaryDns: string) => {
        const error = validateIP(secondaryDns, false);
        setValidationErrors((prev) => ({ ...prev, secondaryDns: error }));
        updateNestedModel("networkAddress", "ipv4", { secondaryDns });
    };

    return (
        <Stack hasGutter>
            <StackItem>
                <Flex>
                    <FlexItem>
                        <Radio
                            id="dhcpv4-radio"
                            name="ipv4-method"
                            label="DHCPv4"
                            isChecked={model.networkAddress.ipv4.method === "auto"}
                            onChange={() => setIpv4Method("dhcp")}
                        />
                    </FlexItem>
                    <FlexItem>
                        <Radio
                            id="static-ip-radio"
                            name="ipv4-method"
                            label="Static IP"
                            isChecked={model.networkAddress.ipv4.method === "static"}
                            onChange={() => setIpv4Method("static")}
                        />
                    </FlexItem>
                    <FlexItem>
                        <Radio
                            id="disabled-ipv4-radio"
                            name="ipv4-method"
                            label="Disabled"
                            isChecked={model.networkAddress.ipv4.method === "disabled"}
                            onChange={() => setIpv4Method("disabled")}
                        />
                    </FlexItem>
                </Flex>
            </StackItem>
            {model.networkAddress.ipv4.method === "static" && (
                <StackItem>
                    <Stack hasGutter>
                        <StackItem>
                            <FormGroup label={_("IPv4 Address")} isRequired>
                                <Flex alignItems={{ default: "alignItemsFlexStart" }}>
                                    <FlexItem grow={{ default: "grow" }}>
                                        <TextInputGroup
                                            validated={
                                                validationErrors.address
                                                    ? ValidatedOptions.error
                                                    : model.networkAddress.ipv4.address && !validationErrors.address
                                                      ? ValidatedOptions.success
                                                      : ValidatedOptions.warning
                                            }
                                        >
                                            <TextInputGroupMain
                                                id="ipv4-address"
                                                value={model.networkAddress.ipv4.address || ""}
                                                onChange={(_, value) => setIpv4Address(value)}
                                                placeholder="192.168.1.100"
                                            />
                                        </TextInputGroup>
                                    </FlexItem>
                                    <FlexItem>
                                        {!isSetupInterface && (
                                            <Button
                                                variant="secondary"
                                                onClick={checkIpAvailability}
                                                isDisabled={
                                                    arpingRunning ||
                                                    !model.networkAddress.ipv4.address ||
                                                    !!validationErrors.address ||
                                                    !model.networkInterface.selectedInterface
                                                }
                                                icon={arpingRunning ? <Spinner size="sm" /> : undefined}
                                            >
                                                {_("Check availability")}
                                            </Button>
                                        )}
                                    </FlexItem>
                                </Flex>
                                {arpingResult && (
                                    <FormHelperText>
                                        <HelperText>
                                            {arpingResult === "available" && (
                                                <HelperTextItem variant="success">
                                                    {_("IP address appears to be available")}
                                                </HelperTextItem>
                                            )}
                                            {arpingResult === "conflict" && (
                                                <HelperTextItem variant="warning">
                                                    {_("This IP address is already in use on the network")}
                                                </HelperTextItem>
                                            )}
                                            {arpingResult === "error" && (
                                                <HelperTextItem variant="indeterminate">
                                                    {_("Could not determine IP availability")}
                                                </HelperTextItem>
                                            )}
                                        </HelperText>
                                    </FormHelperText>
                                )}
                            </FormGroup>
                        </StackItem>
                        <StackItem>
                            <FormGroup label="Subnet Mask" isRequired>
                                <TextInputGroup
                                    validated={
                                        validationErrors.subnetMask
                                            ? ValidatedOptions.error
                                            : model.networkAddress.ipv4.subnetMask && !validationErrors.subnetMask
                                              ? ValidatedOptions.success
                                              : ValidatedOptions.warning
                                    }
                                >
                                    <TextInputGroupMain
                                        id="subnet-mask"
                                        value={model.networkAddress.ipv4.subnetMask || ""}
                                        onChange={(_, value) => setSubnetMask(value)}
                                        placeholder="255.255.255.0 or /24"
                                    />
                                </TextInputGroup>
                            </FormGroup>
                        </StackItem>
                        <StackItem>
                            <FormGroup label="Gateway IP" isRequired>
                                <Flex alignItems={{ default: "alignItemsFlexStart" }}>
                                    <FlexItem grow={{ default: "grow" }}>
                                        <TextInputGroup
                                            validated={
                                                validationErrors.gateway
                                                    ? ValidatedOptions.error
                                                    : model.networkAddress.ipv4.gateway && !validationErrors.gateway
                                                      ? ValidatedOptions.success
                                                      : ValidatedOptions.warning
                                            }
                                        >
                                            <TextInputGroupMain
                                                id="gateway-ip"
                                                value={model.networkAddress.ipv4.gateway || ""}
                                                onChange={(_, value) => setGatewayIp(value)}
                                                placeholder="192.168.1.1"
                                            />
                                        </TextInputGroup>
                                    </FlexItem>
                                    <FlexItem>
                                        {!isSetupInterface && (
                                            <Button
                                                variant="secondary"
                                                onClick={checkGatewayReachability}
                                                isDisabled={
                                                    gatewayArpingRunning ||
                                                    !model.networkAddress.ipv4.gateway ||
                                                    !!validationErrors.gateway ||
                                                    !model.networkInterface.selectedInterface
                                                }
                                                icon={gatewayArpingRunning ? <Spinner size="sm" /> : undefined}
                                            >
                                                {_("Check gateway")}
                                            </Button>
                                        )}
                                    </FlexItem>
                                </Flex>
                                {validationErrors.gateway && (
                                    <FormHelperText>
                                        <HelperText>
                                            <HelperTextItem variant="error">{validationErrors.gateway}</HelperTextItem>
                                        </HelperText>
                                    </FormHelperText>
                                )}
                                {gatewayArpingResult && (
                                    <FormHelperText>
                                        <HelperText>
                                            {gatewayArpingResult === "reachable" && (
                                                <HelperTextItem variant="success">
                                                    {_("Gateway is reachable")}
                                                </HelperTextItem>
                                            )}
                                            {gatewayArpingResult === "unreachable" && (
                                                <HelperTextItem variant="warning">
                                                    {_(
                                                        "Gateway did not respond — verify the address and cable connection"
                                                    )}
                                                </HelperTextItem>
                                            )}
                                            {gatewayArpingResult === "error" && (
                                                <HelperTextItem variant="indeterminate">
                                                    {_("Could not check gateway reachability")}
                                                </HelperTextItem>
                                            )}
                                        </HelperText>
                                    </FormHelperText>
                                )}
                            </FormGroup>
                        </StackItem>
                    </Stack>
                </StackItem>
            )}
            {model.networkAddress.ipv4.method !== "disabled" && (
                <StackItem>
                    <Checkbox
                        id="auto-dns-ipv4"
                        label="Automatically configure DNS"
                        isChecked={model.networkAddress.ipv4.autoDns}
                        onChange={(_, checked) => setAutoDns(checked)}
                    />
                    {!model.networkAddress.ipv4.autoDns && (
                        <Stack hasGutter style={{ marginTop: "1rem", marginLeft: "1.5rem" }}>
                            <StackItem>
                                <FormGroup label="Primary Server" isRequired>
                                    <TextInputGroup
                                        validated={
                                            validationErrors.primaryDns
                                                ? ValidatedOptions.error
                                                : model.networkAddress.ipv4.primaryDns && !validationErrors.primaryDns
                                                  ? ValidatedOptions.success
                                                  : ValidatedOptions.warning
                                        }
                                    >
                                        <TextInputGroupMain
                                            id="primary-dns-ipv4"
                                            value={model.networkAddress.ipv4.primaryDns || ""}
                                            onChange={(_, value) => setPrimaryDns(value)}
                                            placeholder="8.8.8.8"
                                        />
                                    </TextInputGroup>
                                </FormGroup>
                            </StackItem>
                            <StackItem>
                                <FormGroup label="Secondary Server">
                                    <TextInputGroup
                                        {...(validationErrors.secondaryDns
                                            ? { validated: ValidatedOptions.error }
                                            : model.networkAddress.ipv4.secondaryDns?.trim()
                                              ? { validated: ValidatedOptions.success }
                                              : {})}
                                    >
                                        <TextInputGroupMain
                                            id="secondary-dns-ipv4"
                                            value={model.networkAddress.ipv4.secondaryDns || ""}
                                            onChange={(_, value) => setSecondaryDns(value)}
                                            placeholder="8.8.4.4"
                                        />
                                    </TextInputGroup>
                                </FormGroup>
                            </StackItem>
                        </Stack>
                    )}
                </StackItem>
            )}
        </Stack>
    );
};

export const NetworkConfigIPv6: React.FunctionComponent<{ isSetupInterface?: boolean }> = ({
    isSetupInterface = false,
}) => {
    const { model, updateNestedModel } = useModelContext();

    // Validation state
    const [validationErrors, setValidationErrors] = React.useState({
        address: null as string | null,
        gateway: null as string | null,
        primaryDns: null as string | null,
        secondaryDns: null as string | null,
    });

    type Ping6Result = "available" | "conflict" | "error" | null;
    type Ping6GwResult = "reachable" | "unreachable" | "error" | null;

    const [ipCheckRunning, setIpCheckRunning] = React.useState(false);
    const [ipCheckResult, setIpCheckResult] = React.useState<Ping6Result>(null);
    const [gwCheckRunning, setGwCheckRunning] = React.useState(false);
    const [gwCheckResult, setGwCheckResult] = React.useState<Ping6GwResult>(null);

    const stripPrefix = (addr: string) => (addr.includes("/") ? addr.split("/")[0] : addr);

    const checkIpv6Availability = async () => {
        const address = model.networkAddress.ipv6.address;
        const interfaceName = model.networkInterface.selectedInterface;
        if (!address || !interfaceName) {
            return;
        }

        setIpCheckRunning(true);
        setIpCheckResult(null);

        const bare = stripPrefix(address);
        try {
            await cockpit.spawn(["ping", "-6", "-c", "2", "-W", "3", "-I", interfaceName, bare], { err: "message" });
            // exit 0 = reply received = address is already in use
            setIpCheckResult("conflict");
        } catch (err: unknown) {
            const cockpitErr = err as { exit_status?: number };
            if (cockpitErr.exit_status === 1) {
                setIpCheckResult("available");
            } else {
                setIpCheckResult("error");
            }
        } finally {
            setIpCheckRunning(false);
        }
    };

    const checkIpv6Gateway = async () => {
        const gateway = model.networkAddress.ipv6.gateway;
        const interfaceName = model.networkInterface.selectedInterface;
        if (!gateway || !interfaceName) {
            return;
        }

        setGwCheckRunning(true);
        setGwCheckResult(null);

        const target = gateway.toLowerCase().startsWith("fe80:") ? `${gateway}%${interfaceName}` : gateway;
        try {
            await cockpit.spawn(["ping", "-6", "-c", "2", "-W", "3", "-I", interfaceName, target], { err: "message" });
            setGwCheckResult("reachable");
        } catch (err: unknown) {
            const cockpitErr = err as { exit_status?: number };
            if (cockpitErr.exit_status === 1) {
                setGwCheckResult("unreachable");
            } else {
                setGwCheckResult("error");
            }
        } finally {
            setGwCheckRunning(false);
        }
    };

    const setIpv6Method = (method: "auto" | "dhcp" | "static" | "disabled") => {
        updateNestedModel("networkAddress", "ipv6", { method });
    };

    const setIpv6Address = (address: string) => {
        const error = validateIPv6(address, model.networkAddress.ipv6.method === "static");
        setValidationErrors((prev) => ({ ...prev, address: error }));
        setIpCheckResult(null);
        updateNestedModel("networkAddress", "ipv6", { address });
    };

    const handleIpv6AddressBlur = (address: string) => {
        if (address.trim() && !address.includes("/")) {
            const normalizedAddress = `${address}/64`;
            updateNestedModel("networkAddress", "ipv6", { address: normalizedAddress });
        }
    };

    const setGatewayIpv6 = (gateway: string) => {
        const formatError = validateIPv6Gateway(gateway);
        const subnetError =
            !formatError && gateway.trim() && model.networkAddress.ipv6.address
                ? validateIPv6GatewaySubnet(model.networkAddress.ipv6.address, gateway)
                : null;
        setValidationErrors((prev) => ({ ...prev, gateway: formatError || subnetError }));
        setGwCheckResult(null);
        updateNestedModel("networkAddress", "ipv6", { gateway });
    };

    const setAutoDnsIpv6 = (autoDns: boolean) => {
        updateNestedModel("networkAddress", "ipv6", { autoDns });
        // Clear DNS validation errors when switching to auto-DNS
        if (autoDns) {
            setValidationErrors((prev) => ({ ...prev, primaryDns: null, secondaryDns: null }));
        }
    };

    const setPrimaryDnsIpv6 = (primaryDns: string) => {
        const error = validateIP(primaryDns, !model.networkAddress.ipv6.autoDns);
        setValidationErrors((prev) => ({ ...prev, primaryDns: error }));
        updateNestedModel("networkAddress", "ipv6", { primaryDns });
    };

    const setSecondaryDnsIpv6 = (secondaryDns: string) => {
        const error = validateIP(secondaryDns, false);
        setValidationErrors((prev) => ({ ...prev, secondaryDns: error }));
        updateNestedModel("networkAddress", "ipv6", { secondaryDns });
    };

    return (
        <Stack hasGutter>
            <StackItem>
                <Flex>
                    <FlexItem>
                        <Radio
                            id="slaac-radio"
                            name="ipv6-method"
                            label="Automatic (SLAAC)"
                            isChecked={model.networkAddress.ipv6.method === "auto"}
                            onChange={() => setIpv6Method("auto")}
                        />
                    </FlexItem>
                    <FlexItem>
                        <Radio
                            id="dhcpv6-radio"
                            name="ipv6-method"
                            label="Stateful DHCPv6"
                            isChecked={model.networkAddress.ipv6.method === "dhcp"}
                            onChange={() => setIpv6Method("dhcp")}
                        />
                    </FlexItem>
                    <FlexItem>
                        <Radio
                            id="static-ipv6-radio"
                            name="ipv6-method"
                            label="Static IP"
                            isChecked={model.networkAddress.ipv6.method === "static"}
                            onChange={() => setIpv6Method("static")}
                        />
                    </FlexItem>
                    <FlexItem>
                        <Radio
                            id="disabled-ipv6-radio"
                            name="ipv6-method"
                            label="Disabled"
                            isChecked={model.networkAddress.ipv6.method === "disabled"}
                            onChange={() => setIpv6Method("disabled")}
                        />
                    </FlexItem>
                </Flex>
            </StackItem>
            {model.networkAddress.ipv6.method === "static" && (
                <StackItem>
                    <Stack hasGutter>
                        <StackItem>
                            <FormGroup label="IPv6 Address" isRequired>
                                <Flex alignItems={{ default: "alignItemsFlexStart" }}>
                                    <FlexItem grow={{ default: "grow" }}>
                                        <TextInputGroup
                                            validated={
                                                validationErrors.address
                                                    ? ValidatedOptions.error
                                                    : model.networkAddress.ipv6.address && !validationErrors.address
                                                      ? ValidatedOptions.success
                                                      : ValidatedOptions.warning
                                            }
                                        >
                                            <TextInputGroupMain
                                                id="ipv6-address"
                                                value={model.networkAddress.ipv6.address || ""}
                                                onChange={(_, value) => setIpv6Address(value)}
                                                onBlur={(e) => handleIpv6AddressBlur(e.currentTarget.value)}
                                                placeholder="2001:db8::1/64"
                                            />
                                        </TextInputGroup>
                                    </FlexItem>
                                    <FlexItem>
                                        {!isSetupInterface && (
                                            <Button
                                                variant="secondary"
                                                onClick={checkIpv6Availability}
                                                isDisabled={
                                                    ipCheckRunning ||
                                                    !model.networkAddress.ipv6.address ||
                                                    !!validationErrors.address ||
                                                    !model.networkInterface.selectedInterface
                                                }
                                                icon={ipCheckRunning ? <Spinner size="sm" /> : undefined}
                                            >
                                                {_("Check availability")}
                                            </Button>
                                        )}
                                    </FlexItem>
                                </Flex>
                                {ipCheckResult && (
                                    <FormHelperText>
                                        <HelperText>
                                            {ipCheckResult === "available" && (
                                                <HelperTextItem variant="success">
                                                    {_("IPv6 address appears to be available")}
                                                </HelperTextItem>
                                            )}
                                            {ipCheckResult === "conflict" && (
                                                <HelperTextItem variant="warning">
                                                    {_("This IPv6 address is already in use on the network")}
                                                </HelperTextItem>
                                            )}
                                            {ipCheckResult === "error" && (
                                                <HelperTextItem variant="indeterminate">
                                                    {_("Could not determine IPv6 address availability")}
                                                </HelperTextItem>
                                            )}
                                        </HelperText>
                                    </FormHelperText>
                                )}
                            </FormGroup>
                        </StackItem>
                        <StackItem>
                            <FormGroup label="Gateway IP">
                                <Flex alignItems={{ default: "alignItemsFlexStart" }}>
                                    <FlexItem grow={{ default: "grow" }}>
                                        <TextInputGroup
                                            {...(validationErrors.gateway
                                                ? { validated: ValidatedOptions.error }
                                                : model.networkAddress.ipv6.gateway?.trim()
                                                  ? { validated: ValidatedOptions.success }
                                                  : {})}
                                        >
                                            <TextInputGroupMain
                                                id="gateway-ipv6"
                                                value={model.networkAddress.ipv6.gateway || ""}
                                                onChange={(_, value) => setGatewayIpv6(value)}
                                                placeholder="2001:db8::1"
                                            />
                                        </TextInputGroup>
                                    </FlexItem>
                                    <FlexItem>
                                        {!isSetupInterface && (
                                            <Button
                                                variant="secondary"
                                                onClick={checkIpv6Gateway}
                                                isDisabled={
                                                    gwCheckRunning ||
                                                    !model.networkAddress.ipv6.gateway ||
                                                    !!validationErrors.gateway ||
                                                    !model.networkInterface.selectedInterface
                                                }
                                                icon={gwCheckRunning ? <Spinner size="sm" /> : undefined}
                                            >
                                                {_("Check gateway")}
                                            </Button>
                                        )}
                                    </FlexItem>
                                </Flex>
                                {validationErrors.gateway && (
                                    <FormHelperText>
                                        <HelperText>
                                            <HelperTextItem variant="error">{validationErrors.gateway}</HelperTextItem>
                                        </HelperText>
                                    </FormHelperText>
                                )}
                                {gwCheckResult && (
                                    <FormHelperText>
                                        <HelperText>
                                            {gwCheckResult === "reachable" && (
                                                <HelperTextItem variant="success">
                                                    {_("Gateway is reachable")}
                                                </HelperTextItem>
                                            )}
                                            {gwCheckResult === "unreachable" && (
                                                <HelperTextItem variant="warning">
                                                    {_(
                                                        "Gateway did not respond — verify the address and cable connection"
                                                    )}
                                                </HelperTextItem>
                                            )}
                                            {gwCheckResult === "error" && (
                                                <HelperTextItem variant="indeterminate">
                                                    {_("Could not check gateway reachability")}
                                                </HelperTextItem>
                                            )}
                                        </HelperText>
                                    </FormHelperText>
                                )}
                            </FormGroup>
                        </StackItem>
                    </Stack>
                </StackItem>
            )}
            {model.networkAddress.ipv6.method !== "disabled" && (
                <StackItem>
                    <Checkbox
                        id="auto-dns-ipv6"
                        label="Automatically configure DNS"
                        isChecked={model.networkAddress.ipv6.autoDns}
                        onChange={(_, checked) => setAutoDnsIpv6(checked)}
                    />
                    {!model.networkAddress.ipv6.autoDns && (
                        <Stack hasGutter style={{ marginTop: "1rem", marginLeft: "1.5rem" }}>
                            <StackItem>
                                <FormGroup label="Primary Server" isRequired>
                                    <TextInputGroup
                                        validated={
                                            validationErrors.primaryDns
                                                ? ValidatedOptions.error
                                                : model.networkAddress.ipv6.primaryDns && !validationErrors.primaryDns
                                                  ? ValidatedOptions.success
                                                  : ValidatedOptions.warning
                                        }
                                    >
                                        <TextInputGroupMain
                                            id="primary-dns-ipv6"
                                            value={model.networkAddress.ipv6.primaryDns || ""}
                                            onChange={(_, value) => setPrimaryDnsIpv6(value)}
                                            placeholder="2001:4860:4860::8888"
                                        />
                                    </TextInputGroup>
                                </FormGroup>
                            </StackItem>
                            <StackItem>
                                <FormGroup label="Secondary Server">
                                    <TextInputGroup
                                        {...(validationErrors.secondaryDns
                                            ? { validated: ValidatedOptions.error }
                                            : model.networkAddress.ipv6.secondaryDns?.trim()
                                              ? { validated: ValidatedOptions.success }
                                              : {})}
                                    >
                                        <TextInputGroupMain
                                            id="secondary-dns-ipv6"
                                            value={model.networkAddress.ipv6.secondaryDns || ""}
                                            onChange={(_, value) => setSecondaryDnsIpv6(value)}
                                            placeholder="2001:4860:4860::8844"
                                        />
                                    </TextInputGroup>
                                </FormGroup>
                            </StackItem>
                        </Stack>
                    )}
                </StackItem>
            )}
        </Stack>
    );
};
