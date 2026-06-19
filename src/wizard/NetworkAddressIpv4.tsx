import React from "react";
import cockpit from "cockpit";

import { Button } from "@patternfly/react-core/dist/esm/components/Button/index.js";
import { FormGroup, FormHelperText } from "@patternfly/react-core/dist/esm/components/Form/index.js";
import { Grid, GridItem, gridSpans } from "@patternfly/react-core/dist/esm/layouts/Grid/index.js";
import { HelperText, HelperTextItem } from "@patternfly/react-core/dist/esm/components/HelperText/index.js";
import { Spinner } from "@patternfly/react-core/dist/esm/components/Spinner/index.js";
import { Stack, StackItem } from "@patternfly/react-core/dist/esm/layouts/Stack/index.js";

import ValidatedTextInput from "../components/ValidatedTextInput";
import { useModelContext } from "../model-context";
import { SCRIPT_CHECK_NETWORK } from "../paths";
import { validateIPv4, validateIPv4GatewaySubnet, validateSubnetMask } from "../validation";

const _ = cockpit.gettext;

type ArpingResult = "conflict" | "available" | "error" | null;
type GatewayArpingResult = "reachable" | "unreachable" | "error" | null;

export const NetworkAddressIpv4 = ({ isSetupInterface = false }: { isSetupInterface?: boolean }) => {
    const { model, updateNestedModel } = useModelContext();

    const [validationErrors, setValidationErrors] = React.useState({
        address: null as string | null,
        subnetMask: null as string | null,
        gateway: null as string | null,
    });

    const [arpingRunning, setArpingRunning] = React.useState(false);
    const [arpingResult, setArpingResult] = React.useState<ArpingResult>(null);
    const [gatewayArpingRunning, setGatewayArpingRunning] = React.useState(false);
    const [gatewayArpingResult, setGatewayArpingResult] = React.useState<GatewayArpingResult>(null);

    const { gateway: ipv4Gateway, address: ipv4Address, subnetMask: ipv4SubnetMask } = model.networkAddress.ipv4;
    const selectedIfaceName = model.networkInterface.selectedInterface;

    console.log("%c model.networkAddress.ipv4", "color: red; font-size:18px", model.networkAddress.ipv4);

    const setIpv4Address = (address: string) => {
        const error = validateIPv4(address);
        setValidationErrors((prev) => ({ ...prev, address: error }));
        setArpingResult(null);
        updateNestedModel("networkAddress", "ipv4", { address });
    };

    const checkIpAvailability = async () => {
        const ipAddress = ipv4Address;
        if (!ipAddress || !selectedIfaceName) {
            return;
        }

        setArpingRunning(true);
        setArpingResult(null);

        try {
            await cockpit.spawn(["sudo", SCRIPT_CHECK_NETWORK, "check-ip", selectedIfaceName, ipAddress], {
                err: "message",
            });
            setArpingResult("available");
        } catch (err: unknown) {
            const cockpitErr = err as { exit_status?: number };
            if (cockpitErr.exit_status === 1) {
                setArpingResult("conflict");
            } else {
                setArpingResult("error");
            }
        } finally {
            setArpingRunning(false);
        }
    };

    const checkGatewayReachability = async () => {
        if (!ipv4Gateway || !selectedIfaceName) {
            return;
        }

        setGatewayArpingRunning(true);
        setGatewayArpingResult(null);

        try {
            await cockpit.spawn(["sudo", SCRIPT_CHECK_NETWORK, "check-gateway", selectedIfaceName, ipv4Gateway], {
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
        if (!error && ipv4Gateway && ipv4Address) {
            const gwError =
                validateIPv4(ipv4Gateway) || validateIPv4GatewaySubnet(ipv4Address, ipv4Gateway, subnetMask);
            setValidationErrors((prev) => ({ ...prev, gateway: gwError }));
        }
    };

    const setGatewayIp = (gateway: string) => {
        const formatError = validateIPv4(gateway);
        const subnetError =
            !formatError && ipv4Address && ipv4SubnetMask
                ? validateIPv4GatewaySubnet(ipv4Address, gateway, ipv4SubnetMask)
                : null;
        setValidationErrors((prev) => ({ ...prev, gateway: formatError || subnetError }));
        setGatewayArpingResult(null);
        updateNestedModel("networkAddress", "ipv4", { gateway });
    };

    const fieldColSpan = isSetupInterface ? 12 : (10 as gridSpans);
    const buttonColSpan = 2 as gridSpans;

    return (
        <Stack hasGutter>
            <StackItem>
                <FormGroup label={_("IPv4 Address")} isRequired>
                    <Grid hasGutter>
                        <GridItem md={fieldColSpan}>
                            <ValidatedTextInput
                                id="ipv4-address"
                                value={ipv4Address || ""}
                                error={validationErrors.address}
                                onChange={(_, value) => setIpv4Address(value)}
                                placeholder={_("e.g. 192.168.1.100")}
                            />
                        </GridItem>

                        {!isSetupInterface && (
                            <GridItem md={buttonColSpan}>
                                <Button
                                    variant="secondary"
                                    onClick={checkIpAvailability}
                                    isDisabled={
                                        arpingRunning ||
                                        !ipv4Address ||
                                        !!validationErrors.address ||
                                        !selectedIfaceName
                                    }
                                    icon={arpingRunning ? <Spinner size="sm" /> : undefined}
                                >
                                    {_("Check availability")}
                                </Button>
                            </GridItem>
                        )}
                    </Grid>

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
                    <Grid hasGutter>
                        <GridItem md={fieldColSpan}>
                            <ValidatedTextInput
                                id="subnet-mask"
                                value={ipv4SubnetMask || ""}
                                error={validationErrors.subnetMask}
                                onChange={(_, value) => setSubnetMask(value)}
                                placeholder={_("e.g. 255.255.255.0 or /24")}
                            />
                        </GridItem>
                    </Grid>
                </FormGroup>
            </StackItem>
            <StackItem>
                <FormGroup label={_("Gateway IP")} isRequired>
                    <Grid hasGutter>
                        <GridItem span={fieldColSpan}>
                            <ValidatedTextInput
                                id="gateway-ip"
                                value={ipv4Gateway || ""}
                                error={validationErrors.gateway}
                                onChange={(_, value) => setGatewayIp(value)}
                                placeholder={_("e.g. 192.168.1.1")}
                            />
                        </GridItem>
                        {!isSetupInterface && (
                            <GridItem md={buttonColSpan}>
                                <Button
                                    variant="secondary"
                                    onClick={checkGatewayReachability}
                                    isDisabled={
                                        gatewayArpingRunning ||
                                        !ipv4Gateway ||
                                        !!validationErrors.gateway ||
                                        !selectedIfaceName
                                    }
                                    icon={gatewayArpingRunning ? <Spinner size="sm" /> : undefined}
                                >
                                    {_("Check gateway")}
                                </Button>
                            </GridItem>
                        )}
                    </Grid>

                    {gatewayArpingResult && (
                        <FormHelperText>
                            <HelperText>
                                {gatewayArpingResult === "reachable" && (
                                    <HelperTextItem variant="success">{_("Gateway is reachable")}</HelperTextItem>
                                )}
                                {gatewayArpingResult === "unreachable" && (
                                    <HelperTextItem variant="warning">
                                        {_("Gateway did not respond — verify the address and cable connection")}
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
    );
};
