import React from "react";
import cockpit from "cockpit";

import { Button } from "@patternfly/react-core/dist/esm/components/Button/index.js";
import { FormGroup, FormHelperText } from "@patternfly/react-core/dist/esm/components/Form/index.js";
import { HelperText, HelperTextItem } from "@patternfly/react-core/dist/esm/components/HelperText/index.js";
import { Spinner } from "@patternfly/react-core/dist/esm/components/Spinner/index.js";
import { Flex, FlexItem } from "@patternfly/react-core/dist/esm/layouts/Flex/index.js";
import { Stack, StackItem } from "@patternfly/react-core/dist/esm/layouts/Stack/index.js";
import { TextInputGroupMain } from "@patternfly/react-core/dist/esm/components/TextInputGroup/index.js";

import ValidatedTextInputGroup from "../components/ValidatedTextInputGroup";
import { ErrorHelperText } from "../components/HelperTexts";
import { useModelContext } from "../model-context";
import { validateIPv6, validateIPv6Gateway, validateIPv6GatewaySubnet } from "../validation";

const _ = cockpit.gettext;

type Ping6Result = "available" | "conflict" | "error" | null;
type Ping6GwResult = "reachable" | "unreachable" | "error" | null;

export const NetworkAddressIpv6 = ({ isSetupInterface = false }: { isSetupInterface?: boolean }) => {
    const { model, updateNestedModel } = useModelContext();

    const [validationErrors, setValidationErrors] = React.useState({
        address: null as string | null,
        gateway: null as string | null,
    });

    const [ipCheckRunning, setIpCheckRunning] = React.useState(false);
    const [ipCheckResult, setIpCheckResult] = React.useState<Ping6Result>(null);
    const [gwCheckRunning, setGwCheckRunning] = React.useState(false);
    const [gwCheckResult, setGwCheckResult] = React.useState<Ping6GwResult>(null);

    const { address: ipv6Address, gateway: ipv6Gateway } = model.networkAddress.ipv6;
    const selectedIfaceName = model.networkInterface.selectedInterface;

    const stripPrefix = (addr: string) => (addr.includes("/") ? addr.split("/")[0] : addr);

    const checkIpv6Availability = async () => {
        if (!ipv6Address || !selectedIfaceName) {
            return;
        }

        setIpCheckRunning(true);
        setIpCheckResult(null);

        const bare = stripPrefix(ipv6Address);
        try {
            await cockpit.spawn(["ping", "-6", "-c", "2", "-W", "3", "-I", selectedIfaceName, bare], { err: "message" });
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
        if (!ipv6Gateway || !selectedIfaceName) {
            return;
        }

        setGwCheckRunning(true);
        setGwCheckResult(null);

        const target = ipv6Gateway.toLowerCase().startsWith("fe80:") ? `${ipv6Gateway}%${selectedIfaceName}` : ipv6Gateway;
        try {
            await cockpit.spawn(["ping", "-6", "-c", "2", "-W", "3", "-I", selectedIfaceName, target], { err: "message" });
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
            !formatError && gateway.trim() && ipv6Address
                ? validateIPv6GatewaySubnet(ipv6Address, gateway)
                : null;
        setValidationErrors((prev) => ({ ...prev, gateway: formatError || subnetError }));
        setGwCheckResult(null);
        updateNestedModel("networkAddress", "ipv6", { gateway });
    };

    return (
        <Stack hasGutter>
            <StackItem>
                <FormGroup label={_("IPv6 Address")} isRequired>
                    <Flex alignItems={{ default: "alignItemsFlexStart" }}>
                        <FlexItem grow={{ default: "grow" }}>
                            <ValidatedTextInputGroup
                                value={ipv6Address}
                                error={validationErrors.address}
                                warnWhenEmpty
                            >
                                <TextInputGroupMain
                                    id="ipv6-address"
                                    value={ipv6Address || ""}
                                    onChange={(_, value) => setIpv6Address(value)}
                                    onBlur={(e) => handleIpv6AddressBlur(e.currentTarget.value)}
                                    placeholder={_("e.g. 2001:db8::1/64")}
                                />
                            </ValidatedTextInputGroup>
                        </FlexItem>
                        <FlexItem>
                            {!isSetupInterface && (
                                <Button
                                    variant="secondary"
                                    onClick={checkIpv6Availability}
                                    isDisabled={
                                        ipCheckRunning ||
                                        !ipv6Address ||
                                        !!validationErrors.address ||
                                        !selectedIfaceName
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
                <FormGroup label={_("Gateway IP")}>
                    <Flex alignItems={{ default: "alignItemsFlexStart" }}>
                        <FlexItem grow={{ default: "grow" }}>
                            <ValidatedTextInputGroup
                                value={ipv6Gateway}
                                error={validationErrors.gateway}
                            >
                                <TextInputGroupMain
                                    id="gateway-ipv6"
                                    value={ipv6Gateway || ""}
                                    onChange={(_, value) => setGatewayIpv6(value)}
                                    placeholder={_("e.g. 2001:db8::1")}
                                />
                            </ValidatedTextInputGroup>
                        </FlexItem>
                        <FlexItem>
                            {!isSetupInterface && (
                                <Button
                                    variant="secondary"
                                    onClick={checkIpv6Gateway}
                                    isDisabled={
                                        gwCheckRunning ||
                                        !ipv6Gateway ||
                                        !!validationErrors.gateway ||
                                        !selectedIfaceName
                                    }
                                    icon={gwCheckRunning ? <Spinner size="sm" /> : undefined}
                                >
                                    {_("Check gateway")}
                                </Button>
                            )}
                        </FlexItem>
                    </Flex>
                    <ErrorHelperText error={validationErrors.gateway} />

                    {gwCheckResult && (
                        <FormHelperText>
                            <HelperText>
                                {gwCheckResult === "reachable" && (
                                    <HelperTextItem variant="success">{_("Gateway is reachable")}</HelperTextItem>
                                )}
                                {gwCheckResult === "unreachable" && (
                                    <HelperTextItem variant="warning">
                                        {_("Gateway did not respond — verify the address and cable connection")}
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
    );
};
